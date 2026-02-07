import { Request, Response } from 'express'
import { getPlaybackSession, savePlaybackSession } from '../../database/player'

export const getSession = (req: Request, res: Response) => {
    try {
        const session = getPlaybackSession()
        res.json(session || { player: {}, queue: [] })
    } catch (error) {
        console.error('Error getting session:', error)
        res.status(500).json({ error: 'Failed to get session' })
    }
}

export const updateSession = (req: Request, res: Response) => {
    try {
        const session = req.body
        savePlaybackSession(session)
        res.json({ success: true })
    } catch (error) {
        console.error('Error updating session:', error)
        res.status(500).json({ error: 'Failed to update session' })
    }
}
