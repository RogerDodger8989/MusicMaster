const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const serverDbPath = path.join(__dirname, 'data', 'musicmaster.db');
const desktopDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'music-master', 'musicmaster.db');

console.log('Server DB:', serverDbPath);
console.log('Desktop DB:', desktopDbPath);

const serverDb = new Database(serverDbPath);
const desktopDb = new Database(desktopDbPath);

function getColumns(db) {
  return db.prepare("PRAGMA table_info('acousticbrainz_data')").all().map((row) => row.name);
}

const serverCols = getColumns(serverDb);
const desktopCols = getColumns(desktopDb);
const commonCols = serverCols.filter((col) => desktopCols.includes(col));

if (!commonCols.includes('track_id') || !commonCols.includes('id')) {
  throw new Error('Required columns missing in destination table.');
}

console.log('Common columns:', commonCols.join(', '));

// Read AcousticBrainz rows with their server track MBIDs.
const selectSql = `
  SELECT ab.*, t.musicbrainz_track_id
  FROM acousticbrainz_data ab
  JOIN tracks t ON t.id = ab.track_id
  WHERE t.musicbrainz_track_id IS NOT NULL
`;

const rows = serverDb.prepare(selectSql).all();

// Build a lookup for desktop track IDs by MBID.
const desktopTrackByMbid = new Map(
  desktopDb
    .prepare('SELECT id, musicbrainz_track_id FROM tracks WHERE musicbrainz_track_id IS NOT NULL')
    .all()
    .map((row) => [row.musicbrainz_track_id, row.id])
);

const insertCols = commonCols;
const insertSql = `INSERT OR REPLACE INTO acousticbrainz_data (${insertCols.join(', ')}) VALUES (${insertCols
  .map(() => '?')
  .join(', ')})`;
const insertStmt = desktopDb.prepare(insertSql);
const deleteStmt = desktopDb.prepare('DELETE FROM acousticbrainz_data WHERE track_id = ?');

let mapped = 0;
let skipped = 0;

const before = desktopDb.prepare('SELECT COUNT(*) as count FROM acousticbrainz_data').get().count;

const insertMany = desktopDb.transaction((items) => {
  for (const row of items) {
    const desktopTrackId = desktopTrackByMbid.get(row.musicbrainz_track_id);
    if (!desktopTrackId) {
      skipped++;
      continue;
    }

    mapped++;
    deleteStmt.run(desktopTrackId);

    const data = insertCols.map((col) => {
      if (col === 'track_id') return desktopTrackId;
      return row[col];
    });

    insertStmt.run(data);
  }
});

insertMany(rows);
const after = desktopDb.prepare('SELECT COUNT(*) as count FROM acousticbrainz_data').get().count;

console.log('Desktop rows before:', before);
console.log('Desktop rows after:', after);
console.log('Mapped rows:', mapped);
console.log('Skipped rows (no MBID match):', skipped);

serverDb.close();
desktopDb.close();
