/**
 * Cleanup script: Remove tracks from database whose files no longer exist on disk.
 * Also re-aggregates albums after cleanup.
 * 
 * Uses server's better-sqlite3 (compiled for system Node.js)
 */
const Database = require('../server/node_modules/better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'server', 'data', 'musicmaster.db')
console.log('Database path:', dbPath)

if (!fs.existsSync(dbPath)) {
  console.error('Database not found!')
  process.exit(1)
}

const db = new Database(dbPath)

// Get all tracks
const tracks = db.prepare('SELECT id, file_path, title, artist, album FROM tracks').all()
console.log(`\nTotal tracks in database: ${tracks.length}`)

// Check which files exist
let removed = 0
let kept = 0
const deleteStmt = db.prepare('DELETE FROM tracks WHERE id = ?')

const transaction = db.transaction(() => {
  for (const track of tracks) {
    if (!fs.existsSync(track.file_path)) {
      console.log(`  ❌ REMOVING: ${track.artist} - ${track.title} (${track.file_path})`)
      deleteStmt.run(track.id)
      removed++
    } else {
      kept++
    }
  }
})

transaction()

console.log(`\n✅ Results:`)
console.log(`   Kept: ${kept} tracks (files exist)`)
console.log(`   Removed: ${removed} tracks (files missing)`)

// Re-aggregate albums
console.log('\n🔄 Re-aggregating albums...')
try {
  // Clear and rebuild albums_cache  
  db.exec('DELETE FROM albums_cache')
  
  const albumRows = db.prepare(`
    SELECT 
      COALESCE(NULLIF(album, ''), 'Unknown Album') as name,
      COALESCE(album_artist, artist, 'Unknown Artist') as artist,
      MIN(year) as year,
      GROUP_CONCAT(DISTINCT genre) as genres,
      COUNT(*) as track_count,
      SUM(duration) as total_duration,
      MIN(disc_num) as disc_count,
      musicbrainz_album_id
    FROM tracks 
    GROUP BY COALESCE(NULLIF(album, ''), 'Unknown Album'), 
             COALESCE(album_artist, artist, 'Unknown Artist')
    ORDER BY name
  `).all()

  const insertAlbum = db.prepare(`
    INSERT OR REPLACE INTO albums_cache (id, name, artist, year, genre, track_count, total_duration, musicbrainz_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const { v4: uuidv4 } = require('uuid')

  const albumTransaction = db.transaction(() => {
    for (const album of albumRows) {
      const id = uuidv4()
      insertAlbum.run(
        id,
        album.name,
        album.artist,
        album.year || null,
        album.genres || null,
        album.track_count,
        album.total_duration || 0,
        album.musicbrainz_album_id || null
      )
    }
  })

  albumTransaction()
  console.log(`   Created ${albumRows.length} album entries`)
} catch (err) {
  console.error('Album aggregation error:', err.message)
}

// Update folder track counts
console.log('\n🔄 Updating folder track counts...')
const folders = db.prepare('SELECT id FROM music_folders').all()
for (const folder of folders) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM tracks WHERE folder_id = ?').get(folder.id)
  db.prepare('UPDATE music_folders SET track_count = ? WHERE id = ?').run(count.cnt, folder.id)
  console.log(`   Folder ${folder.id}: ${count.cnt} tracks`)
}

// Clean up artists table
console.log('\n🔄 Re-aggregating artists...')
try {
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

  const insertArtist = db.prepare(`
    INSERT OR REPLACE INTO artists (id, name, album_count, track_count)
    VALUES (?, ?, ?, ?)
  `)

  const { v4: uuidv4_2 } = require('uuid')

  const artistTransaction = db.transaction(() => {
    for (const artist of artistRows) {
      const id = uuidv4_2()
      insertArtist.run(id, artist.name, artist.album_count, artist.track_count)
    }
  })

  artistTransaction()
  console.log(`   Created ${artistRows.length} artist entries`)
} catch (err) {
  console.error('Artist aggregation error:', err.message)
}

console.log('\n✅ Database cleanup complete!')
console.log('   Restart the desktop app to see the changes.')

db.close()
