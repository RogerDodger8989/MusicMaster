const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const releaseId = '2e9eec60-ee5d-3a26-a650-73287e0f349f';
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Fetching release: ${releaseId}...`);
    try {
        const res = await mb.lookup('release', releaseId, ['recordings']);
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log(`🎉 SUCCESS! Title: ${res.title}`);
            const tracks = [];
            for (const media of res.media || []) {
                for (const track of media.tracks || []) {
                    tracks.push({
                        title: track.title,
                        recordingId: track.recording.id
                    });
                }
            }
            console.log('Found tracks:', tracks.slice(0, 5));
            const roulette = tracks.find(t => t.title === 'Roulette');
            console.log('Roulette MBID:', roulette ? roulette.recordingId : 'Not found');
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
