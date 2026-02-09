const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

// Get all tracks  
const tracks = db.prepare('SELECT id, title, musicbrainz_recording_id FROM tracks ORDER BY title').all();

console.log('Recording IDs i databasen:\n');
tracks.forEach(t => {
  console.log(`${t.title}`);
  console.log(`  ID: ${t.musicbrainz_recording_id}\n`);
});
