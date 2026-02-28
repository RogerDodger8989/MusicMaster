import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { getDatabase } from '../../database'

// Helper to find cover art
const findCoverArt = (dir: string): string | null => {
    const covers = ['cover.jpg', 'folder.jpg', 'cover.png', 'folder.png', 'artwork.jpg']
    for (const cover of covers) {
        const coverPath = path.join(dir, cover)
        if (fs.existsSync(coverPath)) {
            return coverPath
        }
    }
    return null
}

// Helper to generate waveform using FFmpeg
const generateWaveformForTrack = (filePath: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const cmd = `ffmpeg -i "${filePath}" -f lavfi -i color=c=black:s=800x100:d=0 -filter_complex "[0:a]aformat=channel_layouts=mono,compand=gain=-7|showwavespic=s=800x100:colors=#3b82f6[fg];[1][fg]scale2ref[bg][fg];[bg][fg]overlay=format=auto,format=yuv420p[v]" -map "[v]" -vframes 1 -y "${outputPath}"`
            execSync(cmd, { stdio: 'pipe' })
            resolve()
        } catch (error) {
            reject(error)
        }
    })
}

export const getCover = (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const db = getDatabase()
        let coverPath: string | null = null;

        // Try to find album in albums_cache (where aggregation happens)
        const album = db.prepare('SELECT cover_art_path as coverArtPath, name FROM albums_cache WHERE id = ?').get(id) as any

        if (album) {
            const pathFromDb = album.coverArtPath;
            if (pathFromDb && fs.existsSync(pathFromDb)) {
                coverPath = pathFromDb
            } else {
                console.log(`[Media] Cover invalid/missing in DB for '${album.name}' (ID: ${id}). DB Object:`, JSON.stringify(album))

                // Try to resolve from folder by finding a track in this album
                const track = db.prepare('SELECT file_path as path FROM tracks WHERE album = ? LIMIT 1').get(album.name) as any

                if (track) {
                    const dir = path.dirname(track.path)
                    console.log(`[Media] Found track for album '${album.name}': ${track.path}`)
                    console.log(`[Media] Searching for cover in directory: ${dir}`)

                    coverPath = findCoverArt(dir)

                    if (coverPath) {
                        console.log(`[Media] Found cover via filesystem scan: ${coverPath}`)
                    } else {
                        console.warn(`[Media] No cover file found in directory: ${dir}`)
                    }
                } else {
                    console.warn(`[Media] No tracks found for album '${album.name}' in tracks table.`)
                }
            }
        } else {
            // Check if it's a track ID
            const track = db.prepare('SELECT file_path as path, album FROM tracks WHERE id = ?').get(id) as any
            if (track) {
                const dir = path.dirname(track.path)
                coverPath = findCoverArt(dir)
            }
        }

        if (coverPath && fs.existsSync(coverPath)) {
            res.sendFile(coverPath)
        } else {
            console.warn(`[Media] Cover not found for ID: ${id}.`)
            res.status(404).send('Cover not found')
        }

    } catch (error) {
        console.error('Error serving cover:', error)
        res.status(500).send('Internal Server Error')
    }
}

export const getArtistImage = (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const db = getDatabase()
        const artist = db.prepare('SELECT image_path as imagePath FROM artists WHERE id = ? OR musicbrainz_artistid = ?').get(id, id) as any

        if (artist && artist.imagePath && fs.existsSync(artist.imagePath)) {
            return res.sendFile(artist.imagePath)
        }

        // Fallback: Check local cache for downloaded images (e.g. for remote artists)
        // This handles cases where we downloaded the image but haven't saved the artist to DB yet
        const userDataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
        const cacheDir = path.join(userDataPath, 'external_cache')
        const extensions = ['.jpg', '.png', '.jpeg', '.webp']

        for (const ext of extensions) {
            const cachePath = path.join(cacheDir, `artist_${id}${ext}`)
            if (fs.existsSync(cachePath)) {
                return res.sendFile(cachePath)
            }
        }

        res.status(404).send('Image not found')
    } catch (error) {
        console.error('Error serving artist image:', error)
        res.status(500).send('Internal Error')
    }
}

export const streamTrack = (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const db = getDatabase()
        const track = db.prepare('SELECT file_path as path, format FROM tracks WHERE id = ?').get(id) as any

        if (!track || !fs.existsSync(track.path)) {
            return res.status(404).send('Track not found')
        }

        const stat = fs.statSync(track.path)
        const fileSize = stat.size
        const range = req.headers.range

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = (end - start) + 1
            const file = fs.createReadStream(track.path, { start, end })
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': `audio/${track.format || 'mpeg'}`,
            }
            res.writeHead(206, head)
            file.pipe(res)
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': `audio/${track.format || 'mpeg'}`,
            }
            res.writeHead(200, head)
            fs.createReadStream(track.path).pipe(res)
        }

    } catch (error) {
        console.error('Error streaming track:', error)
        res.status(500).send('Internal Server Error')
    }
}

export const getWaveform = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const waveformDir = path.join(__dirname, '../../../data/waveforms')
        const waveformPath = path.join(waveformDir, `${id}.png`)

        // If waveform exists, serve it
        if (fs.existsSync(waveformPath)) {
            return res.sendFile(waveformPath)
        }

        // Otherwise, generate it on-demand
        const db = getDatabase()
        const track = db.prepare('SELECT file_path as path FROM tracks WHERE id = ?').get(id) as any

        if (!track || !fs.existsSync(track.path)) {
            return res.status(404).send('Track not found')
        }

        // Ensure waveform directory exists
        if (!fs.existsSync(waveformDir)) {
            fs.mkdirSync(waveformDir, { recursive: true })
        }

        try {
            // Generate waveform
            console.log(`[Media] Generating waveform for track ${id}: ${track.path}`)
            await generateWaveformForTrack(track.path, waveformPath)
            console.log(`[Media] ✅ Waveform generated: ${waveformPath}`)
            res.sendFile(waveformPath)
        } catch (ffmpegError) {
            console.error(`[Media] Failed to generate waveform for ${id}:`, ffmpegError)
            res.status(500).send('Failed to generate waveform')
        }
    } catch (error) {
        console.error('Error serving waveform:', error)
        res.status(500).send('Internal Server Error')
    }
}

export const pasteArtwork = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const { image } = req.body // base64 data:image/...

        if (!image) {
            return res.status(400).json({ error: 'Image data is required' })
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
        const buffer = Buffer.from(base64Data, 'base64')

        const userDataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')
        const cacheDir = path.join(userDataPath, 'external_cache')
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

        const fileName = `manual_album_${id}.jpg`
        const filePath = path.join(cacheDir, fileName)

        fs.writeFileSync(filePath, buffer)

        const db = getDatabase()
        db.prepare('UPDATE albums_cache SET cover_art_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(filePath, id)

        res.json({ success: true, path: filePath })
    } catch (error) {
        console.error('Error pasting artwork:', error)
        res.status(500).json({ error: 'Failed to paste artwork' })
    }
}
