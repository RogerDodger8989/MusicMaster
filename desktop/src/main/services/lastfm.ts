import axios from 'axios'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { spotifyService } from './spotify'

const API_KEY = process.env.LASTFM_API_KEY
const BASE_URL = 'http://ws.audioscrobbler.com/2.0/'
const CACHE_DIR = path.join(app.getPath('userData'), 'external_cache')

export interface LastFmTrackInfo {
    duration?: number
    listeners?: string
    playcount?: string
    artist: { name: string; url: string }
    album?: { artist: string; title: string; image: any[] }
    toptags?: { tag: any[] }
    wiki?: { summary: string; content: string }
}

export interface LastFmAlbumInfo {
    name: string
    artist: string
    image: { '#text': string; size: string }[]
    tracks?: { track: any[] }
    tags?: { tag: any[] }
    wiki?: { summary: string; content: string }
}

export interface LastFmArtistInfo {
    name: string
    image: { '#text': string; size: string }[]
    bio?: { summary: string; content: string }
    stats?: { listeners: string; playcount: string }
    tags?: { tag: any[] }
}

export class LastFmService {
    constructor() {
        this.initCache()
    }

    private async initCache() {
        try {
            if (!existsSync(CACHE_DIR)) {
                await fs.mkdir(CACHE_DIR, { recursive: true })
            }
        } catch (error) {
            console.error('Failed to init LastFM cache:', error)
        }
    }

    private async fetch(method: string, params: Record<string, string>) {
        if (!API_KEY) {
            console.warn('LASTFM_API_KEY not found in .env')
            return null
        }

        try {
            const response = await axios.get(BASE_URL, {
                params: {
                    method,
                    api_key: API_KEY,
                    format: 'json',
                    ...params
                }
            })
            return response.data
        } catch (error) {
            console.error(`LastFM request failed (${method}):`, error)
            return null
        }
    }

    async getAlbumInfo(artist: string, album: string): Promise<LastFmAlbumInfo | null> {
        const data = await this.fetch('album.getInfo', { artist, album })
        return data?.album || null
    }

    async getArtistInfo(artist: string): Promise<LastFmArtistInfo | null> {
        const data = await this.fetch('artist.getInfo', { artist })
        return data?.artist || null
    }

    async getDeezerArtistImage(artist: string): Promise<string | null> {
        try {
            const response = await axios.get('https://api.deezer.com/search/artist', {
                params: { q: artist, limit: 1 }
            })
            const data = response.data
            if (data?.data && data.data.length > 0) {
                return data.data[0].picture_xl || data.data[0].picture_big || data.data[0].picture_medium || null
            }
        } catch (error) {
            // silent error
        }
        return null
    }

    async getSimilarArtists(artist: string, limit: number = 20): Promise<{ name: string; image: string; match: string }[]> {
        const data = await this.fetch('artist.getSimilar', { artist, limit: limit.toString() })
        const artists = data?.similarartists?.artist

        if (!artists || !Array.isArray(artists)) return []

        // Enrich with better images if needed
        // Process in parallel (limit to top 10 to avoid excessive API calls)
        const topArtists = artists.slice(0, 10)
        const restArtists = artists.slice(10)

        const enrichedTop = await Promise.all(topArtists.map(async (a: any) => {
            let image = '' // Start empty, preferring Spotify

            // 1. Try Spotify (Primary/Preferred)
            try {
                const spotifyImage = await spotifyService.getArtistImage(a.name)
                if (spotifyImage) {
                    image = spotifyImage
                }
            } catch (e) {
                // Ignore Spotify errors
            }

            // 2. Fallback to Last.fm / Deezer if Spotify failed
            if (!image) {
                image = this.getBestImage(a.image) || ''

                if (!image) {
                    // Try Deezer as last resort
                    try {
                        const deezerImage = await this.getDeezerArtistImage(a.name)
                        if (deezerImage) image = deezerImage
                    } catch (e) { }
                }
            }

            return {
                name: a.name,
                image,
                match: a.match
            }
        }))

        // For the rest, just map them (lazy or no enrichment)
        const mappedRest = restArtists.map((a: any) => ({
            name: a.name,
            image: this.getBestImage(a.image) || '',
            match: a.match
        }))

        return [...enrichedTop, ...mappedRest]
    }

    async downloadImage(url: string, filename: string): Promise<string | null> {
        if (!url) return null

        const filePath = path.join(CACHE_DIR, filename)

        // Return if already cached
        if (existsSync(filePath)) {
            return filePath
        }

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' })
            await fs.writeFile(filePath, response.data)
            return filePath
        } catch (error) {
            console.error(`Failed to download image from ${url}:`, error)
            return null
        }
    }

    /**
     * Get the best quality image from LastFM image array
     */
    getBestImage(images: { '#text': string; size: string }[]): string | null {
        if (!images || images.length === 0) return null

        // LastFM sizes: small, medium, large, extralarge, mega
        const mega = images.find(img => img.size === 'mega')
        const xl = images.find(img => img.size === 'extralarge')
        const lg = images.find(img => img.size === 'large')

        return mega?.['#text'] || xl?.['#text'] || lg?.['#text'] || images[0]?.['#text'] || null
    }
}

export const lastFmService = new LastFmService()
