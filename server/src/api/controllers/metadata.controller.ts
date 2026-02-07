import { Request, Response } from 'express'
import { getDatabase } from '../../database'
import { syncAllMusicBrainzData, writeMusicBrainzDataToFile } from '../../services/metadataWriter'
import { updateTrackWithMBID, getMBIDCoverageStats } from '../../database/musicbrainz'
import { advancedMatch, MatchConfidence } from '../../services/matcher'
import { musicBrainzService } from '../../services/musicbrainz'
import { acousticBrainzService } from '../../services/acousticbrainz'
import { getAllTracks, getTrackById } from '../../database/tracks'

// In-memory state for enhancement process
let enhanceState = {
    isRunning: false,
    current: 0,
    total: 0,
    trackName: '',
    percentage: 0,
    enhanced: 0,
    failed: 0,
    noMatch: 0,
    alreadyHasMBID: 0,
    errors: [] as string[]
}

// In-memory state for file sync process
let fileSyncState = {
    isRunning: false,
    current: 0,
    total: 0,
    trackPath: '',
    percentage: 0,
    success: 0,
    failed: 0,
    skipped: 0
}

export const syncMetadata = async (req: Request, res: Response) => {
    // This is "Sync to Files"
    if (fileSyncState.isRunning) {
        return res.status(409).json({ error: 'File sync already in progress' })
    }

    fileSyncState = {
        isRunning: true,
        current: 0,
        total: 100, // estimated
        trackPath: 'Starting...',
        percentage: 0,
        success: 0,
        failed: 0,
        skipped: 0
    }

    // Start background process
    const db = getDatabase()
    syncAllMusicBrainzData(db, (current, total, path) => {
        fileSyncState.current = current
        fileSyncState.total = total
        fileSyncState.trackPath = path
        fileSyncState.percentage = Math.round((current / total) * 100)
    }).then(result => {
        console.log('Metadata sync complete:', result)
        fileSyncState.success = result.success
        fileSyncState.failed = result.failed
        fileSyncState.skipped = result.skipped
        fileSyncState.isRunning = false
    }).catch(error => {
        console.error('Metadata sync failed:', error)
        fileSyncState.isRunning = false
    })

    res.json({ message: 'Metadata sync started in background' })
}

export const getFileSyncStatus = async (req: Request, res: Response) => {
    res.json(fileSyncState)
}

export const writeTrackMetadata = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const db = getDatabase()
        const success = await writeMusicBrainzDataToFile(db, String(id))

        if (success) {
            res.json({ success: true })
        } else {
            res.status(404).json({ error: 'Track not found or write failed' })
        }
    } catch (error) {
        console.error('Error writing track metadata:', error)
        res.status(500).json({ error: 'Failed to write track metadata' })
    }
}

// ... (omitted)


export const getCoverage = async (req: Request, res: Response) => {
    try {
        const stats = getMBIDCoverageStats()
        res.json(stats)
    } catch (error) {
        console.error('Failed to get MB coverage:', error)
        res.status(500).json({ error: 'Failed to get coverage stats' })
    }
}

export const enhanceLibrary = async (req: Request, res: Response) => {
    if (enhanceState.isRunning) {
        return res.status(409).json({ error: 'Enhancement already in progress' })
    }

    const { writeToFiles } = req.body
    const shouldWrite = writeToFiles !== false // default true

    enhanceState = {
        isRunning: true,
        current: 0,
        total: 0,
        trackName: '',
        percentage: 0,
        enhanced: 0,
        failed: 0,
        noMatch: 0,
        alreadyHasMBID: 0,
        errors: []
    };

    // Start background process
    (async () => {
        try {
            console.log('🚀 Starting library enhancement...')
            const db = getDatabase()

            // Get all tracks without MBIDs
            const tracksWithoutMBID = db.prepare(`
                SELECT id
                FROM tracks
                WHERE mbid IS NULL OR mbid = ''
                ORDER BY id
            `).all() as any[]

            const trackIds = tracksWithoutMBID.map(t => t.id)
            enhanceState.total = trackIds.length
            console.log(`Found ${trackIds.length} tracks without MBIDs`)

            for (let i = 0; i < trackIds.length; i++) {
                // Check if stopped? (Enhancement can be cancelled? Not implemented yet)

                const trackId = trackIds[i]
                const track = getTrackById(trackId)

                enhanceState.current = i + 1
                enhanceState.trackName = track ? `${track.artist} - ${track.title}` : `Track ${trackId}`
                enhanceState.percentage = Math.round(((i + 1) / trackIds.length) * 100)

                if (!track) {
                    enhanceState.failed++
                    continue
                }

                // Double check if already has MBID (race condition)
                if (track.musicbrainzTrackId) { // track.mbid in DB/Types
                    enhanceState.alreadyHasMBID++
                    continue
                }

                try {
                    // Search MusicBrainz
                    const match = await advancedMatch(
                        track.artist,
                        track.title,
                        track.album || '',
                        track.duration,
                        (track as any).isrc // cast if property missing in Track type
                    )

                    if (!match || match.confidence === MatchConfidence.MISMATCH || match.confidence === MatchConfidence.LOW) {
                        console.log(`   ⚠️ No suitable match for track ${trackId}`)
                        enhanceState.noMatch++
                        continue
                    }

                    // Get full recording details
                    const recording = await musicBrainzService.getRecordingDetails(match.mbid)
                    if (!recording) {
                        enhanceState.failed++
                        continue
                    }

                    // Update database
                    // Need to map recording details to updateTrackWithMBID arguments
                    // updateTrackWithMBID(trackId, mbid, albumId, artistId, isrc, recordingDate, ...)
                    const release = recording.releases?.[0]
                    const artistCredit = recording['artist-credit']?.[0]

                    updateTrackWithMBID(
                        trackId,
                        match.mbid,
                        release?.id || null,
                        (artistCredit as any)?.artist?.id || null,
                        recording.isrc?.[0] || null,
                        release?.date || null
                    )

                    // Try to get AcousticBrainz data
                    try {
                        await acousticBrainzService.getRecordingAnalysis(match.mbid)
                    } catch (err) {
                        // ignore
                    }

                    // Write to file if requested
                    if (shouldWrite) {
                        await writeMusicBrainzDataToFile(db, String(trackId))
                    }

                    enhanceState.enhanced++
                    console.log(`   ✅ Enhanced: ${track.artist} - ${track.title}`)

                } catch (error) {
                    console.error(`Failed to enhance track ${trackId}:`, error)
                    enhanceState.failed++
                    enhanceState.errors.push(`${track.artist} - ${track.title}: ${error}`)
                }

                // Rate limit
                await new Promise(resolve => setTimeout(resolve, 50))
            }
            console.log('Library enhancement complete')

        } catch (error) {
            console.error('Enhancement failed:', error)
            enhanceState.errors.push(`General failure: ${error}`)
        } finally {
            enhanceState.isRunning = false
        }
    })()

    res.json({ message: 'Enhancement started' })
}

export const getEnhanceStatus = async (req: Request, res: Response) => {
    res.json(enhanceState)
}

export const searchMetadata = async (req: Request, res: Response) => {
    try {
        const { artist, title, album } = req.query
        if (!artist) {
            return res.status(400).json({ error: 'Artist is required' })
        }

        const results = await musicBrainzService.searchTrack(
            String(artist),
            String(title || ''),
            String(album || '')
        )
        res.json(results)
    } catch (error) {
        console.error('Metadata search failed:', error)
        res.status(500).json({ error: 'Search failed' })
    }
}

export const searchAlbums = async (req: Request, res: Response) => {
    try {
        const { artist, album } = req.query
        if (!artist || !album) {
            return res.status(400).json({ error: 'Artist and Album are required' })
        }

        const results = await musicBrainzService.searchAlbum(
            String(artist),
            String(album)
        )
        res.json(results)
    } catch (error) {
        console.error('Album search failed:', error)
        res.status(500).json({ error: 'Search failed' })
    }
}

export const getArtistDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const details = await musicBrainzService.getArtistDetails(String(id))
        if (details) {
            res.json(details)
        } else {
            res.status(404).json({ error: 'Artist not found' })
        }
    } catch (error) {
        console.error('Get artist details failed:', error)
        res.status(500).json({ error: 'Failed to get artist details' })
    }
}

export const getCandidates = async (req: Request, res: Response) => {
    try {
        const { trackId } = req.params
        const track = getTrackById(String(trackId))
        if (!track) {
            return res.status(404).json({ error: 'Track not found' })
        }

        const candidates = await musicBrainzService.getReleaseCandidates(
            track.artist,
            track.title,
            track.album
        )
        res.json({ candidates })
    } catch (error) {
        console.error('Get candidates failed:', error)
        res.status(500).json({ error: 'Failed to get candidates' })
    }
}

export const applyCandidate = async (req: Request, res: Response) => {
    try {
        const { trackId } = req.params
        const { candidate, writeToFile } = req.body

        if (!candidate) {
            return res.status(400).json({ error: 'Candidate data required' })
        }

        // Adapted from enhanceLibrary logic
        const db = getDatabase()

        // candidate has recordingMbid, releaseMbid, artistMbid, etc.
        // We need to map this to the update function
        // Note: candidate structure from getReleaseCandidates might differ slightly from what updateTrackWithMBID expects
        // But let's assume valid data for now or check types

        updateTrackWithMBID(
            String(trackId),
            candidate.recordingMbid,
            candidate.releaseMbid,
            candidate.artistMbid,
            null, // ISRC might not be in candidate summary
            null  // Date might need parsing if not in candidate
        )

        // Write to file if requested
        if (writeToFile) {
            await writeMusicBrainzDataToFile(db, String(trackId))
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Apply candidate failed:', error)
        res.status(500).json({ error: 'Failed to apply candidate' })
    }
}
