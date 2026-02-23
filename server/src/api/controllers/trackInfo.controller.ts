import { Request, Response } from 'express'
import { getDatabase } from '../../database'
import fs from 'fs'

export const getTrackInfo = (req: Request, res: Response) => {
    try {
        const id = req.params.id as string
        const db = getDatabase()

        // Get track info
        const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as any
        if (!track) {
            return res.status(404).json({ error: 'Track not found' })
        }

        // Get album info
        let albumInfo: any = null
        if (track.album) {
            albumInfo = db.prepare('SELECT * FROM albums_cache WHERE name = ? AND artist = ?').get(track.album, track.album_artist || track.artist) as any
        }

        // Get performers (composers, lyricists, producers, etc)
        const performers = db.prepare(`
            SELECT a.name, p.role 
            FROM performers p 
            JOIN artists a ON p.artist_id = a.id 
            WHERE p.track_id = ?
        `).all(id) as any[]

        const composer = performers.filter(p => p.role.toLowerCase() === 'composer').map(p => p.name).join('; ')
        const lyricist = performers.filter(p => p.role.toLowerCase() === 'lyricist').map(p => p.name).join('; ')
        const producer = performers.filter(p => p.role.toLowerCase() === 'producer').map(p => p.name).join('; ')

        // File stats
        let fileSize = 0
        let modifiedAt = null
        try {
            if (fs.existsSync(track.file_path)) {
                const stats = fs.statSync(track.file_path)
                fileSize = stats.size
                modifiedAt = stats.mtime
            }
        } catch (err) {
            console.error('Error reading file stats:', err)
        }

        const info = {
            path: track.file_path,
            albumArtist: track.album_artist || track.artist,
            artist: track.artist,
            disc: track.disc_num,
            trackNum: track.track_num,
            releaseYear: track.year || (track.release_date ? parseInt(track.release_date.substring(0, 4)) : null),
            genres: track.genre,
            duration: track.duration,
            isCompilation: track.album_artist === 'Various Artists',
            codec: track.format,
            bitrate: track.bitrate,
            sampleRate: track.sample_rate,
            bitDepth: track.bit_depth,
            channels: track.channels || 2,
            size: fileSize,
            favorites: track.loved === 1,
            rating: track.rating,
            playcount: track.play_count,
            modified: modifiedAt,
            musicbrainzId: track.musicbrainz_recordingid || track.musicbrainz_trackid,
            composer: composer,
            lyricist: lyricist,
            producer: producer,
            discTotal: albumInfo?.disc_count || 1,
            isrc: track.isrc,
            media: albumInfo?.packaging || 'Digital Media',
            recordLabel: albumInfo?.label,
            releaseCountry: albumInfo?.release_country,
            releaseStatus: albumInfo?.status,
            releaseType: albumInfo?.album_type,
            trackTotal: albumInfo?.track_count
        }

        res.json(info)

    } catch (error) {
        console.error('API Error:', error)
        res.status(500).json({ error: 'Failed to fetch track info' })
    }
}
