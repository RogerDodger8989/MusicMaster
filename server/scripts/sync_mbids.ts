
import { initDatabase } from '../src/database/index';

const db = initDatabase();

console.log("🔄 Synchronizing mbid and musicbrainz_artist_id columns in artists table...");

// 1. Sync musicbrainz_artist_id -> mbid
const sync1 = db.prepare(`
    UPDATE artists 
    SET mbid = musicbrainz_artist_id 
    WHERE mbid IS NULL AND musicbrainz_artist_id IS NOT NULL
`).run();

// 2. Sync mbid -> musicbrainz_artist_id
const sync2 = db.prepare(`
    UPDATE artists 
    SET musicbrainz_artist_id = mbid 
    WHERE musicbrainz_artist_id IS NULL AND mbid IS NOT NULL
`).run();

console.log(`✅ Sync complete.`);
console.log(`Updated mbid (from musicbrainz_artist_id): ${sync1.changes}`);
console.log(`Updated musicbrainz_artist_id (from mbid): ${sync2.changes}`);

// Verify if there are any mismatches remaining
const mismatches = db.prepare(`
    SELECT name, mbid, musicbrainz_artist_id 
    FROM artists 
    WHERE mbid != musicbrainz_artist_id 
    AND mbid IS NOT NULL 
    AND musicbrainz_artist_id IS NOT NULL
`).all() as any[];

if (mismatches.length > 0) {
    console.warn(`⚠️ Warning: Found ${mismatches.length} records where MBIDs still don't match!`);
    console.log(JSON.stringify(mismatches, null, 2));
} else {
    console.log("✨ All artist MBIDs are now synchronized.");
}
