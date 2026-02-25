import fs from 'fs'
import path from 'path'
import { assignMoodCategory, calculateArousalValence } from './moodTaxonomy'

function logDebug(message: string) {
    try {
        const logPath = path.join(process.cwd(), 'debug-spotify.log')
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`)
    } catch (e) {
        // ignore
    }
}

export class SpotifyService {
    private accessToken: string | null = null
    private tokenExpiresAt = 0

    private async getAccessToken(): Promise<string | null> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken
        }

        const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
        const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

        if (!CLIENT_ID || !CLIENT_SECRET) {
            logDebug('Spotify credentials not found in env')
            return null
        }

        try {
            logDebug('Requesting Spotify Token...')
            const res = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials'
            })

            const data = await res.json() as any
            if (data.access_token) {
                this.accessToken = data.access_token
                this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000
                logDebug('Spotify Token Acquired')
                return this.accessToken
            } else {
                logDebug(`Spotify Token Error: ${JSON.stringify(data)}`)
            }
        } catch (error: any) {
            logDebug(`Failed to get Spotify access token: ${error.message}`)
        }
        return null
    }

    async getArtistImage(artistName: string): Promise<string | null> {
        const token = await this.getAccessToken()
        if (!token) return null

        try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json() as any
            const artist = data.artists?.items?.[0]
            if (artist && artist.images?.length > 0) {
                logDebug(`Found image for ${artistName}: ${artist.images[0].url}`)
                return artist.images[0].url // Usually the largest
            } else {
                logDebug(`No image found for ${artistName}`)
            }
        } catch (error: any) {
            logDebug(`Failed to search Spotify for artist ${artistName}: ${error.message}`)
        }
        return null
    }

    async getTrackAudioFeatures(title: string, artist: string): Promise<{ tempo: number, mood: string } | null> {
        const token = await this.getAccessToken()
        if (!token) return null

        try {
            // 1. Search for track
            const query = `track:${title} artist:${artist}`
            const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const searchData = await searchRes.json() as any
            const track = searchData.tracks?.items?.[0]

            if (!track || !track.id) {
                logDebug(`No track found for ${title} by ${artist}`)
                return null
            }

            // 2. Get audio features
            const featuresRes = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const features = await featuresRes.json() as any

            if (!features || typeof features.tempo !== 'number') {
                logDebug(`No audio features found for track ${track.id}`)
                return null
            }

            const tempo = Math.round(features.tempo)
            const energy = features.energy || 0.5
            const danceability = features.danceability || 0.5
            const valenceScore = features.valence || 0.5

            // Calculate Mood
            // Spotify valence maps directly to our valence.
            // We use calculateArousalValence just to get the weighted arousal from energy and danceability, 
            // though we skip the genre-based valence calc because Spotify's valence is already perfect.
            const { arousal } = calculateArousalValence(energy, danceability, {})

            const moodCategory = assignMoodCategory(arousal, valenceScore, tempo)

            logDebug(`Got audio features for ${title}: Tempo ${tempo}, Mood ${moodCategory.id}`)
            return {
                tempo,
                mood: moodCategory.id
            }

        } catch (error: any) {
            logDebug(`Failed to fetch audio features for ${title} by ${artist}: ${error.message}`)
        }
        return null
    }
}

export const spotifyService = new SpotifyService()
