import { getDatabase } from './index'
import { randomUUID } from 'crypto'
import type { DbAlbumCache } from './index'
import type { Album } from '../types'
import { extractCoverArt } from '../services/coverArt'
import { lastFmService } from '../services/lastfm'
import { spotifyService } from '../services/spotify'
import { app } from 'electron'
import path from 'path'

/**
 * Aggregate albums from tracks
 * Groups tracks by album + artist and calculates metadata
 */
export async function aggregateAlbums(): Promise<void> {
  const db = getDatabase()

  console.log('🎵 Aggregating albums from tracks...')

  // 0. Backup manual ratings
  // Since IDs change on re-aggregation (UUIDs), we must backup by Name+Artist
  const ratingBackup = new Map<string, { rating: number; loved: number }>()
  try {
    const existing = db
      .prepare('SELECT name, artist, rating, loved FROM albums_cache WHERE rating > 0 OR loved = 1')
      .all() as any[]
    for (const row of existing) {
      const key = `${row.name}|${row.artist}`
      ratingBackup.set(key, { rating: row.rating, loved: row.loved })
    }
    console.log(`💾 Backed up ${ratingBackup.size} manual album ratings/loved status`)
  } catch (e) {
    console.warn('Could not backup ratings (might be first run):', e)
  }

  // Clear existing cache
  console.log('🗑️ Clearing existing album and artist cache...')
  db.prepare('DELETE FROM albums_cache').run()
  db.prepare('DELETE FROM artists').run()

  // 1. Get all aggregated data from tracks
  // NOTE: Removed MAX(rating) and MAX(loved) from aggregation to prevent auto-rating
  const rows = db
    .prepare(
      `
        SELECT
            COALESCE(NULLIF(album, ''), 'Unknown Album') as name,
            COALESCE(album_artist, artist, 'Unknown Artist') as artist,
            MAX(year) as year,
            MIN(release_date) as release_date,
            GROUP_CONCAT(DISTINCT genre) as genres_raw,
            MAX(COALESCE(disc_num, 1)) as disc_count,
            COUNT(*) as track_count,
            SUM(duration) as total_duration,
            MAX(cover_art_path) as cover_art_path,
            MAX(musicbrainz_albumid) as musicbrainz_albumid,
            MAX(last_played) as last_played,
            SUM(play_count) as play_count
        FROM tracks
        GROUP BY COALESCE(NULLIF(album, ''), 'Unknown Album'), COALESCE(album_artist, artist, 'Unknown Artist')
    `
    )
    .all() as any[]

  if (rows.length === 0) {
    console.log('⚠️ No albums found to aggregate.')
    return
  }

  console.log(`📊 Aggregated ${rows.length} albums.`)

  // 2. Prepare Insert Statement
  const insertStmt = db.prepare(`
        INSERT INTO albums_cache (
            id, name, artist, year, release_date, genre,
            disc_count, track_count, total_duration, cover_art_path,
            musicbrainz_albumid, rating, loved, last_played, play_count, created_at, updated_at
        ) VALUES (
            @id, @name, @artist, @year, @release_date, @genre,
            @disc_count, @track_count, @total_duration, @cover_art_path,
            @musicbrainz_albumid, @rating, @loved, @last_played, @play_count, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    `)

  // 3. Insert records with generated IDs
  const insertTransaction = db.transaction((albums: any[]) => {
    for (const album of albums) {
      const id = randomUUID()

      // Post-process genres: take up to 5 unique ones
      let processedGenre = album.genres_raw || 'Unknown'
      if (album.genres_raw) {
        // Support multiple delimiters: , ; : | / // \
        processedGenre = album.genres_raw
          .split(/[,;:|]|\/\/|\/|\\/)
          .map((g: string) => g.trim())
          .filter((g: string) => g && g !== 'Unknown' && g.toLowerCase() !== 'unknown')
          .filter((g: string, i: number, self: string[]) => {
            // Case-insensitive distinct
            return self.findIndex((s) => s.toLowerCase() === g.toLowerCase()) === i
          })
          .slice(0, 5)
          .join(' / ')
      }

      // Restore manual rating/loved
      const key = `${album.name}|${album.artist}`
      const filteredBackup = ratingBackup.get(key)

      const finalRating = filteredBackup?.rating || 0
      const finalLoved = filteredBackup?.loved || 0

      insertStmt.run({
        ...album,
        genre: processedGenre,
        rating: finalRating,
        loved: finalLoved,
        id
      })
    }
  })

  try {
    insertTransaction(rows)
    console.log(`✅ Aggregated ${rows.length} albums successfully`)

    // 4. Aggregate artists
    console.log('👤 Aggregating artists...')
    const artistRows = db
      .prepare(
        `
            SELECT 
                COALESCE(album_artist, artist, 'Unknown Artist') as name,
                COUNT(DISTINCT album) as album_count,
                COUNT(*) as track_count
            FROM tracks
            GROUP BY COALESCE(album_artist, artist, 'Unknown Artist')
        `
      )
      .all() as any[]

    const insertArtistStmt = db.prepare(`
            INSERT INTO artists (id, name, album_count, track_count)
            VALUES (?, ?, ?, ?)
        `)

    const artistTransaction = db.transaction((artists: any[]) => {
      for (const artist of artists) {
        insertArtistStmt.run(randomUUID(), artist.name, artist.album_count, artist.track_count)
      }
    })
    artistTransaction(artistRows)
    console.log(`✅ Aggregated ${artistRows.length} artists successfully`)

    // 5. Extract cover art and external metadata
    const albums = db
      .prepare('SELECT id, name, artist, cover_art_path FROM albums_cache')
      .all() as any[]

    console.log(`🖼️ Processing cover art for ${albums.length} albums...`)

    for (const album of albums) {
      let hasCover = !!album.cover_art_path

      // 1. Try local extraction if no cover path yet
      if (!hasCover) {
        const track = db
          .prepare(
            `
                    SELECT file_path FROM tracks
                    WHERE COALESCE(NULLIF(album, ''), 'Unknown Album') = ?
                    AND COALESCE(album_artist, artist, 'Unknown Artist') = ?
                    LIMIT 1
                `
          )
          .get(album.name, album.artist) as { file_path: string } | undefined

        if (track) {
          try {
            const coverPath = await extractCoverArt(track.file_path, album.id)
            if (coverPath) {
              // Use asset:/// (3 slashes) for absolute paths
              const finalPath = `asset:///${coverPath.replace(/\\/g, '/')}`
              console.log(`[CoverArt] Local extraction success for ${album.name}: ${finalPath}`)
              db.prepare('UPDATE albums_cache SET cover_art_path = ? WHERE id = ?').run(
                finalPath,
                album.id
              )
              hasCover = true
            }
          } catch (err) {
            console.error(`Local cover extraction failed for ${album.name}:`, err)
          }
        }
      }

      // 2. Try LastFM if still no cover
      if (!hasCover) {
        try {
          const info = await lastFmService.getAlbumInfo(album.artist, album.name)
          const imageUrl = lastFmService.getBestImage(info?.image || [])
          if (imageUrl) {
            const cachedPath = await lastFmService.downloadImage(
              imageUrl,
              `${album.id}.jpg`,
              path.join(app.getPath('userData'), 'covers')
            )
            if (cachedPath) {
              const finalPath = `asset:///${cachedPath.replace(/\\/g, '/')}`
              console.log(`[CoverArt] LastFM download success for ${album.name}: ${finalPath}`)
              db.prepare('UPDATE albums_cache SET cover_art_path = ? WHERE id = ?').run(
                finalPath,
                album.id
              )
            }
          }
        } catch (err) {
          console.error(`LastFM album info fetch failed for ${album.artist} - ${album.name}:`, err)
        }
      }
    }

    // 6. Process Artist Images & Info
    const artistsData = db.prepare('SELECT id, name FROM artists').all() as any[]
    console.log(`👤 Processing external info for ${artistsData.length} artists...`)

    // Load Last.fm API key from database (if available)
    try {
      const dbKey = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'lastfmApiKey'").get() as any
      if (dbKey) {
        const keyValue = JSON.parse(dbKey.setting_value)
        lastFmService.setApiKey(keyValue)
        console.log('🔑 Loaded Last.fm API key from database for artist enrichment')
      }
    } catch (e) {
      console.log('ℹ️ No Last.fm API key found in database, using environment variable')
    }

    for (const artist of artistsData) {
      try {
        const info = await lastFmService.getArtistInfo(artist.name)

        // Try Spotify for potentially better images (like MusicWest does)
        let imageUrl = await spotifyService.getArtistImage(artist.name)

        // Fallback to Last.fm if Spotify fails
        if (!imageUrl) {
          imageUrl = lastFmService.getBestImage(info?.image || [])
        }

        let imagePath: string | null = null

        if (imageUrl) {
          const cachedPath = await lastFmService.downloadImage(
            imageUrl,
            `artist-${artist.id}.jpg`,
            path.join(app.getPath('userData'), 'covers')
          )
          if (cachedPath) {
            imagePath = `asset:///${cachedPath.replace(/\\/g, '/')}`
          }
        }

        if (imagePath || info?.bio?.summary) {
          db.prepare('UPDATE artists SET image_path = ?, bio = ? WHERE id = ?').run(
            imagePath || null,
            info?.bio?.summary || null,
            artist.id
          )
          console.log(
            `[ArtistInfo] Enriched ${artist.name} (Bio: ${!!info?.bio?.summary}, Image: ${!!imagePath})`
          )
        }
      } catch (err) {
        console.error(`LastFM artist info fetch failed for ${artist.name}:`, err)
      }
    }

    console.log('✅ Metadata and cover art processing complete')
  } catch (error) {
    console.error('❌ Failed to aggregate albums:', error)
    throw error
  }
}

/**
 * Get all albums
 */
export function getAllAlbums(): Album[] {
  const db = getDatabase()

  const rows = db.prepare('SELECT * FROM albums_cache ORDER BY name').all() as DbAlbumCache[]

  return rows.map(dbAlbumToAlbum)
}

/**
 * Get albums by genre
 */
export function getAlbumsByGenre(genre: string): Album[] {
  const db = getDatabase()

  const rows = db
    .prepare('SELECT * FROM albums_cache WHERE genre = ? ORDER BY name')
    .all(genre) as DbAlbumCache[]

  return rows.map(dbAlbumToAlbum)
}

/**
 * Get all genres with album counts
 */
export function getAllGenres(): Array<{ genre: string; count: number }> {
  const db = getDatabase()
  const rows = db
    .prepare("SELECT genre FROM albums_cache WHERE genre IS NOT NULL AND genre != ''")
    .all() as Array<{ genre: string }>

  const genreMap = new Map<string, number>()

  rows.forEach((row) => {
    // Split by " / "
    const parts = row.genre
      .split(' / ')
      .map((g) => g.trim())
      .filter((g) => g)
    parts.forEach((p) => {
      genreMap.set(p, (genreMap.get(p) || 0) + 1)
    })
  })

  const result = Array.from(genreMap.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => a.genre.localeCompare(b.genre))

  return result
}

/**
 * Get albums sorted by various criteria
 */
export function getAlbumsSortedBy(
  sortBy: 'title' | 'year' | 'rating' | 'recently_added' | 'recently_played' | 'recently_released'
): Album[] {
  const db = getDatabase()

  let orderBy = 'name'
  switch (sortBy) {
    case 'title':
      orderBy = 'name'
      break
    case 'year':
      orderBy = 'year DESC'
      break
    case 'rating':
      orderBy = 'rating DESC, name'
      break
    case 'recently_added':
      orderBy = 'created_at DESC'
      break
    case 'recently_played':
      orderBy = 'last_played DESC NULLS LAST, name'
      break
    case 'recently_released':
      orderBy = 'release_date DESC NULLS LAST, year DESC NULLS LAST, name'
      break
  }

  const rows = db.prepare(`SELECT * FROM albums_cache ORDER BY ${orderBy}`).all() as DbAlbumCache[]

  return rows.map(dbAlbumToAlbum)
}

/**
 * Get album by ID
 */
export function getAlbumById(id: string): Album | null {
  const db = getDatabase()

  const row = db.prepare('SELECT * FROM albums_cache WHERE id = ?').get(id) as
    | DbAlbumCache
    | undefined

  return row ? dbAlbumToAlbum(row) : null
}

/**
 * Update album rating
 */
export function updateAlbumRating(albumId: string, rating: number): void {
  const db = getDatabase()

  db.prepare('UPDATE albums_cache SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    rating,
    albumId
  )

  console.log(`✅ Updated album ${albumId} rating to ${rating}`)
}

/**
 * Update album loved status
 */
export function updateAlbumLoved(albumId: string, loved: boolean): void {
  const db = getDatabase()

  db.prepare('UPDATE albums_cache SET loved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    loved ? 1 : 0,
    albumId
  )

  console.log(`✅ Updated album ${albumId} loved to ${loved}`)
}

/**
 * Update album bio
 */
export function updateAlbumBio(albumId: string, bio: string): void {
  const db = getDatabase()

  db.prepare('UPDATE albums_cache SET bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    bio,
    albumId
  )

  console.log(`✅ Updated album ${albumId} bio`)
}

/**
 * Convert database row to Album object
 */
function dbAlbumToAlbum(row: DbAlbumCache): Album {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    year: row.year || undefined,
    releaseDate: row.release_date || undefined,
    genre: row.genre || undefined,
    discCount: row.disc_count,
    trackCount: row.track_count,
    totalDuration: row.total_duration,
    coverArtPath: row.cover_art_path || undefined,
    musicbrainzAlbumId: row.musicbrainz_albumid || undefined,
    rating: row.rating,
    loved: Boolean(row.loved),
    playCount: row.play_count,
    lastPlayed: row.last_played ? new Date(row.last_played) : undefined,
    bio: row.bio || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}
