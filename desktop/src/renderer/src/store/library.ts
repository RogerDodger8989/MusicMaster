import { create } from 'zustand'
import { usePlayer } from './player'
import type { Track, Album, Artist, ScanProgress, ViewMode, SortField, SortOrder, FilterOptions } from '../types'

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
            const tracks = await window.api.tracks.getAll()
            set({ tracks })
        } catch (error) {
            console.error('Failed to load tracks:', error)
        }
    },
    loadAlbums: async () => {
        try {
            const albums = await window.api.albums.getAll()
            set({ albums })
        } catch (error) {
            console.error('Failed to load albums:', error)
        }
    },
    loadArtists: async () => {
        try {
            if (window.api?.library?.getArtists) {
                const artists = await window.api.library.getArtists()
                set({ artists })
            } else {
                console.warn('window.api.library.getArtists is not available')
            }
        } catch (error) {
            console.error('Failed to load artists:', error)
        }
    },
    loadGenres: async () => {
        try {
            const genres = await window.api.albums.getGenres()
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
            const currentTrack = get().tracks.find(t => t.id === trackId)
            if (!currentTrack) return

            // 1. Toggle Protection: If rating is same as current, toggle to 0
            let newRating = rating
            if (currentTrack.rating === rating) {
                newRating = 0
            }

            // 2. Universal Rule: If rating > 0 -> Loved = true. If rating == 0 -> Loved = false
            const newLoved = newRating > 0 ? true : false

            // Optimistic update
            const tracks = get().tracks.map(t =>
                t.id === trackId ? { ...t, rating: newRating, loved: newLoved } : t
            )
            set({ tracks })

            // Update Player Store
            usePlayer.getState().updateTrack(trackId, { rating: newRating, loved: newLoved })

            // Call IPC
            await window.electron.ipcRenderer.invoke('tracks:updateMetadata', trackId, currentTrack.filePath, newRating, newLoved)
        } catch (error) {
            console.error('Failed to rate track:', error)
        }
    },

    rateAlbum: async (albumId, rating) => {
        try {
            const currentAlbum = get().albums.find(a => a.id === albumId)
            if (!currentAlbum) return

            // 1. Toggle Protection
            let newRating = rating
            if (currentAlbum.rating === rating) {
                newRating = 0
            }

            // 2. Love Sync
            const newLoved = newRating > 0 ? true : false
            const lovedChanged = newLoved !== currentAlbum.loved

            // Optimistic update
            const albums = get().albums.map(a =>
                a.id === albumId ? { ...a, rating: newRating, loved: newLoved } : a
            )
            set({ albums })

            // IPC Calls
            await window.api.albums.rate(albumId, newRating)

            if (lovedChanged) {
                if (window.api?.library?.toggleAlbumLoved) {
                    await window.api.library.toggleAlbumLoved(albumId)
                }
            }
        } catch (error) {
            console.error('Failed to rate album:', error)
        }
    },

    toggleLoved: async (trackId) => {
        try {
            const track = get().tracks.find(t => t.id === trackId)
            if (!track) return

            const newLoved = !track.loved
            let newRating = track.rating

            // Universal Rule: If un-loving, we must also clear rating (0)
            // Because "Rated track must have heart". So "No Heart" -> "No Rating".
            if (!newLoved) {
                newRating = 0
            }

            // Optimistic update
            const tracks = get().tracks.map(t =>
                t.id === trackId ? { ...t, loved: newLoved, rating: newRating } : t
            )
            set({ tracks })

            // Update Player Store
            usePlayer.getState().updateTrack(trackId, { loved: newLoved, rating: newRating })

            await window.electron.ipcRenderer.invoke('tracks:updateMetadata', trackId, track.filePath, newRating, newLoved)
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
            const album = get().albums.find(a => a.id === albumId)
            if (!album) return

            const newLoved = !album.loved
            let newRating = album.rating

            // Universal Rule: Unlove -> Unrate
            let ratingChanged = false
            if (!newLoved && newRating > 0) {
                newRating = 0
                ratingChanged = true
            }

            // Optimistic update
            const albums = get().albums.map(a =>
                a.id === albumId ? { ...a, loved: newLoved, rating: newRating } : a
            )
            set({ albums })

            if (window.api?.library?.toggleAlbumLoved) {
                await window.api.library.toggleAlbumLoved(albumId)
            } else {
                console.warn('window.api.library.toggleAlbumLoved is not available')
            }

            if (ratingChanged) {
                await window.api.albums.rate(albumId, 0)
            }
        } catch (error) {
            console.error('Failed to toggle album loved:', error)
        }
    },

    toggleArtistLoved: async (artistId) => {
        try {
            const artist = get().artists.find(a => a.id === artistId)
            if (!artist) return

            const newLoved = !artist.loved

            // Optimistic update
            set(state => ({
                artists: state.artists.map(a => a.id === artistId ? { ...a, loved: newLoved } : a)
            }))

            if (window.api?.library?.toggleArtistLoved) {
                await window.api.library.toggleArtistLoved(artistId, newLoved)
            } else {
                console.warn('window.api.library.toggleArtistLoved is not available')
            }
        } catch (error) {
            console.error('Failed to toggle artist loved:', error)
        }
    },

    reanalyzeLibrary: async () => {
        try {
            console.log('Starting full library re-analysis...')
            // 1. Get all folders from the other store
            // We can't directly access useFolders from here easily without circular dependencies or props, 
            // but we can call an IPC to get folders or expect them to be passed.
            // Actually, we can just call a new IPC method 'library:reanalyze' that handles it all on the backend.

            if (window.api?.library?.reanalyze) {
                await window.api.library.reanalyze()
            } else {
                console.warn('Full re-analysis IPC not found, falling back to aggregation only')
                await window.api.albums.aggregate()
            }

            await get().loadAlbums()
            await get().loadGenres()
            await get().loadTracks()
        } catch (error) {
            console.error('Failed to reanalyze library:', error)
        }
    },

    setScanProgress: (scanProgress) => set({ scanProgress }),

    updateTrack: (trackId, updates) => {
        set(state => ({
            tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
        }))
    },

    initialize: () => {
        // Initial load
        get().loadTracks()
        get().loadAlbums()
        get().loadArtists()
        get().loadGenres()

        // Listen for scanner events
        const removeProgress = window.api.scanner.onProgress((progress) => {
            get().setScanProgress(progress)
        })

        const removeComplete = window.api.scanner.onComplete(async () => {
            console.log('Scan complete - refreshing library...')
            await get().loadTracks()
            await get().loadAlbums()
            await get().loadGenres()
            set({ scanProgress: { ...get().scanProgress, isScanning: false } })
        })

        const removeFileAdded = window.api.scanner.onFileAdded(async () => {
            // Debounce or just reload? For simple case just reload
            await get().loadTracks()
            await get().loadAlbums()
        })

        const removeFileChanged = window.api.scanner.onFileChanged(async () => {
            await get().loadTracks()
            await get().loadAlbums()
        })

        const removeFileRemoved = window.api.scanner.onFileRemoved(async () => {
            await get().loadTracks()
            await get().loadAlbums()
        })

        // Return cleanup function
        return () => {
            removeProgress()
            removeComplete()
            removeFileAdded()
            removeFileChanged()
            removeFileRemoved()
        }
    }
}))
