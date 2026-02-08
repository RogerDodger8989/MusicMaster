/**
 * AcousticBrainz Service - Audio fingerprinting and analysis
 */

import { DbAcousticBrainzData } from '../database/types.musicbrainz'

const AB_BASE_URL = 'https://acousticbrainz.org/api/v1'
const RATE_LIMIT_MS = 500

const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

async function applyRateLimit(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
}

function getFromCache(key: string): any | null {
    const cached = queryCache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data
    }
    queryCache.delete(key)
    return null
}

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
    mood_relaxed: {
        relaxed: number
        not_relaxed: number
    }
    mood_party: {
        party: number
        not_party: number
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
    async getRecordingAnalysis(
        mbid: string,
        highlevel: boolean = true
    ): Promise<AcousticBrainzResult | null> {
        try {
            const cacheKey = `ab:${mbid}:${highlevel}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()

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
                return null
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
}

export const acousticBrainzService = new AcousticBrainzService()
