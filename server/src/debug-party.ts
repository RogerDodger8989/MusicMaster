/**
 * Debug Script - Check which tracks match Party vibe criteria
 */

import { getDatabase } from './database'

const db = getDatabase()

console.log('🔍 Checking Party vibe matches...\n')

// Party vibe criteria
const partyQuery = `
  SELECT 
    t.title,
    t.artist,
    ab.arousal,
    ab.valence,
    ab.bpm,
    ab.danceability,
    ab.energy,
    ab.mood_category,
    ab.confidence_score,
    ab.mood_happy,
    ab.mood_party
  FROM tracks t
  LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE ab.id IS NOT NULL
  AND ab.arousal IS NOT NULL
  AND ab.valence IS NOT NULL
  AND ab.arousal >= 0.75
  AND ab.valence >= 0.6
  AND ab.bpm >= 120
  AND ab.danceability >= 0.8
  ORDER BY t.artist, t.title
`

const matches = db.prepare(partyQuery).all() as any[]

console.log(`✅ Found ${matches.length} tracks matching Party criteria:\n`)
console.log('Criteria: arousal>=0.75, valence>=0.6, bpm>=120, danceability>=0.8\n')

for (const track of matches) {
    console.log(`📀 ${track.artist} - ${track.title}`)
    console.log(`   Arousal: ${track.arousal?.toFixed(2)}, Valence: ${track.valence?.toFixed(2)}`)
    console.log(`   BPM: ${track.bpm}, Danceability: ${track.danceability?.toFixed(2)}`)
    console.log(`   Category: ${track.mood_category}, Confidence: ${track.confidence_score?.toFixed(2)}`)
    console.log(`   Mood Happy: ${track.mood_happy?.toFixed(2)}, Mood Party: ${track.mood_party?.toFixed(2)}`)
    console.log('')
}

// Also check Metallica tracks specifically
console.log('\n🎸 Checking ALL Metallica tracks:\n')

const metallicaQuery = `
  SELECT 
    t.title,
    ab.arousal,
    ab.valence,
    ab.bpm,
    ab.danceability,
    ab.energy,
    ab.mood_category,
    ab.mood_aggressive
  FROM tracks t
  LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE t.artist LIKE '%Metallica%'
  AND ab.arousal IS NOT NULL
  ORDER BY ab.arousal DESC
`

const metallica = db.prepare(metallicaQuery).all() as any[]

for (const track of metallica) {
    const matchesParty =
        track.arousal >= 0.75 &&
        track.valence >= 0.6 &&
        track.bpm >= 120 &&
        track.danceability >= 0.8

    const marker = matchesParty ? '✅ MATCHES' : '❌ NO MATCH'

    console.log(`${marker} ${track.title}`)
    console.log(`   Arousal: ${track.arousal?.toFixed(2)}, Valence: ${track.valence?.toFixed(2)}, BPM: ${track.bpm}`)
    console.log(`   Dance: ${track.danceability?.toFixed(2)}, Category: ${track.mood_category}`)
    console.log('')
}

process.exit(0)
