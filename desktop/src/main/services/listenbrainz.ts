import axios from 'axios'

const BASE_URL = 'https://api.listenbrainz.org/1'

// Store token in memory with fallback to env
let token = process.env.LISTENBRAINZ_TOKEN || ''

const getToken = (): string => token

export interface ListenBrainzListenPayload {
    artist_name: string
    track_name: string
    release_name?: string
    additional_info?: {
        media_player?: string
        submission_client?: string
        submission_client_version?: string
    }
}

export class ListenBrainzService {
    /**
     * Submit a listen (scrobble) to ListenBrainz
     */
    async submitListen(payload: ListenBrainzListenPayload, timestamp?: number): Promise<boolean> {
        const currentToken = getToken()
        console.log('🎵 Submitting listen to ListenBrainz, token:', currentToken ? 'present' : 'missing')

        if (!currentToken) {
            console.error('LISTENBRAINZ_TOKEN not found in submitListen')
            return false
        }

        try {
            const listen = {
                listened_at: timestamp || Math.floor(Date.now() / 1000),
                track_metadata: {
                    artist_name: payload.artist_name,
                    track_name: payload.track_name,
                    release_name: payload.release_name,
                    additional_info: payload.additional_info || {
                        media_player: 'MusicMaster',
                        submission_client: 'MusicMaster',
                        submission_client_version: '1.0.0'
                    }
                }
            }

            console.log('📤 Sending listen to ListenBrainz:', {
                artist: payload.artist_name,
                track: payload.track_name,
                timestamp: listen.listened_at
            })

            const response = await axios.post(`${BASE_URL}/submit-listens`, {
                listen_type: 'single',
                payload: [listen]
            }, {
                headers: {
                    'Authorization': `Token ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            })

            console.log('✅ ListenBrainz response:', response.status, response.data)
            return response.status === 200 || response.status === 201
        } catch (error) {
            console.error('❌ Failed to submit listen to ListenBrainz:', error)
            if (axios.isAxiosError(error)) {
                console.error('Response data:', error.response?.data)
                console.error('Response status:', error.response?.status)
            }
            return false
        }
    }

    /**
     * Submit multiple listens to ListenBrainz
     */
    async submitListens(payloads: Array<{ payload: ListenBrainzListenPayload; timestamp?: number }>): Promise<boolean> {
        const currentToken = getToken()
        if (!currentToken) {
            console.warn('LISTENBRAINZ_TOKEN not found')
            return false
        }

        try {
            const listens = payloads.map(item => ({
                listened_at: item.timestamp || Math.floor(Date.now() / 1000),
                track_metadata: {
                    artist_name: item.payload.artist_name,
                    track_name: item.payload.track_name,
                    release_name: item.payload.release_name,
                    additional_info: item.payload.additional_info || {
                        media_player: 'MusicMaster',
                        submission_client: 'MusicMaster',
                        submission_client_version: '1.0.0'
                    }
                }
            }))

            const response = await axios.post(`${BASE_URL}/submit-listens`, {
                listen_type: 'import',
                payload: listens
            }, {
                headers: {
                    'Authorization': `Token ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            })

            return response.status === 200 || response.status === 201
        } catch (error) {
            console.error('Failed to submit listens to ListenBrainz:', error)
            return false
        }
    }

    /**
     * Get user profile and recent listens
     */
    async getUserProfile(username: string): Promise<any> {
        try {
            const response = await axios.get(`${BASE_URL}/user/${username}`)
            return response.data
        } catch (error) {
            console.error('Failed to get ListenBrainz user profile:', error)
            return null
        }
    }

    /**
     * Get recent listens for a user
     */
    async getRecentListens(username: string, count: number = 50): Promise<any> {
        try {
            const response = await axios.get(`${BASE_URL}/user/${username}/listens`, {
                params: { count }
            })
            return response.data
        } catch (error) {
            console.error('Failed to get recent listens from ListenBrainz:', error)
            return null
        }
    }

    /**
     * Get user's play count for a specific track
     * Note: This is an approximation based on recent listens API
     */
    async getTrackPlayCount(username: string, artist: string, track: string): Promise<number> {
        const currentToken = getToken()
        console.log(`\n🔍 ListenBrainz.getTrackPlayCount()`)
        console.log(`   Token present: ${!!currentToken}`)
        console.log(`   Token length: ${currentToken?.length || 0}`)

        if (!currentToken) {
            console.error('❌ LISTENBRAINZ_TOKEN not found - cannot fetch play count')
            return 0
        }

        try {
            const url = `${BASE_URL}/stats/user/${username}/recordings`
            console.log(`📡 API Request: GET ${url}`)
            console.log(`   Params: count=100, range=all_time`)

            // Get listen_count statistics for the track
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Token ${currentToken}`
                },
                params: {
                    count: 100,
                    range: 'all_time'
                }
            })

            console.log(`✅ API Response: Status ${response.status}`)
            const recordings = response.data?.payload?.recordings || []
            console.log(`📊 Total recordings in response: ${recordings.length}`)

            if (recordings.length === 0) {
                console.warn(`⚠️  No recordings found for user ${username}`)
                console.warn(`   This could mean:`)
                console.warn(`   - You haven't scrobbled anything to ListenBrainz`)
                console.warn(`   - The token is invalid`)
                console.warn(`   - The username is wrong`)
                return 0
            }

            console.log(`\n🔎 Searching for: "${artist}" - "${track}"`)
            console.log(`   (case-insensitive match)\n`)

            const matchingRecording = recordings.find((rec: any) =>
                rec.track_metadata?.artist_name?.toLowerCase() === artist.toLowerCase() &&
                rec.track_metadata?.track_name?.toLowerCase() === track.toLowerCase()
            )

            if (matchingRecording) {
                console.log(`✅✅✅ MATCH FOUND!`)
                console.log(`   Artist: ${matchingRecording.track_metadata?.artist_name}`)
                console.log(`   Track:  ${matchingRecording.track_metadata?.track_name}`)
                console.log(`   Listens: ${matchingRecording.listen_count}`)
                return matchingRecording.listen_count || 0
            } else {
                console.log(`❌ NO MATCH - Track not in top 100 recordings`)
                console.log(`\n📋 Top 5 recordings for comparison:`)
                recordings.slice(0, 5).forEach((rec: any, i: number) => {
                    console.log(`   ${i + 1}. "${rec.track_metadata?.artist_name || '?'}" - "${rec.track_metadata?.track_name || '?'}" (${rec.listen_count} listens)`)
                })
                return 0
            }
        } catch (error: any) {
            console.error('❌❌❌ LISTENBRAINZ API ERROR:')
            if (error.response) {
                console.error(`   Status: ${error.response.status}`)
                console.error(`   Data:`, error.response.data)
            } else {
                console.error(`   Error:`, error.message)
            }
            return 0
        }
    }

    /**
     * Fetch all listens for a user using pagination (max_ts)
     * Returns a map of track count: normalized_string -> count
     */
    async fetchAllListens(username: string, onProgress?: (stats: { fetched: number; total?: number; page: number }) => void): Promise<Map<string, number>> {
        const currentToken = getToken()
        if (!currentToken) {
            throw new Error('ListenBrainz token missing')
        }

        const playCounts = new Map<string, number>()
        let maxTs: number | undefined = undefined
        let page = 1
        let totalFetched = 0
        let hasMore = true
        while (hasMore) {
            let retries = 0
            const maxRetries = 3
            let success = false

            while (retries <= maxRetries && !success) {
                try {
                    console.log(`[ListenBrainz] 📡 Fetching page ${page} (max_ts: ${maxTs || 'latest'})...`)
                    const url = `${BASE_URL}/user/${username}/listens`
                    const response = await axios.get(url, {
                        headers: { 'Authorization': `Token ${currentToken}` },
                        params: {
                            count: 1000,
                            max_ts: maxTs
                        }
                    })

                    const listens = response.data?.payload?.listens || []

                    if (listens.length === 0) {
                        console.log(`[ListenBrainz] ✅ End of history reached at page ${page}`)
                        hasMore = false
                        success = true
                        break
                    }

                    for (const listen of listens) {
                        const metadata = listen.track_metadata
                        if (metadata) {
                            const artist = (metadata.artist_name || '').toLowerCase().trim()
                            const track = (metadata.track_name || '').toLowerCase().trim()
                            const key = `${artist}|${track}`
                            playCounts.set(key, (playCounts.get(key) || 0) + 1)
                        }
                    }

                    totalFetched += listens.length
                    console.log(`[ListenBrainz] ✅ Loaded ${listens.length} listens. Total: ${totalFetched}`)

                    if (onProgress) {
                        onProgress({ fetched: totalFetched, page })
                    }

                    // Get timestamp of oldest listen for next page
                    maxTs = listens[listens.length - 1].listened_at

                    if (listens.length < 1000) {
                        console.log(`[ListenBrainz] ✅ Last page reached (${listens.length} items)`)
                        hasMore = false
                    } else {
                        page++
                    }

                    success = true
                    // Rate limit: 400ms delay between successful requests to be extra safe
                    await new Promise(resolve => setTimeout(resolve, 400))
                } catch (error: any) {
                    if (error.response?.status === 429) {
                        const resetIn = parseInt(error.response.headers['x-ratelimit-reset-in'] || '10')
                        const waitTime = Math.max(resetIn, 12)
                        console.warn(`[ListenBrainz] 🛑 Rate limit exceeded (429) on page ${page}. Waiting ${waitTime}s to reset...`)
                        // Wait for the reset plus a buffer
                        await new Promise(resolve => setTimeout(resolve, (waitTime + 2) * 1000))
                        // Try same page again
                        continue
                    }

                    retries++
                    if (retries > maxRetries) {
                        console.error(`[ListenBrainz] ❌ Final failure fetching page ${page} after ${maxRetries} retries:`, error)
                        throw error
                    }

                    // Exponential backoff: 3s, 7s, 15s
                    const delay = retries === 1 ? 3000 : retries === 2 ? 7000 : 15000
                    console.warn(`[ListenBrainz] ⚠️ Error fetching page ${page} (attempt ${retries}). Retrying in ${delay}ms...`, error.message)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        return playCounts
    }

    /**
     * Set token dynamically (from settings)
     */
    setToken(newToken: string) {
        token = newToken
        console.log('ListenBrainz token updated')
    }
}

export const listenBrainzService = new ListenBrainzService()
