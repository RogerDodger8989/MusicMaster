import { MusicBrainzApi } from 'musicbrainz-api'
import {
    MBArtistResponse,
    MBReleaseResponse,
    MBRecordingResponse,
} from '../database/types.musicbrainz'

const mbApi = new MusicBrainzApi({
    appName: 'MusicMaster',
    appVersion: '1.0.0',
    appContactInfo: 'https://github.com/RogerDodger8989/MusicMaster'
})

// Rate limiting: MusicBrainz requires delays between requests
const RATE_LIMIT_MS = 1100 // 1 second + buffer

// Cache for recent queries (TTL: 1 hour)
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Apply rate limiting between API calls
 */
async function applyRateLimit(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
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

export interface MBTrackResult {
    id: string
    title: string
    artist: string
    album: string
    albumId: string
    artistId: string
    releaseDate?: string
    trackNum?: number
    discNum?: number
    label?: string
    catalogNumber?: string
    barcode?: string
    country?: string
    media?: string
    genres?: string[]
}

export interface MBArtistCredit {
    name: string
    mbid: string
    joinPhrase?: string
}

export interface MBRecordingFull {
    id: string // Recording MBID
    title: string
    length: number // milliseconds
    isrc: string[]
    'artist-credit': Array<{
        artist: {
            id: string
            name: string
            'sort-name': string
        }
        name: string
        joinPhrase?: string
    }>
    releases?: Array<{
        id: string // Release MBID
        title: string
        date: string // YYYY-MM-DD
        country: string
        barcode: string
        status: string
        'release-group'?: {
            'primary-type': string
        }
        media?: Array<{
            position: number
            'track-count': number
            format: string
            'disc-ids'?: string[]
        }>
        'label-info'?: Array<{
            'catalog-number': string
            label: { name: string }
        }>
        relations?: any[]
    }>
    relations?: Array<{
        'target-type': string
        type: string
        url?: { resource: string }
        artist?: any
    }>
}

export interface MBReleaseFull {
    id: string
    title: string
    date: string
    country: string
    barcode: string
    status: string
    packaging: string
    'script': string
    'language': string
    'text-language': string
    'release-group': {
        id: string
        'primary-type': string
    }
    'artist-credit': MBArtistCredit[]
    media: Array<{
        position: number
        title?: string
        format?: string
        'track-count': number
        'disc-ids'?: string[]
        tracks?: Array<{
            id: string
            number: string
            position: string
            title: string
            length: number
            recording: {
                id: string
                title: string
                length: number
                isrc?: string[]
            }
        }>
    }>
    'label-info': Array<{
        label: { id: string; name: string }
        'catalog-number': string
    }>
    relations: Array<{
        'target-type': string
        type: string
        url?: { resource: string }
        direction?: string
        artist?: MBRecordingFull
    }>
}

export class MusicBrainzService {
    /**
     * Search for a track by artist, album, and title
     */
    async searchTrack(
        artist: string,
        title: string,
        album?: string
    ): Promise<MBTrackResult[]> {
        try {
            const cacheKey = `track:${artist}:${title}:${album || 'any'}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            // Strategy 1: Specific search
            let query = `artist:"${artist}" AND recording:"${title}"`
            if (album) {
                query += ` AND release:"${album}"`
            }

            console.log(`🔍 MB: Searching tracks: ${query}`)
            await applyRateLimit()
            let result = await mbApi.search('recording', { query })

            // Strategy 2: Less specific (remove album if no results)
            if (
                (!result.recordings || result.recordings.length === 0) &&
                album
            ) {
                console.log(`⚠️ MB: No results with album. Retrying without...`)
                query = `artist:"${artist}" AND recording:"${title}"`
                await applyRateLimit()
                result = await mbApi.search('recording', { query })
            }

            // Strategy 3: Fuzzy / loose search
            if (!result.recordings || result.recordings.length === 0) {
                console.log(`⚠️ MB: Trying loose search...`)
                query = `${artist} ${title} ${album || ''}`
                await applyRateLimit()
                result = await mbApi.search('recording', { query })
            }

            if (!result.recordings || result.recordings.length === 0) {
                return []
            }

            const results = result.recordings.map((rec: any) => {
                const release = rec.releases?.[0]
                const artistCredit = rec['artist-credit']?.[0]

                // Get label info
                let label = ''
                let catalogNumber = ''
                if (
                    release &&
                    release['label-info'] &&
                    release['label-info'].length > 0
                ) {
                    label = release['label-info'][0].label?.name || ''
                    catalogNumber =
                        release['label-info'][0]['catalog-number'] || ''
                }

                return {
                    id: rec.id,
                    title: rec.title,
                    artist:
                        typeof artistCredit === 'string'
                            ? artistCredit
                            : (artistCredit as any)?.name || 'Unknown Artist',
                    album: release?.title || 'Unknown Album',
                    albumId: release?.id || '',
                    artistId: (artistCredit as any)?.artist?.id || '',
                    releaseDate: release?.date,
                    trackNum: release?.['media']?.[0]?.['tracks']?.[0]
                        ?.number
                        ? parseInt(release['media'][0]['tracks'][0].number)
                        : undefined,
                    discNum: release?.['media']?.[0]?.position,
                    label,
                    catalogNumber,
                    barcode: release?.barcode,
                    country: release?.country,
                    media: release?.['media']?.[0]?.format,
                    genres: (rec as any).tags?.map((t: any) => t.name)
                }
            })

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB track search failed:', error)
            return []
        }
    }

    /**
     * Search for an album (release) by artist and title
     */
    async searchAlbum(artist: string, album: string): Promise<any[]> {
        try {
            const cacheKey = `album:${artist}:${album}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            let query = `artist:"${artist}" AND release:"${album}"`
            console.log(`🔍 MB: Searching albums: ${query}`)

            await applyRateLimit()
            let result = await mbApi.search('release', { query })

            if (!result.releases || result.releases.length === 0) {
                // Retry with less strict
                query = `${artist} ${album}`
                console.log(`⚠️ MB: Retry album search loose: ${query}`)
                await applyRateLimit()
                result = await mbApi.search('release', { query })
            }

            if (!result.releases || result.releases.length === 0) {
                return []
            }

            const results = result.releases.map((rel: any) => {
                let label = ''
                if (rel['label-info'] && rel['label-info'].length > 0) {
                    label = rel['label-info'][0].label?.name || ''
                }

                return {
                    id: rel.id,
                    title: rel.title,
                    artist: (rel['artist-credit']?.[0] as any)?.name ||
                        'Unknown Artist',
                    album: rel.title,
                    releaseDate: rel.date,
                    trackCount: rel['track-count'],
                    country: rel.country,
                    barcode: rel.barcode,
                    status: rel.status,
                    label
                }
            })

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB album search failed:', error)
            return []
        }
    }

    /**
     * Search for an artist by name
     */
    async searchArtist(name: string): Promise<any[]> {
        try {
            const cacheKey = `artist_search:${name}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`🔍 MB: Searching artists: ${name}`)
            await applyRateLimit()
            const result = await mbApi.search('artist', {
                query: name
            })

            if (!result.artists || result.artists.length === 0) {
                return []
            }

            const results = result.artists.map((artist: any) => ({
                id: artist.id,
                name: artist.name,
                sortName: artist['sort-name'],
                type: artist.type,
                country: artist.country,
                area: artist.area?.name,
                score: artist.score
            }))

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB artist search failed:', error)
            return []
        }
    }

    /**
     * Get full recording details with all related data
     */
    async getRecordingDetails(recordingId: string): Promise<MBRecordingFull | null> {
        try {
            const cacheKey = `recording:${recordingId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`📋 MB: Fetching recording: ${recordingId}`)
            await applyRateLimit()
            const recording = (await mbApi.lookup('recording', recordingId, [
                'artists',
                'releases',
                'recordings',
                'url-rels',
                'tags',
                'genres'
            ])) as MBRecordingFull

            cacheResult(cacheKey, recording)
            return recording
        } catch (error) {
            console.error('MB recording lookup failed:', error)
            return null
        }
    }

    /**
     * Get full release (album) details with tracks and credits
     */
    async getReleaseDetails(releaseId: string): Promise<MBReleaseFull | null> {
        try {
            const cacheKey = `release:${releaseId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`📋 MB: Fetching release: ${releaseId}`)
            await applyRateLimit()
            const release = (await mbApi.lookup('release', releaseId, [
                'artists',
                'labels',
                'recordings',
                'release-groups',
                'url-rels',
                'tags',
                'genres'
            ])) as MBReleaseFull

            cacheResult(cacheKey, release)
            return release
        } catch (error) {
            console.error('MB release lookup failed:', error)
            return null
        }
    }

    /**
     * Get artist details (bio, stats, relations, etc.)
     */
    async getArtistDetails(artistId: string) {
        try {
            const cacheKey = `artist:${artistId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`👤 MB: Fetching artist: ${artistId}`)
            await applyRateLimit()
            const artist = await mbApi.lookup('artist', artistId, [
                'area-rels',
                'url-rels',
                'tags',
                'ratings',
                'genres'
            ])

            // Extract website from url-rels
            const website = (artist as any).relations?.find(
                (rel: any) =>
                    rel['target-type'] === 'url' &&
                    rel.type === 'official homepage'
            )?.url?.resource

            const result = {
                id: (artist as any).id,
                name: (artist as any).name,
                sortName: (artist as any)['sort-name'],
                country: (artist as any).country || (artist as any).area?.name,
                lifeSpan: (artist as any)['life-span'],
                type: (artist as any).type,
                gender: (artist as any).gender,
                website,
                genres: (artist as any).genres?.map((g: any) => g.name),
                tags: (artist as any).tags?.map((t: any) => t.name),
                area: (artist as any).area?.name
            }

            cacheResult(cacheKey, result)
            return result
        } catch (error) {
            console.error('MB artist lookup failed:', error)
            return null
        }
    }

    /**
     * Get work details (for classical music)
     */
    async getWorkDetails(workId: string) {
        try {
            const cacheKey = `work:${workId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`🎼 MB: Fetching work: ${workId}`)
            await applyRateLimit()
            const work = await mbApi.lookup('work', workId, [
                'artists',
                'url-rels'
            ])

            cacheResult(cacheKey, work)
            return work
        } catch (error) {
            console.error('MB work lookup failed:', error)
            return null
        }
    }

    /**
     * Get label details
     */
    async getLabelDetails(labelId: string) {
        try {
            const cacheKey = `label:${labelId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`🏷️ MB: Fetching label: ${labelId}`)
            await applyRateLimit()
            const label = await mbApi.lookup('label', labelId, ['url-rels'])

            cacheResult(cacheKey, label)
            return label
        } catch (error) {
            console.error('MB label lookup failed:', error)
            return null
        }
    }

    /**
     * Search by ISRC code (for fingerprinting)
     */
    async searchByISRC(isrc: string): Promise<MBTrackResult[]> {
        try {
            const cacheKey = `isrc:${isrc}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                console.log(`📦 MB Cache hit: ${cacheKey}`)
                return cached
            }

            console.log(`🔍 MB: Searching by ISRC: ${isrc}`)
            await applyRateLimit()
            const result = await mbApi.search('recording', {
                query: `isrc:${isrc}`
            })

            if (!result.recordings || result.recordings.length === 0) {
                return []
            }

            const results = (result.recordings as any[]).map((rec: any) => {
                const release = rec.releases?.[0]
                const artistCredit = rec['artist-credit']?.[0]

                return {
                    id: rec.id,
                    title: rec.title,
                    artist:
                        typeof artistCredit === 'string'
                            ? artistCredit
                            : (artistCredit as any)?.name || 'Unknown',
                    album: release?.title || 'Unknown',
                    albumId: release?.id || '',
                    artistId: (artistCredit as any)?.artist?.id || '',
                    barcode: release?.barcode,
                    country: release?.country
                }
            })

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB ISRC lookup failed:', error)
            return []
        }
    }

    /**
     * Clear cache (for testing or manual cache invalidation)
     */
    clearCache(): void {
        queryCache.clear()
        console.log('✅ MB cache cleared')
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

export const musicBrainzService = new MusicBrainzService()

