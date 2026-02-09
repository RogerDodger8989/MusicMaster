const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');
const { v4: uuidv4 } = require('uuid');

// Get first 3 tracks
const tracks = db.prepare('SELECT id FROM tracks LIMIT 3').all();

console.log('📝 Inserting test enrichment data for tracks...');

// Insert test enrichment data for multiple tracks
const stmt = db.prepare(`
  INSERT OR REPLACE INTO acousticbrainz_data (
    id, track_id, mbid, bpm, energy, danceability, mood_happy, mood_sad, mood_aggressive
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const testData = [
  [120, 0.75, 0.85, 0.92, 0.08, 0.15],
  [95, 0.62, 0.72, 0.75, 0.25, 0.35],
  [140, 0.88, 0.91, 0.70, 0.30, 0.45]
];

tracks.forEach((track, idx) => {
  const data = testData[idx];
  stmt.run(
    uuidv4(),
    track.id,
    '9976f567-f267-4d2e-9792-2e5ae5618e7c',  // Same recording MBID for all
    data[0],  // bpm
    data[1],  // energy
    data[2],  // danceability
    data[3],  // mood_happy
    data[4],  // mood_sad
    data[5]   // mood_aggressive
  );
  console.log(`  ✅ Track ${idx + 1} enriched`);
});

// Check coverage
const total = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE musicbrainz_album_id IS NOT NULL').get();
const enriched = db.prepare(`
  SELECT COUNT(*) as count FROM tracks t
  INNER JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE t.musicbrainz_album_id IS NOT NULL
`).get();

console.log('\n📊 Enrichment Coverage:');
console.log(`  Total tracks: ${total.count}`);
console.log(`  Enriched tracks: ${enriched.count}`);
console.log(`  Coverage: ${Math.round((enriched.count / total.count) * 100)}%`);
console.log('\n✨ Refresh the app to see the updated stats!');
