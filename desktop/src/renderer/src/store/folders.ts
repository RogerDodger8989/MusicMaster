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
  scanFolder: (folderId: string) => Promise<void>
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

  addFolder: async (folderPath: string, watchEnabled: boolean) => {
    set({ isLoading: true, error: null })
    try {
      await client.addFolder(folderPath, watchEnabled)

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
      await client.updateFolderWatch(folderId, watchEnabled)
      set((state) => ({
        folders: state.folders.map((f) => (f.id === folderId ? { ...f, watchEnabled } : f))
      }))
    } catch (error) {
      set({ error: String(error) })
    }
  },

  scanFolder: async (folderId: string) => {
    try {
      await client.scanFolder(folderId)
      // Reload folders to get updated track count and lastScanned
      const folders = await client.getFolders()
      set({ folders })
      // Refresh library data
      const library = useLibrary.getState()
      await library.loadTracks()
      await library.loadAlbums()
      await library.loadGenres()
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
      const path = prompt(
        'Please enter the full path to your music folder:\n(Note: The server must have access to this path)'
      )
      return path || null
    } catch (error) {
      set({ error: String(error) })
      return null
    }
  }
}))
