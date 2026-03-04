const dbPath = 'C:/Users/denni/AppData/Roaming/music-master/musicmaster.db';
const db = require('better-sqlite3')(dbPath);
const fs = require('fs');

try {
    const allArtists = db.prepare("SELECT name, urls FROM artists WHERE name LIKE '%metallica%'").all();
    fs.writeFileSync('C:/Users/denni/Desktop/Egna appar/MusicMaster/desktop/dump.json', JSON.stringify(allArtists, null, 2));
    console.log('Dumped metallica to dump.json', allArtists);
} catch (e) {
    console.error(e);
}
process.exit(0);
