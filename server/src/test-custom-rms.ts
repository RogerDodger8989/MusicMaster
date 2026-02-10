/**
 * Test custom RMS energy calculation on a single Metallica track
 */

import { analyzeAndStoreTrack } from './services/audioAnalysisFfmpeg'
import { getDatabase } from './database'

async function testRMS() {
    console.log('🧪 Testing custom RMS energy calculation...\n')

    const db = getDatabase()

    // Clear one Metallica track for testing
    const track = db.prepare(`
    SELECT t.id, t.file_path, t.title, t.artist
    FROM tracks t
    WHERE t.artist LIKE '%Metallica%' AND t.title LIKE '%Enter Sandman%'
    LIMIT 1
  `).get() as any

    if (!track) {
        console.log('❌ No track found')
        process.exit(1)
    }

    // Clear existing data
    db.prepare('DELETE FROM acousticbrainz_data WHERE track_id = ?').run(track.id)

    console.log(`🎸 Testing: ${track.artist} - ${track.title}\n`)

    // Analyze with new RMS
    await analyzeAndStoreTrack(track.id, track.file_path)

    // Check result
    const result = db.prepare(`
    SELECT energy, arousal, valence, mood_category
    FROM acousticbrainz_data
    WHERE track_id = ?
  `).get(track.id) as any

    if (result) {
        console.log('\n📊 Results with CUSTOM RMS:')
        console.log(`  Energy: ${result.energy?.toFixed(4)}  ${result.energy > 0.7 ? '✅ HIGH' : result.energy > 0.5 ? '⚠️ MEDIUM' : '❌ LOW'}`)
        console.log(`  Arousal: ${result.arousal?.toFixed(4)}`)
        console.log(`  Valence: ${result.valence?.toFixed(4)}`)
        console.log(`  Mood: ${result.mood_category}`)

        if (result.energy > 0.6) {
            console.log('\n✅ SUCCESS! High energy detected for Metallica!')
        } else {
            console.log('\n⚠️ Energy still low - may need to adjust normalization')
        }
    }

    process.exit(0)
}

testRMS().catch(console.error)
