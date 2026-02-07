import axios from 'axios'

const BASE_URL = 'https://api.listenbrainz.org/1'

// Store token in memory with fallback to env
let token = process.env.LISTENBRAINZ_TOKEN || ''

const getToken = (): string => token || process.env.LISTENBRAINZ_TOKEN || ''

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
                        media_player: 'MusicMaster Server',
                        submission_client: 'MusicMaster Server',
                        submission_client_version: '1.0.0'
                    }
                }
            }

            const response = await axios.post(`${BASE_URL}/submit-listens`, {
                listen_type: 'single',
                payload: [listen]
            }, {
                headers: {
                    'Authorization': `Token ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            })

            return response.status === 200 || response.status === 201
        } catch (error) {
            console.error('Failed to submit listen to ListenBrainz:', error)
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
                        media_player: 'MusicMaster Server',
                        submission_client: 'MusicMaster Server',
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
     * Set token dynamically
     */
    setToken(newToken: string) {
        token = newToken
        console.log('ListenBrainz token updated')
    }
    /**
     * Get play count for a track (mock/placeholder for now)
     */
    async getTrackPlayCount(username: string, artist: string, track: string): Promise<number> {
        // TODO: Implement actual ListenBrainz API call to get track stats
        // Currently ListenBrainz doesn't have a simple "get playcount for track" endpoint 
        // without querying stats or iterating history.
        return 0
    }
}

export const listenBrainzService = new ListenBrainzService()
