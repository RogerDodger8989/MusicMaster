const { getDatabase } = require('./src/database/index');
const { musicBrainzService } = require('./src/services/musicbrainz');
const fs = require('fs');

async function debug() {
    const db = getDatabase();
    const track = db.prepare("SELECT title, musicbrainz_track_id as mbid FROM tracks WHERE album = 'Steal This Album!' AND title = 'Boom!'").get();
    if (!track || !track.mbid) {
        console.error('Track Boom! not found with MBID');
        // Let's try to find ANY track with an MBID
        const anyTrack = db.prepare("SELECT title, musicbrainz_track_id as mbid FROM tracks WHERE musicbrainz_track_id IS NOT NULL LIMIT 1").get();
        if (!anyTrack) return console.error('No tracks with MBID found at all');
        track.title = anyTrack.title;
        track.mbid = anyTrack.mbid;
    }

    console.log(`Fetching recording for: ${track.title} (${track.mbid})`);
    const recording = await musicBrainzService.getRecordingDetails(track.mbid);
    if (recording) {
        fs.writeFileSync('recording_success_dump.json', JSON.stringify(recording, null, 2));
        console.log('Dumped to recording_success_dump.json');
        const roles = musicBrainzService.extractRoles(recording);
        console.log('Extracted Roles:', roles);
    } else {
        console.error('Failed to fetch recording');
    }
}
debug().catch(console.error);
