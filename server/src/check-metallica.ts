/**
 * Quick query to check Metallica track values
 */

import { getDatabase } from './database'

const db = getDatabase()

console.log('🎸 Checking Metallica tracks:\n')

const tracks = db.prepare(`
  SELECT t.title, t.artist, ab.bpm, ab.energy, ab.arousal, ab.valence, ab.mood_category
  FROM tracks t
  JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE t.artist LIKE '%Metallica%'
  LIMIT 5
`).all() as any[]

for (const track of tracks) {
    console.log(`${track.title}:`)
    console.log(`  Energy: ${track.energy}, Arousal: ${track.arousal}`)
    console.log(`  Valence: ${track.valence}, Mood: ${track.mood_category}`)
    console.log('')
}

console.log(`\n📊 Total Metallica tracks: ${tracks.length}`)

process.exit(0)
