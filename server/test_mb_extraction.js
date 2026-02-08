const { musicBrainzService } = require('./src/services/musicbrainz');
const dotenv = require('dotenv');
dotenv.config();

async function testExtraction() {
    const albumMbid = '9976f567-f267-4d2e-9792-2e5ae5618e7c'; // Steal This Album!
    console.log(`Testing extraction for Album MBID: ${albumMbid}`);

    const release = await musicBrainzService.getReleaseDetails(albumMbid);
    if (!release) {
        console.error('Failed to fetch release details');
        return;
    }

    console.log('Release Relations Keys:', Object.keys(release.relations || {}));
    const albumRoles = musicBrainzService.extractRoles(release);
    console.log('Extracted Album Roles:', JSON.stringify(albumRoles, null, 2));

    // Test a track (Chic 'N' Stu)
    const trackMbid = '9b2756a1-0bd6-4c4f-83a3-7645f5c531d2'; // Example track MBID if known, otherwise we'll try to find one from release
    console.log(`\nTesting extraction for Track MBID: ${trackMbid}`);
    const recording = await musicBrainzService.getRecordingDetails(trackMbid);
    if (recording) {
        console.log('Recording Relations Keys:', Object.keys(recording.relations || {}));
        const trackRoles = musicBrainzService.extractRoles(recording);
        console.log('Extracted Track Roles:', JSON.stringify(trackRoles, null, 2));
    } else {
        console.log('Failed to fetch recording details');
    }
}

testExtraction().catch(console.error);
