const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');
const tracks = db.prepare("SELECT title, musicbrainz_track_id FROM tracks WHERE album = 'Steal This Album!'").all();
console.log('Tracks in DB:', JSON.stringify(tracks, null, 2));
db.close();
