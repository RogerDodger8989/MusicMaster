const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'MusicMaster', 'musicmaster.db')
console.log('Reading database from:', dbPath)

try {
  const db = new Database(dbPath)

  console.log('\n--- SCHEMA CHECK: albums_cache ---')
  const columns = db.prepare('PRAGMA table_info(albums_cache)').all()
  columns.forEach((c) => console.log(`${c.name}: ${c.type}`))

  console.log('\n--- DATA CHECK: Top 3 Albums ---')
  const albums = db.prepare('SELECT id, name, artist, genre, bio FROM albums_cache LIMIT 3').all()
  albums.forEach((a) => {
    console.log(`\nID: ${a.id}`)
    console.log(`Name: ${a.name}`)
    console.log(`Artist: ${a.artist}`)
    console.log(`Genre: ${a.genre}`)
    console.log(`Bio Snippet: ${a.bio ? a.bio.substring(0, 100) + '...' : 'NONE'}`)
  })
} catch (err) {
  console.error('Error:', err)
}
