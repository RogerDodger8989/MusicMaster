const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const rgId = '3351730c-7853-38f3-8d56-1bf627de4523'; // Steal This Album! RG
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Testing lookup for release-group ${rgId}...`);
    try {
        const res = await mb.lookup('release-group', rgId, []);
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log('🎉 SUCCESS! RG Title:', res.title);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
