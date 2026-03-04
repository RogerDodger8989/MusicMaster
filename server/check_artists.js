const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');
const stats = db.prepare("SELECT (image_path IS NOT NULL AND image_path != '') as has_image, COUNT(*) as count FROM artists GROUP BY has_image").all();
console.log('Artist Image Stats:', stats);
const missing = db.prepare("SELECT name, musicbrainz_artistid, last_enrich_attempt FROM artists WHERE (image_path IS NULL OR image_path = '') LIMIT 10").all();
console.log('Top 10 missing images:', missing);
db.close();
