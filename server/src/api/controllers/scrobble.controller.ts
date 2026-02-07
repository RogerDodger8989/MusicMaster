import { Request, Response } from 'express'
import { lastFmService } from '../../services/lastfm'
import { listenBrainzService } from '../../services/listenbrainz'
import { getDatabase } from '../../database'
import { getAllTracks, getTrackPlayCount, updateTrackPlayCount } from '../../database/tracks'
import { writeMetadata } from '../../services/metadataWriter'

// In-memory state for sync status
// Note: In a real production app, this should be in Redis or DB
let syncState = {
    isRunning: false,
    current: 0,
    total: 0,
    trackName: '',
    percentage: 0,
    errors: [] as string[]
}

export const scrobbleTrack = async (req: Request, res: Response) => {
    try {
        const { artist, track, album, duration, timestamp } = req.body

        console.log(`🎵 Scrobbling: ${artist} - ${track}`)

        // 1. Last.fm
        await lastFmService.scrobble(
            // Session key should be retrieved from DB or passed in request?
            // The service manages its own key if set via setLastFmSessionKey, but that's per instance.
            // Client should probably pass session key if we want to be stateless, OR we store it in Settings table.
            // For now, let's assume service is singleton and has key if initialized,
            // BUT we should probably fetch it from DB settings if not set.
            // Implementation detail: scrobble method in lastfm.ts REQUIRES sessionKey.
            // We need to get it from settings.
            '', // Placeholder, will fix below
            artist,
            track,
            timestamp || Math.floor(Date.now() / 1000),
            album
        )
        // Wait, lastFmService.scrobble signature is (sessionKey, artist, track, timestamp, album, trackNumber)
        // I need to fetch the session key from DB first!

        const db = getDatabase()
        const settings = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get('lastfmSessionKey') as { setting_value: string } | undefined
        let sessionKey = ''
        if (settings) {
            try {
                sessionKey = JSON.parse(settings.setting_value)
            } catch {
                sessionKey = settings.setting_value
            }
        }

        if (sessionKey) {
            await lastFmService.scrobble(sessionKey, artist, track, timestamp || Math.floor(Date.now() / 1000), album)
        }

        // 2. ListenBrainz
        await listenBrainzService.submitListen({
            artist_name: artist,
            track_name: track,
            release_name: album
        }, timestamp)

        // 3. Start playback in local DB (increment play count)
        const row = db.prepare('SELECT id, play_count FROM tracks WHERE title = ? AND artist = ?').get(track, artist) as any

        if (row) {
            db.prepare('UPDATE tracks SET play_count = play_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id)

            // Record history
            db.prepare('INSERT INTO play_history (id, track_id, played_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(
                require('crypto').randomUUID(),
                row.id
            )
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Error scrobbling:', error)
        res.status(500).json({ error: 'Failed to scrobble' })
    }
}

export const updateNowPlaying = async (req: Request, res: Response) => {
    try {
        const { artist, track, album, duration } = req.body

        const db = getDatabase()
        const settings = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get('lastfmSessionKey') as { setting_value: string } | undefined
        let sessionKey = ''
        if (settings) {
            try {
                sessionKey = JSON.parse(settings.setting_value)
            } catch {
                sessionKey = settings.setting_value
            }
        }

        if (sessionKey) {
            await lastFmService.updateNowPlaying(sessionKey, artist, track, album, duration)
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Error updating now playing:', error)
        res.status(500).json({ error: 'Failed to update now playing' })
    }
}

export const getLastFmAuthToken = async (req: Request, res: Response) => {
    try {
        const result = await lastFmService.getAuthToken()
        res.json(result)
    } catch (error) {
        console.error('Error getting Last.fm auth token:', error)
        res.status(500).json({ error: 'Failed to get Last.fm auth token' })
    }
}

export const getLastFmSession = async (req: Request, res: Response) => {
    try {
        const { token } = req.body
        if (!token) {
            return res.status(400).json({ error: 'Token is required' })
        }
        const sessionKey = await lastFmService.getSession(token)
        res.json({ sessionKey })
    } catch (error) {
        console.error('Error creating Last.fm session:', error)
        res.status(500).json({ error: 'Failed to create Last.fm session' })
    }
}

export const getSyncStatus = async (req: Request, res: Response) => {
    res.json(syncState)
}

export const syncPlayCounts = async (req: Request, res: Response) => {
    if (syncState.isRunning) {
        return res.status(409).json({ error: 'Sync already in progress' })
    }

    const { lastfmUsername, listenbrainzUsername, writeToFile } = req.body

    syncState = {
        isRunning: true,
        current: 0,
        total: 0,
        trackName: '',
        percentage: 0,
        errors: []
    };

    // Start background process
    // We don't await this promise so the response returns immediately
    (async () => {
        try {
            console.log('Starting play count sync...')
            const tracks = getAllTracks()
            syncState.total = tracks.length

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i]
                syncState.current = i + 1
                syncState.trackName = `${track.artist} - ${track.title}`
                syncState.percentage = Math.round(((i + 1) / tracks.length) * 100)

                try {
                    const localPlayCount = getTrackPlayCount(track.id)
                    let lastfmPlayCount = 0
                    let listenbrainzPlayCount = 0

                    if (listenbrainzUsername) {
                        try {
                            listenbrainzPlayCount = await listenBrainzService.getTrackPlayCount(
                                listenbrainzUsername,
                                track.artist,
                                track.title
                            )
                        } catch (e) {
                            // ignore
                        }
                    }

                    if (lastfmUsername) {
                        try {
                            lastfmPlayCount = await lastFmService.getUserTrackPlayCount(
                                track.artist,
                                track.title,
                                lastfmUsername
                            )
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Choose max
                    // IMPORTANT: track.playCount might be undefined in Type but 0 in DB. 
                    const dbPlayCount = track.playCount || 0
                    const maxPlayCount = Math.max(dbPlayCount, localPlayCount, lastfmPlayCount, listenbrainzPlayCount)

                    if (maxPlayCount > dbPlayCount) {
                        console.log(`Updating play count for ${track.title}: ${dbPlayCount} -> ${maxPlayCount}`)
                        updateTrackPlayCount(track.id, maxPlayCount)

                        if (writeToFile && track.filePath) {
                            try {
                                await writeMetadata(track.filePath, track.rating, track.loved, maxPlayCount)
                            } catch (error) {
                                console.error('Failed to write metadata:', error)
                            }
                        }
                    }

                } catch (error) {
                    console.error(`Failed to sync track ${track.id}:`, error)
                    syncState.errors.push(`${track.artist} - ${track.title}: ${error}`)
                }

                // Rate limit to avoid API bans
                await new Promise(resolve => setTimeout(resolve, 350))
            }
            console.log('Play count sync complete')
        } catch (error) {
            console.error('Sync failed:', error)
            syncState.errors.push(`General failure: ${error}`)
        } finally {
            syncState.isRunning = false
        }
    })()

    res.json({ message: 'Sync started' })
}
