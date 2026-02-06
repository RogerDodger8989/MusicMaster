import { getDatabase, type DbTrack } from './index'
import type { Track } from '../types'
import { randomUUID, createHash } from 'crypto'
import fs from 'fs'

/**
 * Insert or update a track in the database
 */
export function upsertTrack(track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'> & { folderId: string }): string {
    const db = getDatabase()

    // Check if track already exists by file path
    const existing = db
        .prepare('SELECT id FROM tracks WHERE file_path = ?')
        .get(track.filePath) as { id: string } | undefined

    const id = existing?.id || randomUUID()
    const now = new Date().toISOString()

    if (existing) {
        // Update existing track
        const stmt = db.prepare(`
      UPDATE tracks SET
        title = ?,
        artist = ?,
        album = ?,
        album_artist = ?,
        year = ?,
        genre = ?,
        track_num = ?,
        disc_num = ?,
        duration = ?,
        bitrate = ?,
        format = ?,
        cover_art_path = ?,
        file_hash = ?,
        rating = ?,
        loved = ?,
        release_date = ?,
        musicbrainz_track_id = ?,
        musicbrainz_album_id = ?,
        sample_rate = ?,
        bit_depth = ?,
        replaygain_track_gain = ?,
        replaygain_album_gain = ?,
        replaygain_track_peak = ?,
        replaygain_album_peak = ?,
        updated_at = ?
      WHERE id = ?
    `)

        stmt.run(
            track.title,
            track.artist,
            track.album,
            track.albumArtist || null,
            track.year || null,
            track.genre || null,
            track.trackNum || null,
            track.discNum || null,
            track.duration,
            track.bitrate,
            track.format,
            track.coverArtPath || null,
            track.fileHash || null,
            track.rating || 0,
            track.loved ? 1 : 0,
            track.releaseDate || null,
            track.musicbrainzTrackId || null,
            track.musicbrainzAlbumId || null,
            track.sampleRate || null,
            track.bitDepth || null,
            (track as any).replayGainTrack || null,
            (track as any).replayGainAlbum || null,
            (track as any).replayGainTrackPeak || null,
            (track as any).replayGainAlbumPeak || null,
            now,
            id
        )
    } else {
        // Insert new track
        const stmt = db.prepare(`
      INSERT INTO tracks (
        id, folder_id, file_path, file_hash, title, artist, album, album_artist,
        year, genre, track_num, disc_num, duration, bitrate, format,
        cover_art_path, rating, loved, release_date, musicbrainz_track_id,
        musicbrainz_album_id, sample_rate, bit_depth, replaygain_track_gain,
        replaygain_album_gain, replaygain_track_peak, replaygain_album_peak,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

        stmt.run(
            id,
            track.folderId,
            track.filePath,
            track.fileHash || null,
            track.title,
            track.artist,
            track.album,
            track.albumArtist || null,
            track.year || null,
            track.genre || null,
            track.trackNum || null,
            track.discNum || null,
            track.duration,
            track.bitrate,
            track.format,
            track.coverArtPath || null,
            track.rating || 0,
            track.loved ? 1 : 0,
            track.releaseDate || null,
            track.musicbrainzTrackId || null,
            track.musicbrainzAlbumId || null,
            track.sampleRate || null,
            track.bitDepth || null,
            (track as any).replayGainTrack || null,
            (track as any).replayGainAlbum || null,
            (track as any).replayGainTrackPeak || null,
            (track as any).replayGainAlbumPeak || null,
            now,
            now
        )
    }

    return id
}

/**
 * Get all tracks
 */
export function getAllTracks(): Track[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM tracks ORDER BY artist, album, disc_num, track_num')
    const rows = stmt.all() as DbTrack[]
    return rows.map(dbTrackToTrack)
}

/**
 * Get tracks by folder ID
 */
export function getTracksByFolder(folderId: string): Track[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM tracks WHERE folder_id = ? ORDER BY artist, album, disc_num, track_num')
    const rows = stmt.all(folderId) as DbTrack[]
    return rows.map(dbTrackToTrack)
}

/**
 * Delete track by file path
 */
export function deleteTrackByPath(filePath: string): void {
    const db = getDatabase()
    const stmt = db.prepare('DELETE FROM tracks WHERE file_path = ?')
    stmt.run(filePath)
}

/**
 * Get tracks by album and artist
 */
export function getTracksByAlbum(name: string, artist: string): Track[] {
    const db = getDatabase()
    const stmt = db.prepare(`
        SELECT * FROM tracks 
        WHERE COALESCE(NULLIF(album, ''), 'Unknown Album') = ? 
        AND COALESCE(album_artist, artist, 'Unknown Artist') = ?
        ORDER BY disc_num, track_num
    `)
    const rows = stmt.all(name, artist) as DbTrack[]
    return rows.map(dbTrackToTrack)
}

/**
 * Get track by ID
 */
export function getTrackById(id: string): Track | null {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM tracks WHERE id = ?')
    const row = stmt.get(id) as DbTrack | undefined
    return row ? dbTrackToTrack(row) : null
}

/**
 * Get track by file path
 */
export function getTrackByPath(filePath: string): Track | null {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM tracks WHERE file_path = ?')
    const row = stmt.get(filePath) as DbTrack | undefined
    return row ? dbTrackToTrack(row) : null
}

/**
 * Update track rating
 */
export function updateTrackRating(id: string, rating: number): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE tracks SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    stmt.run(rating, id)
}

/**
 * Update track loved status
 */
export function updateTrackLoved(id: string, loved: boolean): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE tracks SET loved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    stmt.run(loved ? 1 : 0, id)
}

/**
 * Calculate file hash (SHA256)
 */
export function calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath)
    const hashSum = createHash('sha256')
    hashSum.update(fileBuffer)
    return hashSum.digest('hex')
}

/**
 * Convert database track to Track type
 */
export function dbTrackToTrack(dbTrack: DbTrack): Track {
    return {
        id: dbTrack.id,
        filePath: dbTrack.file_path,
        fileHash: dbTrack.file_hash || undefined,
        title: dbTrack.title,
        artist: dbTrack.artist,
        album: dbTrack.album,
        albumArtist: dbTrack.album_artist || undefined,
        year: dbTrack.year || undefined,
        genre: dbTrack.genre || undefined,
        trackNum: dbTrack.track_num || undefined,
        discNum: dbTrack.disc_num || undefined,
        duration: dbTrack.duration,
        bitrate: dbTrack.bitrate,
        format: dbTrack.format,
        sampleRate: dbTrack.sample_rate || undefined,
        bitDepth: dbTrack.bit_depth || undefined,
        coverArtPath: dbTrack.cover_art_path || undefined,
        rating: dbTrack.rating,
        loved: dbTrack.loved === 1,
        releaseDate: dbTrack.release_date || undefined,
        musicbrainzTrackId: dbTrack.musicbrainz_track_id || undefined,
        musicbrainzAlbumId: dbTrack.musicbrainz_album_id || undefined,
        replayGainTrack: (dbTrack as any).replaygain_track_gain || undefined,
        replayGainAlbum: (dbTrack as any).replaygain_album_gain || undefined,
        replayGainTrackPeak: (dbTrack as any).replaygain_track_peak || undefined,
        replayGainAlbumPeak: (dbTrack as any).replaygain_album_peak || undefined,
        createdAt: new Date(dbTrack.created_at),
        updatedAt: new Date(dbTrack.updated_at)
    }
}
