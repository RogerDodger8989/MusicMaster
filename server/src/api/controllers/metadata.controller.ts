import { Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { musicBrainzService } from '../../services/musicbrainz'
import { acoustidService } from '../../services/acoustid'
import { getDatabase } from '../../database/index'

export const identifyTrack = async (req: Request, res: Response) => {
    const { trackId } = req.params

    try {
        const db = getDatabase()
        const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId) as { file_path: string } | undefined

        if (!track || !track.file_path) {
            return res.status(404).json({ error: 'Track not found' })
        }

        const results = await acoustidService.identifyFile(track.file_path)
        res.json({ results })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const searchMusicBrainz = async (req: Request, res: Response) => {
    const artist = (req.query.artist as string) || ''
    const title = (req.query.title as string) || ''
    const album = (req.query.album as string) || undefined
    const type = (req.query.type as string) || 'recording'

    try {
        if (type === 'release') {
            const results = await musicBrainzService.searchAlbum(artist, String(req.query.album || ''))
            return res.json({ results })
        } else {
            const results = await musicBrainzService.searchTrack(artist, title, album)
            return res.json({ results })
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const getMusicBrainzDetails = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const type = req.params.type as string

    try {
        if (type === 'release') {
            const details = await musicBrainzService.getReleaseDetails(id)
            res.json({ details })
        } else if (type === 'recording') {
            const details = await musicBrainzService.getRecordingDetails(id)
            res.json({ details })
        } else {
            res.status(400).json({ error: 'Invalid entity type' })
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            res.status(500).json({ error: error.message })
        } else {
            res.status(500).json({ error: 'An unknown error occurred' })
        }
    }
}

export const getCoverage = async (_req: Request, res: Response) => {
    try {
        const { getMBIDCoverageStats } = await import('../../database/musicbrainz')
        const stats = getMBIDCoverageStats()
        res.json(stats)
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const getCandidates = async (req: Request, res: Response) => {
    const { trackId } = req.params
    try {
        const db = getDatabase()
        const track = db.prepare('SELECT artist, title, album FROM tracks WHERE id = ?').get(trackId) as any
        if (!track) return res.status(404).json({ error: 'Track not found' })

        const candidates = await musicBrainzService.getReleaseCandidates(track.artist, track.title, track.album)
        res.json({ candidates })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const applyCandidate = async (req: Request, res: Response) => {
    const { trackId } = req.params
    const candidate = req.body
    try {
        const { updateTrackWithMBID } = await import('../../database/musicbrainz')
        const { writeMusicBrainzDataToFile } = await import('../../services/metadataWriter')
        const db = getDatabase()

        // Ensure values are strings to satisfy TypeScript
        const recordingMbid = String(candidate.recordingMbid || '')
        const releaseMbid = String(candidate.releaseMbid || '')
        const artistMbid = String(candidate.artistMbid || '')

        // Only proceed if we have at least a recording MBID
        if (!recordingMbid) {
            throw new Error('Missing recording MBID')
        }

        // 1. Update Database
        updateTrackWithMBID(
            trackId as string,
            recordingMbid,
            releaseMbid,
            artistMbid
        )

        // 2. Handle Cover Art
        let coverPath: string | undefined
        if (releaseMbid) {
            try {
                // Get track path to find directory
                const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId) as { file_path: string } | undefined
                if (track?.file_path) {
                    const dir = path.dirname(track.file_path)
                    const coverDest = path.join(dir, 'cover.jpg')

                    // Check if cover already exists
                    if (!fs.existsSync(coverDest)) {
                        const coverUrl = `https://coverartarchive.org/release/${releaseMbid}/front`
                        console.log(`Downloading cover from ${coverUrl}...`)
                        const response = await axios.get(coverUrl, { responseType: 'arraybuffer' })
                        fs.writeFileSync(coverDest, response.data)
                        console.log(`Saved cover to ${coverDest}`)
                        coverPath = coverDest
                    } else {
                        coverPath = coverDest
                    }
                }
            } catch (err) {
                console.warn('Failed to download cover art:', err)
                // Continue without cover
            }
        }

        // 3. Write Tags to File
        const success = await writeMusicBrainzDataToFile(db, trackId as string, coverPath)

        res.json({ success })
    } catch (error: any) {
        console.error('Failed to apply candidate:', error)
        res.status(500).json({ error: error.message })
    }
}

export const enhanceLibrary = async (_req: Request, res: Response) => res.json({ status: 'started' })
export const getEnhanceStatus = async (_req: Request, res: Response) => res.json({ progress: 0 })
export const syncMetadata = async (_req: Request, res: Response) => res.json({ status: 'started' })
export const getFileSyncStatus = async (_req: Request, res: Response) => res.json({ progress: 0 })
export const writeTrackMetadata = async (_req: Request, res: Response) => res.json({ success: true })
