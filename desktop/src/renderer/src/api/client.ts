// Local type definitions to avoid relative import issues
// import { Album, Artist, Track, MusicFolder, ScanProgress } from '../../../../server/src/types'
// Note: We're importing types from server source. Ideally these should be in a shared package.
import { Album, Artist, Track, MusicFolder, ScanProgress } from '../types'

// Interface defining the contract for both Desktop and Server clients
export interface MusicClient {
  // Albums
  getAlbums(sort?: string, genre?: string): Promise<Album[]>
  getAlbum(id: string): Promise<Album | null>
  getAlbumPerformers(id: string): Promise<any[]>
  updateAlbum(id: string, updates: Partial<Album>): Promise<void>
  getGenres(): Promise<{ genre: string; count: number }[]>

  // Artists
  getArtists(): Promise<Artist[]>
  getArtist(id: string): Promise<Artist | null>
  updateArtist(id: string, updates: Partial<Artist>): Promise<void>

  // Tracks
  getTracks(filter?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]>
  getTrack(id: string): Promise<Track | null>
  updateTrack(id: string, updates: Partial<Track>): Promise<void>

  // Interactions
  rateTrack(id: string, rating: number): Promise<void>
  rateAlbum(id: string, rating: number): Promise<void>
  toggleTrackLoved(id: string, loved: boolean): Promise<void>
  toggleAlbumLoved(id: string, loved: boolean): Promise<void>
  toggleArtistLoved(id: string, loved: boolean): Promise<void>

  // Search
  search(query: string): Promise<{
    artists: Artist[]
    albums: Album[]
    tracks: Track[]
    playlists: any[]
  }>

  // Scanning
  startScan(folderId: string, path: string): Promise<void>
  getScanStatus(): Promise<ScanProgress>
  getFolders(): Promise<MusicFolder[]>
  addFolder(path: string, watchEnabled: boolean): Promise<void>
  updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void>
  scanFolder(folderId: string): Promise<void>
  removeFolder(id: string): Promise<void>

  // Playlists
  getPlaylists(): Promise<any[]>
  createPlaylist(name: string, trackIds: string[]): Promise<any>
  deletePlaylist(id: string): Promise<void>
  addToPlaylist(id: string, trackId: string): Promise<void>
  removeFromPlaylist(id: string, trackId: string, position: number): Promise<void>
  renamePlaylist(id: string, name: string): Promise<void>

  // Settings
  getSettings(): Promise<any>
  saveSetting(key: string, value: any): Promise<void>

  // Player
  getSession(): Promise<any>
  saveSession(session: any): Promise<void>

  // Scrobble & Auth
  scrobble(
    artist: string,
    track: string,
    album?: string,
    duration?: number,
    timestamp?: number
  ): Promise<void>
  updateNowPlaying(artist: string, track: string, album?: string, duration?: number): Promise<void>
  syncScrobble(
    lastfmUsername: string,
    listenbrainzUsername: string,
    writeToFile?: boolean
  ): Promise<void>
  getSyncStatus(): Promise<any>
  getLastFmAuthToken(): Promise<any>
  createLastFmSession(token: string): Promise<any>

  // Metadata
  syncMetadata(): Promise<void> // Sync DB to Files
  getFileSyncStatus(): Promise<any>
  enhanceLibrary(writeToFiles?: boolean): Promise<void> // Search MB & Update DB
  getEnhanceStatus(): Promise<any>
  getCoverage(): Promise<any>
  searchMetadata(artist: string, title?: string, album?: string): Promise<any[]>
  searchAlbums(artist: string, album: string): Promise<any[]>
  getArtistDetails(id: string): Promise<any>
  getArtistMembers(id: string): Promise<any[]>
  updateArtist(id: string, updates: any): Promise<void>
  getCandidates(trackId: string): Promise<{ candidates: any[] }>
  applyCandidate(trackId: string, candidate: any, options: { writeToFile: boolean; selectedFields?: string[] }): Promise<void>
  tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number>
  previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]>
  getSimilarArtists(artist: string): Promise<any[]>
  openExternal(url: string): Promise<void>

  // System
  getDrives(): Promise<any[]>
  getDirectory(path: string): Promise<any[]>

  // Media URLs
  getCoverUrl(id: string): string
  getArtistImageUrl(id: string): string
  getAudioUrl(id: string): string
}

// Implementation using window.api (Electron IPC) - Legacy/Fallback
export class DomClient implements MusicClient {
  private api: any

  constructor() {
    this.api = (window as any).api
  }

  async getAlbums(sort?: string, genre?: string): Promise<Album[]> {
    if (sort) return this.api.albums.getSorted(sort)
    if (genre) return this.api.albums.getByGenre(genre)
    return this.api.albums.getAll()
  }

  async getAlbum(id: string): Promise<Album | null> {
    return this.api.albums.getById(id)
  }

  async getAlbumPerformers(_id: string): Promise<any[]> {
    return []
  }

  async updateAlbum(id: string, updates: Partial<Album>): Promise<void> {
    if (updates.rating !== undefined) await this.api.albums.updateRating(id, updates.rating)
    if (updates.loved !== undefined) await this.api.albums.updateLoved(id, updates.loved)
  }

  async getGenres(): Promise<{ genre: string; count: number }[]> {
    return this.api.albums.getGenres()
  }

  async getArtists(): Promise<Artist[]> {
    return this.api.artists.getAll()
  }

  async getArtist(id: string): Promise<Artist | null> {
    return this.api.artists.getById ? this.api.artists.getById(id) : null
  }

  async updateArtist(id: string, updates: Partial<Artist>): Promise<void> {
    return this.api.artists.update(id, updates)
  }

  async getTracks(filter?: {
    folderId?: string
    albumId?: string
    artistId?: string
  }): Promise<Track[]> {
    if (filter?.folderId) return this.api.tracks.getByFolder(filter.folderId)
    if (filter?.albumId) return this.api.tracks.getByAlbum(filter.albumId)
    // If no filter, return all (assuming api supports it)
    return this.api.tracks.getAll()
  }

  async getTrack(id: string): Promise<Track | null> {
    return this.api.tracks.getById(id)
  }

  async updateTrack(id: string, updates: Partial<Track>): Promise<void> {
    if (updates.rating !== undefined) await this.api.tracks.updateRating(id, updates.rating)
    if (updates.loved !== undefined) await this.api.tracks.updateLoved(id, updates.loved)
    if (updates.playCount !== undefined)
      await this.api.tracks.updatePlayCount(id, updates.playCount)
  }

  async rateTrack(id: string, rating: number): Promise<void> {
    return this.api.tracks.updateRating(id, rating)
  }

  async rateAlbum(id: string, rating: number): Promise<void> {
    return this.api.albums.updateRating(id, rating)
  }

  async toggleTrackLoved(id: string, loved: boolean): Promise<void> {
    return this.api.tracks.updateLoved(id, loved)
  }

  async toggleAlbumLoved(id: string, loved: boolean): Promise<void> {
    return this.api.albums.updateLoved(id, loved)
  }

  async toggleArtistLoved(id: string, loved: boolean): Promise<void> {
    // Legacy didn't explicitly have this, but let's assume if it did:
    if (this.api.artists.updateLoved) {
      return this.api.artists.updateLoved(id, loved)
    }
  }

  async search(query: string): Promise<any> {
    return this.api.search.query(query)
  }

  async startScan(folderId: string, path: string): Promise<void> {
    return this.api.scanner.scanFunction(folderId, path)
  }

  async getScanStatus(): Promise<ScanProgress> {
    return { isScanning: false, totalFiles: 0, scannedFiles: 0, currentFile: '', errors: [] }
  }

  async getFolders(): Promise<MusicFolder[]> {
    return this.api.folders.getAll()
  }

  async addFolder(path: string, watchEnabled: boolean): Promise<void> {
    return this.api.folders.add(path, watchEnabled)
  }

  async updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void> {
    return this.api.folders.updateWatch(folderId, watchEnabled)
  }

  async scanFolder(folderId: string): Promise<void> {
    return this.api.folders.scan(folderId)
  }

  async removeFolder(id: string): Promise<void> {
    return this.api.folders.remove(id)
  }

  // New methods - not implemented in legacy DomClient (or partially)
  async getPlaylists(): Promise<any[]> {
    return []
  }
  async createPlaylist(_name: string, _trackIds: string[]): Promise<any> {
    return null
  }
  async deletePlaylist(_id: string): Promise<void> { }
  async addToPlaylist(_id: string, _trackId: string): Promise<void> { }
  async removeFromPlaylist(_id: string, _trackId: string, _position: number): Promise<void> { }
  async renamePlaylist(_id: string, _name: string): Promise<void> { }

  async getSettings(): Promise<any> {
    return {}
  }
  async saveSetting(_key: string, _value: any): Promise<void> { }

  async getSession(): Promise<any> {
    return {}
  }
  async saveSession(_session: any): Promise<void> { }

  async scrobble(): Promise<void> { }
  async updateNowPlaying(): Promise<void> { }
  async syncScrobble(): Promise<void> { }
  async getSyncStatus(): Promise<any> {
    return {}
  }
  async getLastFmAuthToken(): Promise<any> {
    return {}
  }
  async createLastFmSession(): Promise<any> {
    return {}
  }

  async syncMetadata(): Promise<void> { }
  async getFileSyncStatus(): Promise<any> {
    return {}
  }
  async enhanceLibrary(): Promise<void> { }
  async getEnhanceStatus(): Promise<any> {
    return {}
  }
  async getCoverage(): Promise<any> {
    return {}
  }
  async writeTrackMetadata(_id: string): Promise<boolean> {
    return false
  }

  async searchMetadata(artist: string, title?: string, album?: string): Promise<any[]> {
    // Fallback to legacy if available, otherwise empty
    if (this.api.metadata && this.api.metadata.search) {
      return this.api.metadata.search(artist, title || '', album)
    }
    return []
  }
  async searchAlbums(artist: string, album: string): Promise<any[]> {
    if (this.api.metadata && this.api.metadata.searchAlbums) {
      return this.api.metadata.searchAlbums(artist, album)
    }
    return []
  }
  async getArtistDetails(id: string): Promise<any> {
    if (this.api.metadata && this.api.metadata.getArtistDetails) {
      return this.api.metadata.getArtistDetails(id)
    }
    return {}
  }

  async getArtistMembers(id: string): Promise<any[]> {
    if (this.api.artists && this.api.artists.getMembers) {
      return this.api.artists.getMembers(id)
    }
    return []
  }

  async getCandidates(trackId: string): Promise<{ candidates: any[] }> {
    if (this.api.musicbrainz && this.api.musicbrainz.getCandidates) {
      return this.api.musicbrainz.getCandidates(trackId)
    }
    return { candidates: [] }
  }
  async applyCandidate(
    trackId: string,
    candidate: any,
    options: { writeToFile: boolean; selectedFields?: string[] }
  ): Promise<void> {
    if (this.api.musicbrainz && this.api.musicbrainz.applyCandidate) {
      return this.api.musicbrainz.applyCandidate(trackId, candidate, options)
    }
  }
  async tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number> {
    if (this.api.library && this.api.library.tagAlbumMetadata) {
      return this.api.library.tagAlbumMetadata(albumId, mbAlbumId)
    }
    return 0
  }
  async previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]> {
    if (this.api.library && this.api.library.previewMatchAlbum) {
      return this.api.library.previewMatchAlbum(albumId, mbAlbumId)
    }
    return []
  }
  async getSimilarArtists(artist: string): Promise<any[]> {
    if (this.api.library && this.api.library.getSimilarArtists) {
      return this.api.library.getSimilarArtists(artist)
    }
    return []
  }
  async openExternal(url: string): Promise<void> {
    if (this.api.util && this.api.util.openExternal) {
      return this.api.util.openExternal(url)
    }
    window.open(url, '_blank')
  }

  async getDrives(): Promise<any[]> {
    return []
  }
  async getDirectory(_path: string): Promise<any[]> {
    return []
  }

  getCoverUrl(_id: string): string {
    return ''
  }
  getArtistImageUrl(_id: string): string {
    return ''
  }
  getAudioUrl(_id: string): string {
    return ''
  }
}

// Implementation using fetch (REST API)
export class RestClient implements MusicClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async req<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`)
    return res.json()
  }

  async getAlbums(sort?: string, genre?: string): Promise<Album[]> {
    const params = new URLSearchParams()
    if (sort) params.append('sort', sort)
    if (genre) params.append('genre', genre)
    return this.req<Album[]>(`/api/albums?${params.toString()}`)
  }

  async getAlbum(id: string): Promise<Album | null> {
    return this.req<Album>(`/api/albums/${id}`)
  }

  async getAlbumPerformers(id: string): Promise<any[]> {
    return this.req<any[]>(`/api/albums/${id}/performers`)
  }

  async updateAlbum(id: string, updates: Partial<Album>): Promise<void> {
    await this.req(`/api/albums/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
  }

  async getGenres(): Promise<{ genre: string; count: number }[]> {
    return this.req<{ genre: string; count: number }[]>('/api/genres')
  }

  async addFolder(path: string, watchEnabled: boolean): Promise<void> {
    await this.req('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ path, watchEnabled })
    })
  }

  async updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void> {
    await this.req(`/api/folders/${folderId}/watch`, {
      method: 'PUT',
      body: JSON.stringify({ watchEnabled })
    })
  }

  async scanFolder(folderId: string): Promise<void> {
    await this.req(`/api/folders/${folderId}/scan`, { method: 'POST' })
  }

  async removeFolder(id: string): Promise<void> {
    await this.req(`/api/folders/${id}`, { method: 'DELETE' })
  }

  async getArtists(): Promise<Artist[]> {
    return this.req<Artist[]>('/api/artists')
  }

  async getArtist(id: string): Promise<Artist | null> {
    return this.req<Artist>(`/api/artists/${id}`)
  }


  async getTracks(filter?: {
    folderId?: string
    albumId?: string
    artistId?: string
  }): Promise<Track[]> {
    const params = new URLSearchParams()
    if (filter?.folderId) params.append('folderId', filter.folderId)
    if (filter?.albumId) params.append('albumId', filter.albumId)
    if (filter?.artistId) params.append('artistId', filter.artistId)
    return this.req<Track[]>(`/api/tracks?${params.toString()}`)
  }

  async getTrack(id: string): Promise<Track | null> {
    return this.req<Track>(`/api/tracks/${id}`)
  }

  async updateTrack(id: string, updates: Partial<Track>): Promise<void> {
    await this.req(`/api/tracks/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
  }

  async rateTrack(id: string, rating: number): Promise<void> {
    await this.req(`/api/tracks/${id}/rate`, { method: 'POST', body: JSON.stringify({ rating }) })
  }

  async rateAlbum(id: string, rating: number): Promise<void> {
    await this.req(`/api/albums/${id}/rate`, { method: 'POST', body: JSON.stringify({ rating }) })
  }

  async toggleTrackLoved(id: string, loved: boolean): Promise<void> {
    await this.req(`/api/tracks/${id}/loved`, { method: 'POST', body: JSON.stringify({ loved }) })
  }

  async toggleAlbumLoved(id: string, loved: boolean): Promise<void> {
    await this.req(`/api/albums/${id}/loved`, { method: 'POST', body: JSON.stringify({ loved }) })
  }

  async toggleArtistLoved(id: string, loved: boolean): Promise<void> {
    await this.req(`/api/artists/${id}/loved`, { method: 'POST', body: JSON.stringify({ loved }) })
  }

  async search(query: string): Promise<any> {
    return this.req(`/api/search?q=${encodeURIComponent(query)}`)
  }

  async startScan(folderId: string, path: string): Promise<void> {
    await this.req('/api/scan/start', { method: 'POST', body: JSON.stringify({ folderId, path }) })
  }

  async getScanStatus(): Promise<ScanProgress> {
    return this.req<ScanProgress>('/api/scan/status')
  }

  async getFolders(): Promise<MusicFolder[]> {
    return this.req<MusicFolder[]>('/api/folders')
  }

  // Playlists
  async getPlaylists(): Promise<any[]> {
    return this.req<any[]>('/api/playlists')
  }

  async createPlaylist(name: string, trackIds: string[]): Promise<any> {
    return this.req<any>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, trackIds })
    })
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.req(`/api/playlists/${id}`, { method: 'DELETE' })
  }

  async addToPlaylist(id: string, trackId: string): Promise<void> {
    await this.req(`/api/playlists/${id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ trackId })
    })
  }

  async removeFromPlaylist(id: string, trackId: string, position: number): Promise<void> {
    await this.req(`/api/playlists/${id}/tracks/${trackId}?position=${position}`, {
      method: 'DELETE'
    })
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    await this.req(`/api/playlists/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
  }

  // Settings
  async getSettings(): Promise<any> {
    return this.req<any>('/api/settings')
  }

  async saveSetting(key: string, value: any): Promise<void> {
    await this.req('/api/settings', { method: 'POST', body: JSON.stringify({ key, value }) })
  }

  // Player
  async getSession(): Promise<any> {
    return this.req<any>('/api/player')
  }

  async saveSession(session: any): Promise<void> {
    await this.req('/api/player', { method: 'POST', body: JSON.stringify(session) })
  }

  // Scrobble & Auth
  async scrobble(
    artist: string,
    track: string,
    album?: string,
    duration?: number,
    timestamp?: number
  ): Promise<void> {
    await this.req('/api/scrobble', {
      method: 'POST',
      body: JSON.stringify({ artist, track, album, duration, timestamp })
    })
  }

  async updateNowPlaying(
    artist: string,
    track: string,
    album?: string,
    duration?: number
  ): Promise<void> {
    await this.req('/api/scrobble/nowplaying', {
      method: 'POST',
      body: JSON.stringify({ artist, track, album, duration })
    })
  }

  async syncScrobble(
    lastfmUsername: string,
    listenbrainzUsername: string,
    writeToFile?: boolean
  ): Promise<void> {
    await this.req('/api/scrobble/sync', {
      method: 'POST',
      body: JSON.stringify({ lastfmUsername, listenbrainzUsername, writeToFile })
    })
  }

  async getSyncStatus(): Promise<any> {
    return this.req<any>('/api/scrobble/sync/status')
  }

  async getLastFmAuthToken(): Promise<any> {
    return this.req<any>('/api/auth/lastfm/token')
  }

  async createLastFmSession(token: string): Promise<any> {
    return this.req<any>('/api/auth/lastfm/session', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
  }

  // Metadata
  async syncMetadata(): Promise<void> {
    await this.req('/api/metadata/sync', { method: 'POST' })
  }

  async getFileSyncStatus(): Promise<any> {
    return this.req<any>('/api/metadata/sync/status')
  }

  async enhanceLibrary(writeToFiles?: boolean): Promise<void> {
    await this.req('/api/metadata/enhance', {
      method: 'POST',
      body: JSON.stringify({ writeToFiles })
    })
  }

  async getEnhanceStatus(): Promise<any> {
    return this.req<any>('/api/metadata/enhance/status')
  }

  async getCoverage(): Promise<any> {
    return this.req<any>('/api/metadata/coverage')
  }

  async writeTrackMetadata(id: string): Promise<boolean> {
    try {
      await this.req(`/api/metadata/write/${id}`, { method: 'POST' })
      return true
    } catch {
      return false
    }
  }

  async searchMetadata(artist: string, title?: string, album?: string): Promise<any[]> {
    const params = new URLSearchParams()
    params.append('artist', artist)
    if (title) params.append('title', title)
    if (album) params.append('album', album)
    return this.req<any[]>(`/api/metadata/search?${params.toString()}`)
  }

  async searchAlbums(artist: string, album: string): Promise<any[]> {
    const params = new URLSearchParams()
    params.append('artist', artist)
    params.append('album', album)
    params.append('type', 'release')
    return this.req<any[]>(`/api/metadata/search?${params.toString()}`)
  }

  async getArtistDetails(id: string): Promise<any> {
    return this.req<any>(`/api/metadata/artist/${id}`)
  }

  async getArtistMembers(id: string): Promise<any[]> {
    return this.req<any[]>(`/api/artists/${id}/members`)
  }

  async updateArtist(id: string, updates: any): Promise<void> {
    await this.req<any>(`/api/artists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async getCandidates(trackId: string): Promise<{ candidates: any[] }> {
    return this.req<{ candidates: any[] }>(`/api/metadata/candidates/${trackId}`)
  }

  async applyCandidate(
    trackId: string,
    candidate: any,
    options: { writeToFile: boolean; selectedFields?: string[] }
  ): Promise<void> {
    await this.req(`/api/metadata/candidates/${trackId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ candidate, ...options })
    })
  }

  async tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number> {
    const result = await this.req<{ updatedCount: number }>(`/api/metadata/album/${albumId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ mbAlbumId })
    })
    return result.updatedCount
  }
  async previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]> {
    return this.req<any[]>(`/api/metadata/album/${albumId}/match`, {
      method: 'POST',
      body: JSON.stringify({ mbAlbumId })
    }).then((res: any) => res.matches)
  }

  async getSimilarArtists(artist: string): Promise<any[]> {
    const params = new URLSearchParams()
    params.append('name', artist)
    return this.req<any[]>(`/api/artists/similar?${params.toString()}`)
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank')
  }

  async getDrives(): Promise<any[]> {
    return this.req<any[]>('/api/system/drives')
  }

  async getDirectory(path: string): Promise<any[]> {
    return this.req<any[]>(`/api/system/browse?path=${encodeURIComponent(path)}`)
  }

  getCoverUrl(id: string): string {
    return `${this.baseUrl}/api/cover/album/${id}`
  }

  getArtistImageUrl(id: string): string {
    return `${this.baseUrl}/api/cover/artist/${id}`
  }

  getAudioUrl(id: string): string {
    return `${this.baseUrl}/api/stream/${id}`
  }
}

// Factory/Singleton
const SERVER_URL = 'http://localhost:3000'
// Force usage of REST client to allow web client (browser) to work.
// DomClient is only for Electron context which we are migrating away from for the Renderer.
const useServer = true

export const client: MusicClient = useServer ? new RestClient(SERVER_URL) : new DomClient()
