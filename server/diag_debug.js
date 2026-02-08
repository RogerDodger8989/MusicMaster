const { getDatabase } = require('./src/database/index');
const { musicBrainzService } = require('./src/services/musicbrainz');
const { upsertArtistWithMBID, addPerformer, addAlbumCredit } = require('./src/database/musicbrainz');
const fs = require('fs');

async function diag() {
    console.log('--- Manual Enrichment Debugging ---');
    const db = getDatabase();
    const normalize = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();

    const album = db.prepare("SELECT id, name, artist, musicbrainz_album_id as mbid FROM albums_cache WHERE name = 'Steal This Album!'").get();
    if (!album) return console.error('Album not found');

    console.log('Fetching release details...');
    const release = await musicBrainzService.getReleaseDetails(album.mbid);
    if (!release) return console.error('Failed to fetch release');

    // Dump release for inspection
    fs.writeFileSync('release_dump.json', JSON.stringify(release, null, 2));
    console.log('Dumped release to release_dump.json');

    // 1. Save Album Credits
    const albumRoles = musicBrainzService.extractRoles(release);
    console.log('Extracted Album Roles:', Object.keys(albumRoles));

    // 2. Map Tracks and Save Performers
    const tracks = db.prepare("SELECT id, title, musicbrainz_track_id as mbid FROM tracks WHERE album = 'Steal This Album!'").all();

    // Just process the first track for debugging
    const track = tracks[0];
    let trackMbid = track.mbid;
    if (!trackMbid || trackMbid === album.mbid) {
        // ... (title matching skipped for brevity in debug script or reuse logic)
    }

    if (trackMbid) {
        console.log(`Processing track: ${track.title} (${trackMbid})`);
        const recording = await musicBrainzService.getRecordingDetails(trackMbid);
        if (recording) {
            fs.writeFileSync('recording_dump.json', JSON.stringify(recording, null, 2));
            console.log('Dumped recording to recording_dump.json');

            const roles = musicBrainzService.extractRoles(recording);
            console.log('Extracted Track Roles:', Object.keys(roles));
        }
    }

    console.log('--- Debug Finished ---');
}
diag().catch(console.error);
