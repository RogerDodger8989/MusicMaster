import { ElectronAPI } from '@electron-toolkit/preload'
import type { MusicFolder, Track, Album, ScanProgress } from '../main/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      folders: {
        getAll: () => Promise<MusicFolder[]>
        add: (folderPath: string, watchEnabled: boolean) => Promise<MusicFolder>
        remove: (folderId: string) => Promise<void>
        updateWatch: (folderId: string, watchEnabled: boolean) => Promise<void>
        browse: () => Promise<string | null>
      }
      scanner: {
        start: (folderId: string, folderPath: string) => Promise<void>
        getProgress: () => Promise<ScanProgress>
        onProgress: (callback: (progress: ScanProgress) => void) => () => void
        onComplete: (callback: (progress: ScanProgress) => void) => () => void
        onFileAdded: (callback: (filePath: string) => void) => () => void
        onFileChanged: (callback: (filePath: string) => void) => () => void
        onFileRemoved: (callback: (filePath: string) => void) => () => void
      }
      tracks: {
        getAll: () => Promise<Track[]>
        getCoverBufferByAlbum: (albumId: string) => Promise<{ data: Buffer, format: string } | null>
      }
      albums: {
        getAll: () => Promise<Album[]>
        getGenres: () => Promise<Array<{ genre: string; count: number }>>
        aggregate: () => Promise<boolean>
        rate: (id: string, rating: number) => Promise<void>
        getById: (id: string) => Promise<Album | null>
      }
      library: {
        reset: () => Promise<boolean>
        reanalyze: () => Promise<void>
        search: (query: string) => Promise<any>
        getArtists: () => Promise<any[]>
        toggleAlbumLoved: (id: string) => Promise<void>
        toggleArtistLoved: (id: string, loved: boolean) => Promise<void>
        getSimilarArtists: (artist: string) => Promise<{ name: string; image: string; match: string }[]>
      }
      util: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}
