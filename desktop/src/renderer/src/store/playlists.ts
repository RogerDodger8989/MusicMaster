import { create } from 'zustand'
import { Track } from '../types'

export interface Playlist {
    id: string
    name: string
    description?: string
    tracks: Track[]
    createdAt: Date
    updatedAt: Date
}

interface PlaylistStore {
    playlists: Playlist[]
    isLoading: boolean
    error: string | null

    fetchPlaylists: () => Promise<void>
    createPlaylist: (name: string, trackIds: string[]) => Promise<string | null>
    deletePlaylist: (id: string) => Promise<boolean>
    addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<boolean>
    removeTrackFromPlaylist: (playlistId: string, trackId: string, position: number) => Promise<boolean>
    renamePlaylist: (id: string, name: string) => Promise<boolean>
}

export const usePlaylists = create<PlaylistStore>((set, get) => ({
    playlists: [],
    isLoading: false,
    error: null,

    fetchPlaylists: async () => {
        set({ isLoading: true, error: null })
        try {
            const playlists = await window.api.playlists.getAll()
            set({ playlists, isLoading: false })
        } catch (error) {
            console.error('Failed to fetch playlists:', error)
            set({ error: 'Failed to fetch playlists', isLoading: false })
        }
    },

    createPlaylist: async (name, trackIds) => {
        try {
            const id = await window.api.playlists.create(name, trackIds)
            // Refresh to get the full object (with formatted dates, etc.)
            await get().fetchPlaylists()
            return id
        } catch (error) {
            console.error('Failed to create playlist:', error)
            return null
        }
    },

    deletePlaylist: async (id) => {
        try {
            const success = await window.api.playlists.delete(id)
            if (success) {
                set(state => ({
                    playlists: state.playlists.filter(p => p.id !== id)
                }))
            }
            return success
        } catch (error) {
            console.error('Failed to delete playlist:', error)
            return false
        }
    },

    addTrackToPlaylist: async (playlistId, trackId) => {
        try {
            const success = await window.api.playlists.addTrack(playlistId, trackId)
            if (success) {
                await get().fetchPlaylists()
            }
            return success
        } catch (error) {
            console.error('Failed to add track to playlist:', error)
            return false
        }
    },

    removeTrackFromPlaylist: async (playlistId, trackId, position) => {
        try {
            const success = await window.api.playlists.removeTrack(playlistId, trackId, position)
            if (success) {
                await get().fetchPlaylists()
            }
            return success
        } catch (error) {
            console.error('Failed to remove track from playlist:', error)
            return false
        }
    },

    renamePlaylist: async (id, name) => {
        try {
            const success = await window.api.playlists.rename(id, name)
            if (success) {
                set(state => ({
                    playlists: state.playlists.map(p => p.id === id ? { ...p, name } : p)
                }))
            }
            return success
        } catch (error) {
            console.error('Failed to rename playlist:', error)
            return false
        }
    }
}))
