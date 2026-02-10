
import { initDatabase } from '../src/database/index';

const db = initDatabase();

const artistName = "Daron Malakian";
const correctMbid = "42ba45d2-4938-4bf5-9121-5caffc719c4d";

console.log(`Fixing artist: ${artistName}`);

const result = db.prepare(`
    UPDATE artists 
    SET musicbrainz_artist_id = ?,
        mbid = ?,
        type = 'Person',
        life_span_begin = NULL,
        life_span_end = NULL,
        bio = NULL,
        last_enrich_attempt = NULL
    WHERE name = ?
`).run(correctMbid, correctMbid, artistName);

console.log(`Update result:`, result);

if (result.changes > 0) {
    console.log("Successfully fixed Daron Malakian. UI should now fetch correct info on next visit.");
} else {
    console.log("Artist not found or no changes made.");
}
