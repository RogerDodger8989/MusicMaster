const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

try {
    const total = db.prepare('SELECT COUNT(*) as count FROM albums_cache').get().count;
    const withMBID = db.prepare('SELECT COUNT(*) as count FROM albums_cache WHERE musicbrainz_album_id IS NOT NULL').get().count;
    const enriched = db.prepare('SELECT COUNT(*) as count FROM albums_cache WHERE enriched_at IS NOT NULL').get().count;

    console.log(`Total albums: ${total}`);
    console.log(`Albums with MBID: ${withMBID}`);
    console.log(`Enriched albums: ${enriched}`);

    if (withMBID > enriched) {
        const next = db.prepare('SELECT id, name, artist FROM albums_cache WHERE musicbrainz_album_id IS NOT NULL AND enriched_at IS NULL LIMIT 5').all();
        console.log('\nNext in queue:');
        next.forEach(a => console.log(`- ${a.artist} - ${a.name} (id: ${a.id})`));
    }
} catch (err) {
    console.error('Error:', err.message);
} finally {
    db.close();
}
