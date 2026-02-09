import { Request, Response } from 'express'
import { musicScanner } from '../../scanner'
import { getAllMusicFolders, addMusicFolder, removeMusicFolder } from '../../database/folders'
import { startEnrichmentWorker } from '../../services/enrichmentWorker'
import path from 'path'

export const getScanStatus = (req: Request, res: Response) => {
    res.json(musicScanner.getScanProgress())
}

export const startScan = async (req: Request, res: Response) => {
    try {
        const { folderId, path: scanPath } = req.body

        // Use setImmediate to not block response
        setImmediate(() => {
            musicScanner.scanFolder(folderId, scanPath)
                .then(() => {
                    // ALWAYS auto-enrich after scan completes
                    console.log('🎵 Scan completed, starting automatic enrichment...')
                    startEnrichmentWorker((progress) => {
                        console.log(`Enrichment progress: ${progress.enrichedTracks}/${progress.totalTracks} tracks`)
                    }).catch(err => {
                        console.error('Auto-enrich failed:', err)
                    })
                })
                .catch(err => console.error('Scan failed:', err))
        })

        res.json({ success: true, message: 'Scan started' })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to start scan' })
    }
}

export const listFolders = (req: Request, res: Response) => {
    try {
        const folders = getAllMusicFolders()
        res.json(folders)
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch folders' })
    }
}

export const createFolder = (req: Request, res: Response) => {
    try {
        const { path: folderPath, name } = req.body
        addMusicFolder(folderPath, undefined) // watchEnabled unknown in request, default to false/undefined
        res.json({ success: true })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to add folder' })
    }
}

export const deleteFolder = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        removeMusicFolder(id)
        res.json({ success: true })
    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to remove folder' })
    }
}
