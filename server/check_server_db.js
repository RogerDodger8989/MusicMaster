const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'musicmaster.db');
console.log('Checking database at:', dbPath);

try {
  const db = new Database(dbPath);
  
  const trackCount = db.prepare('SELECT COUNT(*) as count FROM tracks').get();
  console.log('Total tracks:', trackCount.count);
  
  const withMbid = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE musicbrainz_track_id IS NOT NULL').get();
  console.log('Tracks with MBID:', withMbid.count);
  
  const abData = db.prepare('SELECT COUNT(*) as count FROM acousticbrainz_data').get();
  console.log('AcousticBrainz rows:', abData.count);
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
