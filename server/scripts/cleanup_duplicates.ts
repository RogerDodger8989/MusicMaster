import { initDatabase } from '../src/database/index';

async function cleanup() {
    const db = initDatabase();
    console.log('🔍 Identifying duplicate rows in acousticbrainz_data...');

    const duplicates = db.prepare(`
        SELECT track_id, COUNT(*) as count 
        FROM acousticbrainz_data 
        GROUP BY track_id 
        HAVING count > 1
    `).all() as { track_id: string, count: number }[];

    if (duplicates.length === 0) {
        console.log('✨ No duplicates found.');
        return;
    }

    console.log(`🧹 Found ${duplicates.length} tracks with duplicate analysis data. Cleaning up...`);

    const deleteStmt = db.prepare(`
        DELETE FROM acousticbrainz_data 
        WHERE track_id = ? AND id NOT IN (
            SELECT id FROM acousticbrainz_data 
            WHERE track_id = ? 
            ORDER BY updated_at DESC LIMIT 1
        )
    `);

    let totalDeleted = 0;
    const transaction = db.transaction((tracks: { track_id: string }[]) => {
        for (const track of tracks) {
            const result = deleteStmt.run(track.track_id, track.track_id);
            totalDeleted += result.changes;
        }
    });

    transaction(duplicates);

    console.log(`✅ Cleanup complete. Removed ${totalDeleted} duplicate rows.`);
}

cleanup().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
