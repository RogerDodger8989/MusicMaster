import { getDatabase } from './index'
import { Album, Artist, SearchResults, Track } from '../types'
import { dbTrackToTrack } from './tracks'
import { dbAlbumToAlbum } from './albums'
import { dbArtistToArtist } from './artists'
import fs from 'fs'
import path from 'path'

export function searchLibrary(query: string): SearchResults {
    const db = getDatabase()
    const normalizedQuery = query.toLowerCase().trim()
    const searchTerm = `%${normalizedQuery}%`

    // Log path - try to find a writable location near the DB
    const logPath = path.join(process.cwd(), 'debug-search.log')
    try {
        fs.appendFileSync(logPath, `\n--- SEARCH START: "${query}" (Normalized: "${normalizedQuery}") ---\n`)
    } catch (e) {
        console.warn('Could not write to search log in server root', e)
    }

    try {
        // Log what's in the DB briefly
        try {
            const albumSample = db.prepare('SELECT name, artist FROM albums_cache LIMIT 3').all()
            fs.appendFileSync(logPath, `DB Sample (Albums): ${JSON.stringify(albumSample)}\n`)
        } catch (e) { }

        console.log(`[Search] Query: "${query}", Term: "${searchTerm}"`)

        // 1. Search Artists (Match by artist name only)
        const artistRows = db.prepare(`
            SELECT * FROM artists 
            WHERE name LIKE ?
            LIMIT 10
        `).all(searchTerm) as any[]
        const artists = artistRows.map(dbArtistToArtist)

        console.log(`[Search] Found ${artists.length} artists`)

        // 2. Search Albums (Match by album name or artist name)
        const albumRows = db.prepare(`
            SELECT * FROM albums_cache 
            WHERE name LIKE ? OR artist LIKE ?
            LIMIT 10
        `).all(searchTerm, searchTerm) as any[]
        const albums = albumRows.map(dbAlbumToAlbum)

        console.log(`[Search] Found ${albums.length} albums`)

        // 3. Search Tracks (Match by title, artist, or album)
        // JOIN with albums_cache to get the parent album's ID for navigation
        const rows = db.prepare(`
            SELECT 
                t.*,
                a.id as album_cache_id
            FROM tracks t
            LEFT JOIN albums_cache a ON 
                (t.album = a.name AND (t.album_artist = a.artist OR t.artist = a.artist))
            WHERE t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ?
            LIMIT 20
        `).all(searchTerm, searchTerm, searchTerm) as any[]

        const tracks = rows.map(row => {
            const track = dbTrackToTrack(row);
            // Add the joined albumId
            (track as any).albumId = row.album_cache_id;
            return track;
        });

        console.log(`[Search] Found ${tracks.length} tracks`)

        try {
            fs.appendFileSync(logPath, `Found: ${artists.length} artists, ${albums.length} albums, ${tracks.length} tracks\n`)
        } catch (e) { }

        return {
            artists,
            albums,
            tracks,
            playlists: []
        }
    } catch (error) {
        try {
            fs.appendFileSync(logPath, `ERROR during search: ${error}\n`)
        } catch (e) { }
        console.error('Search error:', error)
        return { artists: [], albums: [], tracks: [], playlists: [] }
    }
}
