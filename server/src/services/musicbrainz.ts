import { MusicBrainzApi } from 'musicbrainz-api'
import {
    MBArtistResponse,
    MBReleaseResponse,
    MBRecordingResponse,
} from '../database/types.musicbrainz'

const MB_MIRROR_URL = process.env.MUSICBRAINZ_MIRROR_URL
const mbApi = new MusicBrainzApi({
    appName: 'MusicMaster',
    appVersion: '1.0.0',
    appContactInfo: 'https://github.com/RogerDodger8989/MusicMaster',
    baseUrl: MB_MIRROR_URL || 'https://musicbrainz.org'
})

export interface MBArtistMember {
    name: string
    mbid: string
    role: string
}

// Rate limiting: MusicBrainz requires delays between requests
// If using a local mirror, we can go much faster
const RATE_LIMIT_MS = MB_MIRROR_URL ? 100 : 1100 // 0.1s for mirror, 1.1s for public

// Cache for recent queries (TTL: 1 hour)
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

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
    artistCredits?: MBArtistCredit[]
}

export interface MBArtistCredit {
    name: string
    mbid: string
    joinPhrase?: string
}

export interface MBRecordingFull {
    id: string
    title: string
    length: number
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
        id: string
        title: string
        date: string
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
    async getArtistMembers(artistId: string): Promise<MBArtistMember[]> {
        const cacheKey = `artist_members_${artistId}`
        const cached = getFromCache(cacheKey)
        if (cached) return cached

        await applyRateLimit()

        try {
            const artist = await (mbApi as any).lookup('artist', artistId, ['artist-rels'])
            const relations = artist.relations || []
            const members: MBArtistMember[] = relations
                .filter((rel: any) => rel.type === 'member of band' || rel.type === 'member of')
                .map((rel: any) => {
                    let role = 'Band Member'
                    const attributes = rel.attributes || []
                    if (attributes.length > 0) {
                        const cleanAttrs = attributes.filter((a: string) =>
                            !['additional', 'guest', 'solo', 'minor', 'backdrops', 'programming'].includes(a.toLowerCase())
                        )
                        if (cleanAttrs.length > 0) {
                            role = cleanAttrs.map((a: string) => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')
                        }
                    }
                    return {
                        name: rel.artist.name,
                        mbid: rel.artist.id,
                        role: role
                    }
                })

            cacheResult(cacheKey, members)
            return members
        } catch (error) {
            console.error('Failed to fetch artist members:', error)
            return []
        }
    }

    async searchTrack(
        artist: string,
        title: string,
        album?: string
    ): Promise<MBTrackResult[]> {
        try {
            const cacheKey = `track:${artist}:${title}:${album || 'any'}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            let query = `artist:"${artist}" AND recording:"${title}"`
            if (album) {
                query += ` AND release:"${album}"`
            }

            await applyRateLimit()
            let result = await mbApi.search('recording', { query })

            if (
                (!result.recordings || result.recordings.length === 0) &&
                album
            ) {
                query = `artist:"${artist}" AND recording:"${title}"`
                await applyRateLimit()
                result = await mbApi.search('recording', { query })
            }

            if (!result.recordings || result.recordings.length === 0) {
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
                    coverArt: release?.id ? `https://coverartarchive.org/release/${release.id}/front-250` : undefined,
                    media: release?.['media']?.[0]?.format,
                    genres: (rec as any).tags?.map((t: any) => t.name),
                    artistCredits: rec['artist-credit']?.map((ac: any) => ({
                        name: ac.name,
                        mbid: ac.artist?.id,
                        joinPhrase: ac.joinPhrase
                    }))
                }
            })

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB track search failed:', error)
            return []
        }
    }

    async searchAlbum(artist: string, album: string): Promise<any[]> {
        try {
            const cacheKey = `album:${artist}:${album}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            let query = `artist:"${artist}" AND release:"${album}"`
            await applyRateLimit()
            let result = await mbApi.search('release', { query })

            if (!result.releases || result.releases.length === 0) {
                query = `${artist} ${album}`
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
                    label,
                    coverArt: rel.id ? `https://coverartarchive.org/release/${rel.id}/front-250` : undefined
                }
            })

            cacheResult(cacheKey, results)
            return results
        } catch (error) {
            console.error('MB album search failed:', error)
            return []
        }
    }

    async searchArtist(name: string): Promise<any[]> {
        try {
            const cacheKey = `artist_search:${name}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

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

    async getRecordingDetails(recordingId: string): Promise<MBRecordingFull | null> {
        try {
            const cacheKey = `recording:${recordingId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            console.log(`[MusicBrainz] Looking up recording: ${recordingId}`);
            const recording = (await (mbApi as any).lookup('recording', recordingId, [
                'artists',
                'releases',
                'url-rels',
                'tags',
                'genres',
                'artist-rels',
                'work-rels',
                'instrument-rels'
            ])) as MBRecordingFull

            cacheResult(cacheKey, recording)
            return recording
        } catch (error) {
            console.error('MB recording lookup failed:', error)
            return null
        }
    }

    async getReleaseDetails(releaseId: string): Promise<MBReleaseFull | null> {
        try {
            const cacheKey = `release:${releaseId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            console.log(`[MusicBrainz] Looking up release: ${releaseId}`);
            const release = (await (mbApi as any).lookup('release', releaseId, [
                'artists',
                'labels',
                'recordings',
                'release-groups',
                'url-rels',
                'tags',
                'genres',
                'artist-rels',
                'recording-level-rels',
                'work-level-rels'
            ])) as unknown as MBReleaseFull

            cacheResult(cacheKey, release)
            return release
        } catch (error) {
            console.error('MB release lookup failed:', error)
            return null
        }
    }

    async getArtistDetails(artistId: string) {
        try {
            const cacheKey = `artist:${artistId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            const artist = await mbApi.lookup('artist', artistId, [
                'area-rels',
                'url-rels',
                'tags',
                'ratings',
                'genres'
            ])

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

    async getReleaseGroupDetails(releaseGroupId: string) {
        try {
            const cacheKey = `release-group:${releaseGroupId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            const releaseGroup = await mbApi.lookup('release-group', releaseGroupId, [
                'artist-credits',
                'releases',
                'tags',
                'genres'
            ])

            const result = {
                id: (releaseGroup as any).id,
                title: (releaseGroup as any).title,
                firstReleaseDate: (releaseGroup as any)['first-release-date'],
                primaryType: (releaseGroup as any)['primary-type'],
                secondaryTypes: (releaseGroup as any)['secondary-types'] || []
            }

            cacheResult(cacheKey, result)
            return result
        } catch (error) {
            console.error('MB release-group lookup failed:', error)
            return null
        }
    }
    async getWorkDetails(workId: string) {
        try {
            const cacheKey = `work:${workId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            const work = await (mbApi as any).lookup('work', workId, [
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

    async getLabelDetails(labelId: string) {
        try {
            const cacheKey = `label:${labelId}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

            await applyRateLimit()
            const label = await mbApi.lookup('label', labelId, ['url-rels'])

            cacheResult(cacheKey, label)
            return label
        } catch (error) {
            console.error('MB label lookup failed:', error)
            return null
        }
    }

    async searchByISRC(isrc: string): Promise<MBTrackResult[]> {
        try {
            const cacheKey = `isrc:${isrc}`
            const cached = getFromCache(cacheKey)
            if (cached) {
                return cached
            }

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

    async getReleaseCandidates(
        artist: string,
        title: string,
        album?: string,
        limit: number = 10
    ): Promise<Array<{
        recordingMbid: string
        releaseMbid: string
        releaseGroupMbid?: string
        artistMbid?: string
        artistName: string
        albumName: string
        year?: number
        country?: string
        format?: string
        label?: string
        tracks: Array<{
            title: string
            duration: number
            position: number
        }>
    }>> {
        try {
            const trackResults = await this.searchTrack(artist, title, album)
            if (trackResults.length === 0) {
                return []
            }

            const candidates: Array<any> = []
            const seenReleases = new Set<string>()

            for (const track of trackResults.slice(0, limit)) {
                if (!track.albumId || seenReleases.has(track.albumId)) {
                    continue
                }
                seenReleases.add(track.albumId)

                const releaseDetails = await this.getReleaseDetails(track.albumId)
                if (!releaseDetails) {
                    continue
                }

                const tracks: Array<{
                    title: string
                    duration: number
                    position: number
                }> = []

                for (const media of releaseDetails.media || []) {
                    for (const track of media.tracks || []) {
                        tracks.push({
                            title: track.title,
                            duration: Math.round(track.length / 1000),
                            position: parseInt(track.position) || tracks.length + 1
                        })
                    }
                }

                let label = ''
                if (
                    releaseDetails['label-info'] &&
                    releaseDetails['label-info'].length > 0
                ) {
                    label = releaseDetails['label-info'][0]?.label?.name || ''
                }

                let year: number | undefined
                if (releaseDetails.date) {
                    const yearMatch = releaseDetails.date.match(/^(\d{4})/)
                    if (yearMatch) {
                        year = parseInt(yearMatch[1])
                    }
                }

                const format =
                    releaseDetails.media?.[0]?.format ||
                    releaseDetails.packaging ||
                    'Unknown'

                candidates.push({
                    recordingMbid: track.id,
                    releaseMbid: releaseDetails.id,
                    releaseGroupMbid: releaseDetails['release-group']?.id,
                    artistMbid: track.artistId,
                    artistName: track.artist,
                    albumName: releaseDetails.title,
                    year,
                    country: releaseDetails.country,
                    format,
                    label,
                    tracks
                })
            }

            return candidates
        } catch (error) {
            console.error('Failed to get release candidates:', error)
            return []
        }
    }

    extractRoles(item: any): Record<string, { name: string; mbid?: string }[]> {
        const roles: Record<string, { name: string; mbid?: string }[]> = {}
        const relations = item.relations || []

        for (const rel of relations) {
            const targetType = rel['target-type'] || (rel as any).targetType;
            const artist = rel.artist;

            if (targetType === 'artist' && artist) {
                let roleName = rel.type // e.g., "performer", "vocal", "instrument"

                const attributes = rel.attributes || []
                if (attributes.length > 0) {
                    // Filter out metadata-like attributes
                    const cleanAttributes = attributes.filter((a: string) =>
                        !['additional', 'guest', 'solo', 'minor', 'backdrops', 'programming'].includes(a.toLowerCase())
                    )

                    if (cleanAttributes.length > 0) {
                        // Handle "co" attribute for producers/conductors
                        if (attributes.includes('co') && (roleName === 'producer' || roleName === 'conductor')) {
                            roleName = `co-${roleName}`
                        } else {
                            // Join attributes for specific roles like "lead vocals" or "electric guitar"
                            // But avoid redundant prefixes if the role name is already specific
                            const specificAttr = cleanAttributes[0].toLowerCase()
                            if (roleName === 'performer' || roleName === 'vocal' || roleName === 'instrument' || roleName === 'performance') {
                                roleName = specificAttr
                            } else if (!roleName.toLowerCase().includes(specificAttr)) {
                                roleName = `${specificAttr} ${roleName}`
                            }
                        }
                    }
                }

                if (!roles[roleName]) roles[roleName] = []
                roles[roleName].push({
                    name: artist.name,
                    mbid: artist.id
                })
            }
        }

        return roles
    }

    clearCache(): void {
        queryCache.clear()
        console.log('✅ MB cache cleared')
    }

    getCacheStats() {
        return {
            size: queryCache.size,
            ttlMs: CACHE_TTL_MS,
            rateLimitMs: RATE_LIMIT_MS
        }
    }
}

export const musicBrainzService = new MusicBrainzService()
