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
            // Process Artists first (prioritize missing bio/images)
            await this.enrichArtists()

            // Process Tracks (missing tempo/mood)
            await this.enrichTracks()
        } catch (error) {
            console.error('❌ Background enrichment failed:', error)
        }
    }

    private async enrichArtists(force: boolean = false) {
        const db = getDatabase()
        const query = force
            ? `SELECT id, name, musicbrainz_artistid FROM artists`
            : `SELECT id, name, musicbrainz_artistid
               FROM artists
               WHERE (image_path IS NULL OR bio IS NULL OR bio = '')
               ORDER BY last_enrich_attempt ASC NULLS FIRST
               LIMIT 20`

        const artists = db.prepare(query).all() as { id: string, name: string, musicbrainz_artistid: string | null }[]

        if (artists.length === 0) return

        console.log(`🤖 Enriching metadata for ${artists.length} artists...`)

        for (const artist of artists) {
            await this.enrichArtistById(artist.id, artist.name, force)
        }
    }

    public async enrichArtistById(artistId: string, artistName: string, force: boolean = false) {
        const db = getDatabase()
        // Mark attempt immediately to prevent infinite loop on failures
        db.prepare('UPDATE artists SET last_enrich_attempt = CURRENT_TIMESTAMP WHERE id = ?').run(artistId)

        try {
            console.log(`🤖 Enriching artist: ${artistName} (force: ${force})`)

            // Fetch Last.fm info for bio
            const info = await lastFmService.getArtistInfo(artistName)

            if (info) {
                // Update bio
                if (info.bio?.content && (force || !(db.prepare('SELECT bio FROM artists WHERE id = ?').get(artistId) as any)?.bio)) {
                    db.prepare('UPDATE artists SET bio = ? WHERE id = ?').run(info.bio.content, artistId)
                    console.log(`✅ Saved bio for ${artistName}`)
                }
            }

            // Handle image separately with multiple sources
            const dbArtist = db.prepare('SELECT image_path, image_verified FROM artists WHERE id = ?').get(artistId) as { image_path: string | null, image_verified: number }

            if (dbArtist?.image_verified && !force) {
                console.log(`🤖 [Enricher] Artist ${artistName} has verified image lock. Skipping image fetch.`)
            } else if (force || !dbArtist?.image_path) {
                let imageUrl: string | null = null
                let source = ''

                // Try 1: Spotify (Highest quality)
                try {
                    const { spotifyService } = await import('./spotify')
                    imageUrl = await spotifyService.getArtistImage(artistName)
                    if (imageUrl) source = 'Spotify'
                } catch (e) {
                    console.warn(`[Enricher] Spotify lookup failed for ${artistName}`)
                }

                // Try 2: Last.fm (if Spotify failed)
                if (!imageUrl && info?.image) {
                    imageUrl = lastFmService.getBestImage(info.image)
                    if (imageUrl) source = 'Last.fm'
                }

                // Try 3: Deezer (last resort)
                if (!imageUrl) {
                    try {
                        imageUrl = await lastFmService.getDeezerArtistImage(artistName)
                        if (imageUrl) source = 'Deezer'
                    } catch (e) {
                        console.warn(`[Enricher] Deezer lookup failed for ${artistName}`)
                    }
                }

                // Download and save image
                if (imageUrl) {
                    const filename = `artist_${artistId}.jpg`
                    const localPath = await lastFmService.downloadImage(imageUrl, filename)
                    if (localPath) {
                        db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(localPath, artistId)
                        console.log(`✅ Saved image for ${artistName} (source: ${source})`)
                    } else {
                        console.warn(`⚠️ Failed to download image for ${artistName} from ${source}`)
                    }
                } else {
                    console.warn(`⚠️ No image found for ${artistName} from any source`)
                }
            }
        } catch (e) {
            console.warn(`[Enricher] Failed to enrich artist ${artistName}:`, e)
        }
    }

    private markAsFailed(albumId: string) {
        const db = getDatabase()
        db.prepare("UPDATE albums_cache SET enriched_at = datetime('now') WHERE id = ?").run(albumId)
    }

    private async enrichTracks() {
        const db = getDatabase()

        // Find up to 20 tracks missing tempo/mood that haven't been checked recently
        // We use the custom20 field as a temporary 'last_spotify_attempt' tracker if needed,
        // but for now we'll just set 'unknown' on failure to avoid infinite loops
        const query = `
            SELECT id, title, artist 
            FROM tracks 
            WHERE (tempo IS NULL OR mood IS NULL)
            AND tempo != 'unknown' AND mood != 'unknown'
            LIMIT 20
        `

        const tracks = db.prepare(query).all() as { id: string, title: string, artist: string }[]

        if (tracks.length === 0) return

        console.log(`🤖 Enriching audio features for ${tracks.length} tracks from Spotify...`)

        const { spotifyService } = await import('./spotify')

        for (const track of tracks) {
            try {
                // If title or artist is literally "unknown", skip and mark as unknown
                if (!track.title || !track.artist || track.artist.toLowerCase() === 'unknown artist') {
                    db.prepare("UPDATE tracks SET tempo = 'unknown', mood = 'unknown' WHERE id = ?").run(track.id)
                    continue
                }

                const features = await spotifyService.getTrackAudioFeatures(track.title, track.artist)

                if (features) {
                    db.prepare(`UPDATE tracks SET tempo = ?, mood = ? WHERE id = ?`)
                        .run(features.tempo, features.mood, track.id)
                    console.log(`✅ Saved Spotify features for "${track.title}": Tempo ${features.tempo}, Mood ${features.mood}`)
                } else {
                    // Mark as unknown so we don't spam Spotify over and over
                    db.prepare("UPDATE tracks SET tempo = 'unknown', mood = 'unknown' WHERE id = ?").run(track.id)
                    console.log(`⚠️ No Spotify features found for "${track.title}", marked as unknown`)
                }
            } catch (e) {
                console.warn(`[Enricher] Failed to enrich track ${track.title}:`, e)
            }
        }
    }
}

export const backgroundEnricher = new BackgroundEnricher()
