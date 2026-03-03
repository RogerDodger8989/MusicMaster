import { getDatabase, type DbTrack } from './index'
import type { Track } from '../types'
import { randomUUID, createHash } from 'crypto'
import fs from 'fs'

/**
 * Insert or update a track in the database
 */
export function upsertTrack(
  track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'> & { folderId: string }
): string {
  const db = getDatabase()

  // Check if track already exists by file path
  const existing = db.prepare('SELECT id FROM tracks WHERE file_path = ?').get(track.filePath) as
    | { id: string }
    | undefined

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
        play_count = ?,
        release_date = ?,
        musicbrainz_trackid = ?,
        musicbrainz_albumid = ?,
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
      track.playCount || 0,
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
        cover_art_path, rating, loved, play_count, release_date, musicbrainz_trackid,
        musicbrainz_albumid, sample_rate, bit_depth, replaygain_track_gain,
        replaygain_album_gain, replaygain_track_peak, replaygain_album_peak,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      track.playCount || 0,
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
  const stmt = db.prepare(`
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    ORDER BY t.artist, t.album, t.disc_num, t.track_num
  `)
  const rows = stmt.all() as DbTrack[]
  return rows.map(dbTrackToTrack)
}

/**
 * Get top tracks for an artist
 */
export function getArtistTopTracks(artist: string, limit: number = 50): Track[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
      SELECT * FROM tracks 
      WHERE (artist = ? OR album_artist = ?)
      ORDER BY play_count DESC 
      LIMIT ?
      `
    )
    .all(artist, artist, limit) as DbTrack[]
  return rows.map(dbTrackToTrack)
}

/**
 * Get most played tracks
 */
export function getMostPlayed(limit: number = 50): Track[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    WHERE t.play_count > 0
    ORDER BY t.play_count DESC
    LIMIT ?
  `)
  const rows = stmt.all(limit) as DbTrack[]
  return rows.map(dbTrackToTrack)
}


/**
 * Get tracks by folder ID
 */
export function getTracksByFolder(folderId: string): Track[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    WHERE t.folder_id = ?
    ORDER BY t.artist, t.album, t.disc_num, t.track_num
  `)
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
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    WHERE COALESCE(NULLIF(t.album, ''), 'Unknown Album') = ? 
    AND COALESCE(t.album_artist, t.artist, 'Unknown Artist') = ?
    ORDER BY t.disc_num, t.track_num
  `)
  const rows = stmt.all(name, artist) as DbTrack[]
  return rows.map(dbTrackToTrack)
}

/**
 * Get track by ID
 */
export function getTrackById(id: string): Track | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    WHERE t.id = ?
  `)
  const row = stmt.get(id) as DbTrack | undefined
  return row ? dbTrackToTrack(row) : null
}

/**
 * Get track by file path
 */
export function getTrackByPath(filePath: string): Track | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT 
      t.*,
      COALESCE(a.bpm, null) as bpm,
      COALESCE(a.key, null) as key,
      COALESCE(a.energy, null) as energy,
      COALESCE(a.danceability, null) as danceability,
      COALESCE(a.acousticness, null) as acousticness,
      COALESCE(a.mood_acoustic, null) as mood_acoustic,
      COALESCE(a.mood_aggressive, null) as mood_aggressive,
      COALESCE(a.mood_electronic, null) as mood_electronic,
      COALESCE(a.mood_happy, null) as mood_happy,
      COALESCE(a.mood_sad, null) as mood_sad,
      COALESCE(a.mood_relaxed, null) as mood_relaxed,
      COALESCE(a.mood_party, null) as mood_party
    FROM tracks t
    LEFT JOIN acousticbrainz_data a ON t.id = a.track_id
    WHERE t.file_path = ?
  `)
  const row = stmt.get(filePath) as DbTrack | undefined
  return row ? dbTrackToTrack(row) : null
}

/**
 * Update track rating
 */
export function updateTrackRating(id: string, rating: number): void {
  const db = getDatabase()
  const stmt = db.prepare(
    'UPDATE tracks SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
  stmt.run(rating, id)
}

/**
 * Update track loved status
 */
export function updateTrackLoved(id: string, loved: boolean): void {
  const db = getDatabase()
  const stmt = db.prepare(
    'UPDATE tracks SET loved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
  stmt.run(loved ? 1 : 0, id)
}

/**
 * Bulk update tracks
 */
export function bulkUpdateTracks(trackIds: string[], updates: any): void {
  const db = getDatabase()
  const fields = Object.keys(updates)
  if (fields.length === 0) return

  const setClause = fields.map((f) => `${f.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)} = ?`).join(', ')
  const values = Object.values(updates)

  const stmt = db.prepare(`UPDATE tracks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
  const transaction = db.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(...values, id)
    }
  })
  transaction(trackIds)
}

/**
 * Delete track
 */
export function deleteTrack(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM tracks WHERE id = ?').run(id)
}

/**
 * Update MusicBrainz IDs for a track
 */
export function updateTrackMusicBrainz(
  id: string,
  data: { trackId?: string; albumId?: string; artistId?: string }
): void {
  const db = getDatabase()
  const stmt = db.prepare(`
        UPDATE tracks 
        SET musicbrainz_trackid = ?, 
            musicbrainz_albumid = ?, 
            musicbrainz_artistid = ?,
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `)
  stmt.run(data.trackId || null, data.albumId || null, data.artistId || null, id)
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
    playCount: dbTrack.play_count || 0,
    releaseDate: dbTrack.release_date || undefined,
    musicbrainzTrackId: dbTrack.musicbrainz_trackid || undefined,
    musicbrainzAlbumId: dbTrack.musicbrainz_albumid || undefined,
    musicbrainzArtistId: dbTrack.musicbrainz_artistid || undefined,
    isrc: dbTrack.isrc || undefined,
    replayGainTrack: (dbTrack as any).replaygain_track_gain || undefined,
    replayGainAlbum: (dbTrack as any).replaygain_album_gain || undefined,
    replayGainTrackPeak: (dbTrack as any).replaygain_track_peak || undefined,
    replayGainAlbumPeak: (dbTrack as any).replaygain_album_peak || undefined,
    bpm: dbTrack.bpm || undefined,
    key: dbTrack.key || undefined,
    energy: dbTrack.energy || undefined,
    danceability: dbTrack.danceability || undefined,
    moodAcoustic: dbTrack.mood_acoustic || undefined,
    moodAggressive: dbTrack.mood_aggressive || undefined,
    moodElectronic: dbTrack.mood_electronic || undefined,
    moodHappy: dbTrack.mood_happy || undefined,
    moodSad: dbTrack.mood_sad || undefined,
    moodRelaxed: dbTrack.mood_relaxed || undefined,
    moodParty: dbTrack.mood_party || undefined,
    createdAt: new Date(dbTrack.created_at),
    updatedAt: new Date(dbTrack.updated_at)
  }
}
/**
 * Add a scrobble to the queue
 */
export function addScrobbleToQueue(
  trackId: string,
  artist: string,
  title: string,
  album: string | null,
  playedTimestamp: number
): string {
  const db = getDatabase()
  const id = randomUUID()
  const stmt = db.prepare(`
        INSERT INTO scrobble_queue (id, track_id, artist, title, album, played_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `)
  stmt.run(id, trackId, artist, title, album || null, playedTimestamp)
  return id
}

/**
 * Get pending scrobbles
 */
export function getPendingScrobbles(limit: number = 50): Array<{
  id: string
  trackId: string
  artist: string
  title: string
  album: string | null
  playedAt: number
  lastfmSubmitted: boolean
  listenbrainzSubmitted: boolean
}> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
            SELECT id, track_id, artist, title, album, played_at, lastfm_submitted, listenbrainz_submitted
            FROM scrobble_queue
            WHERE lastfm_submitted = 0 OR listenbrainz_submitted = 0
            LIMIT ?
        `
    )
    .all(limit) as Array<any>

  return rows.map((row: any) => ({
    id: row.id,
    trackId: row.track_id,
    artist: row.artist,
    title: row.title,
    album: row.album,
    playedAt: row.played_at,
    lastfmSubmitted: row.lastfm_submitted === 1,
    listenbrainzSubmitted: row.listenbrainz_submitted === 1
  }))
}

/**
 * Mark scrobble as submitted to a service
 */
export function markScrobbleSubmitted(
  scrobbleId: string,
  service: 'lastfm' | 'listenbrainz'
): void {
  const db = getDatabase()
  const column = service === 'lastfm' ? 'lastfm_submitted' : 'listenbrainz_submitted'
  const stmt = db.prepare(`UPDATE scrobble_queue SET ${column} = 1 WHERE id = ?`)
  stmt.run(scrobbleId)

  // Check if both services have submitted
  const row = db
    .prepare('SELECT lastfm_submitted, listenbrainz_submitted FROM scrobble_queue WHERE id = ?')
    .get(scrobbleId) as any
  // Note: We don't have a 'submitted' column in the schema currently,
  // we rely on the individual service columns. If we wanted a global 'submitted' column
  // we would need to add it to the schema in index.ts.
  // For now, we'll just fix the typo in case it's used elsewhere.
  if (row && row.lastfm_submitted === 1 && row.listenbrainz_submitted === 1) {
    // All enabled services are done.
    // We could optionally delete the row here to keep the queue small,
    // but keeping it for history is fine too.
  }
}

/**
 * Record a play in history
 */
export function recordPlayHistory(trackId: string): void {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Check if track was played today
  const existing = db
    .prepare(
      `
            SELECT id, play_count FROM play_history
            WHERE track_id = ? AND DATE(played_at) = DATE(?)
        `
    )
    .get(trackId, now) as { id: string; play_count: number } | undefined

  if (existing) {
    // Increment play count for today
    const stmt = db.prepare('UPDATE play_history SET play_count = play_count + 1 WHERE id = ?')
    stmt.run(existing.id)
  } else {
    // Create new play history entry
    const id = randomUUID()
    const stmt = db.prepare(`
            INSERT INTO play_history (id, track_id, played_at, play_count)
            VALUES (?, ?, ?, 1)
        `)
    stmt.run(id, trackId, now)
  }

  // ALSO update the master play_count in the tracks table for immediate access/performance
  db.prepare(
    'UPDATE tracks SET play_count = play_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(trackId)
}

/**
 * Get play count for a track
 */
export function getTrackPlayCount(trackId: string): number {
  const db = getDatabase()
  const row = db.prepare('SELECT play_count FROM tracks WHERE id = ?').get(trackId) as
    | { play_count: number }
    | undefined
  return row?.play_count || 0
}
