const Database = require('./node_modules/better-sqlite3')
const { randomUUID } = require('crypto')
const db = new Database('./data/musicmaster.db')

// 1. Fix album genre - split semicolons to ' / '
console.log('=== Fixing genres ===')
const albums = db.prepare('SELECT id, genre FROM albums_cache').all()
const updateGenre = db.prepare('UPDATE albums_cache SET genre = ? WHERE id = ?')
for (const album of albums) {
  if (album.genre) {
    const fixed = album.genre
      .split(/[,;:|]/)
      .map(g => g.trim())
      .filter(g => g && g !== 'Unknown')
      .filter((g, i, self) => self.findIndex(s => s.toLowerCase() === g.toLowerCase()) === i)
      .slice(0, 5)
      .join(' / ')
    updateGenre.run(fixed, album.id)
    console.log('  Fixed:', fixed)
  }
}

// 2. Fix artist duplicates - delete and re-aggregate
console.log('\n=== Fixing artists ===')
db.exec('DELETE FROM artists')
const artistRows = db.prepare(`
  SELECT 
    COALESCE(album_artist, artist, 'Unknown Artist') as name,
    COUNT(DISTINCT COALESCE(NULLIF(album, ''), 'Unknown Album')) as album_count,
    COUNT(*) as track_count
  FROM tracks 
  GROUP BY COALESCE(album_artist, artist, 'Unknown Artist')
  ORDER BY name
`).all()

const insertArtist = db.prepare('INSERT INTO artists (id, name, album_count, track_count) VALUES (?, ?, ?, ?)')
for (const a of artistRows) {
  insertArtist.run(randomUUID(), a.name, a.album_count, a.track_count)
  console.log('  Artist:', a.name, '- albums:', a.album_count, '- tracks:', a.track_count)
}

// Verify
console.log('\n=== Verify ===')
const genreCheck = db.prepare('SELECT genre FROM albums_cache').all()
genreCheck.forEach(a => console.log('  Album genre:', a.genre))
const artistCheck = db.prepare('SELECT name FROM artists').all()
console.log('  Artists:', artistCheck.length, 'total')
artistCheck.forEach(a => console.log('    -', a.name))

console.log('\nDone!')
db.close()
