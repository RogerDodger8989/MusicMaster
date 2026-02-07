import { Request, Response } from 'express'
import {
    getTrackById,
    getTracksByFolder,
    updateTrackRating,
    updateTrackLoved,
    updateTrackPlayCount,
    calculateFileHash,
    dbTrackToTrack
} from '../../database/tracks'
import { getDatabase } from '../../database'
import { writeMusicBrainzDataToFile } from '../../services/metadataWriter'

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
            const album = db.prepare('SELECT name, artist FROM albums_cache WHERE id = ?').get(String(albumId)) as any
            if (album) {
                const rows = db.prepare(`
                    SELECT * FROM tracks 
                    WHERE album = ? AND (album_artist = ? OR artist = ?)
                    ORDER BY disc_num, track_num
                 `).all(album.name, album.artist, album.artist) as any[]
                tracks = rows.map(dbTrackToTrack)
            }
        } else {
            const rows = db.prepare('SELECT * FROM tracks LIMIT 50').all() as any[]
            tracks = rows.map(dbTrackToTrack)
        }

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
export const rateTrack = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { rating } = req.body

        if (rating === undefined) {
            return res.status(400).json({ error: 'Rating is required' })
        }

        updateTrackRating(id, Number(rating))

        // Trigger file write
        const db = getDatabase()
        await writeMusicBrainzDataToFile(db, id)

        res.json({ success: true, id, rating })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to rate track' })
    }
}

export const loveTrack = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { loved } = req.body

        if (loved === undefined) {
            return res.status(400).json({ error: 'Loved status is required' })
        }

        updateTrackLoved(id, Boolean(loved))

        // Trigger file write
        const db = getDatabase()
        await writeMusicBrainzDataToFile(db, id)

        res.json({ success: true, id, loved })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to love track' })
    }
}
