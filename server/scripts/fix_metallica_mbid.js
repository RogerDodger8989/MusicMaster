const sqlite3 = require('better-sqlite3');
const db = new sqlite3('c:/Users/denni/Desktop/Apps/MusicMaster/server/data/musicmaster.db');

const METALLICA_CORRECT_MBID = '65f4f0c5-e5ad-40fa-ae39-a0c603297ba2';
const MOTLEY_CRUE_WRONG_MBID = '6b656576-9504-432e-823d-8920139db2f0';

console.log('--- Fixing Metallica MBID ---');

// 1. Get the artist record
const artist = db.prepare("SELECT id, name, musicbrainz_artistid FROM artists WHERE name = 'Metallica'").get();

if (artist) {
    console.log(`Found artist: ${artist.name} (ID: ${artist.id}, MBID: ${artist.musicbrainz_artistid})`);

    // 2. Correct the MBID and clear hijacked bio/image
    const result = db.prepare(`
        UPDATE artists 
        SET musicbrainz_artistid = ?, 
            bio = NULL, 
            image_path = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(METALLICA_CORRECT_MBID, artist.id);

    console.log(`Updated artist record: ${result.changes} row(s) changed.`);
} else {
    console.log('Metallica record not found by exact name.');
}

// 3. Also check if Mötley Crüe's ID is used for any other "Metallica" like names
const others = db.prepare("SELECT id, name FROM artists WHERE musicbrainz_artistid = ?").all(MOTLEY_CRUE_WRONG_MBID);
for (const other of others) {
    if (other.name.toLowerCase().includes('metallica')) {
        console.log(`Found another hijacked record: ${other.name} (ID: ${other.id})`);
        db.prepare("UPDATE artists SET musicbrainz_artistid = NULL, bio = NULL, image_path = NULL WHERE id = ?").run(other.id);
    }
}

// 4. Update tracks too if they have the wrong MBID
const trackResult = db.prepare("UPDATE tracks SET musicbrainz_artistid = ? WHERE musicbrainz_artistid = ? AND artist = 'Metallica'").run(METALLICA_CORRECT_MBID, MOTLEY_CRUE_WRONG_MBID);
console.log(`Updated ${trackResult.changes} tracks.`);

db.close();
console.log('--- Done ---');
