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
export const toggleArtistLoved = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { loved } = req.body

        if (loved === undefined) {
            return res.status(400).json({ error: 'Loved status is required' })
        }

        updateArtist(id, { loved: Boolean(loved) })
        res.json({ success: true, id, loved })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to love artist' })
    }
}

export const getArtistTopTracks = async (req: Request, res: Response) => {
    try {
        const { lastFmService } = await import('../../services/lastfm')
        const artistName = req.query.name as string
        const limit = parseInt(req.query.limit as string) || 50

        if (!artistName) {
            res.status(400).json({ error: 'Artist name is required' })
            return
        }

        const topTracks = await lastFmService.getArtistTopTracks(artistName, limit)
        res.json(topTracks)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch artist top tracks' })
    }
}

export const getArtistMembers = async (req: Request, res: Response) => {
    try {
        const { musicBrainzService } = await import('../../services/musicbrainz')
        const { upsertArtistWithMBID } = await import('../../database/musicbrainz')
        const { backgroundEnricher } = await import('../../services/enricher')
        const id = req.params.id as string

        console.log(`[API] getArtistMembers called for MBID: ${id}`)

        // Use the service to fetch members from MusicBrainz
        const members = await musicBrainzService.getArtistMembers(id)

        // Asynchronously upsert and trigger enrichment for each member
        // This won't block the response
        Promise.all(members.map(async (member) => {
            try {
                const localId = upsertArtistWithMBID(member.name, member.mbid)
                // Trigger enrichment (image/bio)
                await backgroundEnricher.enrichArtistById(localId, member.name)
            } catch (err) {
                console.warn(`[API] Failed to pre-enrich member: ${member.name}`, err)
            }
        })).catch(err => console.error('Member enrichment failed:', err))

        res.json(members)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch artist members' })
    }
}
