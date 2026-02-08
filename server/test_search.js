const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log('Searching for artist: System of a Down...');
    try {
        const res = await mb.search('artist', { query: 'System of a Down' });
        if (res.error) {
            console.log('Error:', res.error);
        } else {
            console.log('🎉 SUCCESS! Found:', res.artists?.length || 0, 'artists.');
            if (res.artists?.length > 0) {
                console.log('First artist:', res.artists[0].name, 'ID:', res.artists[0].id);
            }
        }
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
