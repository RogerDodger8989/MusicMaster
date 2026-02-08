const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    try {
        console.log('Testing search with object...');
        const res1 = await mb.search('release', { query: 'Steal This Album!' });
        console.log('Obj Search 1 Success:', !res1.error);

        console.log('Testing search with string...');
        const res2 = await mb.search('release', 'Steal This Album!');
        console.log('String Search Success:', !res2.error);
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
