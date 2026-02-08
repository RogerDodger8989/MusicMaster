const { MusicBrainzApi } = require('musicbrainz-api');

async function test() {
    const recordingId = 'abec8ec7-def4-43f9-ae20-307cda57d132'; // Roulette
    const tests = [
        ['artists', 'releases', 'url-rels', 'artist-rels', 'work-rels'],
        ['artists', 'releases', 'url-rels', 'artist-rels', 'work-rels', 'instrument-rels'],
        ['artists', 'releases', 'url-rels', 'artist-rels', 'work-rels', 'instrument-rels', 'vocal-rels']
    ];

    const mb = new MusicBrainzApi({
        appName: 'MusicMaster',
        appVersion: '1.0.0',
        appContactInfo: 'dennis@example.com'
    });

    for (const inc of tests) {
        console.log(`\nTesting with inc: ${inc.join(', ')}`);
        try {
            const res = await mb.lookup('recording', recordingId, inc);
            if (res.error) {
                console.log(`  ❌ Error: ${res.error}`);
            } else {
                console.log(`  ✅ Success! Found ${res.relations?.length || 0} relations.`);
                if (res.relations) {
                    const types = [...new Set(res.relations.map(r => r.type))];
                    console.log('  Available types:', types);
                }
            }
        } catch (e) {
            console.log(`  💥 Crash: ${e.message}`);
        }
    }

    console.log('\n--- Release Tests ---');
    const releaseId = 'c95dc7f7-2989-4b8a-98bc-dbd952b61636';
    const releaseTests = [
        ['artists', 'labels', 'recordings', 'artist-rels', 'recording-level-rels', 'performance-rels']
    ];

    for (const inc of releaseTests) {
        console.log(`Testing Release with inc: ${inc.join(', ')}`);
        try {
            const res = await mb.lookup('release', releaseId, inc);
            if (res.error) {
                console.log(`  ❌ Error: ${res.error}`);
            } else {
                console.log(`  ✅ Success! Found ${res.relations?.length || 0} relations.`);
            }
        } catch (e) {
            console.log(`  💥 Crash: ${e.message}`);
        }
    }
}
test();
