import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { MusicFolder, Track, ScanProgress, Album } from '../main/types'

// Custom APIs for renderer
const api = {
  // Music Folders
  folders: {
    getAll: (): Promise<MusicFolder[]> => ipcRenderer.invoke('folders:getAll'),
    add: (folderPath: string, watchEnabled: boolean): Promise<MusicFolder> =>
      ipcRenderer.invoke('folders:add', folderPath, watchEnabled),
    remove: (folderId: string): Promise<void> => ipcRenderer.invoke('folders:remove', folderId),
    updateWatch: (folderId: string, watchEnabled: boolean): Promise<void> =>
      ipcRenderer.invoke('folders:updateWatch', folderId, watchEnabled),
    browse: (): Promise<string | null> => ipcRenderer.invoke('folders:browse')
  },

  // Scanner
  scanner: {
    start: (folderId: string, folderPath: string): Promise<void> =>
      ipcRenderer.invoke('scanner:start', folderId, folderPath),
    getProgress: (): Promise<ScanProgress> => ipcRenderer.invoke('scanner:getProgress'),
    onProgress: (callback: (progress: ScanProgress) => void) => {
      const listener = (_: any, progress: ScanProgress): void => callback(progress)
      ipcRenderer.on('scanner:progress', listener)
      return () => ipcRenderer.removeListener('scanner:progress', listener)
    },
    onComplete: (callback: (progress: ScanProgress) => void) => {
      const listener = (_: any, progress: ScanProgress): void => callback(progress)
      ipcRenderer.on('scanner:complete', listener)
      return () => ipcRenderer.removeListener('scanner:complete', listener)
    },
    onFileAdded: (callback: (filePath: string) => void) => {
      const listener = (_: any, filePath: string): void => callback(filePath)
      ipcRenderer.on('scanner:fileAdded', listener)
      return () => ipcRenderer.removeListener('scanner:fileAdded', listener)
    },
    onFileChanged: (callback: (filePath: string) => void) => {
      const listener = (_: any, filePath: string): void => callback(filePath)
      ipcRenderer.on('scanner:fileChanged', listener)
      return () => ipcRenderer.removeListener('scanner:fileChanged', listener)
    },
    onFileRemoved: (callback: (filePath: string) => void) => {
      const listener = (_: any, filePath: string): void => callback(filePath)
      ipcRenderer.on('scanner:fileRemoved', listener)
      return () => ipcRenderer.removeListener('scanner:fileRemoved', listener)
    }
  },

  // Tracks
  tracks: {
    getAll: (): Promise<Track[]> => ipcRenderer.invoke('tracks:getAll'),
    getTracksByAlbum: (name: string, artist: string): Promise<Track[]> =>
      ipcRenderer.invoke('tracks:getTracksByAlbum', name, artist),
    getCoverBufferByAlbum: (albumId: string): Promise<{ data: Buffer, format: string } | null> =>
      ipcRenderer.invoke('tracks:getCoverBufferByAlbum', albumId),
    rate: (trackId: string, filePath: string, rating: number): Promise<void> =>
      ipcRenderer.invoke('tracks:rate', trackId, filePath, rating),
    updateMetadata: (trackId: string, filePath: string, rating: number, loved: boolean): Promise<boolean> =>
      ipcRenderer.invoke('tracks:updateMetadata', trackId, filePath, rating, loved)
  },

  // Albums
  albums: {
    getAll: (): Promise<Album[]> => ipcRenderer.invoke('albums:getAll'),
    getGenres: (): Promise<Array<{ genre: string; count: number }>> => ipcRenderer.invoke('albums:getGenres'),
    aggregate: (): Promise<boolean> => ipcRenderer.invoke('albums:aggregate'),
    rate: (id: string, rating: number): Promise<void> => ipcRenderer.invoke('albums:rate', id, rating),
    getById: (id: string): Promise<Album | null> => ipcRenderer.invoke('albums:getById', id)
  },

  // Library
  library: {
    reset: (): Promise<boolean> => ipcRenderer.invoke('library:reset'),
    reanalyze: (): Promise<void> => ipcRenderer.invoke('library:reanalyze'),
    search: (query: string): Promise<any> => ipcRenderer.invoke('library:search', query),
    getArtists: (): Promise<any[]> => ipcRenderer.invoke('library:getArtists'),
    toggleAlbumLoved: (id: string): Promise<void> => ipcRenderer.invoke('library:toggleAlbumLoved', id),
    toggleArtistLoved: (id: string, loved: boolean): Promise<void> => ipcRenderer.invoke('library:toggleArtistLoved', id, loved),
    getSimilarArtists: (artist: string): Promise<{ name: string; image: string; match: string }[]> => ipcRenderer.invoke('library:getSimilarArtists', artist)
  },

  // Utils
  util: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('util:openExternal', url),
    showItemInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke('util:showItemInFolder', filePath)
  },

  // Settings
  settings: {
    getAll: (): Promise<Record<string, any>> => ipcRenderer.invoke('settings:getAll'),
    save: (key: string, value: any): Promise<boolean> => ipcRenderer.invoke('settings:save', key, value)
  },

  // Player Persistence
  player: {
    loadSession: (): Promise<any> => ipcRenderer.invoke('player:loadSession'),
    saveSession: (session: any): Promise<boolean> => ipcRenderer.invoke('player:saveSession', session)
  },

  // Playlists
  playlists: {
    getAll: (): Promise<any[]> => ipcRenderer.invoke('playlists:getAll'),
    create: (name: string, trackIds: string[]): Promise<string> => ipcRenderer.invoke('playlists:create', name, trackIds),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('playlists:delete', id),
    addTrack: (playlistId: string, trackId: string): Promise<boolean> => ipcRenderer.invoke('playlists:addTrack', playlistId, trackId),
    removeTrack: (playlistId: string, trackId: string, position: number): Promise<boolean> =>
      ipcRenderer.invoke('playlists:removeTrack', playlistId, trackId, position),
    rename: (id: string, name: string): Promise<boolean> => ipcRenderer.invoke('playlists:rename', id, name)
  },

  scrobble: {
    recordPlay: (trackId: string): Promise<boolean> => ipcRenderer.invoke('scrobble:recordPlay', trackId),
    getPending: (): Promise<any[]> => ipcRenderer.invoke('scrobble:getPending'),
    submitToLastFM: (scrobbleId: string, sessionKey: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:submitToLastFM', scrobbleId, sessionKey),
    submitToListenBrainz: (scrobbleId: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:submitToListenBrainz', scrobbleId),
    getPlayCount: (trackId: string): Promise<number> => ipcRenderer.invoke('scrobble:getPlayCount', trackId),
    updateLastFmKey: (key: string): Promise<boolean> => ipcRenderer.invoke('scrobble:updateLastFmKey', key),
    updateLastFmSecret: (secret: string): Promise<boolean> => ipcRenderer.invoke('scrobble:updateLastFmSecret', secret),
    updateListenBrainzToken: (token: string): Promise<boolean> => ipcRenderer.invoke('scrobble:updateListenBrainzToken', token),
    getLastFmAuthToken: (): Promise<{ token: string; authUrl: string } | null> => ipcRenderer.invoke('scrobble:getLastFmAuthToken'),
    getLastFmSession: (token: string): Promise<string | null> => ipcRenderer.invoke('scrobble:getLastFmSession', token),
    syncPlayCount: (trackId: string, lastfmUsername?: string, listenbrainzUsername?: string): Promise<{ trackId: string; playCount: number; sources: any }> =>
      ipcRenderer.invoke('scrobble:syncPlayCount', trackId, lastfmUsername, listenbrainzUsername),
    syncAllPlayCounts: (lastfmUsername?: string, listenbrainzUsername?: string, writeToFile?: boolean): Promise<{ total: number; synced: number; errors: string[] }> =>
      ipcRenderer.invoke('scrobble:syncAllPlayCounts', lastfmUsername, listenbrainzUsername, writeToFile),
    exportPlayCountsCSV: (): Promise<string | null> => ipcRenderer.invoke('scrobble:exportPlayCountsCSV'),
    syncAllListenBrainz: (username: string): Promise<{ total: number; updated: number }> =>
      ipcRenderer.invoke('scrobble:syncAllListenBrainz', username),
    onSyncProgress: (callback: (progress: { current: number; total: number; trackName: string; percentage: number }) => void) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('scrobble:syncProgress', listener)
      return () => ipcRenderer.removeListener('scrobble:syncProgress', listener)
    },
    onListenBrainzSyncProgress: (callback: (progress: { phase: 'fetching' | 'matching'; fetched?: number; page?: number; current?: number; total?: number }) => void) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('scrobble:listenBrainzSyncProgress', listener)
      return () => ipcRenderer.removeListener('scrobble:listenBrainzSyncProgress', listener)
    }
  }
}

// Expose APIs to renderer
try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
  console.log('Preload: APIs exposed successfully')
} catch (error) {
  console.error('Preload: Error exposing APIs', error)
}
