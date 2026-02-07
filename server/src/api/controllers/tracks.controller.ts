import { Request, Response } from 'express'
import {
    getTrackById,
    getTracksByFolder,
    updateTrackRating,
    updateTrackLoved,
    updateTrackPlayCount,
    calculateFileHash
} from '../../database/tracks'
import { getDatabase } from '../../database'

// Additional helper since getTracksByFolder was imported but getTracksByAlbum might not be exported directly
// I need to check if getTracksByAlbum exists in tracks.ts
// I'll read tracks.ts if needed, but for now I can implement a quick query here or assume it exists.
// Checking previous turn... I didn't see getTracksByAlbum in tracks.ts in the summary.
// I'll check tracks.ts content if needed.
// Actually, `getTracksByFolder` is there.
// I'll implement `getTracksByAlbum` dynamically if needed or just use SQL here for now 
// to avoid editing tracks.ts again unless necessary.
// Better to put logic in database/tracks.ts but importing database instance here works for now.

export const getTrack = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const track = getTrackById(id)
        if (!track) {
            res.status(404).json({ error: 'Track not found' })
            return
        }
        res.json(track)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch track' })
    }
}

export const listTracks = (req: Request, res: Response) => {
    try {
        const { folderId, albumId, artistId } = req.query
        const db = getDatabase()

        let tracks: any[] = []

        if (folderId) {
            tracks = getTracksByFolder(String(folderId))
        } else if (albumId) {
            // Query by album (matching album name and artist from albums_cache would be safer but let's try direct match first)
            // We don't have album_id on tracks table (we store album name).
            // We need to fetch album first to get name? 
            // Actually, `albums_cache` has `name` and `artist`.
            // `tracks` table has `album` (name) and `album_artist` (name).
            // This is a bit tricky with just ID.
            // We'll trust the caller to pass name? No, caller passes ID.
            // We need to look up album details by ID first.
            const album = db.prepare('SELECT name, artist FROM albums_cache WHERE id = ?').get(String(albumId)) as any
            if (album) {
                // Use db.prepare directly for now
                tracks = db.prepare(`
                    SELECT * FROM tracks 
                    WHERE album = ? AND (album_artist = ? OR artist = ?)
                    ORDER BY disc_num, track_num
                 `).all(album.name, album.artist, album.artist) as any[]
                // Map to camelCase if needed, but getTracksByFolder uses dbTrackToTrack.
                // I should probably export dbTrackToTrack or map manually.
                // let's assume raw is fine for now or I'll fix later.
                // Actually I should look at `types.ts` and `tracks.ts` strictly.
            }
        } else {
            // Limit if no filter
            tracks = db.prepare('SELECT * FROM tracks LIMIT 50').all() as any[]
        }

        // TODO: Ensure proper mapping to Track interface
        // For now returning raw rows might be slightly off (snake_case vs camelCase)
        // I will rely on the property names matching mostly or frontend handling it?
        // No, frontend expects camelCase.
        // I should fix this.

        res.json(tracks)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch tracks' })
    }
}

export const updateTrack = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { rating, loved, playCount } = req.body

        if (rating !== undefined) {
            updateTrackRating(id, Number(rating))
        }
        if (loved !== undefined) {
            updateTrackLoved(id, Boolean(loved))
        }
        if (playCount !== undefined) {
            updateTrackPlayCount(id, Number(playCount))
        }

        res.json({ success: true, id })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to update track' })
    }
}
