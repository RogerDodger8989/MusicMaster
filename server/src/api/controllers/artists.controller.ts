import { Request, Response } from 'express'
import { getAllArtists, getArtistById, updateArtist } from '../../database/artists'

export const listArtists = (req: Request, res: Response) => {
    try {
        const artists = getAllArtists()
        res.json(artists)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch artists' })
    }
}

export const getArtist = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const artist = getArtistById(id)
        if (!artist) {
            res.status(404).json({ error: 'Artist not found' })
            return
        }
        res.json(artist)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch artist' })
    }
}

export const updateArtistDetails = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const updates = req.body

        updateArtist(id, updates)
        res.json({ success: true, id })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to update artist' })
    }
}

export const getSimilarArtists = async (req: Request, res: Response) => {
    try {
        const { lastFmService } = await import('../../services/lastfm')
        const artistName = req.query.name as string

        if (!artistName) {
            res.status(400).json({ error: 'Artist name is required' })
            return
        }

        const similar = await lastFmService.getSimilarArtists(artistName)
        res.json(similar)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch similar artists' })
    }
}
