/**
 * Scrobble Service - Handles automatic submission of plays to ListenBrainz/Last.fm
 */

import { useSettings } from '../store/settings'

let scrobbleInterval: NodeJS.Timeout | null = null
const SCROBBLE_CHECK_INTERVAL = 5000 // Check every 5 seconds

export class ScrobbleService {
    private isRunning = false
    private lastfmSessionKey: string | null = null

    /**
     * Start the scrobble service
     */
    start(lastfmSessionKey?: string) {
        if (this.isRunning) return

        this.isRunning = true
        this.lastfmSessionKey = lastfmSessionKey || null

        console.log('🎵 Scrobble Service started')

        // Initial submit
        this.submitPendingScrobbles()

        // Then periodically check
        scrobbleInterval = setInterval(() => {
            this.submitPendingScrobbles()
        }, SCROBBLE_CHECK_INTERVAL)
    }

    /**
     * Stop the scrobble service
     */
    stop() {
        if (scrobbleInterval) {
            clearInterval(scrobbleInterval)
            scrobbleInterval = null
        }
        this.isRunning = false
        console.log('🎵 Scrobble Service stopped')
    }

    /**
     * Submit all pending scrobbles
     */
    private async submitPendingScrobbles() {
        try {
            const pending = await window.api.scrobble.getPending()
            if (pending.length === 0) return

            const settings = useSettings.getState()
            console.log(`📤 Submitting ${pending.length} pending scrobbles (LB: ${settings.listenbrainzEnabled}, LFM: ${settings.lastfmEnabled})`)

            for (const scrobble of pending) {
                // Submit to ListenBrainz (if enabled and not already submitted)
                if (settings.listenbrainzEnabled && !scrobble.listenbrainzSubmitted) {
                    try {
                        const success = await window.api.scrobble.submitToListenBrainz(scrobble.id)
                        if (success) {
                            console.log(`✅ Scrobbled to ListenBrainz: ${scrobble.artist} - ${scrobble.title}`)
                        }
                    } catch (error) {
                        console.error(`Failed to submit to ListenBrainz: ${scrobble.id}`, error)
                    }
                }

                // Submit to Last.fm (if enabled, session exists, and not already submitted)
                if (settings.lastfmEnabled && !scrobble.lastfmSubmitted && this.lastfmSessionKey) {
                    try {
                        const success = await window.api.scrobble.submitToLastFM(scrobble.id, this.lastfmSessionKey)
                        if (success) {
                            console.log(`✅ Scrobbled to Last.fm: ${scrobble.artist} - ${scrobble.title}`)
                        }
                    } catch (error) {
                        console.error(`Failed to submit to Last.fm: ${scrobble.id}`, error)
                    }
                }
            }
        } catch (error) {
            console.error('Failed to submit pending scrobbles:', error)
        }
    }

    /**
     * Set Last.fm session key and restart service
     */
    setLastFmSession(sessionKey: string) {
        this.lastfmSessionKey = sessionKey
        console.log('🔑 Last.fm session updated')
    }

    /**
     * Get service status
     */
    isActive(): boolean {
        return this.isRunning
    }
}

export const scrobbleService = new ScrobbleService()
