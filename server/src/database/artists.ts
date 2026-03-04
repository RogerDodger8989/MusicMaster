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
            musicbrainz_artistid as musicbrainzArtistId,
            country,
            life_span_begin as lifeSpanBegin,
            life_span_end as lifeSpanEnd,
            type,
            gender,
            website,
            urls,
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

    // Transform local file paths to server URLs, but LEAVE remote URLs as is
    if (imagePath && !imagePath.startsWith('http') && !imagePath.startsWith('asset://')) {
        imagePath = `/api/cover/artist/${row.id}?t=${Date.now()}`
    }

    return {
        id: row.id,
        name: row.name,
        albumCount: row.album_count || row.albumCount || 0,
        trackCount: row.track_count || row.trackCount || 0,
        bio: row.bio || undefined,
        imagePath,
        musicbrainzArtistId: row.musicbrainz_artistid || row.musicbrainzArtistId || undefined,
        country: row.country || undefined,
        lifeSpanBegin: row.life_span_begin || row.lifeSpanBegin || undefined,
        gender: row.gender || undefined,
        website: row.website || undefined,
        urls: row.urls || undefined,
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
            musicbrainz_artistid as musicbrainzArtistId,
            country,
            life_span_begin as lifeSpanBegin,
            life_span_end as lifeSpanEnd,
            type,
            gender,
            website,
            urls,
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
    imagePath?: string,
    country?: string,
    lifeSpanBegin?: string,
    lifeSpanEnd?: string,
    type?: string,
    gender?: string,
    website?: string,
    urls?: string,
    bio?: string
}): void {
    const db = getDatabase()

    // Check for verification lock
    const existing = db.prepare('SELECT musicbrainz_artistid, mbid_verified FROM artists WHERE id = ?').get(id) as { musicbrainz_artistid: string | null, mbid_verified: number } | undefined

    let mbidToUpdate = facts.musicbrainzArtistId
    if (existing?.mbid_verified && facts.musicbrainzArtistId && existing.musicbrainz_artistid && facts.musicbrainzArtistId !== existing.musicbrainz_artistid) {
        console.warn(`[Metadata] 🛡️ Permanent Lock: Blocking manual/automated MBID change for verified artist. (Kept: ${existing.musicbrainz_artistid})`)
        mbidToUpdate = existing.musicbrainz_artistid
    }

    // Build dynamic SQL to only update provided fields
    const updates: string[] = []
    const params: any[] = []

    const fieldMap: Record<string, string> = {
        musicbrainzArtistId: 'musicbrainz_artistid',
        imagePath: 'image_path',
        country: 'country',
        lifeSpanBegin: 'life_span_begin',
        lifeSpanEnd: 'life_span_end',
        type: 'type',
        gender: 'gender',
        website: 'website',
        urls: 'urls',
        bio: 'bio'
    }

    for (const [key, columnName] of Object.entries(fieldMap)) {
        const value = key === 'musicbrainzArtistId' ? mbidToUpdate : (facts as any)[key]
        if (value !== undefined) {
            updates.push(`${columnName} = ?`)
            params.push(value === '' ? null : value)
        }
    }

    if (updates.length === 0) return

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    const sql = `UPDATE artists SET ${updates.join(', ')} WHERE id = ?`
    const stmt = db.prepare(sql)
    stmt.run(...params)
}

export function updateArtist(id: string, updates: Partial<Artist>): void {
    if (updates.loved !== undefined) {
        updateArtistLoved(id, updates.loved)
    }

    // Check if any fact fields are present
    const factFields = ['musicbrainzArtistId', 'imagePath', 'country', 'lifeSpanBegin', 'lifeSpanEnd', 'type', 'gender', 'website', 'urls', 'bio']
    const hasFacts = factFields.some(field => field in updates)

    if (hasFacts) {
        updateArtistFacts(id, updates)
    }
}
