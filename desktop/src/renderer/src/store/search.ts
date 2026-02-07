import { create } from 'zustand'
import { Artist, Album, Track } from '../api/client'

interface SearchResults {
    artists: Artist[]
    albums: Album[]
    tracks: Track[]
    playlists: any[]
}

interface SearchStore {
    query: string
    results: SearchResults
    isSearching: boolean
    isOpen: boolean

    // Actions
    setQuery: (query: string) => void
    setIsOpen: (isOpen: boolean) => void
    performSearch: () => Promise<void>
}

export const useSearch = create<SearchStore>((set, get) => ({
    query: '',
    results: {
        artists: [],
        albums: [],
        tracks: [],
        playlists: []
    },
    isSearching: false,
    isOpen: false,

    setQuery: (query) => {
        set({ query })
        if (query.trim().length >= 2) {
            get().performSearch()
        } else {
            set({
                results: {
                    artists: [],
                    albums: [],
                    tracks: [],
                    playlists: []
                }
            })
        }
    },

    setIsOpen: (isOpen) => set({ isOpen }),

    performSearch: async () => {
        const { query } = get()
        if (query.trim().length < 2) return

        set({ isSearching: true })
        try {
            const results = await client.search(query)
            set({ results })
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            set({ isSearching: false })
        }
    }
}))
