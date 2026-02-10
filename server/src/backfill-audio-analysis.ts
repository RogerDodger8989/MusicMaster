/**
 * Backfill Audio Analysis - Analyze all existing tracks
 */

import { analyzeAndStoreTrack } from './services/audioAnalysisFfmpeg'
import { getDatabase } from './database'
import * as path from 'path'

async function backfillAudioAnalysis() {
    const db = getDatabase()

    console.log('🔄 Starting audio analysis backfill...\n')

    // Get all tracks (force re-analysis to apply new genre/mood logic)
    const tracks = db.prepare(`
    SELECT t.id, t.file_path, t.title, t.artist, t.genre
    FROM tracks t
    ORDER BY t.artist, t.title
  `).all() as any[]

    console.log(`📊 Found ${tracks.length} tracks to analyze\n`)

    let analyzed = 0
    let failed = 0

    for (const track of tracks) {
        try {
            console.log(`\n[${analyzed + failed + 1}/${tracks.length}] ${track.artist} - ${track.title}`)

            await analyzeAndStoreTrack(track.id, track.file_path, track.genre)
            analyzed++

            // Progress update every 10 tracks
            if ((analyzed + failed) % 10 === 0) {
                console.log(`\n📈 Progress: ${analyzed} analyzed, ${failed} failed`)
            }
        } catch (error) {
            console.error(`  ❌ Failed:`, error)
            failed++
        }
    }

    console.log('\n✅ Backfill complete!')
    console.log(`📊 Results: ${analyzed} analyzed, ${failed} failed\n`)

    // Show mood distribution
    const stats = db.prepare(`
    SELECT mood_category, COUNT(*) as count
    FROM acousticbrainz_data
    WHERE mood_category IS NOT NULL
    GROUP BY mood_category
    ORDER BY count DESC
  `).all() as any[]

    console.log('📊 Mood Category Distribution:')
    for (const stat of stats) {
        console.log(`  ${stat.mood_category}: ${stat.count} tracks`)
    }

    process.exit(0)
}

backfillAudioAnalysis().catch((error) => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
})
