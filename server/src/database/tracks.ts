import { getDatabase, type DbTrack } from './index'
import type { Track } from '../types'
import { v4 as randomUUID } from 'uuid'
import { createHash } from 'crypto'
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
        play_count = ?,
        release_date = ?,
        musicbrainz_trackid = ?,
        musicbrainz_albumid = ?,
        musicbrainz_artistid = ?,
        musicbrainz_recordingid = ?,
        musicbrainz_releasegroupid = ?,
        musicbrainz_workid = ?,
        sample_rate = ?,
        bit_depth = ?,
        replaygain_track_gain = ?,
        replaygain_album_gain = ?,
        replaygain_track_peak = ?,
        replaygain_album_peak = ?,
        composer = ?,
        lyrics = ?,
        comment = ?,
        track_total = ?,
        disc_total = ?,
        mood = ?,
        conductor = ?,
        grouping = ?,
        album_rating = ?,
        original_artist = ?,
        original_album = ?,
        original_year = ?,
        tempo = ?,
        occasion = ?,
        keywords = ?,
        language = ?,
        custom1 = ?,
        custom2 = ?,
        custom3 = ?,
        custom4 = ?,
        custom5 = ?,
        custom6 = ?,
        custom7 = ?,
        custom8 = ?,
        custom9 = ?,
        custom10 = ?,
        custom11 = ?,
        custom12 = ?,
        custom13 = ?,
        custom14 = ?,
        custom15 = ?,
        custom16 = ?,
        custom17 = ?,
        custom18 = ?,
        custom19 = ?,
        custom20 = ?,
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
            track.musicbrainzArtistId || null,
            track.musicbrainzRecordingId || null,
            track.musicbrainzReleaseGroupId || null,
            track.musicbrainzWorkId || null,
            track.sampleRate || null,
            track.bitDepth || null,
            track.replayGainTrack || null,
            track.replayGainAlbum || null,
            track.replayGainTrackPeak || null,
            track.replayGainAlbumPeak || null,
            track.composer || null,
            track.lyrics || null,
            track.comment || null,
            track.trackTotal || null,
            track.discTotal || null,
            (track as any).mood || null,
            (track as any).conductor || null,
            (track as any).grouping || null,
            (track as any).albumRating || 0,
            (track as any).originalArtist || null,
            (track as any).originalAlbum || null,
            (track as any).originalYear || null,
            (track as any).tempo || null,
            (track as any).occasion || null,
            (track as any).keywords || null,
            (track as any).language || null,
            (track as any).custom1 || null,
            (track as any).custom2 || null,
            (track as any).custom3 || null,
            (track as any).custom4 || null,
            (track as any).custom5 || null,
            (track as any).custom6 || null,
            (track as any).custom7 || null,
            (track as any).custom8 || null,
            (track as any).custom9 || null,
            (track as any).custom10 || null,
            (track as any).custom11 || null,
            (track as any).custom12 || null,
            (track as any).custom13 || null,
            (track as any).custom14 || null,
            (track as any).custom15 || null,
            (track as any).custom16 || null,
            (track as any).custom17 || null,
            (track as any).custom18 || null,
            (track as any).custom19 || null,
            (track as any).custom20 || null,
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
        musicbrainz_albumid, musicbrainz_artistid, musicbrainz_recordingid, 
        musicbrainz_releasegroupid, musicbrainz_workid, sample_rate, bit_depth, 
        replaygain_track_gain, replaygain_album_gain, replaygain_track_peak, replaygain_album_peak,
        composer, lyrics, comment, track_total, disc_total,
        mood, conductor, grouping, album_rating, original_artist, original_album, original_year,
        tempo, occasion, keywords, language,
        custom1, custom2, custom3, custom4, custom5, custom6, custom7, custom8, custom9, custom10,
        custom11, custom12, custom13, custom14, custom15, custom16, custom17, custom18, custom19, custom20,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            track.musicbrainzArtistId || null,
            track.musicbrainzRecordingId || null,
            track.musicbrainzReleaseGroupId || null,
            track.musicbrainzWorkId || null,
            track.sampleRate || null,
            track.bitDepth || null,
            track.replayGainTrack || null,
            track.replayGainAlbum || null,
            track.replayGainTrackPeak || null,
            track.replayGainAlbumPeak || null,
            track.composer || null,
            track.lyrics || null,
            track.comment || null,
            track.trackTotal || null,
            track.discTotal || null,
            (track as any).mood || null,
            (track as any).conductor || null,
            (track as any).grouping || null,
            (track as any).albumRating || 0,
            (track as any).originalArtist || null,
            (track as any).originalAlbum || null,
            (track as any).originalYear || null,
            (track as any).tempo || null,
            (track as any).occasion || null,
            (track as any).keywords || null,
            (track as any).language || null,
            (track as any).custom1 || null,
            (track as any).custom2 || null,
            (track as any).custom3 || null,
            (track as any).custom4 || null,
            (track as any).custom5 || null,
            (track as any).custom6 || null,
            (track as any).custom7 || null,
            (track as any).custom8 || null,
            (track as any).custom9 || null,
            (track as any).custom10 || null,
            (track as any).custom11 || null,
            (track as any).custom12 || null,
            (track as any).custom13 || null,
            (track as any).custom14 || null,
            (track as any).custom15 || null,
            (track as any).custom16 || null,
            (track as any).custom17 || null,
            (track as any).custom18 || null,
            (track as any).custom19 || null,
            (track as any).custom20 || null,
            now,
            now
        )
    }

    return id
}

/**
 * Helper to attach performers to tracks
 */
function attachPerformers(tracks: Track[]): Track[] {
    const db = getDatabase()
    const trackIds = tracks.map(t => t.id)

    if (trackIds.length === 0) return tracks

    // Fetch all performers for these tracks
    // distinct roles per artist per track
    const performers = db.prepare(`
        SELECT p.track_id, a.name, a.id as artist_id, p.role 
        FROM performers p 
        JOIN artists a ON p.artist_id = a.id
    `).all() as any[]

    // Group by track_id
    const performersMap = new Map<string, Array<{ name: string, role: string, id: string }>>()

    for (const p of performers) {
        if (!performersMap.has(p.track_id)) {
            performersMap.set(p.track_id, [])
        }
        performersMap.get(p.track_id)?.push({
            name: p.name,
            role: p.role,
            id: p.artist_id
        })
    }

    // Attach to tracks
    return tracks.map(t => ({
        ...t,
        performers: performersMap.get(t.id) || []
    }))
}

/**
 * Get all tracks
 */
export function getAllTracks(): Track[] {
    const db = getDatabase()
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.bpm, null) as bpm,
            COALESCE(ab.key, null) as key,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            COALESCE(ab.acousticness, null) as acousticness,
            COALESCE(ab.mood_acoustic, null) as mood_acoustic,
            COALESCE(ab.mood_aggressive, null) as mood_aggressive,
            COALESCE(ab.mood_electronic, null) as mood_electronic,
            COALESCE(ab.mood_happy, null) as mood_happy,
            COALESCE(ab.mood_sad, null) as mood_sad,
            COALESCE(ab.mood_relaxed, null) as mood_relaxed,
            COALESCE(ab.mood_party, null) as mood_party,
            COALESCE(ab.arousal, null) as arousal,
            COALESCE(ab.valence, null) as valence,
            COALESCE(ab.mood_category, null) as mood_category,
            COALESCE(ab.confidence_score, null) as confidence_score
        FROM tracks t
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        ORDER BY t.artist, t.album, t.disc_num, t.track_num
    `)
    const rows = stmt.all() as (DbTrack & { album_id?: string })[]
    const tracks = rows.map(dbTrackToTrack)
    return attachPerformers(tracks)
}

/**
 * Get tracks by folder ID
 */
export function getTracksByFolder(folderId: string): Track[] {
    const db = getDatabase()
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.bpm, null) as bpm,
            COALESCE(ab.key, null) as key,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            COALESCE(ab.acousticness, null) as acousticness,
            COALESCE(ab.mood_acoustic, null) as mood_acoustic,
            COALESCE(ab.mood_aggressive, null) as mood_aggressive,
            COALESCE(ab.mood_electronic, null) as mood_electronic,
            COALESCE(ab.mood_happy, null) as mood_happy,
            COALESCE(ab.mood_sad, null) as mood_sad,
            COALESCE(ab.mood_relaxed, null) as mood_relaxed,
            COALESCE(ab.mood_party, null) as mood_party,
            COALESCE(ab.arousal, null) as arousal,
            COALESCE(ab.valence, null) as valence,
            COALESCE(ab.mood_category, null) as mood_category,
            COALESCE(ab.confidence_score, null) as confidence_score
        FROM tracks t
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE t.folder_id = ? 
        ORDER BY t.artist, t.album, t.disc_num, t.track_num
    `)
    const rows = stmt.all(folderId) as (DbTrack & { album_id?: string })[]
    const tracks = rows.map(dbTrackToTrack)
    return attachPerformers(tracks)
}

/**
 * Delete track by ID
 */
export function deleteTrackById(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM tracks WHERE id = ?').run(id)
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
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.bpm, null) as bpm,
            COALESCE(ab.key, null) as key,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            COALESCE(ab.acousticness, null) as acousticness,
            COALESCE(ab.mood_acoustic, null) as mood_acoustic,
            COALESCE(ab.mood_aggressive, null) as mood_aggressive,
            COALESCE(ab.mood_electronic, null) as mood_electronic,
            COALESCE(ab.mood_happy, null) as mood_happy,
            COALESCE(ab.mood_sad, null) as mood_sad,
            COALESCE(ab.mood_relaxed, null) as mood_relaxed,
            COALESCE(ab.mood_party, null) as mood_party,
            COALESCE(ab.arousal, null) as arousal,
            COALESCE(ab.valence, null) as valence,
            COALESCE(ab.mood_category, null) as mood_category,
            COALESCE(ab.confidence_score, null) as confidence_score
        FROM tracks t 
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE COALESCE(NULLIF(t.album, ''), 'Unknown Album') = ? 
        AND COALESCE(t.album_artist, t.artist, 'Unknown Artist') = ?
        ORDER BY t.disc_num, t.track_num
    `)
    const rows = stmt.all(name, artist) as (DbTrack & { album_id?: string })[]
    const tracks = rows.map(dbTrackToTrack)
    return attachPerformers(tracks)
}

/**
 * Get track by ID
 */
export function getTrackById(id: string): Track | null {
    const db = getDatabase()
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.bpm, null) as bpm,
            COALESCE(ab.key, null) as key,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            COALESCE(ab.acousticness, null) as acousticness,
            COALESCE(ab.mood_acoustic, null) as mood_acoustic,
            COALESCE(ab.mood_aggressive, null) as mood_aggressive,
            COALESCE(ab.mood_electronic, null) as mood_electronic,
            COALESCE(ab.mood_happy, null) as mood_happy,
            COALESCE(ab.mood_sad, null) as mood_sad,
            COALESCE(ab.mood_relaxed, null) as mood_relaxed,
            COALESCE(ab.mood_party, null) as mood_party,
            COALESCE(ab.arousal, null) as arousal,
            COALESCE(ab.valence, null) as valence,
            COALESCE(ab.mood_category, null) as mood_category,
            COALESCE(ab.confidence_score, null) as confidence_score
        FROM tracks t
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE t.id = ?
    `)
    const row = stmt.get(id) as (DbTrack & { album_id?: string }) | undefined
    return row ? dbTrackToTrack(row) : null
}

/**
 * Get track by file path
 */
export function getTrackByPath(filePath: string): Track | null {
    const db = getDatabase()
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.bpm, null) as bpm,
            COALESCE(ab.key, null) as key,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            COALESCE(ab.acousticness, null) as acousticness,
            COALESCE(ab.mood_acoustic, null) as mood_acoustic,
            COALESCE(ab.mood_aggressive, null) as mood_aggressive,
            COALESCE(ab.mood_electronic, null) as mood_electronic,
            COALESCE(ab.mood_happy, null) as mood_happy,
            COALESCE(ab.mood_sad, null) as mood_sad,
            COALESCE(ab.mood_relaxed, null) as mood_relaxed,
            COALESCE(ab.mood_party, null) as mood_party,
            COALESCE(ab.arousal, null) as arousal,
            COALESCE(ab.valence, null) as valence,
            COALESCE(ab.mood_category, null) as mood_category,
            COALESCE(ab.confidence_score, null) as confidence_score
        FROM tracks t
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE t.file_path = ?
    `)
    const row = stmt.get(filePath) as (DbTrack & { album_id?: string }) | undefined
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
 * Update track play count
 */
export function updateTrackPlayCount(id: string, playCount: number): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE tracks SET play_count = play_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    stmt.run(id)
}

/**
 * Update MusicBrainz IDs for a track
 */
export function updateTrackMusicBrainz(id: string, data: { trackId?: string, albumId?: string, artistId?: string }): void {
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
        musicbrainzRecordingId: dbTrack.musicbrainz_recordingid || undefined,
        musicbrainzReleaseGroupId: dbTrack.musicbrainz_releasegroupid || undefined,
        musicbrainzWorkId: dbTrack.musicbrainz_workid || undefined,
        albumId: (dbTrack as any).album_id, // Joined from albums_cache
        replayGainTrack: dbTrack.replaygain_track_gain || undefined,
        replayGainAlbum: dbTrack.replaygain_album_gain || undefined,
        replayGainTrackPeak: dbTrack.replaygain_track_peak || undefined,
        replayGainAlbumPeak: dbTrack.replaygain_album_peak || undefined,
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
        instrumentalness: dbTrack.instrumentalness || undefined,
        arousal: (dbTrack as any).arousal || undefined,
        valence: (dbTrack as any).valence || undefined,
        moodCategory: (dbTrack as any).mood_category || undefined,
        confidenceScore: (dbTrack as any).confidence_score || undefined,
        composer: dbTrack.composer || undefined,
        lyrics: dbTrack.lyrics || undefined,
        comment: dbTrack.comment || undefined,
        trackTotal: dbTrack.track_total || undefined,
        discTotal: dbTrack.disc_total || undefined,
        mood: dbTrack.mood || undefined,
        conductor: dbTrack.conductor || undefined,
        grouping: dbTrack.grouping || undefined,
        albumRating: dbTrack.album_rating || 0,
        originalArtist: dbTrack.original_artist || undefined,
        originalAlbum: dbTrack.original_album || undefined,
        originalYear: dbTrack.original_year || undefined,
        tempo: dbTrack.tempo || undefined,
        occasion: dbTrack.occasion || undefined,
        keywords: dbTrack.keywords || undefined,
        language: dbTrack.language || undefined,
        custom1: dbTrack.custom1 || undefined,
        custom2: dbTrack.custom2 || undefined,
        custom3: dbTrack.custom3 || undefined,
        custom4: dbTrack.custom4 || undefined,
        custom5: dbTrack.custom5 || undefined,
        custom6: dbTrack.custom6 || undefined,
        custom7: dbTrack.custom7 || undefined,
        custom8: dbTrack.custom8 || undefined,
        custom9: dbTrack.custom9 || undefined,
        custom10: dbTrack.custom10 || undefined,
        custom11: dbTrack.custom11 || undefined,
        custom12: dbTrack.custom12 || undefined,
        custom13: dbTrack.custom13 || undefined,
        custom14: dbTrack.custom14 || undefined,
        custom15: dbTrack.custom15 || undefined,
        custom16: dbTrack.custom16 || undefined,
        custom17: dbTrack.custom17 || undefined,
        custom18: dbTrack.custom18 || undefined,
        custom19: dbTrack.custom19 || undefined,
        custom20: dbTrack.custom20 || undefined,
        createdAt: new Date(dbTrack.created_at),
        updatedAt: new Date(dbTrack.updated_at)
    }
}
/**
 * Add a scrobble to the queue
 */
export function addScrobbleToQueue(trackId: string, artist: string, title: string, album: string | null, playedTimestamp: number): string {
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
        .prepare(`
            SELECT id, track_id, artist, title, album, played_at, lastfm_submitted, listenbrainz_submitted
            FROM scrobble_queue
            WHERE lastfm_submitted = 0 OR listenbrainz_submitted = 0
            LIMIT ?
        `)
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
export function markScrobbleSubmitted(scrobbleId: string, service: 'lastfm' | 'listenbrainz'): void {
    const db = getDatabase()
    const column = service === 'lastfm' ? 'lastfm_submitted' : 'listenbrainz_submitted'
    const stmt = db.prepare(`UPDATE scrobble_queue SET ${column} = 1 WHERE id = ?`)
    stmt.run(scrobbleId)

    // Check if both services have submitted
    const row = db.prepare('SELECT lastfm_submitted, listenbrainz_submitted FROM scrobble_queue WHERE id = ?').get(scrobbleId) as any
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
        .prepare(`
            SELECT id, play_count FROM play_history
            WHERE track_id = ? AND DATE(played_at) = DATE(?)
        `)
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
    db.prepare('UPDATE tracks SET play_count = play_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(trackId)
}

/**
 * Get play count for a track
 */
export function getTrackPlayCount(trackId: string): number {
    const db = getDatabase()
    const row = db
        .prepare('SELECT play_count FROM tracks WHERE id = ?')
        .get(trackId) as { play_count: number } | undefined
    return row?.play_count || 0
}

/**
 * Get most played tracks by time range
 */
export function getMostPlayedTracksByRange(range: string, limit: number = 10): Track[] {
    const db = getDatabase()

    let dateFilter = ''
    switch (range) {
        case 'this-week':
            // Since most recent Monday 00:00:00 local time
            dateFilter = "AND played_at >= datetime('now', 'localtime', 'weekday 1', '-7 days', 'start of day')"
            break
        case 'week':
            dateFilter = "AND played_at >= datetime('now', '-7 days')"
            break
        case 'month':
            dateFilter = "AND played_at >= datetime('now', '-30 days')"
            break
        case 'year':
            dateFilter = "AND played_at >= datetime('now', 'start of year')"
            break
        case 'last-year':
            dateFilter = "AND played_at BETWEEN datetime('now', 'start of year', '-1 year') AND datetime('now', 'start of year', '-1 second')"
            break
        default:
            // All-time: Use the play_count from tracks table for better performance
            const stmt = db.prepare(`
                SELECT t.*, ac.id as album_id,
                    COALESCE(ab.energy, null) as energy,
                    COALESCE(ab.danceability, null) as danceability
                FROM tracks t
                LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
                LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
                WHERE t.play_count > 0
                ORDER BY t.play_count DESC
                LIMIT ?
            `)
            const rows = stmt.all(limit) as (DbTrack & { album_id?: string })[]
            return attachPerformers(rows.map(dbTrackToTrack))
    }

    // Filtered by history
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability,
            SUM(CASE WHEN ph.play_count > 0 THEN ph.play_count ELSE 1 END) as range_play_count
        FROM play_history ph
        JOIN tracks t ON ph.track_id = t.id
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE 1=1 ${dateFilter}
        GROUP BY t.id
        ORDER BY range_play_count DESC
        LIMIT ?
    `)

    const rows = stmt.all(limit) as (DbTrack & { album_id?: string; range_play_count: number })[]

    return attachPerformers(rows.map(row => ({
        ...dbTrackToTrack(row),
        playCount: row.range_play_count // Map range play count back to playCount for UI
    })))
}

/**
 * Get simple similar tracks (same genre, different album)
 */
export function getSimilarTracks(trackId: string, limit: number = 20): Track[] {
    const db = getDatabase()
    const track = getTrackById(trackId)
    if (!track) return []

    // Basic logic: same genre, different album, random selection
    const stmt = db.prepare(`
        SELECT t.*, ac.id as album_id,
            COALESCE(ab.energy, null) as energy,
            COALESCE(ab.danceability, null) as danceability
        FROM tracks t
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE t.genre = ? AND t.id != ?
        ORDER BY RANDOM()
        LIMIT ?
    `)

    const rows = stmt.all(track.genre, trackId, limit) as (DbTrack & { album_id?: string })[]
    return attachPerformers(rows.map(dbTrackToTrack))
}

/**
 * Update track metadata in the database
 */
export function updateTrackMetadata(id: string, metadata: Partial<Track>): void {
    const db = getDatabase()
    const fields = Object.keys(metadata)
    if (fields.length === 0) return

    // Get valid columns to avoid crashing on unknown fields
    const validColumns = db.prepare('PRAGMA table_info(tracks)').all().map((c: any) => c.name)

    const snakeMetadata: any = {}
    for (const key of fields) {
        // Handle fields that don't follow simple camelToSnake or need special mapping
        let snakeKey = camelToSnake(key)

        // Special cases
        if (key === 'trackNum') snakeKey = 'track_num'
        if (key === 'discNum') snakeKey = 'disc_num'
        if (key === 'trackTotal') snakeKey = 'track_total'
        if (key === 'discTotal') snakeKey = 'disc_total'
        if (key === 'albumArtist') snakeKey = 'album_artist'
        if (key === 'musicbrainzTrackId') snakeKey = 'musicbrainz_track_id'
        if (key === 'musicbrainzAlbumId') snakeKey = 'musicbrainz_album_id'
        if (key === 'musicbrainzArtistId') snakeKey = 'musicbrainz_artist_id'
        if (key === 'musicbrainzRecordingId') snakeKey = 'musicbrainz_recording_id'
        if (key === 'musicbrainzReleaseGroupId') snakeKey = 'musicbrainz_release_group_id'
        if (key === 'musicbrainzWorkId') snakeKey = 'musicbrainz_work_id'
        if (key === 'replayGainTrack') snakeKey = 'replaygain_track_gain'
        if (key === 'replayGainAlbum') snakeKey = 'replaygain_album_gain'
        if (key === 'replayGainTrackPeak') snakeKey = 'replaygain_track_peak'
        if (key === 'replayGainAlbumPeak') snakeKey = 'replaygain_album_peak'
        if (key === 'albumRating') snakeKey = 'album_rating'
        if (key === 'originalArtist') snakeKey = 'original_artist'
        if (key === 'originalAlbum') snakeKey = 'original_album'
        if (key === 'originalYear') snakeKey = 'original_year'
        if (key === 'grouping') snakeKey = 'grouping' // SQLite might need [] but JS object key is fine

        if (validColumns.includes(snakeKey)) {
            snakeMetadata[snakeKey] = (metadata as any)[key]
        } else {
            console.log(`⚠️ Ignoring unknown column: ${snakeKey} (mapped from ${key})`)
        }
    }

    const snakeFields = Object.keys(snakeMetadata)
    if (snakeFields.length === 0) return
    const setClause = snakeFields.map(f => `${f === 'grouping' ? '[grouping]' : f} = ?`).join(', ')
    const values = snakeFields.map(f => {
        const val = snakeMetadata[f]
        if (val === undefined) return null
        if (typeof val === 'boolean') return val ? 1 : 0
        return val
    })

    try {
        require('fs').writeFileSync('debug_sql.txt', `SQL: UPDATE tracks SET ${setClause}\nValues: ${JSON.stringify(values)}`)
    } catch (e) { }

    const stmt = db.prepare(`UPDATE tracks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    stmt.run(...values, id)
}

function camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}
