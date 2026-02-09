/**
 * Vibes Service - Mood-based playlist generation
 * Filters tracks by audio features and avoids duplicate artists
 */

import { getDatabase } from '../database'

export interface VibeDefinition {
  id: string
  name: string
  emoji: string
  description: string
  filters: {
    energy?: { min?: number; max?: number }
    danceability?: { min?: number; max?: number }
    moods?: string[]
  }
}

const VIBE_DEFINITIONS: Record<string, VibeDefinition> = {
  party: {
    id: 'party',
    name: 'Party',
    emoji: '🎉',
    description: 'High energy, dance-worthy hits',
    filters: {
      energy: { min: 0.75 },
      danceability: { min: 0.8 },
      moods: ['mood_happy', 'mood_party']
    }
  },
  chill: {
    id: 'chill',
    name: 'Chill',
    emoji: '😴',
    description: 'Relaxed and laid-back vibes',
    filters: {
      energy: { max: 0.4 },
      danceability: { max: 0.5 },
      moods: ['mood_relaxed']
    }
  },
  workout: {
    id: 'workout',
    name: 'Workout',
    emoji: '💪',
    description: 'Peak performance energy',
    filters: {
      energy: { min: 0.8 },
      danceability: { min: 0.75 },
      moods: ['mood_happy']
    }
  },
  sad: {
    id: 'sad',
    name: 'Sad',
    emoji: '😢',
    description: 'Melancholic and introspective',
    filters: {
      energy: { min: 0.4, max: 0.7 },
      moods: ['mood_sad']
    }
  },
  late_night: {
    id: 'late_night',
    name: 'Late Night',
    emoji: '🌙',
    description: 'Deep and atmospheric',
    filters: {
      energy: { min: 0.3, max: 0.5 },
      moods: ['mood_relaxed', 'mood_acoustic']
    }
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    emoji: '🔥',
    description: 'Raw and intense',
    filters: {
      energy: { min: 0.7 },
      moods: ['mood_aggressive']
    }
  },
  acoustic: {
    id: 'acoustic',
    name: 'Acoustic',
    emoji: '🎸',
    description: 'Stripped and intimate',
    filters: {
      energy: { max: 0.6 },
      moods: ['mood_acoustic']
    }
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
    }
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
    // Build WHERE clause for mood filters
    let moodClause = ''
    if (vibe.filters.moods && vibe.filters.moods.length > 0) {
      const moodConditions = vibe.filters.moods
        .map(mood => `ab.${mood} > 0.6`)
        .join(' OR ')
      moodClause = `AND (${moodConditions})`
    }

    // Build energy filter
    let energyClause = ''
    if (vibe.filters.energy) {
      const conditions = []
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

    // Build danceability filter
    let danceClause = ''
    if (vibe.filters.danceability) {
      const conditions = []
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

    // Query all matching tracks with their audio features
    const query = `
      SELECT 
        t.id, t.title, t.artist,
        ab.energy, ab.danceability,
        ab.mood_happy, ab.mood_sad, ab.mood_aggressive,
        ab.mood_party, ab.mood_relaxed, ab.mood_acoustic,
        ab.bpm, ab.key
      FROM tracks t
      LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
      WHERE ab.id IS NOT NULL
      ${energyClause}
      ${danceClause}
      ${moodClause}
      ORDER BY RANDOM()
    `

    const allTracks = db.prepare(query).all() as TrackWithFeatures[]

    // Filter out duplicate artists (keep first occurrence)
    const artistsSeen = new Set<string>()
    const uniqueTracks: TrackWithFeatures[] = []

    for (const track of allTracks) {
      if (!artistsSeen.has(track.artist.toLowerCase())) {
        artistsSeen.add(track.artist.toLowerCase())
        uniqueTracks.push(track)

        if (uniqueTracks.length >= limit) {
          break
        }
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
