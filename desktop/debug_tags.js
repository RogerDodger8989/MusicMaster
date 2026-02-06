const { parseFile } = require('music-metadata');
const path = require('path');
const fs = require('fs');

async function testMetadata(filePath) {
    console.log(`\n🔍 TESTING METADATA FOR: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        console.error('❌ File does not exist!');
        return;
    }

    try {
        const metadata = await parseFile(filePath);

        console.log('\n--- COMMON METADATA ---');
        console.log(JSON.stringify({ ...metadata.common, picture: undefined }, null, 2));
        console.log('Pictures found:', metadata.common.picture ? metadata.common.picture.length : 0);

        console.log('\n--- RATINGS ---');
        console.log(metadata.common.rating);

        console.log('\n--- NATIVE VORBIS (FLAC) ---');
        if (metadata.native && metadata.native.vorbis) {
            console.log(metadata.native.vorbis.filter(t =>
                ['RATING', 'FMPS_RATING', 'LOVED', 'rating', 'loved'].includes(t.id.toUpperCase())
            ));
        }

        console.log('\n--- NATIVE ID3 (MP3) ---');
        if (metadata.native && metadata.native['ID3v2.3']) {
            console.log(metadata.native['ID3v2.3'].filter(t => t.id === 'POPM'));
        }
        if (metadata.native && metadata.native['ID3v2.4']) {
            console.log(metadata.native['ID3v2.4'].filter(t => t.id === 'POPM'));
        }

    } catch (err) {
        console.error('❌ Error parsing file:', err.message);
    }
}

// Find a sample file from the user's music directory
const musicDir = 'C:\\Users\\denni\\Desktop\\Apps\\MusicMaster\\music';
if (fs.existsSync(musicDir)) {
    const files = fs.readdirSync(musicDir, { recursive: true })
        .filter(f => f.endsWith('.flac') || f.endsWith('.mp3'))
        .map(f => path.join(musicDir, f));

    if (files.length > 0) {
        testMetadata(files[0]);
        if (files.length > 1) testMetadata(files[1]);
    } else {
        console.log('No music files found in music directory.');
    }
} else {
    console.log('Music directory not found at:', musicDir);
}
