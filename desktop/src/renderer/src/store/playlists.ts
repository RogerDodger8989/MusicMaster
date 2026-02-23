import { create } from 'zustand'
import { Track } from '../types'
import { client } from '../api/client'

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
  removeTrackFromPlaylist: (
    playlistId: string,
    trackId: string,
    position: number
  ) => Promise<boolean>
  removeTrackByIdFromPlaylist: (playlistId: string, trackId: string) => Promise<boolean>
  renamePlaylist: (id: string, name: string) => Promise<boolean>
  reorderTracks: (playlistId: string, trackIds: string[]) => Promise<boolean>
}

export const usePlaylists = create<PlaylistStore>((set, get) => ({
  playlists: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null })
    try {
      const playlists = await client.getPlaylists()
      set({ playlists, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
      set({ error: 'Failed to fetch playlists', isLoading: false })
    }
  },

  createPlaylist: async (name, trackIds) => {
    try {
      const result = await client.createPlaylist(name, trackIds)
      // Refresh to get the full object (with formatted dates, etc.)
      await get().fetchPlaylists()
      return result?.id || null
    } catch (error) {
      console.error('Failed to create playlist:', error)
      return null
    }
  },

  deletePlaylist: async (id) => {
    try {
      await client.deletePlaylist(id)
      set((state) => ({
        playlists: state.playlists.filter((p) => p.id !== id)
      }))
      return true
    } catch (error) {
      console.error('Failed to delete playlist:', error)
      return false
    }
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    try {
      await client.addToPlaylist(playlistId, trackId)
      await get().fetchPlaylists()
      return true
    } catch (error) {
      console.error('Failed to add track to playlist:', error)
      return false
    }
  },

  removeTrackFromPlaylist: async (playlistId, trackId, position) => {
    try {
      await client.removeFromPlaylist(playlistId, trackId, position)
      await get().fetchPlaylists()
      return true
    } catch (error) {
      console.error('Failed to remove track from playlist:', error)
      return false
    }
  },
  removeTrackByIdFromPlaylist: async (playlistId, trackId) => {
    try {
      await client.removeFromPlaylistById(playlistId, trackId)
      await get().fetchPlaylists()
      return true
    } catch (error) {
      console.error('Failed to remove track from playlist by ID:', error)
      return false
    }
  },

  renamePlaylist: async (id, name) => {
    try {
      await client.renamePlaylist(id, name)
      set((state) => ({
        playlists: state.playlists.map((p) => (p.id === id ? { ...p, name } : p))
      }))
      return true
    } catch (error) {
      console.error('Failed to rename playlist:', error)
      return false
    }
  },
  reorderTracks: async (playlistId, trackIds) => {
    try {
      await client.reorderPlaylist(playlistId, trackIds)
      set((state) => ({
        playlists: state.playlists.map((p) => {
          if (p.id === playlistId) {
            const trackMap = new Map(p.tracks.map((t) => [t.id, t]))
            const newTracks = trackIds.map((id) => trackMap.get(id)!).filter(Boolean)
            return { ...p, tracks: newTracks }
          }
          return p
        })
      }))
      return true
    } catch (error) {
      console.error('Failed to reorder tracks:', error)
      return false
    }
  }
}))
