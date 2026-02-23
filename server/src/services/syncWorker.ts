import axios from 'axios'
import { getDatabase } from '../database'
import { lastFmService } from './lastfm'
import { listenBrainzService } from './listenbrainz'
import { musicBrainzService } from './musicbrainz'
import { getAllTracks, updateTrackPlayCount, updateTrackLoved } from '../database/tracks'
import { writeMetadata } from './metadataWriter'

// Shared state object so SettingsView can poll it
export const syncState = {
    isRunning: false,
    current: 0,
    total: 0,
    trackName: '',
    percentage: 0,
    errors: [] as string[]
}

class SyncWorker {
    private interval: NodeJS.Timeout | null = null
    private static readonly SYNC_INTERVAL = 12 * 60 * 60 * 1000 // 12 hours

    start() {
        if (this.interval) return
        console.log('🔄 Background SyncWorker started')

        // First run 5 minutes after startup to not delay booting
        setTimeout(() => this.runSync(), 5 * 60 * 1000)

        this.interval = setInterval(() => this.runSync(), SyncWorker.SYNC_INTERVAL)
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }
        console.log('⏹️ Background SyncWorker stopped')
    }

    private normalizeString(str: string): string {
        return str
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()
    }

    /**
     * Executes the main sync process across all tracks for both background worker and manual start.
     */
    async runSync(manualLastfmUsername?: string, manualListenbrainzUsername?: string, manualWriteToFile?: boolean) {
        if (syncState.isRunning) {
            console.log('⚠️ Sync already in progress, skipping.')
            return
        }

        try {
            syncState.isRunning = true
            syncState.current = 0
            syncState.total = 0
            syncState.trackName = 'Initializing...'
            syncState.percentage = 0
            syncState.errors = []

            console.log('🤖 Auto-sync started.')
            const db = getDatabase()

            // Resolve settings (manual override > DB settings)
            const resolveSetting = (key: string) => {
                const setting = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get(key) as any
                if (!setting) return ''
                try { return JSON.parse(setting.setting_value) } catch { return setting.setting_value }
            }

            const lastfmUsername = manualLastfmUsername !== undefined ? manualLastfmUsername : resolveSetting('lastfmUsername')
            const listenbrainzUsername = manualListenbrainzUsername !== undefined ? manualListenbrainzUsername : resolveSetting('listenbrainzUsername')

            let writeToFile = false
            if (manualWriteToFile !== undefined) {
                writeToFile = manualWriteToFile
            } else {
                const wtfSetting = resolveSetting('writeToFileOnSync')
                writeToFile = wtfSetting === true || wtfSetting === 'true'
            }

            if (!lastfmUsername && !listenbrainzUsername) {
                const msg = 'Auto-sync skipped. Neither Last.fm nor ListenBrainz usernames are configured.'
                console.log(`⚠️ ${msg}`)
                syncState.errors.push(msg)
                return
            }

            const tracks = getAllTracks()
            if (tracks.length === 0) return

            syncState.total = tracks.length
            let updatedCount = 0

            // Pre-fetch ListenBrainz data into memory since it lacks track.getInfo
            const lbPlayCounts = new Map<string, number>()
            const lbLovedTracks = new Set<string>()

            if (listenbrainzUsername) {
                syncState.trackName = 'Fetching ListenBrainz Stats...'
                console.log(`📡 Fetching ListenBrainz stats for ${listenbrainzUsername}...`)
                try {
                    // Try to get max 1000 top recordings
                    const response = await axios.get(`https://api.listenbrainz.org/1/stats/user/${listenbrainzUsername}/recordings`, {
                        params: { count: 1000 }
                    })
                    const recs = response.data?.payload?.recordings || []
                    recs.forEach((r: any) => {
                        const artist = r.artist_name || ''
                        const title = r.recording_name || ''
                        const key = `${this.normalizeString(title)}|${this.normalizeString(artist)}`
                        lbPlayCounts.set(key, r.listen_count || 0)
                    })
                } catch (e) { console.error('ListenBrainz recordings sync failed:', e) }

                syncState.trackName = 'Fetching ListenBrainz Feedback...'
                console.log(`📡 Fetching ListenBrainz feedback for ${listenbrainzUsername}...`)
                try {
                    const response = await axios.get(`https://api.listenbrainz.org/1/feedback/user/${listenbrainzUsername}/get-feedback`, {
                        params: { score: 1, count: 1000, metadata: true }
                    })
                    const feedbacks = response.data?.feedback || []
                    feedbacks.forEach((f: any) => {
                        if (f.score === 1 && f.track_metadata) {
                            const artist = f.track_metadata.artist_name || ''
                            const title = f.track_metadata.track_name || ''
                            const key = `${this.normalizeString(title)}|${this.normalizeString(artist)}`
                            lbLovedTracks.add(key)
                        }
                    })
                } catch (e) { console.error('ListenBrainz feedback sync failed:', e) }
            }

            // Sync Database
            console.log('⚙️ Synchronizing each track...')
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i]
                syncState.current = i + 1
                syncState.trackName = `${track.artist} - ${track.title}`
                syncState.percentage = Math.round(((i + 1) / tracks.length) * 100)

                const trackKey = `${this.normalizeString(track.title)}|${this.normalizeString(track.artist)}`
                let needsUpdate = false
                let updatedPlayCount = track.playCount || 0
                let isLoved = track.loved

                try {
                    // 1. Last.fm Exact Match
                    let hasRemotePlaycount = false
                    let remoteMaxPlays = 0

                    if (lastfmUsername) {
                        try {
                            const info = await lastFmService.getTrackInfo(track.artist, track.title, lastfmUsername)
                            if (info) {
                                const lfPlays = parseInt(info.userplaycount || '0', 10)

                                if (lfPlays > 0 || track.playCount > 0) {
                                    remoteMaxPlays = Math.max(remoteMaxPlays, lfPlays)
                                    hasRemotePlaycount = true
                                }

                                // "userloved" is returned as '0' or '1'
                                if (info.userloved === '1') isLoved = true
                            }
                        } catch (e) {
                            // ignore 404s
                        }
                    }

                    // 2. ListenBrainz Map Check
                    if (listenbrainzUsername) {
                        const lbPlays = lbPlayCounts.get(trackKey) || 0
                        if (lbPlays > 0) {
                            remoteMaxPlays = Math.max(remoteMaxPlays, lbPlays)
                            hasRemotePlaycount = true
                        }

                        if (lbLovedTracks.has(trackKey)) isLoved = true
                    }

                    // 3. Update local DB if changed
                    const dbPlayCount = track.playCount || 0

                    if (hasRemotePlaycount) {
                        updatedPlayCount = remoteMaxPlays
                    }

                    if (updatedPlayCount !== dbPlayCount) {
                        updateTrackPlayCount(track.id, updatedPlayCount)
                        needsUpdate = true
                    } else if (!hasRemotePlaycount && updatedPlayCount > dbPlayCount) {
                        updateTrackPlayCount(track.id, updatedPlayCount)
                        needsUpdate = true
                    }

                    if (isLoved && !track.loved) {
                        updateTrackLoved(track.id, true)
                        needsUpdate = true
                    }

                    if (needsUpdate) {
                        updatedCount++
                        // Rate limit to avoid API bans (Last.fm requires 5 reqs/sec max)
                        await new Promise(resolve => setTimeout(resolve, 200))

                        if (writeToFile && track.filePath) {
                            await writeMetadata(track.filePath, track.rating, isLoved, updatedPlayCount)
                        }
                    }

                } catch (error) {
                    console.error(`Failed to sync track ${track.id}:`, error)
                    syncState.errors.push(`${track.artist} - ${track.title}: ${error}`)
                }
            }

            syncState.trackName = 'Complete'
            console.log(`✅ Auto-sync completed. Synchronized updates for ${updatedCount} tracks.`)

        } catch (error) {
            console.error('❌ Auto-sync failed:', error)
            syncState.errors.push(`General failure: ${error}`)
        } finally {
            syncState.isRunning = false
        }
    }

    async syncMusicBrainzRatings() {
        if (syncState.isRunning) {
            console.log('⚠️ Sync already in progress, skipping rating sync.')
            return
        }

        try {
            syncState.isRunning = true
            syncState.current = 0
            syncState.total = 0
            syncState.trackName = 'Initializing MB Rating Sync...'
            syncState.percentage = 0
            syncState.errors = []

            const db = getDatabase()
            const resolveSetting = (key: string) => {
                const setting = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get(key) as any
                if (!setting) return ''
                try { return JSON.parse(setting.setting_value) } catch { return setting.setting_value }
            }

            const username = resolveSetting('musicbrainzUsername')
            const password = resolveSetting('musicbrainzPassword')

            if (!username || !password) {
                const msg = 'MusicBrainz Rating Sync skipped. Credentials not configured.'
                console.log(`⚠️ ${msg}`)
                syncState.errors.push(msg)
                return
            }

            // Only sync rated tracks (rating > 0) that have an MBID
            const tracks = getAllTracks().filter(t => t.rating > 0 && t.musicbrainzRecordingId)
            if (tracks.length === 0) {
                console.log('No rated tracks with MusicBrainz IDs found.')
                return
            }

            syncState.total = tracks.length
            console.log(`🤖 Starting MB Rating Sync for ${tracks.length} tracks...`)

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i]
                syncState.current = i + 1
                syncState.trackName = `${track.artist} - ${track.title}`
                syncState.percentage = Math.round(((i + 1) / tracks.length) * 100)

                try {
                    await musicBrainzService.submitRating(track.musicbrainzRecordingId!, track.rating, { username, password })
                } catch (error) {
                    console.error(`Failed to submit rating for ${track.id}:`, error)
                    syncState.errors.push(`${track.artist} - ${track.title}: ${error}`)
                }
            }

            syncState.trackName = 'Complete'
            console.log(`✅ MB Rating Sync completed for ${tracks.length} tracks.`)

        } catch (error) {
            console.error('❌ MB Rating Sync failed:', error)
            syncState.errors.push(`General failure: ${error}`)
        } finally {
            syncState.isRunning = false
        }
    }
}

export const syncWorker = new SyncWorker()
