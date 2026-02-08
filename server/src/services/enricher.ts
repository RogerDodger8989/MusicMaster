import { getDatabase } from '../database'
import { lastFmService } from './lastfm'
import { musicBrainzService } from './musicbrainz'
import { acousticBrainzService } from './acousticbrainz'
import {
    upsertArtistWithMBID,
    upsertAlbumWithMBID,
    addTrackArtist,
    storeAcousticBrainzData,
    addPerformer,
    addAlbumCredit
} from '../database/musicbrainz'

export class BackgroundEnricher {
    private isRunning = false
    private interval: NodeJS.Timeout | null = null

    start(intervalMs: number = 60000) { // Default 1 minute
        if (this.isRunning) return
        this.isRunning = true
        console.log('🤖 Background Enricher started')

        this.enrichNextBatch()
        this.interval = setInterval(() => this.enrichNextBatch(), intervalMs)
    }

    stop() {
        if (this.interval) clearInterval(this.interval)
        this.isRunning = false
        console.log('🤖 Background Enricher stopped')
    }

    private async enrichNextBatch() {
        try {
            const db = getDatabase()

            // 1. Find an album with an MBID that hasn't been enriched recently
            // We'll use the 'updated_at' on the albums table or a new 'enriched_at'
            const album = db.prepare(`
                SELECT id, name, artist, musicbrainz_album_id as mbid
                FROM albums_cache
                WHERE musicbrainz_album_id IS NOT NULL 
                AND (enriched_at IS NULL OR enriched_at < datetime('now', '-30 days'))
                LIMIT 1
            `).get() as { id: string, name: string, artist: string, mbid: string } | undefined

            if (!album) return

            console.log(`🤖 Enriching album: ${album.name} by ${album.artist}`)

            // 2. Fetch full release details from MusicBrainz
            const release = await musicBrainzService.getReleaseDetails(album.mbid)
            if (!release) {
                this.markAsFailed(album.id)
                return
            }

            // 3. Save release info (Label, Country, etc.)
            const label = release['label-info']?.[0]?.label?.name
            const catalogNumber = release['label-info']?.[0]?.['catalog-number']

            upsertAlbumWithMBID(
                album.name,
                null, // Artist ID handled separately or kept
                album.mbid,
                release['release-group']?.['primary-type'],
                release.date,
                release.barcode,
                release.status,
                release.packaging,
                release.media?.length || 1,
                release['release-group']?.id,
                release.title,
                label,
                catalogNumber
            )

            // 4. Save Album-level credits
            const albumRoles = musicBrainzService.extractRoles(release)
            for (const [role, artists] of Object.entries(albumRoles)) {
                for (const artistInfo of artists) {
                    const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || '')

                    // Fetch artist image if missing
                    const dbArtist = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(artistId) as { image_path: string | null }
                    if (!dbArtist?.image_path) {
                        try {
                            const info = await lastFmService.getArtistInfo(artistInfo.name)
                            if (info?.image) {
                                const imageUrl = lastFmService.getBestImage(info.image)
                                if (imageUrl) {
                                    const filename = `artist_${artistId}.jpg`
                                    const localPath = await lastFmService.downloadImage(imageUrl, filename)
                                    if (localPath) {
                                        db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(localPath, artistId)
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn(`[Enricher] Failed to fetch image for ${artistInfo.name}:`, e)
                        }
                    }

                    addAlbumCredit(album.id, artistId, role)
                }
            }

            // 5. Process Track-level enrichments (Performers, AcousticBrainz)
            const tracks = db.prepare('SELECT id, title, musicbrainz_track_id as mbid FROM tracks WHERE album = ? AND (album_artist = ? OR artist = ?)')
                .all(album.name, album.artist, album.artist) as { id: string, title: string, mbid: string }[]

            // Build a map of track titles to recording MBIDs from the release details
            const normalize = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim()
            const mbTrackMap = new Map<string, string>()
            for (const media of release.media || []) {
                for (const mbTrack of media.tracks || []) {
                    if (mbTrack.recording?.id) {
                        mbTrackMap.set(normalize(mbTrack.title), mbTrack.recording.id)
                    }
                }
            }

            for (const track of tracks) {
                let trackMbid = track.mbid

                // Auto-correct MBID if it matches album MBID or is missing
                if (!trackMbid || trackMbid === album.mbid) {
                    const normalizedTitle = normalize(track.title)
                    const correctedMbid = mbTrackMap.get(normalizedTitle)
                    if (correctedMbid) {
                        console.log(`🤖 Auto-corrected MBID for track "${track.title}" (${normalizedTitle}): ${correctedMbid}`)
                        db.prepare('UPDATE tracks SET musicbrainz_track_id = ? WHERE id = ?').run(correctedMbid, track.id)
                        trackMbid = correctedMbid
                    }
                }

                if (!trackMbid) continue

                // Fetch Recording Details for Performers
                const recording = await musicBrainzService.getRecordingDetails(track.mbid)
                if (recording) {
                    const roles = musicBrainzService.extractRoles(recording)
                    for (const [role, artists] of Object.entries(roles)) {
                        for (const artistInfo of artists) {
                            const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || '')

                            // Download image if still missing
                            const dbArtist = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(artistId) as { image_path: string | null }
                            if (!dbArtist?.image_path) {
                                try {
                                    const info = await lastFmService.getArtistInfo(artistInfo.name)
                                    if (info?.image) {
                                        const imageUrl = lastFmService.getBestImage(info.image)
                                        if (imageUrl) {
                                            const filename = `artist_${artistId}.jpg`
                                            const localPath = await lastFmService.downloadImage(imageUrl, filename)
                                            if (localPath) {
                                                db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(localPath, artistId)
                                            }
                                        }
                                    }
                                } catch (e) { }
                            }

                            addPerformer(track.id, artistId, role)
                        }
                    }
                }

                // Fetch AcousticBrainz (Mood/BPM)
                const analysis = await acousticBrainzService.getRecordingAnalysis(track.mbid)
                if (analysis) {
                    storeAcousticBrainzData(track.id, {
                        mbid: track.mbid,
                        bpm: analysis.lowLevel?.bpm,
                        bpm_confidence: analysis.lowLevel?.bpm_confidence,
                        key: analysis.lowLevel ? `${analysis.lowLevel.key_key} ${analysis.lowLevel.key_scale}` : undefined,
                        key_confidence: analysis.lowLevel?.key_confidence,
                        mood_acoustic: analysis.highlevel?.mood_acoustic?.acoustic,
                        mood_aggressive: analysis.highlevel?.mood_aggressive?.aggressive,
                        mood_electronic: analysis.highlevel?.mood_electronic?.electronic,
                        mood_happy: analysis.highlevel?.mood_happy?.happy,
                        mood_sad: analysis.highlevel?.mood_sad?.sad,
                        mood_relaxed: analysis.highlevel?.mood_relaxed?.relaxed,
                        mood_party: analysis.highlevel?.mood_party?.party,
                    })
                }
            }

            // 6. Mark as enriched
            db.prepare("UPDATE albums_cache SET enriched_at = CURRENT_TIMESTAMP WHERE id = ?").run(album.id)
            console.log(`✅ Enrichment complete for ${album.name}`)

        } catch (error) {
            console.error('❌ Background enrichment failed:', error)
        }
    }

    private markAsFailed(albumId: string) {
        const db = getDatabase()
        db.prepare("UPDATE albums_cache SET enriched_at = datetime('now') WHERE id = ?").run(albumId)
    }
}

export const backgroundEnricher = new BackgroundEnricher()
