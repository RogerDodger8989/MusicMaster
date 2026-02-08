import { Request, Response } from 'express'
import { getDatabase } from '../../database/index'

export const getStats = async (_req: Request, res: Response) => {
    try {
        const db = getDatabase()
        const tracks = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number }
        const albums = db.prepare('SELECT COUNT(*) as count FROM albums').get() as { count: number }
        const artists = db.prepare('SELECT COUNT(*) as count FROM artists').get() as { count: number }

        res.json({
            tracks: tracks.count,
            albums: albums.count,
            artists: artists.count
        })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}
