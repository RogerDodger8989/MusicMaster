const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

// Assuming standard Windows path for Electron userData
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'musicmaster', 'musicmaster.db')
console.log('Opening DB at:', dbPath)

try {
  const db = new Database(dbPath, { readonly: true })

  console.log('\n--- ALL ALBUMS ---')
  const albums = db.prepare('SELECT name, artist, track_count FROM albums_cache LIMIT 20').all()
  console.table(albums)

  console.log('\n--- 10cc TRACKS ---')
  const tracks = db
    .prepare(
      `
        SELECT title, album, artist 
        FROM tracks 
        WHERE album LIKE '%10cc%' OR artist LIKE '%10cc%'
    `
    )
    .all()
  console.table(tracks)

  db.close()
} catch (err) {
  console.error('Error:', err.message)
}
