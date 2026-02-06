import { getDatabase } from './index'
import { Track, Album, Artist, SearchResults } from '../types'
import fs from 'fs'
import path from 'path'

export function searchLibrary(query: string): SearchResults {
    const db = getDatabase()
    const normalizedQuery = query.toLowerCase().trim()
    const searchTerm = `%${normalizedQuery}%`

    // Log path - try to find a writable location near the DB
    const logPath = path.join(process.cwd(), 'debug-search.log')
    fs.appendFileSync(logPath, `\n--- SEARCH START: "${query}" (Normalized: "${normalizedQuery}") ---\n`)

    try {
        // Log what's in the DB briefly
        const albumSample = db.prepare('SELECT name, artist FROM albums_cache LIMIT 3').all()
        fs.appendFileSync(logPath, `DB Sample (Albums): ${JSON.stringify(albumSample)}\n`)

        // 1. Search Artists (Match by artist name only)
        const artists = db.prepare(`
            SELECT 
                id, name, bio, 
                album_count as albumCount, 
                track_count as trackCount, 
                image_path as imagePath 
            FROM artists 
            WHERE name LIKE ? COLLATE NOCASE
            LIMIT 10
        `).all(searchTerm) as Artist[]

        // 2. Search Albums (Match by album name ONLY)
        // Restricted to title only to avoid showing all albums by an artist when searching for their name
        const albums = db.prepare(`
            SELECT 
                id, name, artist, year, genre, 
                disc_count as discCount, 
                track_count as trackCount, 
                total_duration as totalDuration, 
                cover_art_path as coverArtPath, 
                rating, play_count as playCount,
                musicbrainz_album_id as musicbrainzAlbumId
            FROM albums_cache 
            WHERE name LIKE ? COLLATE NOCASE
            LIMIT 10
        `).all(searchTerm) as Album[]

        // 3. Search Tracks (Match by track title ONLY)
        // JOIN with albums_cache to get the parent album's ID for navigation
        const tracks = db.prepare(`
            SELECT 
                t.id, t.title, t.artist, t.album, t.year, t.genre, t.duration, t.bitrate, t.format, t.rating, t.loved,
                t.file_path as filePath, 
                t.album_artist as albumArtist, 
                t.track_num as trackNum, 
                t.disc_num as discNum, 
                t.cover_art_path as coverArtPath,
                t.release_date as releaseDate,
                t.musicbrainz_track_id as musicbrainzTrackId,
                t.musicbrainz_album_id as musicbrainzAlbumId,
                a.id as albumId
            FROM tracks t
            LEFT JOIN albums_cache a ON 
                (t.album = a.name AND (t.album_artist = a.artist OR t.artist = a.artist))
            WHERE t.title LIKE ? COLLATE NOCASE
            LIMIT 20
        `).all(searchTerm) as Track[]

        fs.appendFileSync(logPath, `Found: ${artists.length} artists, ${albums.length} albums, ${tracks.length} tracks\n`)

        return {
            artists,
            albums,
            tracks,
            playlists: []
        }
    } catch (error) {
        fs.appendFileSync(logPath, `ERROR during search: ${error}\n`)
        console.error('Search error:', error)
        return { artists: [], albums: [], tracks: [], playlists: [] }
    }
}


