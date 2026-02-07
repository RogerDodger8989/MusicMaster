/**
 * MusicBrainz Database Handlers - Module 2c
 * Handles all database operations for storing and retrieving MusicBrainz metadata
 */

import { getDatabase } from './index'
import {
    DbTrack,
    DbArtist,
    DbAlbum,
    DbTrackArtist,
    DbAlbumArtist,
    DbExternalLink,
    DbExternalIdentifier,
    DbAcousticBrainzData,
    DbReleaseInfo,
    DbLabel,
    DbAlbumLabel
} from './types.musicbrainz'
import { v4 as uuidv4 } from 'uuid'

/**
 * Update track with MusicBrainz Recording data
 */
export function updateTrackWithMBID(
    trackId: string,
    mbid: string,
    mbidAlbumId: string | null = null,
    mbidArtistId: string | null = null,
    isrc: string | null = null,
    recordingDate: string | null = null,
    movementNum: number | null = null,
    movementName: string | null = null
): boolean {
    try {
        const db = getDatabase()
        const stmt = db.prepare(`
            UPDATE tracks
            SET mbid = ?,
                mbid_album_id = ?,
                mbid_artist_id = ?,
                isrc = ?,
                recording_date = ?,
                movement_num = ?,
                movement_name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)

        stmt.run(
            mbid,
            mbidAlbumId,
            mbidArtistId,
            isrc,
            recordingDate,
            movementNum,
            movementName,
            trackId
        )

        console.log(`✅ Track ${trackId} updated with MBID: ${mbid}`)
        return true
    } catch (error) {
        console.error('Failed to update track with MBID:', error)
        return false
    }
}

/**
 * Store or update artist with MusicBrainz data
 */
export function upsertArtistWithMBID(
    name: string,
    mbid: string,
    countryCode: string | null = null,
    artistType: string | null = null,
    lifeSpanBegin: string | null = null,
    lifeSpanEnd: string | null = null,
    bio: string | null = null,
    website: string | null = null,
    imagePath: string | null = null
): string {
    try {
        const db = getDatabase()
        const artistId = uuidv4()

        const stmt = db.prepare(`
            INSERT INTO artists (
                id, name, mbid, country, artist_type,
                life_span_begin, life_span_end, bio, website, image_path, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(mbid) DO UPDATE SET
                name = excluded.name,
                country = COALESCE(excluded.country, country),
                artist_type = COALESCE(excluded.artist_type, artist_type),
                life_span_begin = COALESCE(excluded.life_span_begin, life_span_begin),
                life_span_end = COALESCE(excluded.life_span_end, life_span_end),
                bio = COALESCE(excluded.bio, bio),
                website = COALESCE(excluded.website, website),
                image_path = COALESCE(excluded.image_path, image_path),
                updated_at = CURRENT_TIMESTAMP
        `)

        stmt.run(
            artistId,
            name,
            mbid,
            countryCode,
            artistType,
            lifeSpanBegin,
            lifeSpanEnd,
            bio,
            website,
            imagePath
        )

        // Return existing ID if artist already exists
        const existing = db
            .prepare('SELECT id FROM artists WHERE mbid = ?')
            .get(mbid) as { id: string } | undefined
        return existing?.id || artistId
    } catch (error) {
        console.error('Failed to upsert artist:', error)
        throw error
    }
}

/**
 * Store or update album with MusicBrainz data
 */
export function upsertAlbumWithMBID(
    name: string,
    albumArtistId: string | null,
    mbid: string,
    albumType: string | null = null,
    releaseDate: string | null = null,
    barcode: string | null = null,
    status: string | null = null,
    packaging: string | null = null,
    discCount: number = 1
): string {
    try {
        const db = getDatabase()
        const albumId = uuidv4()

        const stmt = db.prepare(`
            INSERT INTO albums (
                id, name, album_artist_id, mbid, album_type,
                release_date, barcode, status, packaging, disc_count, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(mbid) DO UPDATE SET
                name = excluded.name,
                album_artist_id = COALESCE(excluded.album_artist_id, album_artist_id),
                album_type = COALESCE(excluded.album_type, album_type),
                release_date = COALESCE(excluded.release_date, release_date),
                barcode = COALESCE(excluded.barcode, barcode),
                status = COALESCE(excluded.status, status),
                packaging = COALESCE(excluded.packaging, packaging),
                disc_count = COALESCE(excluded.disc_count, disc_count),
                updated_at = CURRENT_TIMESTAMP
        `)

        stmt.run(
            albumId,
            name,
            albumArtistId,
            mbid,
            albumType,
            releaseDate,
            barcode,
            status,
            packaging,
            discCount
        )

        // Return existing ID if album already exists
        const existing = db
            .prepare('SELECT id FROM albums WHERE mbid = ?')
            .get(mbid) as { id: string } | undefined
        return existing?.id || albumId
    } catch (error) {
        console.error('Failed to upsert album:', error)
        throw error
    }
}

/**
 * Add artist to track with role (producer, featured, etc.)
 */
export function addTrackArtist(
    trackId: string,
    artistId: string,
    role: string,
    instrument: string | null = null,
    creditedAs: string | null = null,
    sortPosition: number | null = null
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO track_artists (
                id, track_id, artist_id, role, instrument,
                credited_as, sort_position
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(track_id, artist_id, role, instrument)
            DO UPDATE SET
                credited_as = COALESCE(excluded.credited_as, credited_as),
                sort_position = COALESCE(excluded.sort_position, sort_position)
        `)

        stmt.run(
            uuidv4(),
            trackId,
            artistId,
            role,
            instrument,
            creditedAs,
            sortPosition
        )

        return true
    } catch (error) {
        console.error('Failed to add track artist:', error)
        return false
    }
}

/**
 * Add artist to album with role
 */
export function addAlbumArtist(
    albumId: string,
    artistId: string,
    role: string,
    creditedAs: string | null = null,
    sortPosition: number | null = null
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO album_artists (
                id, album_id, artist_id, role,
                credited_as, sort_position
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(album_id, artist_id, role)
            DO UPDATE SET
                credited_as = COALESCE(excluded.credited_as, credited_as),
                sort_position = COALESCE(excluded.sort_position, sort_position)
        `)

        stmt.run(
            uuidv4(),
            albumId,
            artistId,
            role,
            creditedAs,
            sortPosition
        )

        return true
    } catch (error) {
        console.error('Failed to add album artist:', error)
        return false
    }
}

/**
 * Store external link (Wikipedia, Discogs, etc.)
 */
export function addExternalLink(
    entityType: string,
    entityId: string,
    linkType: string,
    url: string,
    description: string | null = null
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO external_links (
                id, entity_type, entity_id, link_type, url, description
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(entity_type, entity_id, link_type)
            DO UPDATE SET
                url = excluded.url,
                description = excluded.description
        `)

        stmt.run(
            uuidv4(),
            entityType,
            entityId,
            linkType,
            url,
            description
        )

        return true
    } catch (error) {
        console.error('Failed to add external link:', error)
        return false
    }
}

/**
 * Store external identifier (Spotify ID, Apple Music ID, etc.)
 */
export function addExternalIdentifier(
    entityType: string,
    entityId: string,
    identifierType: string,
    value: string
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO external_identifiers (
                id, entity_type, entity_id, identifier_type, value
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(entity_type, entity_id, identifier_type)
            DO UPDATE SET value = excluded.value
        `)

        stmt.run(
            uuidv4(),
            entityType,
            entityId,
            identifierType,
            value
        )

        return true
    } catch (error) {
        console.error('Failed to add external identifier:', error)
        return false
    }
}

/**
 * Store AcousticBrainz audio analysis data
 */
export function storeAcousticBrainzData(
    trackId: string,
    data: Partial<DbAcousticBrainzData>
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO acousticbrainz_data (
                id, track_id, mbid, bpm, bpm_confidence,
                key, key_confidence, energy, danceability,
                acousticness, instrumentalness, liveness,
                speechiness, valence, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(track_id)
            DO UPDATE SET
                mbid = COALESCE(excluded.mbid, mbid),
                bpm = COALESCE(excluded.bpm, bpm),
                bpm_confidence = COALESCE(excluded.bpm_confidence, bpm_confidence),
                key = COALESCE(excluded.key, key),
                key_confidence = COALESCE(excluded.key_confidence, key_confidence),
                energy = COALESCE(excluded.energy, energy),
                danceability = COALESCE(excluded.danceability, danceability),
                acousticness = COALESCE(excluded.acousticness, acousticness),
                instrumentalness = COALESCE(excluded.instrumentalness, instrumentalness),
                liveness = COALESCE(excluded.liveness, liveness),
                speechiness = COALESCE(excluded.speechiness, speechiness),
                valence = COALESCE(excluded.valence, valence),
                updated_at = CURRENT_TIMESTAMP
        `)

        stmt.run(
            uuidv4(),
            trackId,
            data.mbid || null,
            data.bpm || null,
            data.bpm_confidence || null,
            data.key || null,
            data.key_confidence || null,
            data.energy || null,
            data.danceability || null,
            data.acousticness || null,
            data.instrumentalness || null,
            data.liveness || null,
            data.speechiness || null,
            data.valence || null
        )

        return true
    } catch (error) {
        console.error('Failed to store AcousticBrainz data:', error)
        return false
    }
}

/**
 * Get track by MBID
 */
export function getTrackByMBID(mbid: string): DbTrack | null {
    try {
        const db = getDatabase()
        const track = db
            .prepare('SELECT * FROM tracks WHERE mbid = ?')
            .get(mbid) as DbTrack | undefined
        return track || null
    } catch (error) {
        console.error('Failed to get track by MBID:', error)
        return null
    }
}

/**
 * Get artist by MBID
 */
export function getArtistByMBID(mbid: string): DbArtist | null {
    try {
        const db = getDatabase()
        const artist = db
            .prepare('SELECT * FROM artists WHERE mbid = ?')
            .get(mbid) as DbArtist | undefined
        return artist || null
    } catch (error) {
        console.error('Failed to get artist by MBID:', error)
        return null
    }
}

/**
 * Get album by MBID
 */
export function getAlbumByMBID(mbid: string): DbAlbum | null {
    try {
        const db = getDatabase()
        const album = db
            .prepare('SELECT * FROM albums WHERE mbid = ?')
            .get(mbid) as DbAlbum | undefined
        return album || null
    } catch (error) {
        console.error('Failed to get album by MBID:', error)
        return null
    }
}

/**
 * Get all artists for a track (with roles)
 */
export function getTrackArtists(
    trackId: string
): (DbTrackArtist & { artist: DbArtist })[] {
    try {
        const db = getDatabase()
        const artists = db
            .prepare(`
                SELECT ta.*, a.*
                FROM track_artists ta
                LEFT JOIN artists a ON ta.artist_id = a.id
                WHERE ta.track_id = ?
                ORDER BY ta.sort_position ASC
            `)
            .all(trackId) as any[]
        return artists || []
    } catch (error) {
        console.error('Failed to get track artists:', error)
        return []
    }
}

/**
 * Get AcousticBrainz data for a track
 */
export function getTrackAcousticBrainzData(
    trackId: string
): DbAcousticBrainzData | null {
    try {
        const db = getDatabase()
        const data = db
            .prepare('SELECT * FROM acousticbrainz_data WHERE track_id = ?')
            .get(trackId) as DbAcousticBrainzData | undefined
        return data || null
    } catch (error) {
        console.error('Failed to get AcousticBrainz data:', error)
        return null
    }
}

/**
 * Search tracks by ISRC code
 */
export function searchTracksByISRC(isrc: string): DbTrack[] {
    try {
        const db = getDatabase()
        const tracks = db
            .prepare('SELECT * FROM tracks WHERE isrc = ?')
            .all(isrc) as DbTrack[]
        return tracks || []
    } catch (error) {
        console.error('Failed to search tracks by ISRC:', error)
        return []
    }
}

/**
 * Get tracks without MBIDs (for batch processing)
 */
export function getTracksWithoutMBID(limit: number = 100): DbTrack[] {
    try {
        const db = getDatabase()
        const tracks = db
            .prepare(`
                SELECT * FROM tracks
                WHERE mbid IS NULL AND title IS NOT NULL
                LIMIT ?
            `)
            .all(limit) as DbTrack[]
        return tracks || []
    } catch (error) {
        console.error('Failed to get tracks without MBID:', error)
        return []
    }
}

/**
 * Get statistics on MBID coverage
 */
export function getMBIDCoverageStats(): {
    total_tracks: number
    tracks_with_mbid: number
    coverage_percent: number
    tracks_with_isrc: number
    artists_with_mbid: number
} {
    try {
        const db = getDatabase()

        const totalTracks = (
            db.prepare('SELECT COUNT(*) as count FROM tracks').get() as any
        ).count
        const tracksWithMBID = (
            db.prepare('SELECT COUNT(*) as count FROM tracks WHERE mbid IS NOT NULL')
                .get() as any
        ).count
        const tracksWithISRC = (
            db.prepare('SELECT COUNT(*) as count FROM tracks WHERE isrc IS NOT NULL')
                .get() as any
        ).count
        const artistsWithMBID = (
            db.prepare('SELECT COUNT(*) as count FROM artists WHERE mbid IS NOT NULL')
                .get() as any
        ).count

        const coverage = totalTracks > 0
            ? Math.round((tracksWithMBID / totalTracks) * 100)
            : 0

        return {
            total_tracks: totalTracks,
            tracks_with_mbid: tracksWithMBID,
            coverage_percent: coverage,
            tracks_with_isrc: tracksWithISRC,
            artists_with_mbid: artistsWithMBID
        }
    } catch (error) {
        console.error('Failed to get MBID coverage stats:', error)
        return {
            total_tracks: 0,
            tracks_with_mbid: 0,
            coverage_percent: 0,
            tracks_with_isrc: 0,
            artists_with_mbid: 0
        }
    }
}
