
const { searchLibrary } = require('./src/database/search');
const { initDatabase } = require('./src/database/index');

// Initialize DB first
initDatabase();

try {
    console.log('--- Testing searchLibrary("steal") ---');
    const results = searchLibrary('steal');
    console.log('Success!');
    console.log(`Artists: ${results.artists.length}`);
    console.log(`Albums: ${results.albums.length}`);
    console.log(`Tracks: ${results.tracks.length}`);

    if (results.tracks.length > 0) {
        console.log('First track sample:', JSON.stringify(results.tracks[0], null, 2));
    }
} catch (e) {
    console.error('searchLibrary CRASHED:', e);
}
