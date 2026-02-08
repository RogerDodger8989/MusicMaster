const { musicBrainzService } = require('./src/services/musicbrainz');
const fs = require('fs');

async function debug() {
    console.log('Mirror URL:', process.env.MUSICBRAINZ_MIRROR_URL);
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57d132'; // Roulette (Success in test_inc)
    console.log(`Fetching recording details for: ${recordingId}`);

    // Use the service directly
    const recording = await musicBrainzService.getRecordingDetails(recordingId);
    if (recording) {
        fs.writeFileSync('recording_final_test.json', JSON.stringify(recording, null, 2));
        console.log('Dumped to recording_final_test.json');
        const roles = musicBrainzService.extractRoles(recording);
        console.log('Extracted Roles:', roles);
    } else {
        console.error('Failed to fetch recording');
    }
}
debug().catch(console.error);
