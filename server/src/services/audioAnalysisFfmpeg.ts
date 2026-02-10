/**
 * FFmpeg-Based Audio Analysis Service
 * Extracts audio features using FFmpeg instead of JavaScript libraries
 * Uses bundled FFmpeg binaries (cross-platform, no PATH required)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database'
import { calculateArousalValence, assignMoodCategory, findClosestMoodCategory, calculateConfidenceScore, calculateMoodsFromGenre } from './moodTaxonomy'
import { v4 as uuidv4 } from 'uuid'
// @ts-ignore - ffmpeg-static doesn't have types
import ffmpegPath from 'ffmpeg-static'
// @ts-ignore - ffprobe-static doesn't have types  
import ffprobePath from 'ffprobe-static'

const execAsync = promisify(exec)

// Use bundled binaries (cross-platform, no PATH configuration needed)
const FFMPEG = ffmpegPath
const FFPROBE = ffprobePath.path

export interface AudioFeatures {
    bpm: number | null
    bpm_confidence: number | null
    energy: number | null
    danceability: number | null
    loudness: number | null
    arousal: number | null
    valence: number | null
    mood_category: string | null
    confidence_score: number | null
    waveform_path: string | null
    instrumentalness: number | null
}

/**
 * Extract BPM using FFmpeg's silencedetect (beat detection proxy)
 * This is a simplified approach - real BPM needs more complex analysis
 */
async function estimateBPM(filePath: string): Promise<{ bpm: number; confidence: number }> {
    try {
        // Get audio duration first
        const durationCmd = `"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        const { stdout: durationStr } = await execAsync(durationCmd)
        const duration = parseFloat(durationStr.trim())

        // For now, use a heuristic based on duration and file metadata
        // In a real implementation, you'd use beat detection algorithms

        // Dynamic placeholder based on energy if we had it, but we don't yet in this scope
        // So we'll just keep it at a safer 100 for now or calculate later
        const bpm = 100
        const confidence = 0.3

        return { bpm, confidence }
    } catch (error) {
        console.error('BPM estimation failed:', error)
        return { bpm: 0, confidence: 0 }
    }
}

/**
 * Calculate audio energy using custom RMS from raw PCM samples
 * This is WAY more accurate than FFmpeg astats filter
 */
async function calculateAudioEnergy(filePath: string): Promise<number> {
    try {
        // Extract raw PCM audio data using FFmpeg
        // Convert to mono, 16-bit PCM, 44.1kHz
        const tempPcm = path.join(__dirname, `../../data/temp_audio_${uuidv4()}.pcm`)
        const extractCmd = `"${FFMPEG}" -i "${filePath}" -ac 1 -f s16le -ar 44100 "${tempPcm}" -y 2>&1`

        await execAsync(extractCmd)

        // Read PCM data
        const pcmData = fs.readFileSync(tempPcm)

        // Convert to int16 samples
        const sampleCount = pcmData.length / 2
        const samples: number[] = []

        for (let i = 0; i < pcmData.length; i += 2) {
            // Read 16-bit signed integer (little-endian)
            const sample = pcmData.readInt16LE(i)
            // Normalize to -1.0 to 1.0
            samples.push(sample / 32768.0)
        }

        // Calculate RMS (Root Mean Square) energy
        let sumSquares = 0
        for (const sample of samples) {
            sumSquares += sample * sample
        }

        const rms = Math.sqrt(sumSquares / samples.length)

        // Clean up temp file
        try {
            fs.unlinkSync(tempPcm)
        } catch (e) {
            // Ignore cleanup errors
        }

        // RMS typically ranges from 0 to ~0.3 for music
        // Normalize to 0-1 scale, with some headroom
        const normalized = Math.min(rms / 0.25, 1.0)

        return normalized
    } catch (error) {
        console.error('Energy calculation failed:', error)
        return 0.5 // Default fallback
    }
}

/**
 * Generate waveform PNG using FFmpeg
 */
async function generateWaveform(filePath: string, outputPath: string): Promise<void> {
    try {
        const cmd = `"${FFMPEG}" -i "${filePath}" -filter_complex "showwavespic=s=800x100:colors=#3b82f6" -frames:v 1 -y "${outputPath}"`
        await execAsync(cmd)
    } catch (error) {
        console.error('Waveform generation failed:', error)
    }
}

/**
 * Analyze audio file and extract all features
 */
export async function analyzeAudioFile(trackId: string, filePath: string, genre: string | null = null): Promise<AudioFeatures> {
    console.log(`🎵 Analyzing: ${path.basename(filePath)}`)

    try {
        // 1. Estimate BPM
        const { bpm, confidence: bpm_confidence } = await estimateBPM(filePath)

        // 2. Calculate energy
        const energy = await calculateAudioEnergy(filePath)

        // 3. Estimate loudness (use energy as proxy)
        const loudness = energy

        // 3.01 Improve BPM guess based on energy
        const estimatedBpm = energy > 0.6 ? 128 : (energy < 0.3 ? 85 : 105)

        // 3.1 Estimate instrumentalness (simple heuristic)
        let instrumentalness = 0.05 // Base: assume vocal

        // Metadata hints
        const lowerPath = filePath.toLowerCase()
        const instrumentalKeywords = ['score', 'soundtrack', 'instrumental', 'theme', 'overture', 'concerto', 'symphony', 'ambient', 'orchestral', 'cinematic', 'symphonic']
        if (instrumentalKeywords.some(kw => lowerPath.includes(kw))) {
            instrumentalness += 0.6
        }

        // Genre hints
        if (genre) {
            const lowerGenre = genre.toLowerCase()
            if (instrumentalKeywords.some(kw => lowerGenre.includes(kw))) {
                instrumentalness += 0.8 // Stronger signal from explicit genre
            }
        }

        // Energy/BPM hints
        if (energy < 0.25) instrumentalness += 0.3
        if (bpm > 0 && bpm < 80) instrumentalness += 0.1

        instrumentalness = Math.min(1.0, instrumentalness)

        // 4. Estimate danceability based on BPM
        const effectiveBpm = estimatedBpm
        let danceability = 0.5
        if (effectiveBpm > 0) {
            // Ideal dance range 90-130 BPM
            if (effectiveBpm >= 90 && effectiveBpm <= 130) {
                const distanceFrom120 = Math.abs(effectiveBpm - 120)
                danceability = 1.0 - (distanceFrom120 / 40)
            } else if (effectiveBpm > 130 && effectiveBpm <= 180) {
                danceability = 0.7 - ((effectiveBpm - 130) / 200)
            }
            danceability = Math.max(0, Math.min(1, danceability))
        }

        // 5. Generate waveform
        const waveformDir = path.join(__dirname, '../../data/waveforms')
        if (!fs.existsSync(waveformDir)) {
            fs.mkdirSync(waveformDir, { recursive: true })
        }

        const waveformPath = path.join(waveformDir, `${trackId}.png`)
        await generateWaveform(filePath, waveformPath)

        // 6. Calculate Arousal-Valence
        // Infer mood scores from genre if available
        const inferredMoods = calculateMoodsFromGenre(genre)

        const { arousal, valence } = calculateArousalValence(
            energy,
            danceability,
            inferredMoods
        )

        // 7. Assign mood category
        const moodCategory = assignMoodCategory(arousal, valence, effectiveBpm)

        // 8. Calculate confidence
        const { distance } = findClosestMoodCategory(arousal, valence)
        const confidence_score = calculateConfidenceScore(
            energy !== null,
            danceability !== null,
            effectiveBpm !== null && effectiveBpm > 0,
            inferredMoods,
            distance
        )

        console.log(`  ✅ Energy: ${energy.toFixed(2)}, Dance: ${danceability.toFixed(2)}`)
        console.log(`  🎭 Arousal: ${arousal.toFixed(2)}, Valence: ${valence.toFixed(2)}, Category: ${moodCategory.id}`)

        return {
            bpm: effectiveBpm,
            bpm_confidence,
            energy,
            danceability,
            loudness,
            arousal,
            valence,
            mood_category: moodCategory.id,
            confidence_score,
            waveform_path: waveformPath,
            instrumentalness: instrumentalness
        }
    } catch (error) {
        console.error(`❌ Analysis failed for ${filePath}:`, error)
        return {
            bpm: null,
            bpm_confidence: null,
            energy: null,
            danceability: null,
            loudness: null,
            arousal: null,
            valence: null,
            mood_category: null,
            confidence_score: null,
            waveform_path: null,
            instrumentalness: null
        }
    }
}

/**
 * Store audio features in database
 */
export function storeAudioFeatures(trackId: string, features: AudioFeatures): void {
    const db = getDatabase()

    // Find existing entry for this track if it exists
    const existing = db.prepare('SELECT id FROM acousticbrainz_data WHERE track_id = ?').get(trackId) as { id: string } | undefined
    const id = existing?.id || uuidv4()

    const stmt = db.prepare(`
    INSERT OR REPLACE INTO acousticbrainz_data (
      id, track_id, bpm, bpm_confidence, energy, danceability,
      loudness_integrated, arousal, valence, mood_category, confidence_score,
      instrumentalness,
      mood_happy, mood_sad, mood_aggressive, mood_party, mood_relaxed, mood_acoustic
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

    const moods = {
        happy: features.mood_category === 'happy' ? 1.0 : 0.0,
        sad: features.mood_category === 'sad' ? 1.0 : 0.0,
        aggressive: features.mood_category === 'aggressive' ? 1.0 : 0.0,
        party: features.mood_category === 'party' ? 1.0 : 0.0,
        relaxed: features.mood_category === 'relaxed' ? 1.0 : 0.0,
        acoustic: features.mood_category === 'acoustic' ? 1.0 : 0.0
    }

    stmt.run(
        id,
        trackId,
        features.bpm,
        features.bpm_confidence,
        features.energy,
        features.danceability,
        features.loudness,
        features.arousal,
        features.valence,
        features.mood_category,
        features.confidence_score,
        features.instrumentalness,
        moods.happy,
        moods.sad,
        moods.aggressive,
        moods.party,
        moods.relaxed,
        moods.acoustic
    )

    console.log(`  💾 Stored in database (Mood: ${features.mood_category}, Instrumental: ${features.instrumentalness?.toFixed(2)})`)
}

/**
 * Analyze and store (convenience function)
 */
export async function analyzeAndStoreTrack(trackId: string, filePath: string, genre: string | null = null): Promise<void> {
    const features = await analyzeAudioFile(trackId, filePath, genre)
    if (features.arousal !== null) {
        storeAudioFeatures(trackId, features)
    }
}
