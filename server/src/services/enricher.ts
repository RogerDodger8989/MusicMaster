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
        } catch (error) {
            console.error('❌ Background enrichment failed:', error)
        }
    }

    private async enrichArtists() {
        const db = getDatabase()
        const artists = db.prepare(`
            SELECT id, name, musicbrainz_artistid
            FROM artists
            WHERE (image_path IS NULL OR bio IS NULL OR bio = '')
            ORDER BY last_enrich_attempt ASC NULLS FIRST
            LIMIT 20
        `).all() as { id: string, name: string, musicbrainz_artistid: string | null }[]

        if (artists.length === 0) return

        console.log(`🤖 Enriching metadata for ${artists.length} artists...`)

        for (const artist of artists) {
            await this.enrichArtistById(artist.id, artist.name)
        }
    }

    public async enrichArtistById(artistId: string, artistName: string) {
        const db = getDatabase()
        // Mark attempt immediately to prevent infinite loop on failures
        db.prepare('UPDATE artists SET last_enrich_attempt = CURRENT_TIMESTAMP WHERE id = ?').run(artistId)

        try {
            console.log(`🤖 Enriching artist: ${artistName}`)

            // Fetch Last.fm info for bio
            const info = await lastFmService.getArtistInfo(artistName)

            if (info) {
                // Update bio
                if (info.bio?.content) {
                    db.prepare('UPDATE artists SET bio = ? WHERE id = ?').run(info.bio.content, artistId)
                    console.log(`✅ Saved bio for ${artistName}`)
                }
            }

            // Handle image separately with multiple sources
            const dbArtist = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(artistId) as { image_path: string | null }
            if (!dbArtist?.image_path) {
                let imageUrl: string | null = null
                let source = ''

                // Try 1: Last.fm
                if (info?.image) {
                    imageUrl = lastFmService.getBestImage(info.image)
                    if (imageUrl) source = 'Last.fm'
                }

                // Try 2: Spotify (if Last.fm failed)
                if (!imageUrl) {
                    try {
                        const { spotifyService } = await import('./spotify')
                        imageUrl = await spotifyService.getArtistImage(artistName)
                        if (imageUrl) source = 'Spotify'
                    } catch (e) {
                        console.warn(`[Enricher] Spotify lookup failed for ${artistName}`)
                    }
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
}

export const backgroundEnricher = new BackgroundEnricher()
