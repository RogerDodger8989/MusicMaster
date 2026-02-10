const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

// Try different database paths
const paths = [
  'music_master.db',
  'musicmaster.db',
  path.join(process.cwd(), 'music_master.db'),
  path.join(process.cwd(), 'musicmaster.db'),
  // Electron app data path
  path.join(process.env.APPDATA || '', 'musicmaster', 'musicmaster.db'),
]

console.log('🔍 Searching for database...')
console.log('Current dir:', process.cwd())
console.log('APPDATA:', process.env.APPDATA)

let dbPath = null
const fs = require('fs')

for (const p of paths) {
  if (fs.existsSync(p)) {
    dbPath = p
    console.log('✅ Found database at:', p)
    break
  }
}

if (!dbPath) {
  console.log('❌ Database not found in any location')
  console.log('Checked paths:', paths)
  process.exit(1)
}

try {
  const db = new Database(dbPath)
  
  console.log('\n📊 ENRICHMENT STATUS:')
  
  // Count acousticbrainz data
  const count = db.prepare('SELECT COUNT(*) as cnt FROM acousticbrainz_data').get()
  console.log(`acousticbrainz_data rows: ${count.cnt}`)
  
  // Sample rows
  if (count.cnt > 0) {
    const samples = db.prepare('SELECT track_id, bpm, energy, mood_happy, mood_sad, mood_relaxed FROM acousticbrainz_data LIMIT 5').all()
    console.log('\nSample enrichment data:')
    samples.forEach(s => {
      console.log(`  Track ${s.track_id}: BPM=${s.bpm}, Energy=${s.energy}, Happy=${s.mood_happy}, Sad=${s.mood_sad}, Relaxed=${s.mood_relaxed}`)
    })
  }
  
  // Check enrichment log
  console.log('\n📝 ENRICHMENT LOG (last 5):')
  const logs = db.prepare('SELECT * FROM enrichment_log ORDER BY created_at DESC LIMIT 5').all()
  logs.forEach(log => {
    console.log(`  Status: ${log.status}, Started: ${log.started_at}, Completed: ${log.completed_at}, AB Fetched: ${log.acousticbrainz_fetched}`)
  })
  
  // Check tracks
  console.log('\n🎵 TRACKS (first 5):')
  const tracks = db.prepare('SELECT id, title, artist, album FROM tracks LIMIT 5').all()
  tracks.forEach(t => {
    console.log(`  ${t.title} - ${t.artist} (${t.id})`)
  })
  
  db.close()
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
