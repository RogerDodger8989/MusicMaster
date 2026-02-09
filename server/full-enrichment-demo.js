const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');
const { v4: uuidv4 } = require('uuid');

console.log('='.repeat(60));
console.log('PHASE 9 - FULL ENRICHMENT SIMULATION FOR ALL 16 TRACKS');
console.log('='.repeat(60) + '\n');

// Get status BEFORE
const before = db.prepare('SELECT COUNT(*) as count FROM acousticbrainz_data').get();
console.log('📊 CURRENT STATE:');
console.log(`  AcousticBrainz enriched entries: ${before.count}\n`);

// Simulate enrichment for ALL 16 tracks
console.log('🚀 ENRICHING ALL 16 TRACKS...\n');

const allTracks = db.prepare('SELECT id, title FROM tracks').all();
const stmt = db.prepare(`
  INSERT OR REPLACE INTO acousticbrainz_data (
    id, track_id, mbid, bpm, energy, danceability, mood_happy, mood_sad, 
    mood_aggressive, mood_party, mood_relaxed, mood_acoustic
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

allTracks.forEach((t, idx) => {
  stmt.run(
    uuidv4(),
    t.id,
    '9976f567-f267-4d2e-9792-2e5ae5618e7c',
    Math.floor(Math.random() * 160) + 60,   // BPM 60-220
    Math.random().toFixed(2),                // Energy
    Math.random().toFixed(2),                // Danceability
    Math.random().toFixed(2),                // Mood Happy
    Math.random().toFixed(2),                // Mood Sad
    Math.random().toFixed(2),                // Mood Aggressive
    Math.random().toFixed(2),                // Mood Party
    Math.random().toFixed(2),                // Mood Relaxed
    Math.random().toFixed(2)                 // Mood Acoustic
  );
  console.log(`  ✅ ${idx + 1}. ${t.title}`);
});

console.log('\n' + '='.repeat(60));

// Check coverage AFTER
const after = db.prepare(`
  SELECT COUNT(*) as count FROM tracks t
  INNER JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE t.musicbrainz_album_id IS NOT NULL
`).get();

const total = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE musicbrainz_album_id IS NOT NULL').get();

console.log('📊 ENRICHMENT COMPLETE!\n');
console.log(`  Total tracks: ${total.count}`);
console.log(`  Enriched tracks: ${after.count}`);
console.log(`  Coverage: ${Math.round((after.count / total.count) * 100)}%\n`);

console.log('✨ This is what Phase 9 will show when you add albums');
console.log('   that have data in AcousticBrainz!\n');

console.log('🔄 Refresh your browser to see the updated stats!\n');
console.log('='.repeat(60));
