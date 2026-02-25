const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

try {
    console.log('--- play_history Sample ---');
    const rows = db.prepare('SELECT played_at, play_count, track_id FROM play_history ORDER BY played_at DESC LIMIT 10').all();
    console.log(JSON.stringify(rows, null, 2));

    console.log('\n--- SQL Date Checks ---');
    const dates = db.prepare(`
        SELECT
            datetime('now') as now_utc,
            date('now', 'weekday 1', '-7 days') as v1,
            datetime('now', 'weekday 1', '-7 days', 'start of day') as v2,
            date('now', '-6 days', 'weekday 1') as v3
    `).get();
    console.log(JSON.stringify(dates, null, 2));

    const dateFilter = "AND played_at >= datetime('now', 'weekday 1', '-7 days', 'start of day')";
    const stmt = db.prepare(`
        SELECT t.title, t.artist,
            SUM(MAX(COALESCE(ph.play_count, 1), 1)) as range_play_count
        FROM play_history ph
        JOIN tracks t ON ph.track_id = t.id
        LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
        LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
        WHERE 1=1 ${dateFilter}
        GROUP BY t.id
        ORDER BY range_play_count DESC
        LIMIT 5
    `);
    const results = stmt.all();
    console.log('\n--- Real Query Results ---');
    console.log(JSON.stringify(results, null, 2));

} catch (err) {
    console.error(err);
}
