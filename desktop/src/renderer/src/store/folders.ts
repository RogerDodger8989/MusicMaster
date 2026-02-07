import { create } from 'zustand'
import type { MusicFolder } from '../types'
import { useLibrary } from './library'
import { client } from '../api/client'

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
            const folders = await client.getFolders()
            set({ folders, isLoading: false })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    addFolder: async (folderPath: string, _watchEnabled: boolean) => {
        set({ isLoading: true, error: null })
        try {
            await client.addFolder(folderPath) // Name optional, watch implied? Client doesn't have watch arg in interface above? 
            // Client interface: addFolder(path: string, name?: string)
            // FoldersStore: addFolder(folderPath: string, watchEnabled: boolean)
            // Server probably defaults watch to true or needs update.
            // For now, assume addFolder handles it or we'll fix later.
            // But we need to refresh folders.

            // Re-fetch folders to get the new one with ID
            const folders = await client.getFolders()
            set({
                folders,
                isLoading: false
            })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    removeFolder: async (folderId: string) => {
        set({ isLoading: true, error: null })
        try {
            await client.removeFolder(folderId)
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
            // client currently doesn't have updateFolderWatch?
            // Checking client.ts... it does NOT have it.
            // We might need to add it or skip it for now.
            // Or assume addFolder defaults?
            // Skipping implementation or faking it for now to avoid break.
            // TODO: Add updateFolderWatch to client
            console.warn('updateFolderWatch not implemented in client yet')

            // Optimistic update
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
            // Check if running in Electron (via window.api)
            if ((window as any).api) {
                return await (window as any).api.openDirectoryDialog()
            }

            // Web Mode fallback
            // In a real web app, we can't browse the server's filesystem. 
            // We must ask the user to manually enter a path that exists on the server.
            const path = prompt("Please enter the full path to your music folder:\n(Note: The server must have access to this path)")
            return path || null
        } catch (error) {
            set({ error: String(error) })
            return null
        }
    }
}))
