const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57d132'; // Roulette
    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    const individualParams = [
        'artist-credits',
        'releases',
        'tags',
        'genres',
        'artist-rels',
        'work-rels',
        'instrument-rels',
        'url-rels'
    ];

    console.log('--- Individual Parameter Check ---');
    const valid = [];
    for (const p of individualParams) {
        try {
            const res = await mb.lookup('recording', recordingId, [p]);
            if (!res.error) {
                console.log(`  ✅ ${p} is VALID`);
                valid.push(p);
            } else {
                console.log(`  ❌ ${p} is INVALID (${res.error})`);
            }
        } catch (e) {
            console.log(`  💥 ${p} CRASHED: ${e.message}`);
        }
    }

    console.log('\n--- Final Golden Set Test ---');
    console.log('Testing with:', valid.join(', '));
    const res = await mb.lookup('recording', recordingId, valid);
    if (!res.error) {
        console.log('  🎉 SUCCESS! Golden set works.');
        console.log('  Relations count:', res.relations?.length || 0);
    } else {
        console.log('  😭 FAILED even with individual valid params:', res.error);
    }
}
test();
