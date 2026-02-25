const { MusicBrainzApi } = require('musicbrainz-api');
const mbApi = new MusicBrainzApi({ appName: 'MusicMasterTest', appVersion: '1.0.0', appContactInfo: 'none' });

async function test() {
    const searchReq = await mbApi.search('release', { query: 'Dark Side of the Moon' });
    const releaseId = searchReq.releases[0].id;
    console.log('Release ID:', releaseId);

    const release = await mbApi.lookup('release', releaseId, ['recordings']);
    console.log('Media:', JSON.stringify(release.media, null, 2));
}

test().catch(console.error);
