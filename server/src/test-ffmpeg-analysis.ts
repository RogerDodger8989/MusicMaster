/**
 * Test FFmpeg-based audio analysis
 */

import { analyzeAndStoreTrack } from './services/audioAnalysisFfmpeg'
import { getDatabase } from './database'

async function testFFmpegAnalysis() {
    console.log('🧪 Testing FFmpeg-based audio analysis...\n')

    const db = getDatabase()

    // Get a Metallica track
    const track = db.prepare(`
    SELECT id, file_path, title, artist
    FROM tracks
    WHERE artist LIKE '%Metallica%'
    LIMIT 1
  `).get() as any

    if (!track) {
        console.log('❌ No tracks found')
        return
    }

    console.log(`🎸 Testing: ${track.artist} - ${track.title}`)
    console.log(`📁 File: ${track.file_path}\n`)

    // Analyze
    await analyzeAndStoreTrack(track.id, track.file_path)

    // Check results
    const result = db.prepare(`
    SELECT bpm, energy, danceability, arousal, valence, mood_category, confidence_score
    FROM acousticbrainz_data
    WHERE track_id = ?
  `).get(track.id) as any

    if (result) {
        console.log('\n📊 Results:')
        console.log(`  BPM: ${result.bpm}`)
        console.log(`  Energy: ${result.energy?.toFixed(3)}`)
        console.log(`  Danceability: ${result.danceability?.toFixed(3)}`)
        console.log(`  Arousal: ${result.arousal?.toFixed(3)}`)
        console.log(`  Valence: ${result.valence?.toFixed(3)}`)
        console.log(`  Mood: ${result.mood_category}`)
        console.log(`  Confidence: ${result.confidence_score?.toFixed(3)}`)
    }

    process.exit(0)
}

testFFmpegAnalysis().catch(console.error)
