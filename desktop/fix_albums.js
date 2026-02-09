const Database = require('../server/node_modules/better-sqlite3')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const db = new Database(path.join(__dirname, '..', 'server', 'data', 'musicmaster.db'))

// Re-aggregate albums with correct column name
db.exec('DELETE FROM albums_cache')

const albumRows = db.prepare(`
  SELECT 
    COALESCE(NULLIF(album, ''), 'Unknown Album') as name,
    COALESCE(album_artist, artist, 'Unknown Artist') as artist,
    MIN(year) as year,
    GROUP_CONCAT(DISTINCT genre) as genres,
    COUNT(*) as track_count,
    SUM(duration) as total_duration,
    musicbrainz_album_id
  FROM tracks 
  GROUP BY COALESCE(NULLIF(album, ''), 'Unknown Album'), 
           COALESCE(album_artist, artist, 'Unknown Artist')
  ORDER BY name
`).all()

const insertAlbum = db.prepare(`
  INSERT OR REPLACE INTO albums_cache (id, name, artist, year, genre, track_count, total_duration, musicbrainz_album_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

const tx = db.transaction(() => {
  for (const a of albumRows) {
    insertAlbum.run(uuidv4(), a.name, a.artist, a.year || null, a.genres || null, a.track_count, a.total_duration || 0, a.musicbrainz_album_id || null)
  }
})
tx()

console.log('Albums re-aggregated:', albumRows.length, 'albums')
albumRows.forEach(a => console.log('  -', a.name, 'by', a.artist, '(' + a.track_count + ' tracks)'))

// Verify
const count = db.prepare('SELECT COUNT(*) as cnt FROM tracks').get()
console.log('\nTotal tracks:', count.cnt)

db.close()
console.log('\nDone! Restart app to see changes.')
