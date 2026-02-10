import axios from 'axios'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { spotifyService } from './spotify'

const BASE_URL = 'http://ws.audioscrobbler.com/2.0/'
const CACHE_DIR = path.join(app.getPath('userData'), 'external_cache')

// Store API key and secret in memory with fallback to env
let apiKey = process.env.LASTFM_API_KEY || ''
let apiSecret = process.env.LASTFM_API_SECRET || ''

const getApiKey = (): string => apiKey
const getApiSecret = (): string => apiSecret

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
    const key = getApiKey()
    if (!key) {
      console.warn('LASTFM_API_KEY not found')
      return null
    }

    try {
      const response = await axios.get(BASE_URL, {
        params: {
          method,
          api_key: key,
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
    const data = await this.fetch('album.getInfo', { artist, album, lang: 'en' })
    return data?.album || null
  }

  async getArtistInfo(artist: string): Promise<LastFmArtistInfo | null> {
    const data = await this.fetch('artist.getInfo', { artist, lang: 'en' })
    return data?.artist || null
  }

  async getDeezerArtistImage(artist: string): Promise<string | null> {
    try {
      const response = await axios.get('https://api.deezer.com/search/artist', {
        params: { q: artist, limit: 1 }
      })
      const data = response.data
      if (data?.data && data.data.length > 0) {
        return (
          data.data[0].picture_xl || data.data[0].picture_big || data.data[0].picture_medium || null
        )
      }
    } catch (error) {
      // silent error
    }
    return null
  }

  async getSimilarArtists(
    artist: string,
    limit: number = 20
  ): Promise<{ name: string; image: string; match: string }[]> {
    const data = await this.fetch('artist.getSimilar', { artist, limit: limit.toString() })
    const artists = data?.similarartists?.artist

    if (!artists || !Array.isArray(artists)) return []

    // Enrich with better images if needed
    // Process in parallel (limit to top 10 to avoid excessive API calls)
    const topArtists = artists.slice(0, 10)
    const restArtists = artists.slice(10)

    const enrichedTop = await Promise.all(
      topArtists.map(async (a: any) => {
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
            } catch (e) {}
          }
        }

        return {
          name: a.name,
          image,
          match: a.match
        }
      })
    )

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
    const mega = images.find((img) => img.size === 'mega')
    const xl = images.find((img) => img.size === 'extralarge')
    const lg = images.find((img) => img.size === 'large')

    return mega?.['#text'] || xl?.['#text'] || lg?.['#text'] || images[0]?.['#text'] || null
  }

  /**
   * Get track info including playcount and loved status
   */
  async getTrackInfo(
    artist: string,
    track: string,
    username?: string
  ): Promise<LastFmTrackInfo | null> {
    const params: Record<string, string> = { artist, track }
    if (username) params.username = username

    const data = await this.fetch('track.getInfo', params)
    return data?.track || null
  }

  /**
   * Get user's play count for a specific track
   * REQUIRES username - counts personal scrobbles from Last.fm
   */
  async getUserTrackPlayCount(artist: string, track: string, username: string): Promise<number> {
    if (!username) {
      console.warn('⚠️ Username is required to get personal play count from Last.fm')
      return 0
    }
    try {
      // Fetch user's recent tracks and count matches
      const response = await axios.get(BASE_URL, {
        params: {
          method: 'user.getRecentTracks',
          user: username,
          api_key: getApiKey(),
          format: 'json',
          limit: 500 // Get last 500 scrobbles
        }
      })

      const tracks = response.data?.recenttracks?.track || []
      let count = 0

      // Count matching tracks
      if (Array.isArray(tracks)) {
        count = tracks.filter(
          (t) =>
            t.artist?.name?.toLowerCase() === artist.toLowerCase() &&
            t.name?.toLowerCase() === track.toLowerCase()
        ).length
      } else if (
        tracks.artist?.name?.toLowerCase() === artist.toLowerCase() &&
        tracks.name?.toLowerCase() === track.toLowerCase()
      ) {
        count = 1
      }

      console.log(
        `👤 Last.fm "${username}" - "${artist} - ${track}": ${count} plays (from last 500 scrobbles)`
      )
      return count
    } catch (error) {
      console.error('Failed to get Last.fm user play count:', error)
      return 0
    }
  }

  /**
   * Get MD5 hash for Last.fm authentication
   */
  private md5(str: string): string {
    return createHash('md5').update(str).digest('hex')
  }

  /**
   * Generate authentication signature for Last.fm API
   */
  private generateSignature(params: Record<string, string>): string {
    // Filter out 'format' and 'api_sig' as per Last.fm API docs
    // These should NOT be included in signature calculation
    const signatureParams = Object.keys(params)
      .filter((key) => key !== 'format' && key !== 'api_sig')
      .sort()

    let str = ''
    for (const key of signatureParams) {
      str += key + params[key]
    }
    str += getApiSecret()

    const signature = this.md5(str)
    console.log('🔐 Generated signature for params:', signatureParams)
    return signature
  }

  /**
   * Update now playing track
   */
  async updateNowPlaying(
    sessionKey: string,
    artist: string,
    track: string,
    album?: string,
    duration?: number
  ): Promise<boolean> {
    const key = getApiKey()
    if (!key || !sessionKey) {
      console.warn('LASTFM_API_KEY or session key missing')
      return false
    }

    try {
      const params: Record<string, string> = {
        method: 'track.updateNowPlaying',
        api_key: key,
        artist,
        track,
        sk: sessionKey
      }
      if (album) params.album = album
      if (duration) params.duration = duration.toString()

      const signature = this.generateSignature(params)
      params.api_sig = signature
      params.format = 'json' // Add format AFTER signature generation

      const response = await axios.post(BASE_URL, new URLSearchParams(params))
      return response.status === 200
    } catch (error) {
      console.error('Failed to update now playing:', error)
      return false
    }
  }

  /**
   * Scrobble a track
   */
  async scrobble(
    sessionKey: string,
    artist: string,
    track: string,
    timestamp: number,
    album?: string,
    trackNumber?: number
  ): Promise<boolean> {
    const key = getApiKey()
    if (!key || !sessionKey) {
      console.warn('LASTFM_API_KEY or session key missing')
      return false
    }

    try {
      const params: Record<string, string> = {
        method: 'track.scrobble',
        api_key: key,
        artist,
        track,
        timestamp: timestamp.toString(),
        sk: sessionKey
      }
      if (album) params.album = album
      if (trackNumber) params.trackNumber = trackNumber.toString()

      const signature = this.generateSignature(params)
      params.api_sig = signature
      params.format = 'json' // Add format AFTER signature generation

      const response = await axios.post(BASE_URL, new URLSearchParams(params))
      return response.status === 200
    } catch (error) {
      console.error('Failed to scrobble track:', error)
      return false
    }
  }

  /**
   * Love/Unlove a track
   */
  async loveTrack(
    sessionKey: string,
    artist: string,
    track: string,
    love: boolean = true
  ): Promise<boolean> {
    const key = getApiKey()
    if (!key || !sessionKey) {
      console.warn('LASTFM_API_KEY or session key missing')
      return false
    }

    try {
      const method = love ? 'track.love' : 'track.unlove'
      const params: Record<string, string> = {
        method,
        api_key: key,
        artist,
        track,
        sk: sessionKey
      }

      const signature = this.generateSignature(params)
      params.api_sig = signature
      params.format = 'json' // Add format AFTER signature generation

      const response = await axios.post(BASE_URL, new URLSearchParams(params))
      return response.status === 200
    } catch (error) {
      console.error(`Failed to ${love ? 'love' : 'unlove'} track:`, error)
      return false
    }
  }

  /**
   * Get authentication token for Last.fm OAuth flow
   * Returns auth token and auth URL that user must visit
   */
  async getAuthToken(): Promise<{ token: string; authUrl: string } | null> {
    const key = getApiKey()
    console.log('🔐 Getting Last.fm auth token with API key:', key ? 'present' : 'missing')

    if (!key) {
      console.error('LASTFM_API_KEY not found in getAuthToken')
      return null
    }

    try {
      const params: Record<string, string> = {
        method: 'auth.getToken',
        api_key: key,
        format: 'json'
      }

      console.log('📤 Requesting auth token from Last.fm...', params)
      const response = await axios.get(BASE_URL, { params })
      console.log('📥 Last.fm auth token response:', response.data)

      if (response.data?.token) {
        const token = response.data.token
        const authUrl = `https://www.last.fm/api/auth/?api_key=${key}&token=${token}`
        console.log('✅ Auth token obtained:', token.substring(0, 8) + '...')
        return { token, authUrl }
      }
      console.error('❌ No token in response:', response.data)
      return null
    } catch (error) {
      console.error('❌ Failed to get Last.fm auth token:', error)
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data)
        console.error('Response status:', error.response?.status)
      }
      return null
    }
  }

  /**
   * Exchange auth token for session key (after user has authorized)
   */
  async getSession(token: string): Promise<string | null> {
    const key = getApiKey()
    console.log('🔄 Getting Last.fm session with token:', token ? 'present' : 'missing')

    if (!key) {
      console.error('LASTFM_API_KEY not found in getSession')
      return null
    }

    try {
      const params: Record<string, string> = {
        method: 'auth.getSession',
        api_key: key,
        token
      }

      const signature = this.generateSignature(params)
      params.api_sig = signature
      params.format = 'json' // Add format AFTER signature generation

      console.log('📤 Requesting session from Last.fm...')
      const response = await axios.post(BASE_URL, new URLSearchParams(params))
      console.log('📥 Last.fm session response:', response.data)

      if (response.data?.session?.key) {
        console.log('✅ Session key obtained:', response.data.session.key.substring(0, 8) + '...')
        return response.data.session.key
      }
      console.error('❌ No session key in response:', response.data)
      return null
    } catch (error) {
      console.error('❌ Failed to get Last.fm session:', error)
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data)
        console.error('Response status:', error.response?.status)
      }
      return null
    }
  }

  /**
   * Set API key dynamically (from settings)
   */
  setApiKey(key: string) {
    apiKey = key
    console.log('Last.fm API key updated')
  }

  /**
   * Set API secret dynamically (from settings)
   */
  setApiSecret(secret: string) {
    apiSecret = secret
    console.log('Last.fm API secret updated')
  }
}

export const lastFmService = new LastFmService()
