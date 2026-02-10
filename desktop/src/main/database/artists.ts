import { getDatabase } from './index'
import { Artist } from '../types'

export function getAllArtists(): Artist[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
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
            loved
        FROM artists 
        ORDER BY name ASC
    `
    )
    .all() as any[]

  return rows.map((row) => ({
    ...row,
    loved: row.loved === 1
  }))
}

export function updateArtistLoved(id: string, loved: boolean): void {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE artists SET loved = ? WHERE id = ?')
  stmt.run(loved ? 1 : 0, id)
}
export function updateArtistFacts(
  id: string,
  facts: {
    musicbrainzArtistId?: string
    country?: string
    lifeSpanBegin?: string
    lifeSpanEnd?: string
    type?: string
    gender?: string
    website?: string
    bio?: string
  }
): void {
  const db = getDatabase()
  const stmt = db.prepare(`
        UPDATE artists 
        SET musicbrainz_artistid = COALESCE(?, musicbrainz_artistid),
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
