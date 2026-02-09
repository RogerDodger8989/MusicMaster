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
        getCoverBufferByAlbum: (albumId: string) => Promise<{ data: Buffer; format: string } | null>
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
        getSimilarArtists: (
          artist: string
        ) => Promise<{ name: string; image: string; match: string }[]>
      }
      util: {
        openExternal: (url: string) => Promise<void>
      }
      settings: {
        getAll: () => Promise<Record<string, any>>
        save: (key: string, value: any) => Promise<boolean>
      }
      player: {
        loadSession: () => Promise<any>
        saveSession: (session: any) => Promise<boolean>
      }
      playlists: {
        getAll: () => Promise<any[]>
        create: (name: string, trackIds: string[]) => Promise<string>
        delete: (id: string) => Promise<boolean>
        addTrack: (playlistId: string, trackId: string) => Promise<boolean>
        removeTrack: (playlistId: string, trackId: string, position: number) => Promise<boolean>
        rename: (id: string, name: string) => Promise<boolean>
      }
      scrobble: {
        recordPlay: (trackId: string) => Promise<boolean>
        getPending: () => Promise<any[]>
        submitToLastFM: (scrobbleId: string, sessionKey: string) => Promise<boolean>
        submitToListenBrainz: (scrobbleId: string) => Promise<boolean>
        getPlayCount: (trackId: string) => Promise<number>
        updateLastFmKey: (key: string) => Promise<boolean>
        updateLastFmSecret: (secret: string) => Promise<boolean>
        updateListenBrainzToken: (token: string) => Promise<boolean>
        getLastFmAuthToken: () => Promise<{ token: string; authUrl: string } | null>
        getLastFmSession: (token: string) => Promise<string | null>
        syncPlayCount: (
          trackId: string,
          lastfmUsername?: string,
          listenbrainzUsername?: string
        ) => Promise<{ trackId: string; playCount: number; sources: any }>
        syncAllPlayCounts: (
          lastfmUsername?: string,
          listenbrainzUsername?: string,
          writeToFile?: boolean
        ) => Promise<{ total: number; synced: number; errors: string[] }>
        exportPlayCountsCSV: () => Promise<string | null>
        importListenBrainzJSON: (filePath?: string) => Promise<{
          canceled: boolean
          filePath?: string
          totalListens?: number
          totalTracks?: number
          matchedTracks?: number
          updatedTracks?: number
          matchedByMbid?: number
          matchedByText?: number
        }>
        onSyncProgress: (
          callback: (progress: {
            current: number
            total: number
            trackName: string
            percentage: number
          }) => void
        ) => () => void
        onListenBrainzSyncProgress: (
          callback: (progress: {
            phase: string
            fetched?: number
            page?: number
            current?: number
            total?: number
          }) => void
        ) => () => void
      }
      metadata: {
        search: (artist: string, title: string, album?: string) => Promise<any[]>
        searchAlbums: (artist: string, album: string) => Promise<any[]>
        getArtistDetails: (artistId: string) => Promise<any>
        getAlbumDetails: (albumId: string) => Promise<any>
        exportMissingCSV: (tracks: any[]) => Promise<string | null>
        updateArtistFacts: (id: string, facts: any) => Promise<boolean>
      }
      musicbrainz: {
        getCoverage: () => Promise<{
          totalTracks: number
          tracksWithMBID: number
          tracksWithoutMBID: number
          coveragePercentage: number
          totalAlbums: number
          albumsWithMBID: number
          albumsWithoutMBID: number
        }>
        searchTrack: (params: {
          artist: string
          title: string
          album?: string
          duration?: number
          isrc?: string
        }) => Promise<{
          mbid: string
          matchScore: number
          confidence: 'PERFECT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MISMATCH'
          recording: any
        } | null>
        getRecordingDetails: (recordingMBID: string) => Promise<any>
        getAcousticBrainz: (recordingMBID: string) => Promise<any>
        enhanceTrack: (
          trackId: number,
          writeToFile?: boolean
        ) => Promise<{
          success: boolean
          confidence?: string
          matchScore?: number
          mbid?: string
          reason?: string
        }>
        enhanceTracks: (
          trackIds: number[],
          writeToFiles?: boolean
        ) => Promise<{
          total: number
          enhanced: number
          failed: number
          noMatch: number
          alreadyHasMBID: number
        }>
        enhanceLibrary: (writeToFiles?: boolean) => Promise<{
          total: number
          enhanced: number
          failed: number
          noMatch: number
          alreadyHasMBID: number
        }>
        getCandidates: (trackId: number) => Promise<{
          track: {
            id: number
            title: string
            artist: string
            album: string
            duration: number
          }
          candidates: Array<{
            recordingMbid: string
            releaseMbid: string
            releaseGroupMbid?: string
            artistMbid?: string
            artistName: string
            albumName: string
            year?: number
            country?: string
            format?: string
            label?: string
            confidence: number
            tracks: Array<{
              title: string
              duration: number
              expectedDuration: number
              position: number
            }>
          }>
        }>
        applyCandidate: (
          trackId: number,
          candidate: any,
          writeToFile?: boolean
        ) => Promise<{
          success: boolean
          mbid?: string
          bpm?: number
          key?: string
        }>
        syncToFiles: (trackIds?: number[]) => Promise<{
          success: number
          failed: number
          skipped: number
        }>
        refreshMetadata: (trackIds: number[]) => Promise<{
          total: number
          refreshed: number
          failed: number
          noMBID: number
        }>
        onEnhanceProgress: (
          callback: (progress: {
            current: number
            total: number
            trackId: number
            trackName: string
          }) => void
        ) => () => void
        onSyncProgress: (
          callback: (progress: { current: number; total: number; trackPath: string }) => void
        ) => () => void
        onRefreshProgress: (
          callback: (progress: {
            current: number
            total: number
            trackId: number
            trackName: string
          }) => void
        ) => () => void
      }
      enrichment: {
        start: () => Promise<{ started: boolean }>
        getStatus: () => Promise<{
          status: string
          album_mbid?: string | null
          performers_fetched?: number
          acousticbrainz_fetched?: number
          completed_at?: string | null
        }>
        getHistory: (limit?: number) => Promise<any[]>
        onProgress: (
          callback: (progress: {
            totalAlbums: number
            processedAlbums: number
            totalTracks: number
            enrichedTracks: number
            performersAdded: number
            acousticbrainzAdded: number
            errors: string[]
          }) => void
        ) => () => void
        onCompleted: (callback: (result: any) => void) => () => void
        onError: (callback: (error: string) => void) => () => void
      }    }
  }
}