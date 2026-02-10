
import { initDatabase } from '../src/database/index';

const db = initDatabase();

const artistName = "Daron Malakian";

const artist = db.prepare('SELECT * FROM artists WHERE name = ?').get(artistName) as any;

console.log("--- DATABASE INFO FOR: " + artistName + " ---");
console.log(artist);

if (artist) {
    import('../src/services/musicbrainz').then(async ({ musicBrainzService }) => {
        if (artist.mbid) {
            console.log(`\nChecking mbid: ${artist.mbid}...`);
            const details = await musicBrainzService.getArtistDetails(artist.mbid);
            console.log(`Result: ${details?.name} (${details?.type})`);
        }
        if (artist.musicbrainz_artist_id && artist.musicbrainz_artist_id !== artist.mbid) {
            console.log(`\nChecking musicbrainz_artist_id: ${artist.musicbrainz_artist_id}...`);
            const details = await musicBrainzService.getArtistDetails(artist.musicbrainz_artist_id);
            console.log(`Result: ${details?.name} (${details?.type})`);
        }
    });
} else {
    console.log("\nArtist not found in database.");
}
