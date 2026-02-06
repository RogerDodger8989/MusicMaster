const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Standard Electron AppData path for MusicMaster
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'MusicMaster', 'musicmaster.db');

console.log('Checking database at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    console.log('\n--- TABLES ---');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(tables.map(t => t.name).join(', '));

    console.log('\n--- ARTISTS (First 5) ---');
    const artists = db.prepare("SELECT * FROM artists LIMIT 5").all();
    console.log(artists);

    console.log('\n--- ALBUMS (First 5) ---');
    const albums = db.prepare("SELECT id, name, artist FROM albums_cache LIMIT 5").all();
    console.log(albums);

    console.log('\n--- SEARCH TEST (ABBA) ---');
    const searchResult = db.prepare("SELECT name, artist FROM albums_cache WHERE name LIKE '%abba%' OR artist LIKE '%abba%'").all();
    console.log('Albums found with %abba%:', searchResult);

    const artistResult = db.prepare("SELECT name FROM artists WHERE name LIKE '%abba%'").all();
    console.log('Artists found with %abba%:', artistResult);

    db.close();
} catch (err) {
    console.error('Error:', err);
}
