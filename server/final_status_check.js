const { getDatabase } = require('./src/database/index');
const fs = require('fs');
const path = require('path');
const db = getDatabase();

console.log('--- Schema Verification ---');
try {
    const perfSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'performers'").get();
    console.log('Performers Schema:', perfSchema.sql);
    const perfIndices = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='performers'").all();
    console.log('Performers Indices:', perfIndices);

    const creditsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'album_credits'").get();
    console.log('Album Credits Schema:', creditsSchema.sql);
    const creditsIndices = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='album_credits'").all();
    console.log('Album Credits Indices:', creditsIndices);
} catch (e) {
    console.error('Schema check failed:', e);
}

console.log('\n--- Artist Status ---');
const artist = db.prepare("SELECT name, image_path FROM artists WHERE name = 'System of a Down'").get();
console.log('Artist:', artist);
if (artist && artist.image_path) {
    console.log('Image file exists:', fs.existsSync(artist.image_path));
}

console.log('\n--- Enrichment Status ---');
db.prepare("PRAGMA foreign_keys = ON").run();
const album = db.prepare("SELECT id, name, artist, enriched_at FROM albums_cache WHERE name = 'Steal This Album!'").get();
console.log('Album:', album);

console.log('\n--- Tracks Status ---');
const tracks = db.prepare("SELECT id, title, musicbrainz_track_id FROM tracks WHERE album = 'Steal This Album!' LIMIT 3").all();
console.log('Sample Tracks:', tracks);

console.log('\n--- Foreign Key Violations ---');
try {
    const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
    console.log('FK Violations:', fkCheck);
} catch (e) {
    console.error('FK Check failed:', e);
}

console.log('\n--- Performers/Credits Count ---');
const performers = db.prepare("SELECT COUNT(*) as count FROM performers").get();
const credits = db.prepare("SELECT COUNT(*) as count FROM album_credits").get();
console.log('Performers Count:', performers.count);
console.log('Credits Count:', credits.count);

console.log('\n--- Sample Performer ---');
const sample = db.prepare(`
    SELECT p.role, a.name as artist_name 
    FROM performers p 
    JOIN artists a ON p.artist_id = a.id 
    LIMIT 3
`).all();
console.log('Sample Performers:', sample);

db.close();
