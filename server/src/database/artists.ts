import { getDatabase } from './index'
import { Artist } from '../types'

export function getAllArtists(): Artist[] {
    const db = getDatabase()
    const rows = db.prepare(`
        SELECT 
            id, name, bio, 
            album_count as albumCount, 
            track_count as trackCount, 
            image_path as imagePath,
            musicbrainz_artist_id as musicbrainzArtistId,
            country,
            life_span_begin as lifeSpanBegin,
            life_span_end as lifeSpanEnd,
            type,
            gender,
            website,
            loved
        FROM artists 
        ORDER BY name ASC
    `).all() as any[]

    return rows.map(dbArtistToArtist)
}

/**
 * Convert database row to Artist object
 */
export function dbArtistToArtist(row: any): Artist {
    let imagePath = row.image_path || row.imagePath || undefined

    // Transform local file paths to server URLs
    if (imagePath && !imagePath.startsWith('http')) {
        imagePath = `/api/cover/artist/${row.id}?t=${Date.now()}`
    }

    return {
        id: row.id,
        name: row.name,
        albumCount: row.album_count || row.albumCount || 0,
        trackCount: row.track_count || row.trackCount || 0,
        bio: row.bio || undefined,
        imagePath,
        musicbrainzArtistId: row.musicbrainz_artist_id || row.musicbrainzArtistId || undefined,
        country: row.country || undefined,
        lifeSpanBegin: row.life_span_begin || row.lifeSpanBegin || undefined,
        lifeSpanEnd: row.life_span_end || row.lifeSpanEnd || undefined,
        type: row.type || undefined,
        gender: row.gender || undefined,
        website: row.website || undefined,
        loved: row.loved === 1
    }
}

export function getArtistById(id: string): Artist | null {
    const db = getDatabase()
    const row = db.prepare(`
        SELECT 
            id, name, bio, 
            album_count as albumCount, 
            track_count as trackCount, 
            image_path as imagePath,
            musicbrainz_artist_id as musicbrainzArtistId,
            country,
            life_span_begin as lifeSpanBegin,
            life_span_end as lifeSpanEnd,
            type,
            gender,
            website,
            loved
        FROM artists 
        WHERE id = ?
    `).get(id) as any

    if (!row) return null

    return dbArtistToArtist(row)
}

export function updateArtistLoved(id: string, loved: boolean): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE artists SET loved = ? WHERE id = ?')
    stmt.run(loved ? 1 : 0, id)
}

export function updateArtistFacts(id: string, facts: {
    musicbrainzArtistId?: string,
    country?: string,
    lifeSpanBegin?: string,
    lifeSpanEnd?: string,
    type?: string,
    gender?: string,
    website?: string,
    bio?: string
}): void {
    const db = getDatabase()
    const stmt = db.prepare(`
        UPDATE artists 
        SET musicbrainz_artist_id = COALESCE(?, musicbrainz_artist_id),
            country = COALESCE(?, country),
            life_span_begin = COALESCE(?, life_span_begin),
            life_span_end = COALESCE(?, life_span_end),
            type = COALESCE(?, type),
            gender = COALESCE(?, gender),
            website = COALESCE(?, website),
            bio = COALESCE(?, bio)
        WHERE id = ?
    `)
    stmt.run(
        facts.musicbrainzArtistId || null,
        facts.country || null,
        facts.lifeSpanBegin || null,
        facts.lifeSpanEnd || null,
        facts.type || null,
        facts.gender || null,
        facts.website || null,
        facts.bio || null,
        id
    )
}

export function updateArtist(id: string, updates: Partial<Artist>): void {
    if (updates.loved !== undefined) {
        updateArtistLoved(id, updates.loved)
    }

    // Check if any fact fields are present
    const factFields = ['musicbrainzArtistId', 'country', 'lifeSpanBegin', 'lifeSpanEnd', 'type', 'gender', 'website', 'bio']
    const hasFacts = factFields.some(field => field in updates)

    if (hasFacts) {
        updateArtistFacts(id, updates)
    }
}
