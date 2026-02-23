import { create } from 'zustand'
import { client } from '../api/client'
import { Track } from '../types'

export type RuleField =
    | 'title' | 'artist' | 'album' | 'genre' | 'year'
    | 'rating' | 'loved' | 'play_count' | 'last_played' | 'created_at'
    | 'duration' | 'format' | 'bitrate' | 'bit_depth' | 'sample_rate'
    | 'bpm' | 'mood'

export type RuleOperator =
    | 'eq' | 'neq'
    | 'contains' | 'not_contains' | 'starts_with'
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'between'
    | 'is_true' | 'is_false'
    | 'in_last_days' | 'not_in_last_days' | 'never'
    | 'is_flac' | 'is_mp3'

export interface PlaylistRule {
    id: string
    field: RuleField
    operator: RuleOperator
    value?: string | number
    value2?: string | number
}

export interface SmartPlaylist {
    id: string
    name: string
    description?: string
    matchMode: 'all' | 'any'
    rules: PlaylistRule[]
    limitCount?: number
    limitRandom: boolean
    sortField: string
    sortOrder: 'asc' | 'desc'
    trackCount?: number
    createdAt: string
    updatedAt: string
}

interface SmartPlaylistStore {
    playlists: SmartPlaylist[]
    isLoading: boolean
    error: string | null

    fetchPlaylists: () => Promise<void>
    createPlaylist: (data: Omit<SmartPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'trackCount'>) => Promise<SmartPlaylist | null>
    updatePlaylist: (id: string, data: Partial<Omit<SmartPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'trackCount'>>) => Promise<boolean>
    deletePlaylist: (id: string) => Promise<boolean>
    resolvePlaylist: (id: string) => Promise<Track[]>
    previewPlaylist: (data: Partial<SmartPlaylist>) => Promise<{ tracks: Track[]; total: number }>
}

export const useSmartPlaylists = create<SmartPlaylistStore>((set, _get) => ({
    playlists: [],
    isLoading: false,
    error: null,

    fetchPlaylists: async () => {
        set({ isLoading: true, error: null })
        try {
            const playlists = await client.getSmartPlaylists()
            set({ playlists, isLoading: false })
        } catch (err) {
            console.error('Failed to fetch smart playlists:', err)
            set({ error: 'Failed to fetch smart playlists', isLoading: false })
        }
    },

    createPlaylist: async (data) => {
        try {
            const sp = await client.createSmartPlaylist(data)
            set((state) => ({ playlists: [...state.playlists, sp] }))
            return sp
        } catch (err) {
            console.error('Failed to create smart playlist:', err)
            return null
        }
    },

    updatePlaylist: async (id, data) => {
        try {
            const updated = await client.updateSmartPlaylist(id, data)
            set((state) => ({
                playlists: state.playlists.map((p) => p.id === id ? { ...p, ...updated } : p)
            }))
            return true
        } catch (err) {
            console.error('Failed to update smart playlist:', err)
            return false
        }
    },

    deletePlaylist: async (id) => {
        try {
            await client.deleteSmartPlaylist(id)
            set((state) => ({ playlists: state.playlists.filter((p) => p.id !== id) }))
            return true
        } catch (err) {
            console.error('Failed to delete smart playlist:', err)
            return false
        }
    },

    resolvePlaylist: async (id) => {
        try {
            const result = await client.resolveSmartPlaylist(id)
            return result.tracks
        } catch (err) {
            console.error('Failed to resolve smart playlist:', err)
            return []
        }
    },

    previewPlaylist: async (data) => {
        try {
            return await client.previewSmartPlaylist(data)
        } catch (err) {
            console.error('Failed to preview smart playlist:', err)
            return { tracks: [], total: 0 }
        }
    },
}))
