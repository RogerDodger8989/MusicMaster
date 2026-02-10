const sqlite3 = require('better-sqlite3');
const db = new sqlite3('c:/Users/denni/Desktop/Apps/MusicMaster/server/data/musicmaster.db');
const rows = db.prepare("SELECT name, musicbrainz_artistid, bio, image_path FROM artists WHERE name LIKE '%Metallica%'").all();
console.log(JSON.stringify(rows, null, 2));
db.close();
