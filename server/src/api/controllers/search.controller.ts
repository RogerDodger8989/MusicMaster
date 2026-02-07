import { Request, Response } from 'express'
import { searchLibrary } from '../../database/search'

export const search = (req: Request, res: Response) => {
    try {
        const { q } = req.query
        if (!q || typeof q !== 'string') {
            res.json({ artists: [], albums: [], tracks: [], playlists: [] })
            return
        }

        const results = searchLibrary(q)
        res.json(results)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Search failed' })
    }
}
