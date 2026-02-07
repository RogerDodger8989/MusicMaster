const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'MusicMaster', 'musicmaster.db')

console.log('Checking database at:', dbPath)

try {
  const db = new Database(dbPath, { readonly: true })

  console.log('\n--- SCROBBLE QUEUE (Latest 10) ---')
  const scrobbles = db
    .prepare('SELECT * FROM scrobble_queue ORDER BY played_at DESC LIMIT 10')
    .all()
  console.log(scrobbles)

  console.log('\n--- PLAY HISTORY (Latest 10) ---')
  const history = db.prepare('SELECT * FROM play_history ORDER BY played_at DESC LIMIT 10').all()
  console.log(history)

  console.log('\n--- PENDING SCROBBLES COUNT ---')
  const pending = db
    .prepare(
      'SELECT COUNT(*) as count FROM scrobble_queue WHERE lastfm_submitted = 0 OR listenbrainz_submitted = 0'
    )
    .get()
  console.log('Pending scrobbles:', pending.count)

  db.close()
} catch (err) {
  console.error('Error:', err)
}
