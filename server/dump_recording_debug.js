const { MusicBrainzApi } = require('musicbrainz-api');
const fs = require('fs');

async function test() {
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57a66a'; // Chic ’n’ Stu
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    console.log(`Fetching recording details for ${recordingId}...`);
    try {
        const res = await mb.lookup('recording', recordingId, [
            'artists',
            'releases',
            'artist-rels',
            'work-rels',
            'instrument-rels',
            'place-rels',
            'area-rels',
            'series-rels',
            'url-rels'
        ]);
        fs.writeFileSync('recording_debug.json', JSON.stringify(res, null, 2));
        console.log('🎉 SUCCESS! Saved to recording_debug.json');
        console.log('Relation types found:', (res.relations || []).map(r => r.type));
    } catch (e) {
        console.log('Exception:', e.message);
    }
}
test();
