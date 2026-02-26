import express from 'express'
import cors from 'cors'
import * as os from 'os'
import { getTrackById, getAllTracks } from '../../database/tracks'

const app = express()
app.use(cors())

// Cache of tracks being casted to avoid DB lookup (since Desktop DB might be empty)
let castingTrackCache: Record<string, { filePath: string, format?: string }> = {}

export function setTrackForCasting(track: any) {
    if (track && track.id && track.filePath) {
        castingTrackCache[track.id] = {
            filePath: track.filePath,
            format: track.format
        }
    }
}

// Find the local IPv4 address
function getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces()
    let bestAddress = '127.0.0.1'

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // Prefer standard home network prefixes
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
                    return iface.address // Immediate return for likely correct interface
                }
                bestAddress = iface.address
            }
        }
    }
    return bestAddress
}

let serverIp = getLocalIpAddress()
let serverPort = 31337 // Default port

// Route to stream audio by track ID (filename is required for extension hinting)
app.get('/stream/:trackId/:filename', (req, res) => {
    const trackId = req.params.trackId.trim()
    console.log(`[Cast Server] Incoming stream request for trackId: "${trackId}"`)

    // Try cache first, then DB
    let filePath = castingTrackCache[trackId]?.filePath
    if (!filePath) {
        const track = getTrackById(trackId)
        if (track && track.filePath) {
            filePath = track.filePath
        }
    }

    if (!filePath) {
        const allTracks = getAllTracks()
        console.log(`[Cast Server] DB contains ${allTracks.length} tracks. Cache keys:`, Object.keys(castingTrackCache))
        console.log(`[Cast Server] Track not found for: "${trackId}"`)
        return res.status(404).send('Track not found')
    }

    console.log(`[Cast Server] Serving file: ${filePath}`)
    // express.sendFile automatically handles Range requests for seeking!
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`[Cast Server] Error sending file:`, err)
        }
    })
})

// Route for serving the cover art (useful for Chromecast display)
app.get('/cover/:trackId', async (req, res) => {
    // We can let the renderer pass the cover URL when casting.
    return res.status(404).send('Not implemented yet')
})

export function startCastServer(port = 31337): Promise<string> {
    serverPort = port
    return new Promise((resolve) => {
        app.listen(serverPort, '0.0.0.0', () => {
            console.log(`Cast Streaming Server running at http://${serverIp}:${serverPort}`)
            resolve(`http://${serverIp}:${serverPort}`)
        }).on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${serverPort} in use, trying ${serverPort + 1}...`)
                resolve(startCastServer(serverPort + 1))
            }
        })
    })
}

export function getCastStreamUrl(track: any): string {
    const trackId = track.id
    setTrackForCasting(track) // Register it in cache immediately

    let ext = 'mp3'
    if (track.format) {
        const formatStr = track.format.toLowerCase()
        if (formatStr.includes('flac')) ext = 'flac'
        else if (formatStr.includes('ogg')) ext = 'ogg'
        else if (formatStr.includes('wav')) ext = 'wav'
        else if (formatStr.includes('m4a') || formatStr.includes('aac')) ext = 'm4a'
    } else if (track.filePath) {
        const parts = track.filePath.split('.')
        if (parts.length > 1) {
            ext = parts[parts.length - 1].toLowerCase()
        }
    }

    return `http://${serverIp}:${serverPort}/stream/${trackId}/audio.${ext}`
}
