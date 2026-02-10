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
    DbAcousticBrainzData
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
    recordingDate: string | null = null,
    movementNum: number | null = null,
    movementName: string | null = null,
    publisher: string | null = null,
    isrc: string | null = null
): boolean {
    try {
        const db = getDatabase()
        const stmt = db.prepare(`
            UPDATE tracks
            SET musicbrainz_trackid = ?,
                musicbrainz_albumid = ?,
                musicbrainz_artistid = ?,
                isrc = COALESCE(?, isrc),
                recording_date = ?,
                movement_num = ?,
                movement = ?,
                publisher = COALESCE(?, publisher),
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
            publisher,
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
    mbid: string | null = null,
    countryCode: string | null = null,
    artistType: string | null = null,
    lifeSpanBegin: string | null = null,
    lifeSpanEnd: string | null = null,
    bio: string | null = null,
    website: string | null = null,
    imagePath: string | null = null,
    nameSortOrder: string | null = null,
    genderOther: string | null = null
): string {
    try {
        const db = getDatabase()

        // 1. Try to find existing artist by MBID if provided
        let existing: { id: string, name: string, musicbrainz_artistid: string | null } | undefined
        if (mbid) {
            existing = db.prepare('SELECT id, name, musicbrainz_artistid FROM artists WHERE musicbrainz_artistid = ?').get(mbid) as any
        }

        // 2. Fallback: Try to find by name (and country if provided)
        if (!existing) {
            if (countryCode) {
                existing = db.prepare('SELECT id, name, musicbrainz_artistid FROM artists WHERE name = ? AND country = ?').get(name, countryCode) as any
            } else {
                existing = db.prepare('SELECT id, name, musicbrainz_artistid FROM artists WHERE name = ?').get(name) as any
            }
        }

        if (existing) {
            // Update existing artist
            db.prepare(`
                UPDATE artists SET
                    name = ?,
                    musicbrainz_artistid = COALESCE(?, musicbrainz_artistid),
                    country = COALESCE(?, country),
                    artist_type = COALESCE(?, artist_type),
                    life_span_begin = COALESCE(?, life_span_begin),
                    life_span_end = COALESCE(?, life_span_end),
                    bio = COALESCE(?, bio),
                    website = COALESCE(?, website),
                    image_path = COALESCE(?, image_path),
                    name_sort_order = COALESCE(?, name_sort_order),
                    gender_other = COALESCE(?, gender_other),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                name, mbid, countryCode, artistType, lifeSpanBegin, lifeSpanEnd,
                bio, website, imagePath, nameSortOrder, genderOther,
                existing.id
            )
            return existing.id
        }

        // 3. Insert new artist
        const artistId = uuidv4()
        db.prepare(`
            INSERT INTO artists (
                id, name, musicbrainz_artistid, country, artist_type,
                life_span_begin, life_span_end, bio, website, image_path,
                name_sort_order, gender_other, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            artistId, name, mbid, countryCode, artistType,
            lifeSpanBegin, lifeSpanEnd, bio, website, imagePath,
            nameSortOrder, genderOther
        )
        return artistId
    } catch (error) {
        console.error('Failed to upsert artist:', error, { name, mbid })
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
    discCount: number = 1,
    releaseGroupMBID: string | null = null,
    releaseTitle: string | null = null,
    label: string | null = null,
    catalogNumber: string | null = null
): string {
    try {
        const db = getDatabase()
        const albumId = uuidv4()

        const stmt = db.prepare(`
            INSERT INTO albums (
                id, name, album_artist_id, musicbrainz_albumid, album_type,
                release_date, barcode, status, packaging, disc_count,
                musicbrainz_releasegroupid, release_title, label, catalog_number, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(musicbrainz_albumid) DO UPDATE SET
                name = excluded.name,
                album_artist_id = COALESCE(excluded.album_artist_id, album_artist_id),
                album_type = COALESCE(excluded.album_type, album_type),
                release_date = COALESCE(excluded.release_date, release_date),
                barcode = COALESCE(excluded.barcode, barcode),
                status = COALESCE(excluded.status, status),
                packaging = COALESCE(excluded.packaging, packaging),
                disc_count = COALESCE(excluded.disc_count, disc_count),
                musicbrainz_releasegroupid = COALESCE(excluded.musicbrainz_releasegroupid, musicbrainz_releasegroupid),
                release_title = COALESCE(excluded.release_title, release_title),
                label = COALESCE(excluded.label, label),
                catalog_number = COALESCE(excluded.catalog_number, catalog_number),
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
            discCount,
            releaseGroupMBID,
            releaseTitle,
            label,
            catalogNumber
        )

        // Return existing ID if album already exists
        const existing = db
            .prepare('SELECT id FROM albums WHERE musicbrainz_albumid = ?')
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
    joinPhrase: string | null = null,
    sortPosition: number | null = null
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO track_artists (
                id, track_id, artist_id, role, instrument,
                credited_as, join_phrase, sort_position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(track_id, artist_id, role, instrument)
            DO UPDATE SET
                credited_as = COALESCE(excluded.credited_as, credited_as),
                join_phrase = COALESCE(excluded.join_phrase, join_phrase),
                sort_position = COALESCE(excluded.sort_position, sort_position)
        `)

        stmt.run(
            uuidv4(),
            trackId,
            artistId,
            role,
            instrument,
            creditedAs,
            joinPhrase,
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
    joinPhrase: string | null = null,
    sortPosition: number | null = null
): boolean {
    try {
        const db = getDatabase()

        const stmt = db.prepare(`
            INSERT INTO album_artists (
                id, album_id, artist_id, role,
                credited_as, join_phrase, sort_position
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(album_id, artist_id, role)
            DO UPDATE SET
                credited_as = COALESCE(excluded.credited_as, credited_as),
                join_phrase = COALESCE(excluded.join_phrase, join_phrase),
                sort_position = COALESCE(excluded.sort_position, sort_position)
        `)

        stmt.run(
            uuidv4(),
            albumId,
            artistId,
            role,
            creditedAs,
            joinPhrase,
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
                id, track_id, musicbrainz_recordingid, bpm, bpm_confidence,
                energy, danceability,
                acousticness, instrumentalness, liveness,
                speechiness, valence, mood_acoustic, mood_aggressive,
                mood_electronic, mood_happy, mood_sad, mood_relaxed,
                mood_party, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(track_id)
            DO UPDATE SET
                musicbrainz_recordingid = COALESCE(excluded.musicbrainz_recordingid, musicbrainz_recordingid),
                bpm = COALESCE(excluded.bpm, bpm),
                bpm_confidence = COALESCE(excluded.bpm_confidence, bpm_confidence),
                energy = COALESCE(excluded.energy, energy),
                danceability = COALESCE(excluded.danceability, danceability),
                acousticness = COALESCE(excluded.acousticness, acousticness),
                instrumentalness = COALESCE(excluded.instrumentalness, instrumentalness),
                liveness = COALESCE(excluded.liveness, liveness),
                speechiness = COALESCE(excluded.speechiness, speechiness),
                valence = COALESCE(excluded.valence, valence),
                mood_acoustic = COALESCE(excluded.mood_acoustic, mood_acoustic),
                mood_aggressive = COALESCE(excluded.mood_aggressive, mood_aggressive),
                mood_electronic = COALESCE(excluded.mood_electronic, mood_electronic),
                mood_happy = COALESCE(excluded.mood_happy, mood_happy),
                mood_sad = COALESCE(excluded.mood_sad, mood_sad),
                mood_relaxed = COALESCE(excluded.mood_relaxed, mood_relaxed),
                mood_party = COALESCE(excluded.mood_party, mood_party),
                updated_at = CURRENT_TIMESTAMP
        `)

        stmt.run(
            uuidv4(),
            trackId,
            data.musicbrainz_recordingid || null,
            data.bpm || null,
            data.bpm_confidence || null,
            data.energy || null,
            data.danceability || null,
            data.acousticness || null,
            data.instrumentalness || null,
            data.liveness || null,
            data.speechiness || null,
            data.valence || null,
            (data as any).mood_acoustic || null,
            (data as any).mood_aggressive || null,
            (data as any).mood_electronic || null,
            (data as any).mood_happy || null,
            (data as any).mood_sad || null,
            (data as any).mood_relaxed || null,
            (data as any).mood_party || null
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
            .prepare('SELECT * FROM tracks WHERE musicbrainz_trackid = ?')
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
            .prepare('SELECT * FROM artists WHERE musicbrainz_artistid = ?')
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
            .prepare('SELECT * FROM albums WHERE musicbrainz_albumid = ?')
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
                WHERE musicbrainz_trackid IS NULL AND title IS NOT NULL
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
            db.prepare('SELECT COUNT(*) as count FROM tracks WHERE musicbrainz_trackid IS NOT NULL')
                .get() as any
        ).count
        const tracksWithISRC = (
            db.prepare('SELECT COUNT(*) as count FROM tracks WHERE isrc IS NOT NULL')
                .get() as any
        ).count
        const artistsWithMBID = (
            db.prepare('SELECT COUNT(*) as count FROM artists WHERE musicbrainz_artistid IS NOT NULL')
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

/**
 * Add or update a track performer/credit
 */
export function addPerformer(trackId: string, artistId: string, role: string) {
    try {
        const db = getDatabase()
        db.prepare(`
            INSERT INTO performers (id, track_id, artist_id, role, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(track_id, artist_id, role) DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP
        `).run(uuidv4(), trackId, artistId, role)
        console.log(`[Database] Added performer to track ${trackId}: Artist ${artistId} as ${role}`)
    } catch (error) {
        console.error(`[Database] Failed to add performer:`, error, { trackId, artistId, role })
    }
}

/**
 * Add or update an album credit
 */
export function addAlbumCredit(albumId: string, artistId: string, role: string) {
    try {
        const db = getDatabase()
        db.prepare(`
            INSERT INTO album_credits (id, album_id, artist_id, role, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(album_id, artist_id, role) DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP
        `).run(uuidv4(), albumId, artistId, role)
        console.log(`[Database] Added album credit to album ${albumId}: Artist ${artistId} as ${role}`)
    } catch (error) {
        console.error(`[Database] Failed to add album credit:`, error, { albumId, artistId, role })
    }
}
/**
 * Get all performers and credits for an album
 */
export function getAlbumPerformers(albumId: string): any[] {
    try {
        const db = getDatabase()

        // Find all track IDs for this album
        const album = db.prepare("SELECT name, artist FROM albums_cache WHERE id = ?").get(albumId) as { name: string, artist: string } | undefined
        if (!album) return []

        const tracks = db.prepare("SELECT id FROM tracks WHERE album = ? AND (album_artist = ? OR artist = ?)").all(album.name, album.artist, album.artist) as { id: string }[]
        const trackIds = tracks.map(t => t.id)

        if (trackIds.length === 0) return []

        // Get performers for all these tracks
        const performers = db.prepare(`
            SELECT p.*, a.name as artist_name, a.image_path as artist_image
            FROM performers p
            LEFT JOIN artists a ON p.artist_id = a.id
            WHERE p.track_id IN (${trackIds.map(() => '?').join(',')})
        `).all(...trackIds)

        // Get album-level credits too
        const albumCredits = db.prepare(`
            SELECT ac.*, a.name as artist_name, a.image_path as artist_image
            FROM album_credits ac
            LEFT JOIN artists a ON ac.artist_id = a.id
            WHERE ac.album_id = ?
        `).all(albumId)

        return [...performers, ...albumCredits]
    } catch (error) {
        console.error('Failed to get album performers:', error)
        return []
    }
}
