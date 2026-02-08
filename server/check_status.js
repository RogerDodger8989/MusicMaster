const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

try {
    const total = db.prepare('SELECT COUNT(*) as count FROM albums_cache').get().count;
    const enriched = db.prepare('SELECT COUNT(*) as count FROM albums_cache WHERE enriched_at IS NOT NULL').get().count;
    const sample = db.prepare('SELECT id, name, artist, enriched_at FROM albums_cache WHERE enriched_at IS NOT NULL LIMIT 5').all();

    console.log(`Total albums: ${total}`);
    console.log(`Enriched albums: ${enriched}`);
    if (sample.length > 0) {
        console.log('\nEnriched Sample:');
        sample.forEach(s => console.log(`- ${s.artist} - ${s.name} (Enriched: ${s.enriched_at})`));
    } else {
        console.log('\nNo albums enriched yet. The background worker processes 1 album per minute by default.');
    }
} catch (err) {
    console.error('Error checking status:', err.message);
} finally {
    db.close();
}
