const { getDatabase } = require('./src/database/index');

function debugPerformers(albumId) {
    const db = getDatabase();
    console.log(`--- Debugging Performer API for Album ID: ${albumId} ---`);

    const album = db.prepare("SELECT name, artist FROM albums_cache WHERE id = ?").get(albumId);
    if (!album) {
        console.error('Album not found in albums_cache');
        return;
    }
    console.log(`Album in cache: "${album.name}" by "${album.artist}"`);

    const tracks = db.prepare("SELECT id, title, artist, album_artist FROM tracks WHERE album = ? AND (album_artist = ? OR artist = ?)").all(album.name, album.artist, album.artist);
    console.log(`Found ${tracks.length} tracks matching album/artist criteria.`);

    if (tracks.length === 0) {
        console.log('Trying broader search (album name only)...');
        const allTracks = db.prepare("SELECT id, title, artist, album_artist, album FROM tracks WHERE album = ?").all(album.name);
        console.log(`Found ${allTracks.length} tracks total for album name "${album.name}".`);
        if (allTracks.length > 0) {
            console.log('Sample track from broad search:', allTracks[0]);
        }
    }

    const trackIds = tracks.map(t => t.id);
    if (trackIds.length > 0) {
        const performers = db.prepare(`
            SELECT p.*, a.name as artist_name
            FROM performers p
            LEFT JOIN artists a ON p.artist_id = a.id
            WHERE p.track_id IN (${trackIds.map(() => '?').join(',')})
        `).all(...trackIds);
        console.log(`Found ${performers.length} performer records for these tracks.`);
    }

    const albumCredits = db.prepare(`
        SELECT ac.*, a.name as artist_name
        FROM album_credits ac
        LEFT JOIN artists a ON ac.artist_id = a.id
        WHERE ac.album_id = ?
    `).all(albumId);
    console.log(`Found ${albumCredits.length} album-level credit records.`);
}

const albumId = 'c5080b0b-f3c5-48ff-a9ad-17eacb4fdd32'; // Steal This Album!
debugPerformers(albumId);
