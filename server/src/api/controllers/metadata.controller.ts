import { Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { musicBrainzService } from '../../services/musicbrainz'
import { acoustidService } from '../../services/acoustid'
import { getDatabase } from '../../database/index'
import { updateTrackWithMBID, upsertAlbumWithMBID, upsertArtistWithMBID } from '../../database/musicbrainz'
import { writeMusicBrainzDataToFile } from '../../services/metadataWriter'

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
            return res.json(results)
        } else {
            const results = await musicBrainzService.searchTrack(artist, title, album)
            return res.json(results)
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
        } else if (type === 'artist') {
            const details = await musicBrainzService.getArtistDetails(id)
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

import { lastFmService } from '../../services/lastfm'
import { spotifyService } from '../../services/spotify'

export const getArtistDetails = async (req: Request, res: Response) => {
    const id = req.params.id as string
    console.log(`[DEBUG] getArtistDetails called for artist ID: ${id}`)
    try {
        const db = getDatabase()
        const mbResult: any = await musicBrainzService.getArtistDetails(id)
        console.log(`[DEBUG] MusicBrainz returned artist: ${mbResult?.name}, has image: ${!!mbResult?.image}`)
        if (!mbResult) {
            return res.status(404).json({ error: 'Artist not found' })
        }

        // Clone to prevent mutations from polluting MusicBrainz cache
        const details = { ...mbResult }

        // Check DB for existing bio to avoid re-fetching
        // Note: Image validation happens in downloadImage() which checks file size
        try {
            const existing = db
                .prepare('SELECT bio FROM artists WHERE mbid = ? OR id = ? OR name = ?')
                .get(id, id, details.name) as any
            if (existing?.bio) {
                details.biography = existing.bio
                details.bio = existing.bio.substring(0, 200) + '...'
            }
        } catch (e) { /* ignore */ }

        // Enrich with Last.fm data (Bio & Image)
        try {
            console.log(`[DEBUG] Fetching Last.fm info for: ${details.name}`)
            const lastFmInfo = await lastFmService.getArtistInfo(details.name)
            if (lastFmInfo) {
                console.log(`[DEBUG] Last.fm response has bio:`, !!lastFmInfo.bio)
                // Add Bio if missing
                if (lastFmInfo.bio?.content) {
                    console.log(`[DEBUG] Last.fm bio content length:`, lastFmInfo.bio.content.length)
                    details.biography = lastFmInfo.bio.content
                    details.bio = lastFmInfo.bio.summary
                } else {
                    console.log(`[DEBUG] No bio in Last.fm response. Bio object:`, JSON.stringify(lastFmInfo.bio))
                }

                // Add Image if missing (MusicBrainz service doesn't fetch artist images natively yet)
                console.log(`[DEBUG] Checking if image needed. Current details.image: ${details.image}`)
                if (!details.image) {
                    console.log(`[DEBUG] No image found, searching for best image...`)
                    let bestImage: string | null = null

                    // 1. Try Spotify (High Quality)
                    try {
                        bestImage = await spotifyService.getArtistImage(details.name)
                        if (bestImage) console.log(`[Metadata] Found Spotify image for ${details.name}`)
                    } catch (e) { }

                    // 2. Fallback to Last.fm
                    if (!bestImage) {
                        bestImage = lastFmService.getBestImage(lastFmInfo.image)
                    }

                    // 3. Fallback to Deezer
                    if (!bestImage) {
                        try {
                            bestImage = await lastFmService.getDeezerArtistImage(details.name)
                            if (bestImage) console.log(`[Metadata] Found Deezer image for ${details.name}`)
                        } catch (e) { }
                    }

                    if (bestImage) {
                        console.log(`[DEBUG] Best image URL found: ${bestImage}`)
                        // Download image to cache to avoid hotlinking issues and valid local serving
                        const urlWithoutParams = bestImage.split(/[#?]/)[0]
                        let ext = urlWithoutParams.split('.').pop() || 'jpg'

                        // Sanitize extension (Spotify URLs often don't have extensions, e.g. .../image/ab67...)
                        // If it looks like a path or is too long, default to jpg
                        if (ext.length > 5 || ext.includes('/') || ext.includes('\\')) {
                            ext = 'jpg'
                        }
                        console.log(`[DEBUG] Sanitized extension: ${ext}`)

                        const filename = `artist_${details.id}.${ext}`
                        console.log(`[DEBUG] Calling downloadImage with filename: ${filename}`)
                        let localPath = await lastFmService.downloadImage(bestImage, filename)

                        // Validate image size (reject placeholders < 5KB)
                        if (localPath) {
                            try {
                                const stats = fs.statSync(localPath)
                                if (stats.size < 5120) {
                                    console.warn(`[Metadata] Rejected small image for ${details.name} (${stats.size} bytes)`)
                                    fs.unlinkSync(localPath)
                                    localPath = null
                                }
                            } catch (e) {
                                console.error('Error checking image size:', e)
                            }
                        }

                        if (localPath) {

                            // Persist to DB immediately so Grid View sees it (without creating duplicates)
                            let imageId = id
                            try {
                                const existing = db
                                    .prepare('SELECT id FROM artists WHERE mbid = ? OR name = ?')
                                    .get(id, details.name) as any

                                if (existing) {
                                    imageId = existing.id
                                    console.log(`[DEBUG] Updating artist ${existing.id} with bio length:`, details.biography ? details.biography.length : 'NULL')
                                    db.prepare(
                                        'UPDATE artists SET image_path = ?, bio = COALESCE(?, bio), mbid = COALESCE(?, mbid) WHERE id = ?'
                                    ).run(localPath, details.biography || null, id, existing.id)
                                    console.log(`[Metadata] ✅ Updated image${details.biography ? ' + bio' : ''} for existing artist ${details.name} (${existing.id})`)
                                } else {
                                    console.log(`[Metadata] Skipping artist insert for ${details.name} to avoid duplicates`)
                                }
                            } catch (err) {
                                console.error('[Metadata] ❌ Failed to persist artist image:', err)
                            }

                            // Send URL to frontend
                            details.image = `/api/cover/artist/${imageId}?t=${Date.now()}`
                        } else {
                            // Fallback to URL if download failed
                            details.image = bestImage
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[Metadata] Failed to enrich artist ${details.name} from Last.fm:`, err)
        }

        res.json(details)
    } catch (error: any) {
        res.status(500).json({ error: error.message })
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

        // 1b. Update album cache if we have a release MBID
        if (releaseMbid) {
            const trackInfo = db.prepare('SELECT album, artist FROM tracks WHERE id = ?').get(trackId) as any
            if (trackInfo) {
                db.prepare('UPDATE albums_cache SET musicbrainz_album_id = ? WHERE name = ? AND artist = ?')
                    .run(releaseMbid, trackInfo.album, trackInfo.artist)
            }
        }

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

export const tagAlbumMetadata = async (req: Request, res: Response) => {
    const { id: albumId } = req.params
    const { mbAlbumId } = req.body

    try {
        const db = getDatabase()

        // 1. Get MB details
        const mbAlbum = await musicBrainzService.getReleaseDetails(mbAlbumId)
        if (!mbAlbum) throw new Error('Failed to fetch MB album details')

        // 1b. Get release-group details for first-release-date
        let firstReleaseDate = mbAlbum.date
        if (mbAlbum['release-group']?.id) {
            const releaseGroup = await musicBrainzService.getReleaseGroupDetails(mbAlbum['release-group'].id)
            if (releaseGroup?.firstReleaseDate) {
                firstReleaseDate = releaseGroup.firstReleaseDate
            }
        }

        // 2. Get local tracks
        const album = db.prepare('SELECT id, name, artist FROM albums_cache WHERE id = ?').get(albumId) as any
        if (!album) throw new Error('Album not found')

        // 3. Update album cache with MBID and full metadata
        db.prepare(`
            UPDATE albums_cache SET 
                musicbrainz_album_id = ?,
                album_type = ?,
                status = ?,
                release_date = ?,
                original_release_date = ?,
                label = ?,
                catalog_number = ?,
                barcode = ?,
                country = ?,
                media = ?,
                release_group_mbid = ?,
                script = ?,
                total_discs = ?,
                total_tracks = ?
            WHERE id = ?
        `).run(
            mbAlbum.id,
            mbAlbum['release-group']?.['primary-type'] || null,
            mbAlbum.status || null,
            firstReleaseDate || null,
            firstReleaseDate || null,
            (mbAlbum as any)['label-info']?.[0]?.label?.name || null,
            (mbAlbum as any)['label-info']?.[0]?.['catalog-number'] || null,
            mbAlbum.barcode || null,
            (mbAlbum as any)['release-events']?.[0]?.area?.['iso-3166-1-codes']?.[0] || (mbAlbum as any)['release-events']?.[0]?.area?.name || null,
            mbAlbum.media?.[0]?.format || null,
            mbAlbum['release-group']?.id || null,
            (mbAlbum as any).script || null,
            mbAlbum.media?.length || null,
            mbAlbum.media?.reduce((sum: number, m: any) => sum + (m['track-count'] || 0), 0) || null,
            albumId
        )

        // 4. Upsert to extended schema (for fallback/enrichment)
        const primaryArtist = (mbAlbum as any)['artist-credit']?.[0]?.artist
        let dbArtistId: string | null = null
        if (primaryArtist) {
            // Include sort-name when upserting artist
            dbArtistId = upsertArtistWithMBID(
                primaryArtist.name,
                primaryArtist.id,
                null, // country
                null, // artistType
                null, // lifeSpanBegin
                null, // lifeSpanEnd
                null, // bio
                null, // website
                null, // imagePath
                primaryArtist['sort-name'] || null // nameSortOrder
            )
        }
        upsertAlbumWithMBID(mbAlbum.title, dbArtistId, mbAlbum.id, mbAlbum['release-group']?.['primary-type'], mbAlbum.date)

        const localTracks = db.prepare('SELECT id, title, track_num as trackNum FROM tracks WHERE album = ? AND artist = ?').all(album.name, album.artist) as any[]

        let updatedCount = 0
        for (const mbMedia of mbAlbum.media || []) {
            for (const mbTrack of mbMedia.tracks || []) {
                const mbTrackNum = mbTrack.number ? parseInt(mbTrack.number) : undefined
                const mbTitle = mbTrack.title.toLowerCase()

                const localMatch = localTracks.find((lt) => {
                    if (mbTrackNum !== undefined && lt.trackNum === mbTrackNum) return true
                    if (lt.title.toLowerCase() === mbTitle) return true
                    return false
                })

                if (localMatch) {
                    updateTrackWithMBID(
                        localMatch.id,
                        mbTrack.id,
                        mbAlbum.id,
                        (mbAlbum as any)['artist-credit']?.[0]?.artist?.id
                    )
                    await writeMusicBrainzDataToFile(db, localMatch.id)
                    updatedCount++
                }
            }
        }

        res.json({ updatedCount })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const previewMatchAlbum = async (req: Request, res: Response) => {
    const { id: albumId } = req.params
    const { mbAlbumId } = req.body

    try {
        const db = getDatabase()
        const mbAlbum = await musicBrainzService.getReleaseDetails(mbAlbumId)
        if (!mbAlbum) throw new Error('Failed to fetch MB album details')

        // Get release-group details for original release date
        let firstReleaseDate = mbAlbum.date
        if (mbAlbum['release-group']?.id) {
            const releaseGroup = await musicBrainzService.getReleaseGroupDetails(mbAlbum['release-group'].id)
            if (releaseGroup?.firstReleaseDate) {
                firstReleaseDate = releaseGroup.firstReleaseDate
            }
        }

        const album = db.prepare('SELECT name, artist FROM albums_cache WHERE id = ?').get(albumId) as any
        if (!album) throw new Error('Album not found')

        const localTracks = db.prepare('SELECT id, title, track_num as trackNum FROM tracks WHERE album = ? AND artist = ?').all(album.name, album.artist) as any[]

        const matches: any[] = []
        for (const mbMedia of mbAlbum.media || []) {
            for (const mbTrack of mbMedia.tracks || []) {
                const mbTrackNum = mbTrack.number ? parseInt(mbTrack.number) : undefined
                const mbTitle = mbTrack.title.toLowerCase()

                const localMatch = localTracks.find((lt) => {
                    if (mbTrackNum !== undefined && lt.trackNum === mbTrackNum) return true
                    if (lt.title.toLowerCase() === mbTitle) return true
                    return false
                })

                matches.push({
                    mbTrack: {
                        id: mbTrack.id,
                        title: mbTrack.title,
                        number: mbTrack.number,
                        position: mbTrack.position
                    },
                    localTrack: localMatch ? {
                        id: localMatch.id,
                        title: localMatch.title,
                        trackNum: localMatch.trackNum
                    } : null,
                    matchType: localMatch ? (mbTrackNum !== undefined && localMatch.trackNum === mbTrackNum ? 'number' : 'title') : 'none'
                })
            }
        }

        const totalTracks = (mbAlbum.media || []).reduce((sum: number, m: any) => sum + (m['track-count'] || 0), 0)
        const albumDetails = {
            id: mbAlbum.id,
            title: mbAlbum.title,
            albumName: mbAlbum.title,
            artistName: (mbAlbum as any)['artist-credit']?.[0]?.artist?.name || (mbAlbum as any)['artist-credit']?.[0]?.name,
            releaseDate: mbAlbum.date,
            originalDate: firstReleaseDate,
            country: (mbAlbum as any)['release-events']?.[0]?.area?.['iso-3166-1-codes']?.[0] || (mbAlbum as any)['release-events']?.[0]?.area?.name,
            label: (mbAlbum as any)['label-info']?.[0]?.label?.name || null,
            catalogNumber: (mbAlbum as any)['label-info']?.[0]?.['catalog-number'] || null,
            barcode: mbAlbum.barcode || null,
            format: mbAlbum.media?.[0]?.format || null,
            media: mbAlbum.media?.[0]?.format || null,
            script: (mbAlbum as any).script || null,
            totalDiscs: mbAlbum.media?.length || null,
            totalTracks: totalTracks || null,
            trackCount: totalTracks || null,
            releaseType: mbAlbum['release-group']?.['primary-type'] || null,
            status: mbAlbum.status || null
        }

        res.json({ matches, album: albumDetails })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const enhanceLibrary = async (_req: Request, res: Response) => res.json({ status: 'started' })
export const getEnhanceStatus = async (_req: Request, res: Response) => res.json({ progress: 0 })
export const syncMetadata = async (_req: Request, res: Response) => {
    try {
        const { syncAllMusicBrainzData } = await import('../../services/metadataWriter')
        const db = getDatabase()

        // Start sync in background
        syncAllMusicBrainzData(db, (current, total, trackPath) => {
            console.log(`[Metadata Sync] ${current}/${total}: ${trackPath}`)
        }).then(results => {
            console.log(`[Metadata Sync] Complete: ${results.success} successful, ${results.failed} failed, ${results.skipped} skipped`)
        }).catch(error => {
            console.error('[Metadata Sync] Error:', error)
        })

        res.json({ status: 'started', message: 'Metadata sync started in background' })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const getFileSyncStatus = async (_req: Request, res: Response) => res.json({ progress: 0 })

export const writeTrackMetadata = async (req: Request, res: Response) => {
    const { id } = req.params
    const trackId = String(id)

    try {
        const db = getDatabase()
        const success = await writeMusicBrainzDataToFile(db, trackId)

        if (success) {
            res.json({ success: true, message: 'Metadata written to file' })
        } else {
            res.status(400).json({ success: false, error: 'Failed to write metadata' })
        }
    } catch (error: any) {
        console.error(`[Write Metadata] Error for track ${trackId}:`, error)
        res.status(500).json({ success: false, error: error.message })
    }
}
