import { MusicBrainzApi } from 'musicbrainz-api'

const mbApi = new MusicBrainzApi({
    appName: 'MusicMaster',
    appVersion: '1.0.0',
    appContactInfo: 'https://github.com/RogerDodger8989/MusicMaster' // Example contact
})

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

export class MusicBrainzService {
    /**
     * Search for a track by artist, album, and title
     */
    async searchTrack(artist: string, title: string, album?: string): Promise<MBTrackResult[]> {
        try {
            // Strategy 1: Specific search
            let query = `artist:"${artist}" AND recording:"${title}"`
            if (album) {
                query += ` AND release:"${album}"`
            }

            console.log(`🔍 MbService: Searching with query: ${query}`)
            let result = await mbApi.search('recording', { query })

            // Strategy 2: Less specific (remove album if no results)
            if ((!result.recordings || result.recordings.length === 0) && album) {
                console.log(`⚠️ MbService: No results with album. Retrying without album...`)
                query = `artist:"${artist}" AND recording:"${title}"`
                result = await mbApi.search('recording', { query })
            }

            // Strategy 3: Fuzzy / loose search
            if (!result.recordings || result.recordings.length === 0) {
                console.log(`⚠️ MbService: Still no results. Trying loose search...`)
                // Remove quotes for fuzzy search, remove AND
                query = `${artist} ${title} ${album || ''}`
                result = await mbApi.search('recording', { query })
            }


            if (!result.recordings || result.recordings.length === 0) {
                return []
            }

            return result.recordings.map(rec => {
                const release = rec.releases?.[0]
                const artistCredit = rec['artist-credit']?.[0]

                // Get label info
                let label = ''
                let catalogNumber = ''
                if (release && release['label-info'] && release['label-info'].length > 0) {
                    label = release['label-info'][0].label?.name || ''
                    catalogNumber = release['label-info'][0]['catalog-number'] || ''
                }

                return {
                    id: rec.id,
                    title: rec.title,
                    artist: typeof artistCredit === 'string' ? artistCredit : (artistCredit as any)?.name || 'Unknown Artist',
                    album: release?.title || 'Unknown Album',
                    albumId: release?.id || '',
                    artistId: (artistCredit as any)?.artist?.id || '',
                    releaseDate: release?.date, // YYYY-MM-DD
                    trackNum: release?.['media']?.[0]?.['tracks']?.[0]?.number ? parseInt(release['media'][0]['tracks'][0].number) : undefined,
                    discNum: release?.['media']?.[0]?.position,
                    label: label,
                    catalogNumber: catalogNumber,
                    barcode: release?.barcode,
                    country: release?.country,
                    media: release?.['media']?.[0]?.format,
                    genres: (rec as any).tags?.map((t: any) => t.name)
                }
            })
        } catch (error) {
            console.error('MusicBrainz search failed:', error)
            return []
        }
    }

    /**
     * Search for an album (release) by artist and title
     */
    async searchAlbum(artist: string, album: string): Promise<any[]> {
        try {
            let query = `artist:"${artist}" AND release:"${album}"`
            console.log(`🔍 MbService: Searching albums query: ${query}`)

            let result = await mbApi.search('release', { query })

            if ((!result.releases || result.releases.length === 0)) {
                // Retry with less strict
                query = `${artist} ${album}`
                console.log(`⚠️ MbService: Retry album search loose: ${query}`)
                result = await mbApi.search('release', { query })
            }

            if (!result.releases || result.releases.length === 0) {
                return []
            }

            return result.releases.map(rel => {
                let label = ''
                if (rel['label-info'] && rel['label-info'].length > 0) {
                    label = rel['label-info'][0].label?.name || ''
                }

                return {
                    id: rel.id,
                    title: rel.title,
                    artist: (rel['artist-credit']?.[0] as any)?.name || 'Unknown Artist',
                    album: rel.title,
                    releaseDate: rel.date,
                    trackCount: rel['track-count'],
                    country: rel.country,
                    barcode: rel.barcode,
                    status: rel.status,
                    label: label
                }
            })
        } catch (error) {
            console.error('MusicBrainz album search failed:', error)
            return []
        }
    }

    /**
     * Get artist details (bio, stats, etc.)
     */
    async getArtistDetails(artistId: string) {
        try {
            const artist = await mbApi.lookup('artist', artistId, ['area-rels', 'url-rels', 'tags', 'ratings', 'genres'])

            // Extract website from url-rels
            const website = artist.relations?.find(rel => rel['target-type'] === 'url' && rel.type === 'official homepage')?.url?.resource

            return {
                id: artist.id,
                name: artist.name,
                country: artist.country || artist.area?.name,
                lifeSpan: artist['life-span'],
                type: artist.type,
                gender: artist.gender,
                website: website,
                genres: artist.genres?.map(g => g.name),
                tags: artist.tags?.map(t => t.name)
            }
        } catch (error) {
            console.error('MusicBrainz artist lookup failed:', error)
            return null
        }
    }

    /**
     * Get album details
     */
    async getAlbumDetails(albumId: string) {
        try {
            const release = await mbApi.lookup('release', albumId, ['artists', 'labels', 'recordings', 'release-groups', 'url-rels'])
            return release
        } catch (error) {
            console.error('MusicBrainz release lookup failed:', error)
            return null
        }
    }
}

export const musicBrainzService = new MusicBrainzService()
