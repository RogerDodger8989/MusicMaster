import { Request, Response } from 'express'
import {
    getAllAlbums,
    getAlbumById,
    getAlbumsByGenre,
    getAlbumsSortedBy,
    updateAlbumRating,
    updateAlbumLoved,
    getAllGenres
} from '../../database/albums'
import { getAlbumPerformers as fetchMBPerformers } from '../../database/musicbrainz'

export const getAlbumPerformers = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const performers = fetchMBPerformers(id)
        res.json(performers)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch album performers' })
    }
}

export const listAlbums = (req: Request, res: Response) => {
    try {
        const { sort, genre } = req.query

        if (sort) {
            const albums = getAlbumsSortedBy(String(sort) as any)
            res.json(albums)
        } else if (genre) {
            const albums = getAlbumsByGenre(String(genre))
            res.json(albums)
        } else {
            const albums = getAllAlbums()
            res.json(albums)
        }
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch albums' })
    }
}

export const getAlbum = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const album = getAlbumById(id)
        if (!album) {
            res.status(404).json({ error: 'Album not found' })
            return
        }
        res.json(album)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch album' })
    }
}

export const getGenres = (req: Request, res: Response) => {
    try {
        const genres = getAllGenres()
        res.json(genres)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch genres' })
    }
}

export const updateAlbum = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { rating, loved } = req.body

        if (rating !== undefined) {
            updateAlbumRating(id, Number(rating))
        }

        if (loved !== undefined) {
            updateAlbumLoved(id, Boolean(loved))
        }

        res.json({ success: true, id })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to update album' })
    }
}
export const rateAlbum = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { rating } = req.body

        if (rating === undefined) {
            return res.status(400).json({ error: 'Rating is required' })
        }

        updateAlbumRating(id, Number(rating))
        res.json({ success: true, id, rating })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to rate album' })
    }
}

export const toggleAlbumLoved = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { loved } = req.body

        if (loved === undefined) {
            return res.status(400).json({ error: 'Loved status is required' })
        }

        updateAlbumLoved(id, Boolean(loved))
        res.json({ success: true, id, loved })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to love album' })
    }
}
