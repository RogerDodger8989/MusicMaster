const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const releaseId = '2e9eec60-ee5d-3a26-a650-73287e0f349f';
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Testing lookup for release ${releaseId}...`);
    try {
        const res = await mb.lookup('release', releaseId, []);
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log('🎉 SUCCESS! Release Title:', res.title);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
