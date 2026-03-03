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
    scan: (folderId: string): Promise<void> => ipcRenderer.invoke('folders:scan', folderId),
    browse: (type?: 'file' | 'folder'): Promise<string | null> => ipcRenderer.invoke('folders:browse', type)
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
    getById: (id: string): Promise<Track | null> => ipcRenderer.invoke('tracks:getById', id),
    getTracksByAlbum: (name: string, artist: string): Promise<Track[]> =>
      ipcRenderer.invoke('tracks:getTracksByAlbum', name, artist),
    getCoverBufferByAlbum: (albumId: string): Promise<{ data: Buffer; format: string } | null> =>
      ipcRenderer.invoke('tracks:getCoverBufferByAlbum', albumId),
    rate: (trackId: string, filePath: string, rating: number): Promise<void> =>
      ipcRenderer.invoke('tracks:rate', trackId, filePath, rating),
    updateMetadata: (
      trackId: string,
      filePath: string,
      rating: number,
      loved: boolean,
      mbData?: any
    ): Promise<boolean> =>
      ipcRenderer.invoke('tracks:updateMetadata', trackId, filePath, rating, loved, mbData),
    getMostPlayed: (limit?: number): Promise<Track[]> =>
      ipcRenderer.invoke('tracks:getMostPlayed', limit),
    getInfo: (id: string): Promise<any> => ipcRenderer.invoke('tracks:getInfo', id),
    getCoverage: (): Promise<any> => ipcRenderer.invoke('tracks:getCoverage'),
    getArtistTop: (artist: string, limit?: number): Promise<any[]> => ipcRenderer.invoke('tracks:getArtistTop', artist, limit),
    bulkUpdate: (trackIds: string[], data: any): Promise<void> =>
      ipcRenderer.invoke('tracks:bulkUpdate', trackIds, data),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('tracks:delete', id),
    getSimilar: (id: string): Promise<Track[]> => ipcRenderer.invoke('tracks:getSimilar', id)
  },

  // Albums
  albums: {
    getAll: (): Promise<Album[]> => ipcRenderer.invoke('albums:getAll'),
    getGenres: (): Promise<Array<{ genre: string; count: number }>> =>
      ipcRenderer.invoke('albums:getGenres'),
    aggregate: (): Promise<boolean> => ipcRenderer.invoke('albums:aggregate'),
    rate: (id: string, rating: number): Promise<void> =>
      ipcRenderer.invoke('albums:rate', id, rating),
    getById: (id: string): Promise<Album | null> => ipcRenderer.invoke('albums:getById', id),
    update: (id: string, updates: Partial<Album>): Promise<void> =>
      ipcRenderer.invoke('albums:update', id, updates),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('albums:delete', id),
    getPerformers: (id: string): Promise<any[]> => ipcRenderer.invoke('albums:getPerformers', id),
    pasteArtwork: (id: string, imageBase64: string): Promise<{ path: string }> =>
      ipcRenderer.invoke('albums:pasteArtwork', id, imageBase64)
  },

  // Library
  library: {
    reset: (): Promise<boolean> => ipcRenderer.invoke('library:reset'),
    reanalyze: (): Promise<void> => ipcRenderer.invoke('library:reanalyze'),
    search: (query: string): Promise<any> => ipcRenderer.invoke('library:search', query),
    getArtists: (): Promise<any[]> => ipcRenderer.invoke('library:getArtists'),
    toggleAlbumLoved: (id: string): Promise<void> =>
      ipcRenderer.invoke('library:toggleAlbumLoved', id),
    toggleArtistLoved: (id: string, loved: boolean): Promise<void> =>
      ipcRenderer.invoke('library:toggleArtistLoved', id, loved),
    getSimilarArtists: (
      artist: string
    ): Promise<{ name: string; image: string; match: string }[]> =>
      ipcRenderer.invoke('library:getSimilarArtists', artist),
    tagAlbumMetadata: (albumId: string, mbAlbumId: string): Promise<number> =>
      ipcRenderer.invoke('library:tagAlbumMetadata', albumId, mbAlbumId),
    updateArtist: (id: string, updates: Partial<any>): Promise<void> =>
      ipcRenderer.invoke('library:updateArtist', id, updates)
  },

  // TIDAL REMOVED

  // Utils
  util: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('util:openExternal', url),
    showItemInFolder: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('util:showItemInFolder', filePath)
  },

  // Settings
  settings: {
    getAll: (): Promise<Record<string, any>> => ipcRenderer.invoke('settings:getAll'),
    save: (key: string, value: any): Promise<boolean> =>
      ipcRenderer.invoke('settings:save', key, value)
  },

  // Player Persistence
  player: {
    loadSession: (): Promise<any> => ipcRenderer.invoke('player:loadSession'),
    saveSession: (session: any): Promise<boolean> =>
      ipcRenderer.invoke('player:saveSession', session),
    getSession: (): Promise<any> => ipcRenderer.invoke('player:getSession'),
    updateThumbarButtons: (isPlaying: boolean): Promise<boolean> =>
      ipcRenderer.invoke('player:updateThumbarButtons', isPlaying),
    onCommand: (callback: (command: 'togglePlay' | 'prev' | 'next') => void) => {
      const listener = (_: any, command: any): void => callback(command)
      ipcRenderer.on('player:command', listener)
      return () => ipcRenderer.removeListener('player:command', listener)
    }
  },

  // Playlists
  playlists: {
    getAll: (): Promise<any[]> => ipcRenderer.invoke('playlists:getAll'),
    create: (name: string, trackIds: string[]): Promise<string> =>
      ipcRenderer.invoke('playlists:create', name, trackIds),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('playlists:delete', id),
    add: (playlistId: string, trackId: string): Promise<boolean> =>
      ipcRenderer.invoke('playlists:add', playlistId, trackId),
    remove: (playlistId: string, trackId: string, position: number): Promise<boolean> =>
      ipcRenderer.invoke('playlists:remove', playlistId, trackId, position),
    rename: (id: string, name: string): Promise<boolean> =>
      ipcRenderer.invoke('playlists:rename', id, name),
    removeById: (id: string, trackId: string): Promise<void> =>
      ipcRenderer.invoke('playlists:removeById', id, trackId),
    reorder: (id: string, trackIds: string[]): Promise<void> =>
      ipcRenderer.invoke('playlists:reorder', id, trackIds)
  },

  // Smart Playlists
  smartplaylists: {
    getAll: (): Promise<any[]> => ipcRenderer.invoke('smartplaylists:getAll'),
    getById: (id: string): Promise<any> => ipcRenderer.invoke('smartplaylists:getById', id),
    create: (data: any): Promise<any> => ipcRenderer.invoke('smartplaylists:create', data),
    update: (id: string, data: any): Promise<any> => ipcRenderer.invoke('smartplaylists:update', id, data),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('smartplaylists:delete', id),
    resolve: (id: string): Promise<{ tracks: any[]; total: number }> => ipcRenderer.invoke('smartplaylists:resolve', id),
    preview: (data: any): Promise<{ tracks: any[]; total: number }> => ipcRenderer.invoke('smartplaylists:preview', data)
  },

  scrobble: {
    recordPlay: (trackId: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:recordPlay', trackId),
    getPending: (): Promise<any[]> => ipcRenderer.invoke('scrobble:getPending'),
    submitToLastFM: (scrobbleId: string, sessionKey: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:submitToLastFM', scrobbleId, sessionKey),
    submitToListenBrainz: (scrobbleId: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:submitToListenBrainz', scrobbleId),
    getPlayCount: (trackId: string): Promise<number> =>
      ipcRenderer.invoke('scrobble:getPlayCount', trackId),
    getSyncStatus: (): Promise<any> => ipcRenderer.invoke('scrobble:getSyncStatus'),
    updateLastFmKey: (key: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:updateLastFmKey', key),
    updateLastFmSecret: (secret: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:updateLastFmSecret', secret),
    updateListenBrainzToken: (token: string): Promise<boolean> =>
      ipcRenderer.invoke('scrobble:updateListenBrainzToken', token),
    getLastFmAuthToken: (): Promise<{ token: string; authUrl: string } | null> =>
      ipcRenderer.invoke('scrobble:getLastFmAuthToken'),
    getLastFmSession: (token: string): Promise<string | null> =>
      ipcRenderer.invoke('scrobble:getLastFmSession', token),
    syncPlayCount: (
      trackId: string,
      lastfmUsername?: string,
      listenbrainzUsername?: string
    ): Promise<{ trackId: string; playCount: number; sources: any }> =>
      ipcRenderer.invoke('scrobble:syncPlayCount', trackId, lastfmUsername, listenbrainzUsername),
    syncAllPlayCounts: (
      lastfmUsername?: string,
      listenbrainzUsername?: string,
      writeToFile?: boolean
    ): Promise<{ total: number; synced: number; errors: string[] }> =>
      ipcRenderer.invoke(
        'scrobble:syncAllPlayCounts',
        lastfmUsername,
        listenbrainzUsername,
        writeToFile
      ),
    exportPlayCountsCSV: (): Promise<string | null> =>
      ipcRenderer.invoke('scrobble:exportPlayCountsCSV'),
    syncAllListenBrainz: (username: string): Promise<{ total: number; updated: number }> =>
      ipcRenderer.invoke('scrobble:syncAllListenBrainz', username),
    importListenBrainzJSON: (filePath?: string): Promise<{
      canceled: boolean
      filePath?: string
      totalListens?: number
      totalTracks?: number
      matchedTracks?: number
      updatedTracks?: number
      matchedByMbid?: number
      matchedByText?: number
    }> => ipcRenderer.invoke('scrobble:importListenBrainzJSON', filePath),
    onSyncProgress: (
      callback: (progress: {
        current: number
        total: number
        trackName: string
        percentage: number
      }) => void
    ) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('scrobble:syncProgress', listener)
      return () => ipcRenderer.removeListener('scrobble:syncProgress', listener)
    },
    onListenBrainzSyncProgress: (
      callback: (progress: {
        phase: 'fetching' | 'matching'
        fetched?: number
        page?: number
        current?: number
        total?: number
      }) => void
    ) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('scrobble:listenBrainzSyncProgress', listener)
      return () => ipcRenderer.removeListener('scrobble:listenBrainzSyncProgress', listener)
    },
    track: (artist: string, track: string, album?: string, duration?: number, timestamp?: number): Promise<void> =>
      ipcRenderer.invoke('scrobble:track', artist, track, album, duration, timestamp),
    updateNowPlaying: (artist: string, track: string, album?: string, duration?: number): Promise<void> =>
      ipcRenderer.invoke('scrobble:updateNowPlaying', artist, track, album, duration),
    sync: (lastfmUsername: string, listenbrainzUsername: string, writeToFile?: boolean): Promise<void> =>
      ipcRenderer.invoke('scrobble:sync', lastfmUsername, listenbrainzUsername, writeToFile),
    syncMusicBrainz: (): Promise<void> => ipcRenderer.invoke('scrobble:syncMusicBrainz')
  },

  // Metadata & MusicBrainz
  metadata: {
    search: (artist: string, title: string, album?: string): Promise<any[]> =>
      ipcRenderer.invoke('metadata:searchMusicBrainz', artist, title, album),
    searchAlbums: (artist: string, album: string): Promise<any[]> =>
      ipcRenderer.invoke('metadata:searchAlbumsMusicBrainz', artist, album),
    getArtistDetails: (artistId: string): Promise<any> =>
      ipcRenderer.invoke('metadata:getArtistDetails', artistId),
    getAlbumDetails: (albumId: string): Promise<any> =>
      ipcRenderer.invoke('metadata:getAlbumDetails', albumId),
    exportMissingCSV: (tracks: any[]): Promise<string | null> =>
      ipcRenderer.invoke('metadata:exportMissingCSV', tracks),
    updateArtistFacts: (id: string, facts: any): Promise<boolean> =>
      ipcRenderer.invoke('metadata:updateArtistFacts', id, facts),
    getArtistSimilar: (artist: string): Promise<any[]> =>
      ipcRenderer.invoke('metadata:getArtistSimilar', artist),
    sync: (): Promise<void> => ipcRenderer.invoke('metadata:sync'),
    getSyncStatus: (): Promise<any> => ipcRenderer.invoke('metadata:getSyncStatus'),
    enhance: (writeToFiles?: boolean): Promise<void> => ipcRenderer.invoke('metadata:enhance', writeToFiles),
    getEnhanceStatus: (): Promise<any> => ipcRenderer.invoke('metadata:getEnhanceStatus'),
    getArtistMembers: (id: string): Promise<any[]> => ipcRenderer.invoke('metadata:getArtistMembers', id),
    previewMatchAlbum: (albumId: string, mbAlbumId: string): Promise<any[]> => ipcRenderer.invoke('metadata:previewMatchAlbum', albumId, mbAlbumId)
  },

  // MusicBrainz Enhancement
  musicbrainz: {
    getCoverage: () => ipcRenderer.invoke('musicbrainz:getCoverage'),
    searchTrack: (params: {
      artist: string
      title: string
      album?: string
      duration?: number
      isrc?: string
    }) => ipcRenderer.invoke('musicbrainz:searchTrack', params),
    getRecordingDetails: (recordingMBID: string) =>
      ipcRenderer.invoke('musicbrainz:getRecordingDetails', recordingMBID),
    getAcousticBrainz: (recordingMBID: string) =>
      ipcRenderer.invoke('musicbrainz:getAcousticBrainz', recordingMBID),
    enhanceTrack: (trackId: number, writeToFile = true) =>
      ipcRenderer.invoke('musicbrainz:enhanceTrack', trackId, writeToFile),
    enhanceTracks: (trackIds: number[], writeToFiles = true) =>
      ipcRenderer.invoke('musicbrainz:enhanceTracks', trackIds, writeToFiles),
    enhanceLibrary: (writeToFiles = true) =>
      ipcRenderer.invoke('musicbrainz:enhanceLibrary', writeToFiles),
    getCandidates: (trackId: number) => ipcRenderer.invoke('musicbrainz:getCandidates', trackId),
    applyCandidate: (
      trackId: number,
      candidate: any,
      options: { writeToFile?: boolean; selectedFields?: string[] } = {}
    ) => ipcRenderer.invoke('musicbrainz:applyCandidate', trackId, candidate, options),
    syncToFiles: (trackIds?: number[]) => ipcRenderer.invoke('musicbrainz:syncToFiles', trackIds),
    refreshMetadata: (trackIds: number[]) =>
      ipcRenderer.invoke('musicbrainz:refreshMetadata', trackIds),
    onEnhanceProgress: (
      callback: (progress: {
        current: number
        total: number
        trackId: number
        trackName: string
      }) => void
    ) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('musicbrainz:enhanceProgress', listener)
      return () => ipcRenderer.removeListener('musicbrainz:enhanceProgress', listener)
    },
    onSyncProgress: (
      callback: (progress: { current: number; total: number; trackPath: string }) => void
    ) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('musicbrainz:syncProgress', listener)
      return () => ipcRenderer.removeListener('musicbrainz:syncProgress', listener)
    },
    onRefreshProgress: (
      callback: (progress: {
        current: number
        total: number
        trackId: number
        trackName: string
      }) => void
    ) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('musicbrainz:refreshProgress', listener)
      return () => ipcRenderer.removeListener('musicbrainz:refreshProgress', listener)
    },
    tag: (albumId: string, mbAlbumId: string): Promise<number> =>
      ipcRenderer.invoke('musicbrainz:tag', albumId, mbAlbumId),
    apply: (trackId: string, candidate: any, options: any): Promise<void> =>
      ipcRenderer.invoke('musicbrainz:apply', trackId, candidate, options)
  },

  // Enrichment Worker (Phase 9)
  enrichment: {
    start: (): Promise<{ started: boolean }> => ipcRenderer.invoke('enrichment:start'),
    getStatus: (): Promise<any> => ipcRenderer.invoke('enrichment:getStatus'),
    getHistory: (limit?: number): Promise<any[]> => ipcRenderer.invoke('enrichment:getHistory', limit || 50),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, progress: any): void => callback(progress)
      ipcRenderer.on('enrichment:progress', listener)
      return () => ipcRenderer.removeListener('enrichment:progress', listener)
    },
    onCompleted: (callback: (result: any) => void) => {
      const listener = (_: any, result: any): void => callback(result)
      ipcRenderer.on('enrichment:completed', listener)
      return () => ipcRenderer.removeListener('enrichment:completed', listener)
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_: any, error: string): void => callback(error)
      ipcRenderer.on('enrichment:error', listener)
      return () => ipcRenderer.removeListener('enrichment:error', listener)
    },
    artists: (artistIds: string[]): Promise<void> => ipcRenderer.invoke('enrich:artists', artistIds)
  },
  // Window Controls
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    setSize: (width: number, height: number): Promise<void> =>
      ipcRenderer.invoke('window:setSize', width, height),
    setAlwaysOnTop: (flag: boolean): Promise<void> =>
      ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    setFullScreen: (flag: boolean): Promise<void> =>
      ipcRenderer.invoke('window:setFullScreen', flag)
  },

  // Cast
  cast: {
    startDiscovery: (): Promise<void> => ipcRenderer.invoke('cast:startDiscovery'),
    getDevices: (): Promise<any[]> => ipcRenderer.invoke('cast:getDevices'),
    connect: (deviceId: string, type: string): Promise<boolean> => ipcRenderer.invoke('cast:connect', deviceId, type),
    disconnect: (type: string): Promise<void> => ipcRenderer.invoke('cast:disconnect', type),
    play: (track: any, type: string): Promise<boolean> => ipcRenderer.invoke('cast:play', track, type),
    pause: (type: string): Promise<void> => ipcRenderer.invoke('cast:pause', type),
    resume: (type: string): Promise<void> => ipcRenderer.invoke('cast:resume', type),
    stop: (type: string): Promise<void> => ipcRenderer.invoke('cast:stop', type),
    seek: (time: number, type: string): Promise<void> => ipcRenderer.invoke('cast:seek', time, type),
    setVolume: (volume: number, type: string): Promise<void> => ipcRenderer.invoke('cast:setVolume', volume, type),
    onDevices: (callback: (devices: any[]) => void) => {
      const listener = (_: any, devices: any[]) => callback(devices)
      ipcRenderer.on('cast:devices', listener)
      return () => ipcRenderer.removeListener('cast:devices', listener)
    },
    onStatus: (callback: (status: any) => void) => {
      const listener = (_: any, status: any) => callback(status)
      ipcRenderer.on('cast:status', listener)
      return () => ipcRenderer.removeListener('cast:status', listener)
    }
  },

  // System
  system: {
    getDrives: (): Promise<any[]> => ipcRenderer.invoke('system:getDrives'),
    getDirectory: (path: string): Promise<any[]> => ipcRenderer.invoke('system:getDirectory', path)
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
