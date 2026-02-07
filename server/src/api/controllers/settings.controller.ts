import { Request, Response } from 'express'
import { getAllSettings, saveSetting } from '../../database/settings'

export const getSettings = (req: Request, res: Response) => {
    try {
        const settings = getAllSettings()
        res.json(settings)
    } catch (error) {
        console.error('Error getting settings:', error)
        res.status(500).json({ error: 'Failed to get settings' })
    }
}

export const updateSetting = (req: Request, res: Response) => {
    try {
        const { key, value } = req.body
        if (!key) {
            return res.status(400).json({ error: 'Key is required' })
        }
        saveSetting(key, value)
        res.json({ success: true })
    } catch (error) {
        console.error('Error updating setting:', error)
        res.status(500).json({ error: 'Failed to update setting' })
    }
}
