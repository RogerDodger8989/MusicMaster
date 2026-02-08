const { aggregateAlbums } = require('./src/database/albums');
const { getDatabase } = require('./src/database/index');

async function test() {
    const db = getDatabase();
    const countBefore = db.prepare('SELECT COUNT(*) as count FROM artists').get().count;
    console.log(`Artists before aggregation: ${countBefore}`);

    console.log('Starting aggregation...');
    await aggregateAlbums();
    console.log('Aggregation complete.');

    const countAfter = db.prepare('SELECT COUNT(*) as count FROM artists').get().count;
    console.log(`Artists after aggregation: ${countAfter}`);

    if (countAfter >= countBefore) {
        console.log('✅ SUCCESS: Artists preserved or increased.');
    } else {
        console.log('❌ FAILURE: Artists were lost!');
    }

    // Check images again
    const images = db.prepare("SELECT name, image_path FROM artists WHERE image_path IS NOT NULL").all();
    console.log('Artists with images:', images.length);
    if (images.length > 0) {
        console.log('Sample image path:', images[0].image_path);
    }
}

test().catch(console.error);
