import { Request, Response } from 'express'
import {
    getAllPlaylists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    renamePlaylist
} from '../../database/playlists'

export const listPlaylists = (req: Request, res: Response) => {
    try {
        const playlists = getAllPlaylists()
        res.json(playlists)
    } catch (error) {
        console.error('Error listing playlists:', error)
        res.status(500).json({ error: 'Failed to list playlists' })
    }
}

export const createNewPlaylist = (req: Request, res: Response) => {
    try {
        const { name, trackIds } = req.body
        if (!name) {
            return res.status(400).json({ error: 'Playlist name is required' })
        }
        const id = createPlaylist(name, trackIds || [])
        res.json({ id, success: true })
    } catch (error) {
        console.error('Error creating playlist:', error)
        res.status(500).json({ error: 'Failed to create playlist' })
    }
}

export const removePlaylist = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        deletePlaylist(id)
        res.json({ success: true })
    } catch (error) {
        console.error('Error deleting playlist:', error)
        res.status(500).json({ error: 'Failed to delete playlist' })
    }
}

export const addToPlaylist = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { trackId } = req.body
        if (!trackId) {
            return res.status(400).json({ error: 'Track ID is required' })
        }
        addTrackToPlaylist(id, trackId)
        res.json({ success: true })
    } catch (error) {
        console.error('Error adding to playlist:', error)
        res.status(500).json({ error: 'Failed to add to playlist' })
    }
}

export const deleteFromPlaylist = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const trackId = req.params.trackId as string
        const position = parseInt(req.query.position as string)

        if (isNaN(position)) {
            return res.status(400).json({ error: 'Position is required and must be a number' })
        }

        removeTrackFromPlaylist(id, trackId, position)
        res.json({ success: true })
    } catch (error) {
        console.error('Error removing from playlist:', error)
        res.status(500).json({ error: 'Failed to remove from playlist' })
    }
}

export const updatePlaylist = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const { name } = req.body
        if (!name) {
            return res.status(400).json({ error: 'Name is required' })
        }
        renamePlaylist(id, name)
        res.json({ success: true })
    } catch (error) {
        console.error('Error updating playlist:', error)
        res.status(500).json({ error: 'Failed to update playlist' })
    }
}
