import { create } from 'zustand'
import type { Track } from '../types'
import { client } from '../api/client'

interface TidalState {
    isAuthenticated: boolean
    isConnecting: boolean
    isSearching: boolean
    isLoadingLiked: boolean
    searchResults: Track[]
    likedTracks: Track[]

    // Actions
    login: () => Promise<void>
    logout: () => void
    search: (query: string) => Promise<void>
    loadLikedTracks: () => Promise<void>
    finishAuth: (code: string) => Promise<void>
    load: () => Promise<void>
}

export const useTidal = create<TidalState>((set) => ({
    isAuthenticated: false,
    isConnecting: false,
    isSearching: false,
    isLoadingLiked: false,
    searchResults: [],
    likedTracks: [],

    login: async () => {
        set({ isConnecting: true })
        try {
            const url = await client.getAuthUrl()
            await client.openExternal(url)
            // We set isConnecting to false here so the button isn't stuck.
            // The actual "Connected" state will be set via finishAuth callback.
            set({ isConnecting: false })
        } catch (error) {
            console.error('Failed to get Tidal auth URL', error)
            set({ isConnecting: false })
        }
    },

    finishAuth: async (code: string) => {
        try {
            const success = await client.finishAuth(code)
            set({ isAuthenticated: success, isConnecting: false })
            // Load liked tracks after successful auth
            if (success) {
                await useTidal.getState().loadLikedTracks()
            }
        } catch (error) {
            console.error('Failed to finish Tidal auth', error)
            set({ isConnecting: false })
        }
    },

    logout: () => {
        // We should also clear tokens in backend, but for now just UI
        set({ isAuthenticated: false, likedTracks: [] })
    },

    search: async (query: string) => {
        if (!query) return
        set({ isSearching: true })
        try {
            const results = await window.api.tidal.search(query)

            // Map Tidal results to our Track type
            const mappedTracks: Track[] = results.map((t: any) => ({
                id: `tidal-${t.id}`,
                externalId: t.id.toString(),
                provider: 'tidal',
                title: t.title,
                artist: t.artists.map((a: any) => a.name).join(', '),
                album: t.album.title,
                duration: t.duration,
                format: 'flac', // Tidal HiFi/Max placeholder
                bitrate: 1411,
                rating: 0,
                loved: false,
                playCount: 0,
                coverArtPath: t.album.cover || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                filePath: `tidal://${t.id}` // Virtual path
            }))

            set({ searchResults: mappedTracks, isSearching: false })
        } catch (error) {
            console.error('Tidal search failed', error)
            set({ isSearching: false })
        }
    },

    loadLikedTracks: async () => {
        set({ isLoadingLiked: true })
        try {
            console.log('[Tidal Store] Calling window.api.tidal.getLikedTracks()...')
            const results = await window.api.tidal.getLikedTracks(50)
            console.log('[Tidal Store] Raw results from API:', results)

            // Map Tidal results to our Track type
            const mappedTracks: Track[] = (results || []).map((t: any) => ({
                id: `tidal-${t.id}`,
                externalId: t.id.toString(),
                provider: 'tidal',
                title: t.title,
                artist: t.artists?.map((a: any) => a.name).join(', ') || '',
                album: t.album?.title || '',
                duration: t.duration || 0,
                format: 'flac', // Tidal HiFi/Max placeholder
                bitrate: 1411,
                rating: 0,
                loved: true,
                playCount: 0,
                coverArtPath: t.album?.cover || t.coverArt || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                filePath: `tidal://${t.id}` // Virtual path
            }))

            set({ likedTracks: mappedTracks, isLoadingLiked: false })
            console.log(`[Tidal Store] ✅ Loaded and mapped ${mappedTracks.length} liked Tidal tracks`)
        } catch (error) {
            console.error('[Tidal Store] Failed to load Tidal liked tracks', error)
            set({ isLoadingLiked: false })
        }
    },

    load: async () => {
        try {
            const settings = await client.getSettings()
            const hasAuth = !!(settings.tidal_access_token)
            set({ isAuthenticated: hasAuth })
            
            // Load liked tracks if authenticated
            if (hasAuth) {
                await useTidal.getState().loadLikedTracks()
            }
            
            console.log('🌊 Tidal store initialized, authenticated:', hasAuth)
        } catch (error) {
            console.warn('Failed to initialize Tidal store', error)
        }
    }
}))

// Auto-initialize store
useTidal.getState().load()

// Auto-handle auth callback if store is loaded
if (window.api?.tidal?.onAuthCallback) {
    window.api.tidal.onAuthCallback((code) => {
        useTidal.getState().finishAuth(code)
    })
}
