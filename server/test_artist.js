const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const artistId = 'cc0b7089-c08d-4c10-b6b0-873582c17fd6'; // System of a Down
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Testing lookup for artist ${artistId}...`);
    try {
        const res = await mb.lookup('artist', artistId, []);
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log('🎉 SUCCESS! Artist Name:', res.name);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
