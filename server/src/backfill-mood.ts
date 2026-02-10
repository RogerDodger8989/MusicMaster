/**
 * Backfill Script - Populate arousal/valence for existing tracks
 * Run this once to calculate mood classification for tracks that already have AcousticBrainz data
 */

import { getDatabase } from './database'
import { calculateArousalValence, assignMoodCategory, findClosestMoodCategory, calculateConfidenceScore } from './services/moodTaxonomy'

async function backfillMoodClassification() {
    const db = getDatabase()

    console.log('🔄 Starting mood classification backfill...')

    // Get all tracks with AcousticBrainz data but missing arousal/valence
    const tracks = db.prepare(`
    SELECT 
      ab.id,
      ab.track_id,
      ab.bpm,
      ab.energy,
      ab.danceability,
      ab.mood_happy,
      ab.mood_sad,
      ab.mood_aggressive,
      ab.mood_party,
      ab.mood_relaxed,
      ab.mood_acoustic
    FROM acousticbrainz_data ab
    WHERE ab.arousal IS NULL
  `).all() as any[]

    console.log(`📊 Found ${tracks.length} tracks to classify`)

    let updated = 0
    const updateStmt = db.prepare(`
    UPDATE acousticbrainz_data
    SET arousal = ?,
        valence = ?,
        mood_category = ?,
        confidence_score = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)

    for (const track of tracks) {
        try {
            // Calculate Arousal-Valence
            const { arousal, valence, confidence: avConfidence } = calculateArousalValence(
                track.energy,
                track.danceability,
                {
                    mood_happy: track.mood_happy,
                    mood_sad: track.mood_sad,
                    mood_aggressive: track.mood_aggressive,
                    mood_party: track.mood_party,
                    mood_relaxed: track.mood_relaxed,
                    mood_acoustic: track.mood_acoustic
                }
            )

            // Assign mood category
            const moodCategory = assignMoodCategory(arousal, valence, track.bpm)

            // Calculate confidence score
            const { distance } = findClosestMoodCategory(arousal, valence)
            const confidence_score = calculateConfidenceScore(
                track.energy !== null,
                track.danceability !== null,
                track.bpm !== null,
                {
                    mood_happy: track.mood_happy,
                    mood_sad: track.mood_sad,
                    mood_aggressive: track.mood_aggressive,
                    mood_party: track.mood_party,
                    mood_relaxed: track.mood_relaxed,
                    mood_acoustic: track.mood_acoustic
                },
                distance
            )

            // Update the database
            updateStmt.run(arousal, valence, moodCategory.id, confidence_score, track.id)
            updated++

            if (updated % 100 === 0) {
                console.log(`  ✅ Updated ${updated}/${tracks.length} tracks...`)
            }
        } catch (error) {
            console.error(`  ❌ Error processing track ${track.track_id}:`, error)
        }
    }

    console.log(`✅ Backfill complete! Updated ${updated} tracks`)

    // Show statistics
    const stats = db.prepare(`
    SELECT 
      mood_category,
      COUNT(*) as count
    FROM acousticbrainz_data
    WHERE mood_category IS NOT NULL
    GROUP BY mood_category
    ORDER BY count DESC
  `).all()

    console.log('\n📊 Mood Category Distribution:')
    for (const stat of stats as any[]) {
        console.log(`  ${stat.mood_category}: ${stat.count} tracks`)
    }
}

// Run the backfill
backfillMoodClassification()
    .then(() => {
        console.log('\n✅ Done!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('❌ Error:', error)
        process.exit(1)
    })
