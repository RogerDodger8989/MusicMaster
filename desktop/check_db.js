const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'music-master', 'library.db')
console.log('Opening database at:', dbPath)

try {
  const db = new Database(dbPath)

  console.log('\n--- ALBUMS CACHE ---')
  const albums = db
    .prepare('SELECT name, artist, cover_art_path, rating, loved FROM albums_cache LIMIT 5')
    .all()
  console.log(JSON.stringify(albums, null, 2))

  console.log('\n--- TRACKS ---')
  const tracks = db
    .prepare('SELECT title, artist, rating, loved, file_path FROM tracks LIMIT 5')
    .all()
  console.log(JSON.stringify(tracks, null, 2))
} catch (err) {
  console.error('Error:', err.message)
}
