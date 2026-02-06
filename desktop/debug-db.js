const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to user data database
// Usually in %APPDATA%/MusicMaster/musicmaster.db or similar
// But in dev mode it might be in userData folder.
// Let's assume default electron userData path pattern or check where initDatabase puts it.
// src/main/database/index.ts uses app.getPath('userData').

const dbPath = path.join(process.env.APPDATA, 'desktop', 'musicmaster.db');

console.log('Checking database at:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('Database file not found!');
    process.exit(1);
}

const db = new Database(dbPath);

console.log('--- TRACKS (First 5) ---');
const tracks = db.prepare('SELECT id, title, artist, album, album_artist, file_path FROM tracks LIMIT 5').all();
console.table(tracks);

console.log('--- ALBUMS CACHE (First 5) ---');
const albums = db.prepare('SELECT * FROM albums_cache LIMIT 5').all();
console.table(albums);

console.log('--- AGGREGATION QUERY TEST ---');
try { // Test query
    const rows = db.prepare(`
        SELECT
            album as name,
            COALESCE(album_artist, artist) as artist,
            COUNT(*) as track_count
        FROM tracks
        WHERE album IS NOT NULL AND album != ''
        GROUP BY album, COALESCE(album_artist, artist)
    `).all();
    console.table(rows);
} catch (e) {
    console.error('Query failed:', e);
}
