import { Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { musicBrainzService } from '../../services/musicbrainz'
import { acoustidService } from '../../services/acoustid'
import { getDatabase } from '../../database/index'
import { updateTrackWithMBID, upsertAlbumWithMBID, upsertArtistWithMBID } from '../../database/musicbrainz'
import { writeMusicBrainzDataToFile } from '../../services/metadataWriter'
import { lastFmService } from '../../services/lastfm'
import { spotifyService } from '../../services/spotify'

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
        } else if (type === 'artist' || (artist && !title)) {
            const results = await musicBrainzService.searchArtist(artist)
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

export const getArtistDetails = async (req: Request, res: Response) => {
    const id = req.params.id as string
    console.log(`[DEBUG] getArtistDetails called for artist ID: ${id}`)
    try {
        const db = getDatabase()
        const mbResult: any = await musicBrainzService.getArtistDetails(id)

        if (!mbResult) {
            return res.status(404).json({ error: 'Artist not found' })
        }

        const details = { ...mbResult }

        // Check DB for existing bio
        try {
            const existing = db
                .prepare('SELECT bio FROM artists WHERE musicbrainz_artistid = ? OR id = ? OR name = ?')
                .get(id, id, details.name) as any

            if (existing?.bio) {
                if (!lastFmService.isNonEnglish(existing.bio)) {
                    console.log(`[Metadata] Using existing English bio for ${details.name}`)
                    details.biography = existing.bio
                    details.bio = existing.bio.substring(0, 200) + '...'
                } else {
                    console.log(`[Metadata] 🚩 Non-English bio detected in DB for ${details.name}. Will re-fetch.`)
                }
            }
        } catch (e) { /* ignore */ }

        // Enrichment Phase: Bio & Image
        let bestImage: string | null = null
        try {
            console.log(`[Metadata] Enriching ${details.name} (MBID: ${id})`)
            const forceRefresh = !details.biography

            // 1. Try Spotify for Image FIRST (More reliable for large artists)
            try {
                bestImage = await spotifyService.getArtistImage(details.name)
                if (bestImage) {
                    console.log(`[Metadata] Got premium image from Spotify for ${details.name}`)
                }
            } catch (e) {
                console.error(`[Metadata] Spotify image fetch failed:`, e)
            }

            // 2. Fetch Last.fm info for Bio (and image fallback)
            const lastFmInfo = await lastFmService.getArtistInfo(details.name, id)

            if (lastFmInfo) {
                // SAFETY CHECK: Ensure Last.fm hasn't hijacked the artist (e.g. Zippy Kid / Russian redirects)
                const originalName = details.name.toLowerCase()
                const receivedName = lastFmInfo.name.toLowerCase()

                // Robust matching: Exact match or one contains the other
                // But avoid "Zippy Kid" vs "Metallica"
                const isLikelyMatch =
                    receivedName === originalName ||
                    receivedName.includes(originalName) ||
                    originalName.includes(receivedName)

                if (!isLikelyMatch) {
                    console.warn(`[Metadata] 🛑 Hijacking detected! Expected artist like "${details.name}" but Last.fm gave us "${lastFmInfo.name}". Skipping Last.fm bio/image.`)
                } else {
                    // Bio enrichment
                    if (lastFmInfo.bio?.content) {
                        const bioContent = lastFmInfo.bio.content
                        if (!lastFmService.isNonEnglish(bioContent)) {
                            // Only update if we don't have a bio or if it's much better (longer)
                            if (!details.biography || bioContent.length > (details.biography.length + 10)) {
                                console.log(`[Metadata] Updating bio for ${details.name}`)
                                details.biography = bioContent
                                details.bio = lastFmInfo.bio.summary || bioContent.substring(0, 300) + '...'
                            }
                        } else if (forceRefresh) {
                            console.warn(`[Metadata] ⚠️ Last.fm returned a non-English bio for ${details.name}. Skipping bio update.`)
                        }
                    }

                    // Image fallback (only if Spotify failed)
                    if (!bestImage && lastFmInfo.image) {
                        bestImage = lastFmService.getBestImage(lastFmInfo.image)
                    }
                }
            }
        } catch (e) {
            console.error(`[Metadata] Enrichment failed:`, e)
        }

        // Final fallback for image (Deezer)
        if (!details.image && !bestImage) {
            try {
                bestImage = await lastFmService.getDeezerArtistImage(details.name)
            } catch (e) { }
        }

        // If we found a new image URL, download and persist it
        if (bestImage) {
            const urlWithoutParams = bestImage.split(/[#?]/)[0]
            let ext = urlWithoutParams.split('.').pop() || 'jpg'
            if (ext.length > 5 || ext.includes('/') || ext.includes('\\')) ext = 'jpg'

            const filename = `artist_${id}.${ext}`
            const localPath = await lastFmService.downloadImage(bestImage, filename)

            if (localPath) {
                try {
                    const stats = fs.statSync(localPath)
                    if (stats.size > 5120) {
                        // EXHAUSTIVE UPDATE: Update all possible MBID columns to ensure consistency
                        db.prepare(`
                            UPDATE artists 
                            SET image_path = ?, 
                                bio = COALESCE(?, bio), 
                                musicbrainz_artistid = ?,
                                musicbrainz_artist_id = ?,
                                mbid = ?,
                                type = COALESCE(?, type)
                            WHERE id = ? OR musicbrainz_artistid = ? OR mbid = ?
                        `).run(localPath, details.biography || null, id, id, id, details.type || null, id, id, id)

                        details.image = `/api/cover/artist/${id}?t=${Date.now()}`
                    } else {
                        fs.unlinkSync(localPath)
                        details.image = bestImage
                    }
                } catch (err) {
                    details.image = bestImage
                }
            } else {
                details.image = bestImage
            }
        }

        res.json(details)
    } catch (error: any) {
        console.error('Metadata API Error:', error)
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

        const recordingMbid = String(candidate.recordingMbid || '')
        const releaseMbid = String(candidate.releaseMbid || '')
        const artistMbid = String(candidate.artistMbid || '')

        if (!recordingMbid) {
            throw new Error('Missing recording MBID')
        }

        updateTrackWithMBID(
            trackId as string,
            recordingMbid,
            releaseMbid,
            artistMbid
        )

        if (releaseMbid) {
            const trackInfo = db.prepare('SELECT album, artist FROM tracks WHERE id = ?').get(trackId) as any
            if (trackInfo) {
                db.prepare('UPDATE albums_cache SET musicbrainz_albumid = ? WHERE name = ? AND artist = ?')
                    .run(releaseMbid, trackInfo.album, trackInfo.artist)
            }
        }

        let coverPath: string | undefined
        if (releaseMbid) {
            try {
                const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId) as { file_path: string } | undefined
                if (track?.file_path) {
                    const dir = path.dirname(track.file_path)
                    const coverDest = path.join(dir, 'cover.jpg')

                    if (!fs.existsSync(coverDest)) {
                        const coverUrl = `https://coverartarchive.org/release/${releaseMbid}/front`
                        const response = await axios.get(coverUrl, { responseType: 'arraybuffer' })
                        fs.writeFileSync(coverDest, response.data)
                        coverPath = coverDest
                    } else {
                        coverPath = coverDest
                    }
                }
            } catch (err) { }
        }

        const success = await writeMusicBrainzDataToFile(db, trackId as string, coverPath)
        res.json({ success })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
}

export const tagAlbumMetadata = async (req: Request, res: Response) => {
    const { id: albumId } = req.params
    const { mbAlbumId } = req.body

    try {
        const db = getDatabase()
        const mbAlbum = await musicBrainzService.getReleaseDetails(mbAlbumId)
        if (!mbAlbum) throw new Error('Failed to fetch MB album details')

        let firstReleaseDate = mbAlbum.date
        if (mbAlbum['release-group']?.id) {
            const releaseGroup = await musicBrainzService.getReleaseGroupDetails(mbAlbum['release-group'].id)
            if (releaseGroup?.firstReleaseDate) {
                firstReleaseDate = releaseGroup.firstReleaseDate
            }
        }

        const album = db.prepare('SELECT id, name, artist FROM albums_cache WHERE id = ?').get(albumId) as any
        if (!album) throw new Error('Album not found')

        db.prepare(`
            UPDATE albums_cache SET 
                musicbrainz_albumid = ?,
                album_type = ?,
                status = ?,
                release_date = ?,
                original_release_date = ?,
                label = ?,
                catalog_number = ?,
                barcode = ?,
                country = ?,
                media = ?,
                musicbrainz_releasegroupid = ?,
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

        const primaryArtist = (mbAlbum as any)['artist-credit']?.[0]?.artist
        let dbArtistId: string | null = null
        if (primaryArtist) {
            dbArtistId = upsertArtistWithMBID(
                primaryArtist.name,
                primaryArtist.id,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                primaryArtist['sort-name'] || null
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

        syncAllMusicBrainzData(db, (current, total, trackPath) => {
            console.log(`[Metadata Sync] ${current}/${total}: ${trackPath}`)
        }).then(results => {
            console.log(`[Metadata Sync] Complete`)
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
        res.status(500).json({ success: false, error: error.message })
    }
}
