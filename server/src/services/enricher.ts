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

            // 1. Process Artists first (prioritize missing bio/images)
            await this.enrichArtists()

            // 2. Find an album with an MBID that hasn't been enriched recently
            const album = db.prepare(`
                SELECT id, name, artist, musicbrainz_album_id as mbid
                FROM albums_cache
                WHERE musicbrainz_album_id IS NOT NULL 
                AND (enriched_at IS NULL OR enriched_at < datetime('now', '-30 days'))
                LIMIT 1
            `).get() as { id: string, name: string, artist: string, mbid: string } | undefined

            if (!album) return
            // ... (existing codes etc) ...
        } catch (error) {
            console.error('❌ Background enrichment failed:', error)
        }
    }

    private async enrichArtists() {
        const db = getDatabase()
        const artists = db.prepare(`
            SELECT id, name, musicbrainz_artist_id
            FROM artists
            WHERE (image_path IS NULL OR bio IS NULL)
            LIMIT 5
        `).all() as { id: string, name: string, musicbrainz_artist_id: string | null }[]

        if (artists.length === 0) return

        console.log(`🤖 Enriching metadata for ${artists.length} artists...`)

        for (const artist of artists) {
            try {
                console.log(`🤖 Enriching artist: ${artist.name}`)
                const info = await lastFmService.getArtistInfo(artist.name)

                if (info) {
                    // Update bio
                    if (info.bio?.content) {
                        db.prepare('UPDATE artists SET bio = ? WHERE id = ?').run(info.bio.content, artist.id)
                        console.log(`✅ Saved bio for ${artist.name}`)
                    }

                    // Update image if missing
                    const dbArtist = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(artist.id) as { image_path: string | null }
                    if (!dbArtist?.image_path && info.image) {
                        const imageUrl = lastFmService.getBestImage(info.image)
                        if (imageUrl) {
                            const filename = `artist_${artist.id}.jpg`
                            const localPath = await lastFmService.downloadImage(imageUrl, filename)
                            if (localPath) {
                                db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(localPath, artist.id)
                                console.log(`✅ Saved image for ${artist.name}`)
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[Enricher] Failed to enrich artist ${artist.name}:`, e)
            }
        }
    }

    private markAsFailed(albumId: string) {
        const db = getDatabase()
        db.prepare("UPDATE albums_cache SET enriched_at = datetime('now') WHERE id = ?").run(albumId)
    }
}

export const backgroundEnricher = new BackgroundEnricher()
