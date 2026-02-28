import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'
import { getDatabase } from '../database'

function logDebug(message: string) {
    try {
        const logPath = path.join(process.cwd(), 'debug-tidal.log')
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`)
    } catch (e) {
        // ignore
    }
}

export class TidalService {
    private clientId: string | null = null
    private clientSecret: string | null = null
    private redirectUri = 'musicmaster://auth/'
    private authCodeVerifier: string | null = null

    constructor() {
        this.loadCredentials()
    }

    private loadCredentials() {
        const db = getDatabase()
        const clientIdEntry = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidalClientId'").get() as any
        const clientSecretEntry = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidalClientSecret'").get() as any

        logDebug(`Loading credentials from DB: clientIdEntry=${!!clientIdEntry}, clientSecretEntry=${!!clientSecretEntry}`)

        try {
            this.clientId = clientIdEntry ? JSON.parse(clientIdEntry.setting_value) : (process.env.TIDAL_CLIENT_ID || null)
            this.clientSecret = clientSecretEntry ? JSON.parse(clientSecretEntry.setting_value) : (process.env.TIDAL_CLIENT_SECRET || null)
            logDebug(`Parsed credentials: clientId=${this.clientId ? 'EXISTS' : 'null'}`)
        } catch (e) {
            logDebug(`Error parsing credentials: ${e}`)
            this.clientId = clientIdEntry?.setting_value || process.env.TIDAL_CLIENT_ID || null
            this.clientSecret = clientSecretEntry?.setting_value || process.env.TIDAL_CLIENT_SECRET || null
        }
    }

    public updateCredentials(clientId: string, clientSecret: string) {
        logDebug(`Updating credentials: clientId=${clientId ? 'EXISTS' : 'null'}`)
        this.clientId = clientId
        this.clientSecret = clientSecret

        const db = getDatabase()
        const upsert = db.prepare(`
            INSERT INTO user_settings (id, setting_key, setting_value) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value
        `)

        upsert.run(crypto.randomUUID(), 'tidalClientId', JSON.stringify(clientId))
        upsert.run(crypto.randomUUID(), 'tidalClientSecret', JSON.stringify(clientSecret))
    }

    private getTokens() {
        const db = getDatabase()
        const accessToken = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_access_token'").get() as any
        const refreshToken = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_refresh_token'").get() as any
        const expiresAt = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_token_expires_at'").get() as any

        const parse = (val: string | undefined) => {
            if (!val) return undefined
            try { return JSON.parse(val) } catch { return val }
        }

        return {
            accessToken: parse(accessToken?.setting_value),
            refreshToken: parse(refreshToken?.setting_value),
            expiresAt: expiresAt ? parseInt(parse(expiresAt.setting_value)) : 0
        }
    }

    private saveTokens(tokens: { access_token: string, refresh_token: string, expires_in: number }) {
        const db = getDatabase()
        const expiresAt = Date.now() + (tokens.expires_in * 1000)

        const upsert = db.prepare(`
            INSERT INTO user_settings (id, setting_key, setting_value) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value
        `)

        upsert.run(crypto.randomUUID(), 'tidal_access_token', JSON.stringify(tokens.access_token))
        upsert.run(crypto.randomUUID(), 'tidal_refresh_token', JSON.stringify(tokens.refresh_token))
        upsert.run(crypto.randomUUID(), 'tidal_token_expires_at', JSON.stringify(expiresAt.toString()))
    }

    public generateAuthUrl() {
        logDebug(`Generating Auth URL with ClientId: ${this.clientId ? this.clientId.substring(0, 5) + '...' : 'null'}`)
        if (!this.clientId || this.clientId === 'null' || this.clientId === 'undefined') {
            logDebug(`Error: Invalid Client ID found in TidalService: "${this.clientId}"`)
            throw new Error('Missing or invalid Tidal Client ID')
        }

        const verifier = crypto.randomBytes(32).toString('hex')
        this.authCodeVerifier = verifier
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

        logDebug(`Using Redirect URI: "${this.redirectUri}" (length: ${this.redirectUri.length})`)
        logDebug(`Using Scopes: "user.read collection.read playlists.read search.read playback"`)

        const params = new URLSearchParams({
            client_id: this.clientId!,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            scope: 'user.read collection.read playlists.read search.read playback',
            code_challenge_method: 'S256',
            code_challenge: challenge
        })

        const url = `https://login.tidal.com/authorize?${params.toString()}`
        logDebug(`Generated URL: ${url}`)
        return url
    }

    public async handleCallback(code: string) {
        if (!this.authCodeVerifier) {
            logDebug('Tidal Callback Error: No code verifier found in session')
            return false
        }

        try {
            const params = new URLSearchParams({
                client_id: this.clientId!,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri,
                code_verifier: this.authCodeVerifier
            })

            // Tidal often requires Basic Auth with ClientID:ClientSecret if secret is provided
            const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' }
            if (this.clientSecret) {
                headers['Authorization'] = 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64')
            }

            const res = await axios.post('https://auth.tidal.com/v1/oauth2/token', params, { headers })

            this.saveTokens(res.data)
            return true
        } catch (error: any) {
            logDebug(`Tidal Auth Error: ${error.message} - ${JSON.stringify(error.response?.data)}`)
            return false
        }
    }

    private async ensureValidToken() {
        const tokens = this.getTokens()
        if (!tokens.accessToken) return null

        if (Date.now() < tokens.expiresAt - 60000) {
            return tokens.accessToken
        }

        // Refresh token
        try {
            const params = new URLSearchParams({
                client_id: this.clientId!,
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken
            })

            const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' }
            if (this.clientSecret) {
                headers['Authorization'] = 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64')
            }

            const res = await axios.post('https://auth.tidal.com/v1/oauth2/token', params, { headers })

            this.saveTokens(res.data)
            return res.data.access_token
        } catch (error) {
            logDebug('Failed to refresh Tidal token')
            return null
        }
    }

    public async search(query: string) {
        const token = await this.ensureValidToken()
        if (!token) {
            logDebug('No valid Tidal token for search')
            return []
        }

        try {
            const res = await axios.get(`https://api.tidal.com/v1/search?query=${encodeURIComponent(query)}&limit=20&types=TRACKS`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            
            if (!res.data || !res.data.tracks) {
                logDebug(`Tidal search returned unexpected format: ${JSON.stringify(res.data)}`)
                return []
            }
            
            logDebug(`Tidal search found ${res.data.tracks.items?.length || 0} tracks`)
            return res.data.tracks.items || []
        } catch (error: any) {
            logDebug(`Tidal search error for "${query}": ${error?.message || error}`)
            return []
        }
    }

    public async getStreamUrl(trackId: string) {
        const token = await this.ensureValidToken()
        if (!token) return null

        try {
            // Tidal API for stream URLs requires specific permissions/account type
            // This is a placeholder for the actual Tidal stream endpoint
            const res = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/urlpostpaywall?playbackmode=STREAM&assetpresentation=FULL`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data.url
        } catch (error) {
            logDebug(`Failed to get Tidal stream URL for ${trackId}`)
            return null
        }
    }

    public async getUserInfo() {
        const token = await this.ensureValidToken()
        if (!token) {
            console.error('[Tidal] No token for getUserInfo')
            return null
        }

        try {
            console.log('[Tidal] Getting user info...')
            const res = await axios.get('https://api.tidal.com/v1/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            console.log('[Tidal] User info response:', res.data)
            return res.data
        } catch (error: any) {
            console.error('[Tidal] Failed to get user info:')
            console.error('  Message:', error?.message)
            console.error('  Status:', error?.response?.status)
            console.error('  Response:', error?.response?.data)
            return null
        }
    }

    public async getLikedTracks(limit: number = 50) {
        const token = await this.ensureValidToken()
        if (!token) {
            logDebug('No token available for getLikedTracks')
            console.error('[Tidal] No token available')
            return []
        }

        try {
            console.log('[Tidal] Fetching user info...')
            const userInfo = await this.getUserInfo()
            if (!userInfo) {
                console.error('[Tidal] getUserInfo returned null')
                return []
            }
            
            console.log('[Tidal] User info:', userInfo)
            
            if (!userInfo.userId) {
                console.error('[Tidal] No userId in user info. Keys:', Object.keys(userInfo))
                return []
            }

            console.log(`[Tidal] Fetching liked tracks for user ${userInfo.userId}...`)
            const res = await axios.get(`https://api.tidal.com/v1/users/${userInfo.userId}/favorites/tracks?limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            
            console.log('[Tidal] Liked tracks response:', res.data)
            const items = res.data.items || res.data.totalNumberOfItems ? (res.data.items || []) : []
            console.log(`[Tidal] Returning ${items.length} liked tracks`)
            return items
        } catch (error: any) {
            console.error('[Tidal] Error fetching liked tracks:')
            console.error('  Message:', error?.message)
            console.error('  Status:', error?.response?.status)
            console.error('  Response:', error?.response?.data)
            logDebug(`Failed to get Tidal liked tracks: ${error?.message} (status: ${error?.response?.status}) - Response: ${JSON.stringify(error?.response?.data)}`)
            return []
        }
    }
}

export const tidalService = new TidalService()
