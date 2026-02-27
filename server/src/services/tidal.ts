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
    private redirectUri = 'musicmaster://auth'
    private authCodeVerifier: string | null = null

    constructor() {
        this.clientId = process.env.TIDAL_CLIENT_ID || null
        this.clientSecret = process.env.TIDAL_CLIENT_SECRET || null
    }

    private getTokens() {
        const db = getDatabase()
        const accessToken = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_access_token'").get() as any
        const refreshToken = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_refresh_token'").get() as any
        const expiresAt = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'tidal_token_expires_at'").get() as any

        return {
            accessToken: accessToken?.setting_value,
            refreshToken: refreshToken?.setting_value,
            expiresAt: expiresAt ? parseInt(expiresAt.setting_value) : 0
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

        upsert.run(crypto.randomUUID(), 'tidal_access_token', tokens.access_token)
        upsert.run(crypto.randomUUID(), 'tidal_refresh_token', tokens.refresh_token)
        upsert.run(crypto.randomUUID(), 'tidal_token_expires_at', expiresAt.toString())
    }

    public generateAuthUrl() {
        const verifier = crypto.randomBytes(32).toString('hex')
        this.authCodeVerifier = verifier
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

        const params = new URLSearchParams({
            client_id: this.clientId!,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            scope: 'r_usr w_usr', // Basic Tidal scopes for library access
            code_challenge_method: 'S256',
            code_challenge: challenge
        })

        return `https://login.tidal.com/authorize?${params.toString()}`
    }

    public async handleCallback(code: string) {
        if (!this.authCodeVerifier) throw new Error('No verifier found')

        try {
            const res = await axios.post('https://auth.tidal.com/v1/oauth2/token', new URLSearchParams({
                client_id: this.clientId!,
                client_secret: this.clientSecret!,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri,
                code_verifier: this.authCodeVerifier
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            })

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
            const res = await axios.post('https://auth.tidal.com/v1/oauth2/token', new URLSearchParams({
                client_id: this.clientId!,
                client_secret: this.clientSecret!,
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            })

            this.saveTokens(res.data)
            return res.data.access_token
        } catch (error) {
            logDebug('Failed to refresh Tidal token')
            return null
        }
    }

    public async search(query: string) {
        const token = await this.ensureValidToken()
        if (!token) return []

        try {
            const res = await axios.get(`https://api.tidal.com/v1/search?query=${encodeURIComponent(query)}&limit=20&types=TRACKS`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            return res.data.tracks.items
        } catch (error) {
            return []
        }
    }
}

export const tidalService = new TidalService()
