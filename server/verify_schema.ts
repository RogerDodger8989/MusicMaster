
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'musicmaster.db');
const db = new Database(dbPath);

try {
    const info = db.prepare("PRAGMA table_info(albums_cache)").all();
    const hasEnrichedAt = info.some((col: any) => col.name === 'enriched_at');
    console.log('Column enriched_at exists:', hasEnrichedAt);

    if (hasEnrichedAt) {
        const count = db.prepare("SELECT COUNT(*) as count FROM albums_cache WHERE musicbrainz_album_id IS NOT NULL").get() as any;
        console.log('Albums with MBID ready for enrichment:', count.count);
    }
} catch (error) {
    console.error('Error checking DB:', error);
} finally {
    db.close();
}
