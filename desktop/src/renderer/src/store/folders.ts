import { create } from 'zustand'
import type { MusicFolder } from '../types'
import { useLibrary } from './library'

interface FoldersStore {
    folders: MusicFolder[]
    isLoading: boolean
    error: string | null

    // Actions
    loadFolders: () => Promise<void>
    addFolder: (folderPath: string, watchEnabled: boolean) => Promise<void>
    removeFolder: (folderId: string) => Promise<void>
    updateFolderWatch: (folderId: string, watchEnabled: boolean) => Promise<void>
    browseFolder: () => Promise<string | null>
}

export const useFolders = create<FoldersStore>((set) => ({
    folders: [],
    isLoading: false,
    error: null,

    loadFolders: async () => {
        set({ isLoading: true, error: null })
        try {
            const folders = await window.api.folders.getAll()
            set({ folders, isLoading: false })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    addFolder: async (folderPath: string, watchEnabled: boolean) => {
        set({ isLoading: true, error: null })
        try {
            const newFolder = await window.api.folders.add(folderPath, watchEnabled)
            set((state) => ({
                folders: [...state.folders, newFolder],
                isLoading: false
            }))
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    removeFolder: async (folderId: string) => {
        set({ isLoading: true, error: null })
        try {
            await window.api.folders.remove(folderId)
            set((state) => ({
                folders: state.folders.filter((f) => f.id !== folderId),
                isLoading: false
            }))

            // Refresh library data
            const library = useLibrary.getState()
            await library.loadTracks()
            await library.loadAlbums()
            await library.loadGenres()
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    updateFolderWatch: async (folderId: string, watchEnabled: boolean) => {
        try {
            await window.api.folders.updateWatch(folderId, watchEnabled)
            set((state) => ({
                folders: state.folders.map((f) =>
                    f.id === folderId ? { ...f, watchEnabled } : f
                )
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    browseFolder: async () => {
        try {
            return await window.api.folders.browse()
        } catch (error) {
            set({ error: String(error) })
            return null
        }
    }
}))
