const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'music-master', 'musicmaster.db');
console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    
    // Check tracks with play_count
    const tracks = db.prepare('SELECT title, artist, rating, loved, play_count FROM tracks LIMIT 10').all();
    
    console.log('\n=== First 10 tracks ===');
    tracks.forEach(track => {
        console.log(`${track.title} - ${track.artist}`);
        console.log(`  Rating: ${track.rating}, Loved: ${track.loved}, PlayCount: ${track.play_count}`);
    });
    
    // Check if play_count column exists
    const columns = db.prepare('PRAGMA table_info(tracks)').all();
    console.log('\n=== Tracks table columns ===');
    columns.forEach(col => {
        if (col.name.includes('play') || col.name.includes('count') || col.name.includes('rating') || col.name.includes('loved')) {
            console.log(`${col.name} (${col.type})`);
        }
    });
    
    db.close();
} catch (error) {
    console.error('Error:', error);
}
