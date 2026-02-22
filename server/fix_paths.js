const db = require('better-sqlite3')('data/musicmaster.db');
const oldPath = 'C:\\Users\\denni\\Desktop\\Apps\\MusicMaster';
const newPath = 'C:\\Users\\denni\\Desktop\\Egna appar\\MusicMaster';

console.log('Updating paths...');

// Tables and columns to update
const updates = [
    { table: 'albums', column: 'cover_art_path' },
    { table: 'albums_cache', column: 'cover_art_path' },
    { table: 'tracks', column: 'file_path' },
    { table: 'tracks', column: 'cover_art_path' },
    { table: 'artists', column: 'image_path' },
    { table: 'music_folders', column: 'path' }
];

let changedLines = 0;

for (const { table, column } of updates) {
    try {
        const stmt = db.prepare(`UPDATE ${table} SET ${column} = REPLACE(${column}, ?, ?) WHERE ${column} LIKE ?`);
        const result = stmt.run(oldPath, newPath, oldPath + '%');
        console.log(`Updated ${result.changes} rows in ${table}.${column}`);
        changedLines += result.changes;
    } catch(err) {
        console.warn(`Could not update ${table}.${column} - possibly doesn't exist`);
    }
}

console.log(`Finished updating paths. Total rows updated: ${changedLines}`);
