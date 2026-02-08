const { MusicBrainzApi } = require('musicbrainz-api');
const fs = require('fs');

async function test() {
    const releaseId = '2e9eec60-ee5d-3a26-a650-73287e0f349f';
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Fetching release details for ${releaseId}...`);
    try {
        const res = await mb.lookup('release', releaseId, [
            'artists',
            'recordings',
            'artist-rels',
            'recording-level-rels',
            'work-level-rels',
            'label-rels',
            'place-rels',
            'url-rels'
        ]);
        fs.writeFileSync('release_debug.json', JSON.stringify(res, null, 2));
        console.log('🎉 SUCCESS! Saved to release_debug.json');
        console.log('Relation types found:', (res.relations || []).map(r => r.type));
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
