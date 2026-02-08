const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57d132'; // Roulette
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Testing BARE lookup for ${recordingId}...`);
    try {
        const res = await mb.lookup('recording', recordingId, []);
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log('🎉 SUCCESS! Recording Title:', res.title);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
