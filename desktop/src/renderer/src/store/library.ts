import { create } from 'zustand'
import { usePlayer } from './player'
import { client } from '../api/client'
import type {
  Track,
  Album,
  Artist,
  ScanProgress,
  ViewMode,
  SortField,
  SortOrder,
  FilterOptions
} from '../types'

interface LibraryStore {
  // Data
  tracks: Track[]
  albums: Album[]
  artists: Artist[]
  genres: Array<{ genre: string; count: number }>

  // UI State
  viewMode: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  filters: FilterOptions
  selectedTracks: string[]

  // Scanning
  scanProgress: ScanProgress

  // Actions
  loadTracks: () => Promise<void>
  loadAlbums: () => Promise<void>
  loadArtists: () => Promise<void>
  loadGenres: () => Promise<void>
  setTracks: (tracks: Track[]) => void
  setAlbums: (albums: Album[]) => void
  setArtists: (artists: Artist[]) => void
  setViewMode: (mode: ViewMode) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  setFilters: (filters: FilterOptions) => void
  setSelectedTracks: (ids: string[]) => void
  toggleTrackSelection: (id: string) => void
  rateTrack: (trackId: string, rating: number) => Promise<void>
  rateAlbum: (albumId: string, rating: number) => Promise<void>
  toggleTrackLoved: (trackId: string) => Promise<void> // Keeping toggleLoved for backward compat maybe, but better name
  toggleLoved: (trackId: string) => Promise<void>
  toggleAlbumLoved: (albumId: string) => Promise<void>
  toggleArtistLoved: (artistId: string) => Promise<void>
  updateArtist: (artistId: string, updates: Partial<Artist>) => Promise<void>
  reanalyzeLibrary: () => Promise<void>
  setScanProgress: (progress: ScanProgress) => void
  updateTrack: (trackId: string, updates: Partial<Track>) => void
  initialize: () => () => void
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  // Initial state
  tracks: [],
  albums: [],
  artists: [],
  genres: [],
  viewMode: 'grid',
  sortField: 'title',
  sortOrder: 'asc',
  filters: {},
  selectedTracks: [],
  scanProgress: {
    isScanning: false,
    totalFiles: 0,
    scannedFiles: 0,
    currentFile: '',
    errors: []
  },

  // Actions
  loadTracks: async () => {
    try {
      const tracks = await client.getTracks()
      set({ tracks })
    } catch (error) {
      console.error('Failed to load tracks:', error)
    }
  },
  loadAlbums: async () => {
    try {
      const albums = await client.getAlbums()
      set({ albums })
    } catch (error) {
      console.error('Failed to load albums:', error)
    }
  },
  loadArtists: async () => {
    try {
      const artists = await client.getArtists()
      set({ artists })
    } catch (error) {
      console.error('Failed to load artists:', error)
    }
  },
  loadGenres: async () => {
    try {
      const genres = await client.getGenres()
      set({ genres })
    } catch (error) {
      console.error('Failed to load genres:', error)
    }
  },

  setTracks: (tracks) => set({ tracks }),
  setAlbums: (albums) => set({ albums }),
  setArtists: (artists) => set({ artists }),

  setViewMode: (viewMode) => set({ viewMode }),
  setSortField: (sortField) => set({ sortField }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilters: (filters) => set({ filters }),

  setSelectedTracks: (selectedTracks) => set({ selectedTracks }),
  toggleTrackSelection: (id) => {
    const selected = get().selectedTracks
    if (selected.includes(id)) {
      set({ selectedTracks: selected.filter((tid) => tid !== id) })
    } else {
      set({ selectedTracks: [...selected, id] })
    }
  },

  rateTrack: async (trackId, rating) => {
    try {
      const currentTrack = get().tracks.find((t) => t.id === trackId)
      if (!currentTrack) return

      // Toggle Protection: If rating is same as current, toggle to 0
      let newRating = rating
      if (currentTrack.rating === rating) {
        newRating = 0
      }

      // Optimistic update
      const tracks = get().tracks.map((t) =>
        (t.id === trackId ? { ...t, rating: newRating, loved: newRating > 0 } : t)
      )
      set({ tracks })

      // Update Player Store
      usePlayer.getState().updateTrack(trackId, {
        rating: newRating,
        loved: newRating > 0
      })

      // Call API
      await client.rateTrack(trackId, newRating)

      // Toggle Loved if it changed as a result of rating
      if (newRating > 0 && !currentTrack.loved) {
        await client.toggleTrackLoved(trackId, true)
      } else if (newRating === 0 && currentTrack.loved) {
        await client.toggleTrackLoved(trackId, false)
      }
    } catch (error) {
      console.error('Failed to rate track:', error)
    }
  },

  rateAlbum: async (albumId, rating) => {
    try {
      const currentAlbum = get().albums.find((a) => a.id === albumId)
      if (!currentAlbum) return

      // Toggle Protection
      let newRating = rating
      if (currentAlbum.rating === rating) {
        newRating = 0
      }

      // Optimistic update
      const albums = get().albums.map((a) => (a.id === albumId ? { ...a, rating: newRating, loved: newRating > 0 } : a))
      set({ albums })

      // API Calls
      await client.rateAlbum(albumId, newRating)
      if (newRating > 0 && !currentAlbum.loved) {
        await client.toggleAlbumLoved(albumId, true)
      } else if (newRating === 0 && currentAlbum.loved) {
        await client.toggleAlbumLoved(albumId, false)
      }
    } catch (error) {
      console.error('Failed to rate album:', error)
    }
  },

  toggleLoved: async (trackId) => {
    try {
      const track = get().tracks.find((t) => t.id === trackId)
      if (!track) return

      const newLoved = !track.loved

      // Optimistic update
      const tracks = get().tracks.map((t) => (t.id === trackId ? { ...t, loved: newLoved } : t))
      set({ tracks })

      // Update Player Store
      usePlayer.getState().updateTrack(trackId, { loved: newLoved })

      await client.toggleTrackLoved(trackId, newLoved)
    } catch (error) {
      console.error('Failed to toggle loved:', error)
    }
  },

  toggleTrackLoved: async (trackId) => {
    // Alias for toggleLoved for consistency
    return get().toggleLoved(trackId)
  },

  toggleAlbumLoved: async (albumId) => {
    try {
      const album = get().albums.find((a) => a.id === albumId)
      if (!album) return

      const newLoved = !album.loved

      // Optimistic update
      const albums = get().albums.map((a) => (a.id === albumId ? { ...a, loved: newLoved } : a))
      set({ albums })

      await client.toggleAlbumLoved(albumId, newLoved)
    } catch (error) {
      console.error('Failed to toggle album loved:', error)
    }
  },

  toggleArtistLoved: async (artistId) => {
    try {
      const artist = get().artists.find((a) => a.id === artistId)
      if (!artist) return

      const newLoved = !artist.loved

      // Optimistic update
      set((state) => ({
        artists: state.artists.map((a) => (a.id === artistId ? { ...a, loved: newLoved } : a))
      }))

      await client.toggleArtistLoved(artistId, newLoved)
    } catch (error) {
      console.error('Failed to toggle artist loved:', error)
    }
  },

  updateArtist: async (artistId, updates) => {
    try {
      // Optimistic update
      set((state) => ({
        artists: state.artists.map((a) => (a.id === artistId ? { ...a, ...updates } : a))
      }))

      await client.updateArtist(artistId, updates)
    } catch (error) {
      console.error('Failed to update artist:', error)
    }
  },

  reanalyzeLibrary: async () => {
    try {
      console.log('Starting full library re-analysis...')
      // Backend handles this
      // await client.reanalyzeLibrary() // Assuming this exists or we trigger scan
      // For now just aggregations if that's what reanalyze means here, or full scan?
      // "window.api.albums.aggregate()" was the fallback.
      // Let's assume client has a method or we'll add it.
      // Actually client.startScan exists. Library re-analysis might be different.
      // Leaving as TODO/Warning for now if not in client interface.
      console.warn('reanalyzeLibrary not fully implemented in client yet')

      await get().loadAlbums()
      await get().loadGenres()
      await get().loadTracks()
    } catch (error) {
      console.error('Failed to reanalyze library:', error)
    }
  },

  setScanProgress: (scanProgress) => set({ scanProgress }),

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t))
    }))
  },

  initialize: () => {
    // Initial load
    get().loadTracks()
    get().loadAlbums()
    get().loadArtists()
    get().loadGenres()

    // Polling for scan progress could be added here if needed,
    // but for now we just load data.

    return () => {
      // Cleanup
    }
  }
}))
