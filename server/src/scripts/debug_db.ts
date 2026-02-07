
import { initDatabase } from '../database';

console.log('🔍 Starting DB Debug...');

try {
    const db = initDatabase();
    console.log('✅ Database connection successful.');

    // Helper to print columns
    const printSchema = (tableName: string) => {
        try {
            const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
            console.log(`\n📋 Schema for table '${tableName}':`);
            if (info.length === 0) {
                console.log('   ⚠️ Table not found!');
            } else {
                console.log(info.map((col: any) => `   - ${col.name} (${col.type})`).join('\n'));
            }
        } catch (e) {
            console.log(`   ❌ Error reading schema for ${tableName}:`, e);
        }
    };

    printSchema('tracks');
    printSchema('albums');
    printSchema('artists');
    printSchema('albums_cache');

    console.log('\n🧪 Testing Media Queries...');

    // Test getCover query
    try {
        console.log('   Running getCover query (on albums)...');
        // We pick one existing ID strictly for testing syntax
        const album = db.prepare('SELECT id FROM albums LIMIT 1').get() as any;
        if (album) {
            console.log(`   Found album ID: ${album.id}`);
            // This was the failing query:
            const row = db.prepare('SELECT cover_art_path as coverArtPath, name FROM albums WHERE id = ?').get(album.id);
            console.log('   ✅ getCover query executed successfully:', row);
        } else {
            console.log('   ⚠️ No albums in "albums" table to test.');
        }

        console.log('   Running getCover query (on albums_cache)...');
        const albumCache = db.prepare('SELECT id FROM albums_cache LIMIT 1').get() as any;
        if (albumCache) {
            console.log(`   Found album_cache ID: ${albumCache.id}`);
            const row = db.prepare('SELECT cover_art_path as coverArtPath, name FROM albums_cache WHERE id = ?').get(albumCache.id);
            console.log('   ✅ getCover (cache) query executed successfully:', row);
        } else {
            console.log('   ⚠️ No albums in "albums_cache" table.');
        }

    } catch (e) {
        console.error('   ❌ getCover query FAILED:', e);
    }

    // Test streamTrack query
    try {
        console.log('\n   Running streamTrack query...');
        const track = db.prepare('SELECT id FROM tracks LIMIT 1').get() as any;
        if (track) {
            console.log(`   Found track ID: ${track.id}`);
            // This was likely failing with 500
            const row = db.prepare('SELECT file_path as path, format FROM tracks WHERE id = ?').get(track.id);
            console.log('   ✅ streamTrack query executed successfully:', row);
        } else {
            console.log('   ⚠️ No tracks found to test.');
        }
    } catch (e) {
        console.error('   ❌ streamTrack query FAILED:', e);
    }

    // Check routes import
    try {
        console.log('\n   Testing routes/imports...');
        // Inspect if 'similar' route is registered (requires poking into express router which is hard from here without running app)
        // But we can check if file loads
        console.log('   (Skipping route stack check, relying on file load)');
    } catch (e) { }

} catch (error) {
    console.error('🔥 Fatal DB Error:', error);
}
