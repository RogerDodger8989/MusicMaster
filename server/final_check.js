const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name).join(', '));

    const tracksCount = db.prepare('SELECT COUNT(*) as count FROM tracks').get().count;
    const albumsCount = db.prepare('SELECT COUNT(*) as count FROM albums_cache').get().count;
    const foldersCount = db.prepare('SELECT COUNT(*) as count FROM music_folders').get().count;

    console.log(`Tracks: ${tracksCount}`);
    console.log(`Albums: ${albumsCount}`);
    console.log(`Folders: ${foldersCount}`);

    const album = db.prepare('SELECT * FROM albums_cache WHERE name = "Steal This Album!"').get();
    if (album) {
        console.log('\nAlbum: Steal This Album!');
        console.log(`- Enriched at: ${album.enriched_at}`);
        console.log(`- MusicBrainz ID: ${album.musicbrainz_album_id}`);
        console.log(`- Label: ${album.label}`);
    }
} catch (err) {
    console.error('Error:', err.message);
} finally {
    db.close();
}
