/**
 * Vibes Service - Mood-based playlist generation
 * Filters tracks by audio features and avoids duplicate artists
 */

import { getDatabase } from '../database'
import { MOOD_CATEGORIES, classifyMusicBrainzTag } from './moodTaxonomy'
import * as fs from 'fs'
import * as path from 'path'

const LOG_FILE = path.join(process.cwd(), 'vibe_logic_debug.txt')

function logDebug(msg: string) {
  try {
    fs.appendFileSync(LOG_FILE, new Date().toISOString() + ': ' + msg + '\n')
  } catch (e) { }
}

/**
 * Calculate Euclidean Distance between two mood vectors (Valence & Arousal)
 */
function calculateEuclideanDistance(v1: number, a1: number, v2: number, a2: number): number {
  const dv = v1 - v2
  const da = a1 - a2
  return Math.sqrt(dv * dv + da * da)
}

export interface VibeDefinition {
  id: string
  name: string
  emoji: string
  description: string
  filters: {
    energy?: { min?: number; max?: number }
    danceability?: { min?: number; max?: number }
    bpm?: { min?: number; max?: number }
    arousal?: { min?: number; max?: number }
    valence?: { min?: number; max?: number }
    instrumentalness?: { min?: number; max?: number }
    moods?: string[]
  }
  targetValence?: number
  targetArousal?: number
}

const VIBE_DEFINITIONS: Record<string, VibeDefinition> = {
  party: {
    id: 'party',
    name: 'Party',
    emoji: '🎉',
    description: 'High energy, dance-worthy hits',
    filters: {
      arousal: { min: 0.7 },
      valence: { min: 0.3 },
      bpm: { min: 110 },
      danceability: { min: 0.7 },
      instrumentalness: { max: 0.4 }
    },
    targetValence: 0.8,
    targetArousal: 0.8
  },
  chill: {
    id: 'chill',
    name: 'Chill',
    emoji: '😴',
    description: 'Relaxed and laid-back vibes',
    filters: {
      arousal: { max: 0.35 },
      valence: { min: 0.6 },
      bpm: { max: 95 },
      energy: { max: 0.4 }
    },
    targetValence: 0.8,
    targetArousal: 0.2
  },
  workout: {
    id: 'workout',
    name: 'Workout',
    emoji: '💪',
    description: 'Peak performance energy',
    filters: {
      energy: { min: 0.75 },
      arousal: { min: 0.75 },
      moods: ['mood_happy', 'mood_aggressive', 'mood_party']
    },
    targetValence: 0.6,
    targetArousal: 0.9
  },
  sad: {
    id: 'sad',
    name: 'Sad',
    emoji: '😢',
    description: 'Melancholic and introspective',
    filters: {
      energy: { min: 0.4, max: 0.7 },
      moods: ['mood_sad']
    },
    targetValence: 0.2,
    targetArousal: 0.3
  },
  late_night: {
    id: 'late_night',
    name: 'Late Night',
    emoji: '🌙',
    description: 'Deep and atmospheric',
    filters: {
      energy: { min: 0.3, max: 0.5 },
      moods: ['mood_relaxed', 'mood_acoustic']
    },
    targetValence: 0.4,
    targetArousal: 0.2
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    emoji: '🔥',
    description: 'Raw and intense',
    filters: {
      energy: { min: 0.7 },
      moods: ['mood_aggressive']
    },
    targetValence: 0.2,
    targetArousal: 0.8
  },
  acoustic: {
    id: 'acoustic',
    name: 'Acoustic',
    emoji: '🎸',
    description: 'Stripped and intimate',
    filters: {
      energy: { max: 0.6 },
      moods: ['mood_acoustic']
    },
    targetValence: 0.7,
    targetArousal: 0.3
  },
  pure_joy: {
    id: 'pure_joy',
    name: 'Pure Joy',
    emoji: '✨',
    description: 'Uplifting and happy',
    filters: {
      energy: { min: 0.6 },
      danceability: { min: 0.7 },
      moods: ['mood_happy']
    },
    targetValence: 0.9,
    targetArousal: 0.7
  }
}

interface TrackWithFeatures {
  id: string
  title: string
  artist: string
  energy: number | null
  danceability: number | null
  mood_happy: number | null
  mood_sad: number | null
  mood_aggressive: number | null
  mood_party: number | null
  mood_relaxed: number | null
  mood_acoustic: number | null
  bpm: number | null
  key: string | null
  instrumentalness: number | null
  arousal: number | null
  valence: number | null
  mood_category: string | null
  mood: string | null
}

/**
 * Get all available vibes (built-in + custom)
 */
export function getAllVibes(): VibeDefinition[] {
  const builtInVibes = Object.values(VIBE_DEFINITIONS)
  const customVibes = getCustomVibes()
  return [...builtInVibes, ...customVibes]
}

/**
 * Get specific vibe by ID (checks both built-in and custom)
 */
export function getVibeDefinition(vibeId: string): VibeDefinition | null {
  // Check built-in vibes first
  if (VIBE_DEFINITIONS[vibeId]) {
    return VIBE_DEFINITIONS[vibeId]
  }

  // Check custom vibes
  const customVibe = getCustomVibeById(vibeId)
  return customVibe
}

/**
 * Get all custom vibes from database
 */
export function getCustomVibes(): VibeDefinition[] {
  const db = getDatabase()
  try {
    const rows = db.prepare(`
      SELECT id, name, emoji, description, 
             energy_min, energy_max, 
             danceability_min, danceability_max, 
             mood_filters
      FROM custom_vibes
      ORDER BY created_at DESC
    `).all() as any[]

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      description: row.description || '',
      filters: {
        energy: row.energy_min !== null || row.energy_max !== null
          ? { min: row.energy_min, max: row.energy_max }
          : undefined,
        danceability: row.danceability_min !== null || row.danceability_max !== null
          ? { min: row.danceability_min, max: row.danceability_max }
          : undefined,
        arousal: row.arousal_min !== null || row.arousal_max !== null
          ? { min: row.arousal_min, max: row.arousal_max }
          : undefined,
        valence: row.valence_min !== null || row.valence_max !== null
          ? { min: row.valence_min, max: row.valence_max }
          : undefined,
        instrumentalness: row.instrumentalness_min !== null || row.instrumentalness_max !== null
          ? { min: row.instrumentalness_min, max: row.instrumentalness_max }
          : undefined,
        moods: row.mood_filters ? JSON.parse(row.mood_filters) : undefined
      }

    }))
  } catch (error) {
    console.error('Error fetching custom vibes:', error)
    return []
  }
}

/**
 * Get specific custom vibe by ID
 */
export function getCustomVibeById(vibeId: string): VibeDefinition | null {
  const db = getDatabase()
  try {
    const row = db.prepare(`
      SELECT id, name, emoji, description, 
             energy_min, energy_max, 
             danceability_min, danceability_max, 
             mood_filters
      FROM custom_vibes
      WHERE id = ?
    `).get(vibeId) as any

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      description: row.description || '',
      filters: {
        energy: row.energy_min !== null || row.energy_max !== null
          ? { min: row.energy_min, max: row.energy_max }
          : undefined,
        danceability: row.danceability_min !== null || row.danceability_max !== null
          ? { min: row.danceability_min, max: row.danceability_max }
          : undefined,
        arousal: row.arousal_min !== null || row.arousal_max !== null
          ? { min: row.arousal_min, max: row.arousal_max }
          : undefined,
        valence: row.valence_min !== null || row.valence_max !== null
          ? { min: row.valence_min, max: row.valence_max }
          : undefined,
        instrumentalness: row.instrumentalness_min !== null || row.instrumentalness_max !== null
          ? { min: row.instrumentalness_min, max: row.instrumentalness_max }
          : undefined,
        moods: row.mood_filters ? JSON.parse(row.mood_filters) : undefined
      }

    }
  } catch (error) {
    console.error('Error fetching custom vibe:', error)
    return null
  }
}

/**
 * Get playlist for a vibe with no duplicate artists
 */
export function getVibePlaylist(vibeId: string, limit: number = 50): TrackWithFeatures[] {
  const db = getDatabase()
  const vibe = getVibeDefinition(vibeId)

  if (!vibe) {
    return []
  }

  try {
    // Build WHERE clause for mood filters (stricter threshold)
    let moodClause = ''
    if (vibe.filters.moods && vibe.filters.moods.length > 0) {
      const moodConditions = vibe.filters.moods
        .map(mood => `ab.${mood} > 0.75`)
        .join(' OR ')
      moodClause = `AND (${moodConditions})`
    }

    // Build energy filter (ensure not null if filter is defined)
    let energyClause = ''
    if (vibe.filters.energy) {
      const conditions = ['ab.energy IS NOT NULL']
      if (vibe.filters.energy.min !== undefined) {
        conditions.push(`ab.energy >= ${vibe.filters.energy.min}`)
      }
      if (vibe.filters.energy.max !== undefined) {
        conditions.push(`ab.energy <= ${vibe.filters.energy.max}`)
      }
      if (conditions.length > 0) {
        energyClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Build danceability filter (ensure not null if filter is defined)
    let danceClause = ''
    if (vibe.filters.danceability) {
      const conditions = ['ab.danceability IS NOT NULL']
      if (vibe.filters.danceability.min !== undefined) {
        conditions.push(`ab.danceability >= ${vibe.filters.danceability.min}`)
      }
      if (vibe.filters.danceability.max !== undefined) {
        conditions.push(`ab.danceability <= ${vibe.filters.danceability.max}`)
      }
      if (conditions.length > 0) {
        danceClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Build BPM filter
    let bpmClause = ''
    if (vibe.filters.bpm) {
      const conditions = ['ab.bpm IS NOT NULL']
      if (vibe.filters.bpm.min !== undefined) {
        conditions.push(`ab.bpm >= ${vibe.filters.bpm.min}`)
      }
      if (vibe.filters.bpm.max !== undefined) {
        conditions.push(`ab.bpm <= ${vibe.filters.bpm.max}`)
      }
      if (conditions.length > 0) {
        bpmClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Build arousal filter
    let arousalClause = ''
    if (vibe.filters.arousal) {
      const conditions = ['ab.arousal IS NOT NULL']
      if (vibe.filters.arousal.min !== undefined) {
        conditions.push(`ab.arousal >= ${vibe.filters.arousal.min}`)
      }
      if (vibe.filters.arousal.max !== undefined) {
        conditions.push(`ab.arousal <= ${vibe.filters.arousal.max}`)
      }
      if (conditions.length > 0) {
        arousalClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Build valence filter
    let valenceClause = ''
    if (vibe.filters.valence) {
      const conditions = ['ab.valence IS NOT NULL']
      if (vibe.filters.valence.min !== undefined) {
        conditions.push(`ab.valence >= ${vibe.filters.valence.min}`)
      }
      if (vibe.filters.valence.max !== undefined) {
        conditions.push(`ab.valence <= ${vibe.filters.valence.max}`)
      }
      if (conditions.length > 0) {
        valenceClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Build instrumentalness filter
    let instrumentalnessClause = ''
    if (vibe.filters.instrumentalness) {
      const conditions = ['ab.instrumentalness IS NOT NULL']
      if (vibe.filters.instrumentalness.min !== undefined) {
        conditions.push(`ab.instrumentalness >= ${vibe.filters.instrumentalness.min}`)
      }
      if (vibe.filters.instrumentalness.max !== undefined) {
        conditions.push(`ab.instrumentalness <= ${vibe.filters.instrumentalness.max}`)
      }
      if (conditions.length > 0) {
        instrumentalnessClause = 'AND ' + conditions.join(' AND ')
      }
    }

    // Query all matching tracks with their audio features
    // STRICT: Only include tracks with complete mood classification
    const query = `
      SELECT 
        t.id, t.title, t.artist, t.album, t.album_artist, ac.id as album_id,
        ab.energy, ab.danceability,
        ab.mood_happy, ab.mood_sad, ab.mood_aggressive,
        ab.mood_party, ab.mood_relaxed, ab.mood_acoustic,
        ab.bpm, ab.key, ab.arousal, ab.valence, ab.mood_category,
        ab.instrumentalness, t.mood
      FROM tracks t
      LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
      LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
      WHERE ab.id IS NOT NULL
      AND ab.arousal IS NOT NULL
      AND ab.valence IS NOT NULL
      ${energyClause}
      ${danceClause}
      ${bpmClause}
      ${arousalClause}
      ${valenceClause}
      ${instrumentalnessClause}
      ${moodClause}
      ORDER BY RANDOM()
    `

    const allTracks = db.prepare(query).all() as TrackWithFeatures[]

    // --- PHASE 1: STRICT FILTERING (AB Data & Text Tags) ---
    // Filter and score tracks
    const artistCounts = new Map<string, number>()
    const trackScores: Array<{ track: TrackWithFeatures; distance: number }> = []

    for (const track of allTracks) {
      // 🛡️ Fallback: If no AB data, try to infer from text mood tags
      let effectiveArousal = track.arousal
      let effectiveValence = track.valence

      if ((effectiveArousal === null || effectiveValence === null) && track.mood) {
        const moodTags = track.mood.split(/[;|,]/)
        let totalA = 0
        let totalV = 0
        let count = 0

        for (const tag of moodTags) {
          const category = classifyMusicBrainzTag(tag)
          if (category) {
            totalA += category.arousal
            totalV += category.valence
            count++
          }
        }

        if (count > 0) {
          effectiveArousal = totalA / count
          effectiveValence = totalV / count
          logDebug(`  ✨ Inferred A-V from tags for ${track.title}: Ar:${effectiveArousal.toFixed(2)} Va:${effectiveValence.toFixed(2)}`)
        }
      }

      logDebug(`Checking ${track.title} [${vibeId}] En:${track.energy} Ar:${effectiveArousal} Va:${effectiveValence} Inst:${track.instrumentalness}`)

      // 🛡️ Safety Net: Explicitly check filters in JS to prevent SQL leaks
      if (vibe.filters.energy) {
        if (vibe.filters.energy.max !== undefined && (track.energy === null || track.energy > vibe.filters.energy.max)) {
          logDebug(`  ❌ REJECTED Energy: ${track.energy} > ${vibe.filters.energy.max}`)
          continue
        }
        if (vibe.filters.energy.min !== undefined && (track.energy === null || track.energy < vibe.filters.energy.min)) {
          logDebug(`  ❌ REJECTED Energy: ${track.energy} < ${vibe.filters.energy.min}`)
          continue
        }
      }
      if (vibe.filters.arousal) {
        if (vibe.filters.arousal.max !== undefined && (effectiveArousal === null || effectiveArousal > vibe.filters.arousal.max)) {
          logDebug(`  ❌ REJECTED Arousal: ${effectiveArousal} > ${vibe.filters.arousal.max}`)
          continue
        }
        if (vibe.filters.arousal.min !== undefined && (effectiveArousal === null || effectiveArousal < vibe.filters.arousal.min)) {
          logDebug(`  ❌ REJECTED Arousal: ${effectiveArousal} < ${vibe.filters.arousal.min}`)
          continue
        }
      }
      if (vibe.filters.valence) {
        if (vibe.filters.valence.max !== undefined && (effectiveValence === null || effectiveValence > vibe.filters.valence.max)) continue
        if (vibe.filters.valence.min !== undefined && (effectiveValence === null || effectiveValence < vibe.filters.valence.min)) continue
      }
      if (vibe.filters.instrumentalness) {
        if (vibe.filters.instrumentalness.max !== undefined && (track.instrumentalness === null || track.instrumentalness > vibe.filters.instrumentalness.max)) {
          logDebug(`  ❌ REJECTED Instrumental: ${track.instrumentalness} > ${vibe.filters.instrumentalness.max}`)
          continue
        }
        if (vibe.filters.instrumentalness.min !== undefined && (track.instrumentalness === null || track.instrumentalness < vibe.filters.instrumentalness.min)) {
          logDebug(`  ❌ REJECTED Instrumental: ${track.instrumentalness} < ${vibe.filters.instrumentalness.min}`)
          continue
        }
      }

      const artistKey = track.artist.toLowerCase()
      const count = artistCounts.get(artistKey) || 0

      // Calculate distance if target is defined
      let distance = 0
      if (vibe.targetValence !== undefined && vibe.targetArousal !== undefined && effectiveValence !== null && effectiveArousal !== null) {
        distance = calculateEuclideanDistance(effectiveValence, effectiveArousal, vibe.targetValence, vibe.targetArousal)
      } else {
        distance = Math.random() // Tie-break with randomness if no target
      }

      if (count < 10) {
        logDebug(`  ✅ ACCEPTED (Strict mode) dist: ${distance.toFixed(4)}`)
        artistCounts.set(artistKey, count + 1)
        trackScores.push({ track, distance })
      }
    }

    // Sort by distance and take top tracks
    trackScores.sort((a, b) => a.distance - b.distance)
    const uniqueTracks = trackScores.map(ts => ts.track).slice(0, limit)

    // --- PHASE 2: FALLBACK (Not Enriched Tracks / Genre based) ---
    // If we have very few tracks, fill the pool with tracks that aren't blacklisted
    if (uniqueTracks.length < Math.min(limit, 10)) {
      logDebug(`⚠️ Playlist too small (${uniqueTracks.length}). Running fallback fallback for ${vibeId}...`)

      const fallbackQuery = `
         SELECT 
           t.id, t.title, t.artist, t.album, t.album_artist, ac.id as album_id, t.genre,
           ab.energy, ab.danceability,
           ab.mood_happy, ab.mood_sad, ab.mood_aggressive,
           ab.mood_party, ab.mood_relaxed, ab.mood_acoustic,
           ab.bpm, ab.key, ab.arousal, ab.valence, ab.mood_category,
           ab.instrumentalness
         FROM tracks t
         LEFT JOIN albums_cache ac ON t.album = ac.name AND COALESCE(t.album_artist, t.artist) = ac.artist
         LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
         ORDER BY RANDOM()
       `
      const potentialTracks = db.prepare(fallbackQuery).all() as any[]

      for (const track of potentialTracks) {
        // Skip if already added
        if (uniqueTracks.some(ut => ut.id === track.id)) continue

        const g = (track.genre || '').toLowerCase()
        let isBlacklisted = false

        // 🛡️ Safety check: If it has AB data and failed "Drive" or "Metal" tests earlier, 
        // we should be careful. But for now, we rely on the Genre Blacklist which is very safe.

        // Hard blacklists for vibes
        if (vibeId === 'party') {
          // Party never has "Score", "Soundtrack", "Classical", "Ambient"
          if (g.includes('score') || g.includes('soundtrack') || g.includes('ambient') || g.includes('orchestral') || g.includes('film')) {
            isBlacklisted = true
          }
          // Also block high instrumentalness if we have the data
          if (track.instrumentalness !== null && track.instrumentalness > 0.6) isBlacklisted = true
        }

        if (vibeId === 'chill') {
          // Chill never has "Metal", "Hardcore", "Aggressive"
          if (g.includes('metal') || g.includes('hardcore') || g.includes('aggressive') || g.includes('thrash') || g.includes('punk')) {
            isBlacklisted = true
          }
          // Also block high energy/arousal if we have the data
          if ((track.energy !== null && track.energy > 0.7) || (track.arousal !== null && track.arousal > 0.7)) isBlacklisted = true
        }

        const artistKey = track.artist.toLowerCase()
        const count = artistCounts.get(artistKey) || 0
        if (!isBlacklisted && count < 10) {
          logDebug(`  ✅ ACCEPTED (Fallback mode): ${track.title} [${track.genre}]`)
          artistCounts.set(artistKey, count + 1)
          uniqueTracks.push(track as TrackWithFeatures)
        }

        if (uniqueTracks.length >= limit) break
      }
    }

    return uniqueTracks
  } catch (error) {
    console.error(`Error fetching vibe playlist for ${vibeId}:`, error)
    return []
  }
}

/**
 * Get favorite vibes (most used recently)
 */
export function getFavouriteVibes(): string[] {
  // TODO: Track which vibes user clicks most
  // For now return all
  return Object.keys(VIBE_DEFINITIONS)
}

/**
 * Create a new custom vibe
 */
export interface CreateCustomVibeInput {
  id: string
  name: string
  emoji: string
  description?: string
  energy_min?: number
  energy_max?: number
  danceability_min?: number
  danceability_max?: number
  mood_filters?: string[]
}

export function createCustomVibe(input: CreateCustomVibeInput): boolean {
  const db = getDatabase()
  try {
    const stmt = db.prepare(`
      INSERT INTO custom_vibes (
        id, name, emoji, description,
        energy_min, energy_max,
        danceability_min, danceability_max,
        mood_filters
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      input.id,
      input.name,
      input.emoji,
      input.description || null,
      input.energy_min ?? null,
      input.energy_max ?? null,
      input.danceability_min ?? null,
      input.danceability_max ?? null,
      input.mood_filters ? JSON.stringify(input.mood_filters) : null
    )

    return true
  } catch (error) {
    console.error('Error creating custom vibe:', error)
    return false
  }
}

/**
 * Update an existing custom vibe
 */
export function updateCustomVibe(vibeId: string, input: Partial<CreateCustomVibeInput>): boolean {
  const db = getDatabase()
  try {
    const updates: string[] = []
    const values: any[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.emoji !== undefined) {
      updates.push('emoji = ?')
      values.push(input.emoji)
    }
    if (input.description !== undefined) {
      updates.push('description = ?')
      values.push(input.description)
    }
    if (input.energy_min !== undefined) {
      updates.push('energy_min = ?')
      values.push(input.energy_min)
    }
    if (input.energy_max !== undefined) {
      updates.push('energy_max = ?')
      values.push(input.energy_max)
    }
    if (input.danceability_min !== undefined) {
      updates.push('danceability_min = ?')
      values.push(input.danceability_min)
    }
    if (input.danceability_max !== undefined) {
      updates.push('danceability_max = ?')
      values.push(input.danceability_max)
    }
    if (input.mood_filters !== undefined) {
      updates.push('mood_filters = ?')
      values.push(JSON.stringify(input.mood_filters))
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(vibeId)

    const stmt = db.prepare(`
      UPDATE custom_vibes 
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...values)
    return true
  } catch (error) {
    console.error('Error updating custom vibe:', error)
    return false
  }
}

/**
 * Delete a custom vibe
 */
export function deleteCustomVibe(vibeId: string): boolean {
  const db = getDatabase()
  try {
    const stmt = db.prepare('DELETE FROM custom_vibes WHERE id = ?')
    stmt.run(vibeId)
    return true
  } catch (error) {
    console.error('Error deleting custom vibe:', error)
    return false
  }
}
