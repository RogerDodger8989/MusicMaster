import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export interface AcoustidResult {
    id: string
    score: number
    recordings?: Array<{
        id: string
        title?: string
        artists?: Array<{ id: string; name: string }>
        releasegroups?: Array<{ id: string; title: string }>
    }>
}

export class AcoustidService {
    private clientKey: string = '8XaBELgH' // Public key for MusicMaster or replace with user key

    async getFingerprint(filePath: string): Promise<{ duration: number; fingerprint: string } | null> {
        try {
            // Check if fpcalc is available
            const { stdout } = await execAsync(`fpcalc "${filePath}"`)

            const durationMatch = stdout.match(/^DURATION=(\d+)/m)
            const fingerprintMatch = stdout.match(/^FINGERPRINT=(.+)/m)

            if (!durationMatch || !fingerprintMatch) {
                return null
            }

            return {
                duration: parseInt(durationMatch[1]),
                fingerprint: fingerprintMatch[1]
            }
        } catch (error) {
            console.error('Failed to generate fingerprint:', error)
            return null
        }
    }

    async lookupFingerprint(duration: number, fingerprint: string): Promise<AcoustidResult[]> {
        try {
            const url = `https://api.acoustid.org/v2/lookup?client=${this.clientKey}&duration=${duration}&fingerprint=${fingerprint}&meta=recordings+releasegroups+compress`

            const response = await fetch(url)
            if (!response.ok) {
                return []
            }

            const data = await response.json() as any
            if (data.status !== 'ok' || !data.results) {
                return []
            }

            return data.results as AcoustidResult[]
        } catch (error) {
            console.error('Acoustid lookup failed:', error)
            return []
        }
    }

    async identifyFile(filePath: string): Promise<AcoustidResult[]> {
        const fp = await this.getFingerprint(filePath)
        if (!fp) return []
        return this.lookupFingerprint(fp.duration, fp.fingerprint)
    }
}

export const acoustidService = new AcoustidService()
