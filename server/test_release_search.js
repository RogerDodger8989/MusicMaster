const { MusicBrainzApi } = require('musicbrainz-api');
const fs = require('fs');

async function test() {
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    const query = 'release:"Steal This Album!" AND arid:cc0b7089-c08d-4c10-b6b0-873582c17fd6';
    try {
        const res = await mb.search('release', { query });
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            fs.writeFileSync('release_results.json', JSON.stringify(res.releases, null, 2));
            console.log(`🎉 SUCCESS! Saved ${res.releases?.length || 0} releases to release_results.json`);
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
