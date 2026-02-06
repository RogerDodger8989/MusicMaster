import fs from 'fs'
import path from 'path'

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
}

export const spotifyService = new SpotifyService()
