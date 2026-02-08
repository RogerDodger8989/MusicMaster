/**
 * AcousticBrainz Service - Audio fingerprinting and analysis
 *
 * Provides access to AcousticBrainz API for:
 * - BPM detection
 * - Key/tonality analysis
 * - Mood classification (energy, danceability, acousticness, etc.)
 * - Loudness measurements
 */

import { DbAcousticBrainzData } from '../database/types.musicbrainz'

const AB_BASE_URL = 'https://acousticbrainz.org/api/v1'
const RATE_LIMIT_MS = 500 // AcousticBrainz is more lenient than MusicBrainz

// Cache for recent queries (TTL: 24 hours)
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Apply rate limiting between API calls
 */
async function applyRateLimit(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
}

/**
 * Get from cache if available and not expired
 */
function getFromCache(key: string): any | null {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  queryCache.delete(key)
  return null
}

/**
 * Store in cache
 */
function cacheResult(key: string, data: any): void {
  queryCache.set(key, { data, timestamp: Date.now() })
}

export interface AcousticBrainzLowLevel {
  bpm: number
  bpm_confidence: number
  key_key: string
  key_scale: string
  key_confidence: number
}

export interface AcousticBrainzHighLevel {
  danceability: {
    danceable: number
    not_danceable: number
  }
  energy: {
    energetic: number
    not_energetic: number
  }
  mood_acoustic: {
    acoustic: number
    not_acoustic: number
  }
  mood_aggressive: {
    aggressive: number
    not_aggressive: number
  }
  mood_happy: {
    happy: number
    not_happy: number
  }
  mood_sad: {
    sad: number
    not_sad: number
  }
  mood_electronic: {
    electronic: number
    not_electronic: number
  }
  mood_party: {
    party: number
    not_party: number
  }
  mood_relaxed: {
    relaxed: number
    not_relaxed: number
  }
  tonal_atonal: {
    atonal: number
    tonal: number
  }
  voice_instrumental: {
    instrumental: number
    voice: number
  }
}

export interface AcousticBrainzResult {
  mbid: string
  lowLevel?: AcousticBrainzLowLevel
  highlevel?: AcousticBrainzHighLevel
}

export class AcousticBrainzService {
  /**
   * Get audio analysis for a recording by MusicBrainz ID
   * @param mbid MusicBrainz Recording ID
   * @param highlevel Include high-level analysis (mood, energy, etc.)
   */
  async getRecordingAnalysis(
    mbid: string,
    highlevel: boolean = true
  ): Promise<AcousticBrainzResult | null> {
    try {
      const cacheKey = `ab:${mbid}:${highlevel}`
      const cached = getFromCache(cacheKey)
      if (cached) {
        console.log(`📦 AB Cache hit: ${mbid}`)
        return cached
      }

      console.log(`🎵 AB: Fetching analysis for: ${mbid}`)
      await applyRateLimit()

      // High-level analysis endpoint
      let url = `${AB_BASE_URL}/${mbid}/high-level`
      if (!highlevel) {
        url = `${AB_BASE_URL}/${mbid}/low-level`
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MusicMaster/1.0.0'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`ℹ️ AB: No analysis found for: ${mbid}`)
          return null
        }
        throw new Error(`AB API error: ${response.status}`)
      }

      const data = (await response.json()) as any

      const result: AcousticBrainzResult = {
        mbid: mbid,
        highlevel: data.highlevel,
        lowLevel: data['lowlevel']
      }

      cacheResult(cacheKey, result)
      return result
    } catch (error) {
      console.error('AB analysis fetch failed:', error)
      return null
    }
  }

  /**
   * Get low-level features (technical analysis)
   */
  async getLowLevelFeatures(mbid: string): Promise<AcousticBrainzLowLevel | null> {
    try {
      const cacheKey = `ab_low:${mbid}`
      const cached = getFromCache(cacheKey)
      if (cached) {
        console.log(`📦 AB Cache hit (low-level): ${mbid}`)
        return cached
      }

      console.log(`🔧 AB: Fetching low-level for: ${mbid}`)
      await applyRateLimit()

      const response = await fetch(`${AB_BASE_URL}/${mbid}/low-level`, {
        headers: {
          'User-Agent': 'MusicMaster/1.0.0'
        }
      })

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as any
      const lowLevel: AcousticBrainzLowLevel = {
        bpm: data.lowlevel?.rhythm?.bpm || 0,
        bpm_confidence: data.lowlevel?.rhythm?.bpm_confidence || 0,
        key_key: data.lowlevel?.tonal?.key_key || 'Unknown',
        key_scale: data.lowlevel?.tonal?.key_scale || 'Unknown',
        key_confidence: data.lowlevel?.tonal?.key_strength || 0
      }

      cacheResult(cacheKey, lowLevel)
      return lowLevel
    } catch (error) {
      console.error('AB low-level fetch failed:', error)
      return null
    }
  }

  /**
   * Get high-level mood/energy features
   */
  async getHighLevelFeatures(mbid: string): Promise<AcousticBrainzHighLevel | null> {
    try {
      const cacheKey = `ab_high:${mbid}`
      const cached = getFromCache(cacheKey)
      if (cached) {
        console.log(`📦 AB Cache hit (high-level): ${mbid}`)
        return cached
      }

      console.log(`😊 AB: Fetching high-level for: ${mbid}`)
      await applyRateLimit()

      const response = await fetch(`${AB_BASE_URL}/${mbid}/high-level`, {
        headers: {
          'User-Agent': 'MusicMaster/1.0.0'
        }
      })

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as any
      const highlevel: AcousticBrainzHighLevel = {
        danceability: data.highlevel?.danceability || {
          danceable: 0,
          not_danceable: 0
        },
        energy: data.highlevel?.energy || {
          energetic: 0,
          not_energetic: 0
        },
        mood_acoustic: data.highlevel?.mood_acoustic || {
          acoustic: 0,
          not_acoustic: 0
        },
        mood_aggressive: data.highlevel?.mood_aggressive || {
          aggressive: 0,
          not_aggressive: 0
        },
        mood_happy: data.highlevel?.mood_happy || {
          happy: 0,
          not_happy: 0
        },
        mood_sad: data.highlevel?.mood_sad || {
          sad: 0,
          not_sad: 0
        },
        mood_electronic: data.highlevel?.mood_electronic || {
          electronic: 0,
          not_electronic: 0
        },
        mood_party: data.highlevel?.mood_party || {
          party: 0,
          not_party: 0
        },
        mood_relaxed: data.highlevel?.mood_relaxed || {
          relaxed: 0,
          not_relaxed: 0
        },
        tonal_atonal: data.highlevel?.tonal_atonal || {
          atonal: 0,
          tonal: 0
        },
        voice_instrumental: data.highlevel?.voice_instrumental || {
          instrumental: 0,
          voice: 0
        }
      }

      cacheResult(cacheKey, highlevel)
      return highlevel
    } catch (error) {
      console.error('AB high-level fetch failed:', error)
      return null
    }
  }

  /**
   * Extract formatted values to 0-1 scale
   * Converts AcousticBrainz confidence scores to normalized values
   */
  formatAnalysisForDb(
    mbid: string,
    lowLevel?: AcousticBrainzLowLevel,
    highlevel?: AcousticBrainzHighLevel
  ): Partial<DbAcousticBrainzData> {
    const result: Partial<DbAcousticBrainzData> = {
      mbid,
      updated_at: new Date().toISOString()
    }

    // Low-level features
    if (lowLevel) {
      result.bpm = Math.round(lowLevel.bpm)
      result.bpm_confidence = Math.min(1, lowLevel.bpm_confidence)
      result.key = lowLevel.key_key
      result.key_confidence = Math.min(1, lowLevel.key_confidence)
    }

    // High-level features (convert to 0-1 scale)
    if (highlevel) {
      // Danceability
      if (highlevel.danceability) {
        const dance_val =
          highlevel.danceability.danceable /
          (highlevel.danceability.danceable + highlevel.danceability.not_danceable || 1)
        result.danceability = Math.round(dance_val * 100) / 100
      }

      // Energy
      if (highlevel.energy) {
        const energy_val =
          highlevel.energy.energetic /
          (highlevel.energy.energetic + highlevel.energy.not_energetic || 1)
        result.energy = Math.round(energy_val * 100) / 100
      }

      // Acousticness
      if (highlevel.mood_acoustic) {
        const acoustic_val =
          highlevel.mood_acoustic.acoustic /
          (highlevel.mood_acoustic.acoustic + highlevel.mood_acoustic.not_acoustic || 1)
        result.acousticness = Math.round(acoustic_val * 100) / 100
      }

      // Instrumentalness
      if (highlevel.voice_instrumental) {
        const instrumental_val =
          highlevel.voice_instrumental.instrumental /
          (highlevel.voice_instrumental.instrumental + highlevel.voice_instrumental.voice || 1)
        result.instrumentalness = Math.round(instrumental_val * 100) / 100
      }

      // Valence (happiness/positivity)
      if (highlevel.mood_happy) {
        const valence_val =
          highlevel.mood_happy.happy /
          (highlevel.mood_happy.happy + highlevel.mood_happy.not_happy || 1)
        result.valence = Math.round(valence_val * 100) / 100
      }

      // Moods
      if (highlevel.mood_acoustic) {
        result.mood_acoustic =
          Math.round(
            (highlevel.mood_acoustic.acoustic /
              (highlevel.mood_acoustic.acoustic + highlevel.mood_acoustic.not_acoustic || 1)) *
            100
          ) / 100
      }
      if (highlevel.mood_aggressive) {
        result.mood_aggressive =
          Math.round(
            (highlevel.mood_aggressive.aggressive /
              (highlevel.mood_aggressive.aggressive + highlevel.mood_aggressive.not_aggressive ||
                1)) *
            100
          ) / 100
      }
      if (highlevel.mood_electronic) {
        result.mood_electronic =
          Math.round(
            (highlevel.mood_electronic.electronic /
              (highlevel.mood_electronic.electronic + highlevel.mood_electronic.not_electronic ||
                1)) *
            100
          ) / 100
      }
      if (highlevel.mood_happy) {
        result.mood_happy =
          Math.round(
            (highlevel.mood_happy.happy /
              (highlevel.mood_happy.happy + highlevel.mood_happy.not_happy || 1)) *
            100
          ) / 100
      }
      if (highlevel.mood_sad) {
        result.mood_sad =
          Math.round(
            (highlevel.mood_sad.sad / (highlevel.mood_sad.sad + highlevel.mood_sad.not_sad || 1)) *
            100
          ) / 100
      }
      if (highlevel.mood_relaxed) {
        result.mood_relaxed =
          Math.round(
            (highlevel.mood_relaxed.relaxed /
              (highlevel.mood_relaxed.relaxed + highlevel.mood_relaxed.not_relaxed || 1)) *
            100
          ) / 100
      }
      if (highlevel.mood_party) {
        result.mood_party =
          Math.round(
            (highlevel.mood_party.party /
              (highlevel.mood_party.party + highlevel.mood_party.not_party || 1)) *
            100
          ) / 100
      }
    }

    return result
  }

  /**
   * Clear cache (for testing or manual invalidation)
   */
  clearCache(): void {
    queryCache.clear()
    console.log('✅ AB cache cleared')
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: queryCache.size,
      ttlMs: CACHE_TTL_MS,
      rateLimitMs: RATE_LIMIT_MS
    }
  }
}

export const acousticBrainzService = new AcousticBrainzService()
