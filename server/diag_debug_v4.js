const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57d132'; // Roulette

    // Exact same config as test_inc.js
    const mbApi = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    const inc = [
        'artists',
        'releases',
        'url-rels',
        'tags',
        'genres',
        'artist-rels',
        'work-rels',
        'instrument-rels'
    ];

    console.log(`Testing lookup for ${recordingId}...`);
    try {
        const res = await mbApi.lookup('recording', recordingId, inc);
        console.log('API Response Keys:', Object.keys(res));
        if (res.error) {
            console.log('Error from MB:', res.error);
        } else {
            console.log('Success! Relations count:', res.relations?.length || 0);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
