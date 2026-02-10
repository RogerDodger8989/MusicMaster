const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'music-master', 'musicmaster.db');
console.log('Checking desktop database at:', dbPath);

try {
  const db = new Database(dbPath);
  
  const trackCount = db.prepare('SELECT COUNT(*) as count FROM tracks').get();
  console.log('Total tracks:', trackCount.count);
  
  const withMbid = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE musicbrainz_track_id IS NOT NULL').get();
  console.log('Tracks with MBID:', withMbid.count);
  
  const abData = db.prepare('SELECT COUNT(*) as count FROM acousticbrainz_data').get();
  console.log('AcousticBrainz rows:', abData.count);
  
  const enrichLog = db.prepare('SELECT * FROM enrichment_log ORDER BY start_time DESC LIMIT 1').get();
  if (enrichLog) {
    console.log('\nLast enrichment:');
    console.log('  Status:', enrichLog.status);
    console.log('  Start:', enrichLog.start_time);
    console.log('  Fetched:', enrichLog.acousticbrainz_fetched);
    console.log('  Updated:', enrichLog.tracks_updated);
  } else {
    console.log('\nNo enrichment history');
  }
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
