// Types shared between renderer and server
import { Album, Artist, Track, MusicFolder, ScanProgress } from '../types';

// Interface defining the contract for both Desktop and Server clients
export interface MusicClient {
  // Albums
  getAlbums(sort?: string, genre?: string): Promise<Album[]>;
  getAlbum(id: string): Promise<Album | null>;
  getAlbumPerformers(id: string): Promise<any[]>;
  updateAlbum(id: string, updates: Partial<Album>): Promise<void>;
  deleteAlbum(id: string): Promise<void>;
  pasteAlbumArtwork(id: string, imageBase64: string): Promise<{ path: string }>;
  getGenres(): Promise<{ genre: string; count: number }[]>;

  // Artists
  getArtists(): Promise<Artist[]>;
  getArtist(id: string): Promise<Artist | null>;
  updateArtist(id: string, updates: Partial<Artist>): Promise<void>;

  // Tracks
  getTracks(options?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]>;
  getTrack(id: string): Promise<Track | null>;
  getTrackInfo(id: string): Promise<any>;
  getSimilarTracks(id: string): Promise<Track[]>;
  updateTrack(id: string, data: Partial<Track> & { metadata?: any }): Promise<void>;
  bulkUpdateTracks(trackIds: string[], data: any): Promise<void>;
  deleteTrack(id: string): Promise<void>;

  // Interactions
  getMostPlayedTracks(range: string, limit?: number): Promise<Track[]>;
  rateTrack(id: string, rating: number): Promise<void>;
  rateAlbum(id: string, rating: number): Promise<void>;
  loveTrack(id: string, loved: boolean): Promise<void>;
  toggleAlbumLoved(id: string, loved: boolean): Promise<void>;
  toggleArtistLoved(id: string, loved: boolean): Promise<void>;

  // Search
  search(query: string): Promise<{ artists: Artist[]; albums: Album[]; tracks: Track[]; playlists: any[] }>;

  // Scanning
  startScan(folderId: string, path: string): Promise<void>;
  getScanStatus(): Promise<ScanProgress>;
  getFolders(): Promise<MusicFolder[]>;
  addFolder(path: string, watchEnabled: boolean): Promise<void>;
  updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void>;
  scanFolder(folderId: string): Promise<void>;
  removeFolder(id: string): Promise<void>;

  // Playlists
  getPlaylists(): Promise<any[]>;
  createPlaylist(name: string, trackIds: string[]): Promise<any>;
  deletePlaylist(id: string): Promise<void>;
  addToPlaylist(id: string, trackId: string): Promise<void>;
  removeFromPlaylist(id: string, trackId: string, position: number): Promise<void>;
  removeFromPlaylistById(id: string, trackId: string): Promise<void>;
  renamePlaylist(id: string, name: string): Promise<void>;
  reorderPlaylist(id: string, trackIds: string[]): Promise<void>;

  // Smart Playlists
  getSmartPlaylists(): Promise<any[]>;
  getSmartPlaylist(id: string): Promise<any>;
  createSmartPlaylist(data: any): Promise<any>;
  updateSmartPlaylist(id: string, data: any): Promise<any>;
  deleteSmartPlaylist(id: string): Promise<void>;
  resolveSmartPlaylist(id: string): Promise<{ tracks: any[]; total: number }>;
  previewSmartPlaylist(data: any): Promise<{ tracks: any[]; total: number }>;

  // Settings
  getSettings(): Promise<any>;
  saveSetting(key: string, value: any): Promise<void>;

  // Player
  getSession(): Promise<any>;
  saveSession(session: any): Promise<void>;

  // Scrobble & Auth
  scrobble(artist: string, track: string, album?: string, duration?: number, timestamp?: number): Promise<void>;
  updateNowPlaying(artist: string, track: string, album?: string, duration?: number): Promise<void>;
  syncScrobble(lastfmUsername: string, listenbrainzUsername: string, writeToFile?: boolean): Promise<void>;
  syncMusicBrainzRatings(): Promise<void>;
  getSyncStatus(): Promise<any>;
  getLastFmAuthToken(): Promise<any>;
  createLastFmSession(token: string): Promise<any>;

  // Metadata
  syncMetadata(): Promise<void>;
  getFileSyncStatus(): Promise<any>;
  enhanceLibrary(writeToFiles?: boolean): Promise<void>;
  getEnhanceStatus(): Promise<any>;
  getCoverage(): Promise<any>;
  searchMetadata(artist: string, title?: string, album?: string, queryMbid?: string, currentTrackMbid?: string | null, currentAlbumMbid?: string | null): Promise<any[]>;
  searchAlbums(artist: string, album: string, queryMbid?: string, currentAlbumMbid?: string | null): Promise<any[]>;
  getArtistDetails(id: string): Promise<any>;
  getArtistMembers(id: string): Promise<any[]>;
  getArtistTopTracks(artist: string, limit?: number): Promise<{ name: string; playcount: string }[]>;
  getCandidates(trackId: string): Promise<{ candidates: any[] }>;
  applyCandidate(trackId: string, candidate: any, options: { writeToFile: boolean; selectedFields?: string[] }): Promise<void>;
  tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number>;
  previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]>;
  getSimilarArtists(artist: string): Promise<any[]>;
  openExternal(url: string): Promise<void>;
  enrichArtists(artistIds: string[]): Promise<void>;

  // System
  getDrives(): Promise<any[]>;
  getDirectory(path: string): Promise<any[]>;
  browseNative(type?: 'file' | 'folder'): Promise<{ path: string | null }>;
  showItemInFolder(path: string): Promise<void>;

  // Media URLs
  getCoverUrl(id: string): string;
  getArtistImageUrl(id: string): string;
  getAudioUrl(id: string): string;
  getWaveformUrl(id: string): string;
  getVibePlaylist(vibeId: string, limit?: number): Promise<Track[]>;
}

// IPC client for Desktop (Electron) – calls main process via window.api
export class IpcClient implements MusicClient {
  private get api() {
    return (window as any).api;
  }

  private async call<T>(channel: string, ...args: any[]): Promise<T> {
    const api = this.api;
    if (!api) {
      console.warn(`IPC API not available for channel: ${channel}. Falling back to empty.`);
      return [] as any;
    }
    // Access nested API e.g. "folders:getAll" -> this.api.folders.getAll
    const [namespace, method] = channel.split(':');
    if (api[namespace] && api[namespace][method]) {
      return await api[namespace][method](...args);
    }
    console.error(`IPC Method not found: ${namespace}.${method}`);
    return [] as any;
  }

  // Albums
  async getAlbums(sort?: string, genre?: string): Promise<Album[]> {
    if (genre) return this.call<Album[]>('albums:getByGenre', genre);
    if (sort) return this.call<Album[]>('albums:getSorted', sort);
    return this.call<Album[]>('albums:getAll');
  }
  async getAlbum(id: string): Promise<Album | null> { return this.call<Album | null>('albums:getById', id); }
  async getAlbumPerformers(id: string): Promise<any[]> { return this.call<any[]>('albums:getPerformers', id); }
  async updateAlbum(id: string, updates: Partial<Album>): Promise<void> { await this.call('albums:update', id, updates); }
  async deleteAlbum(id: string): Promise<void> { await this.call('albums:delete', id); }
  async pasteAlbumArtwork(id: string, imageBase64: string): Promise<{ path: string }> { return this.call('albums:pasteArtwork', id, imageBase64); }
  async getGenres(): Promise<{ genre: string; count: number }[]> { return this.call('albums:getGenres'); }

  // Artists
  async getArtists(): Promise<Artist[]> { return this.call<Artist[]>('library:getArtists'); }
  async getArtist(id: string): Promise<Artist | null> { return this.call<Artist | null>('library:getArtist', id); }
  async updateArtist(id: string, updates: Partial<Artist>): Promise<void> { await this.call('library:updateArtist', id, updates); }

  // Tracks
  async getTracks(options?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]> {
    if (options?.albumId) {
      // Need to fetch album first to get name/artist for the existing IPC handler
      const album = await this.getAlbum(options.albumId);
      if (album) return this.call<Track[]>('tracks:getTracksByAlbum', album.name, album.artist);
    }
    return this.call<Track[]>('tracks:getAll');
  }
  async getTrack(id: string): Promise<Track | null> { return this.call<Track | null>('tracks:getById', id); }
  async getTrackInfo(id: string): Promise<any> { return this.call<any>('tracks:getInfo', id); }
  async getSimilarTracks(id: string): Promise<Track[]> { return this.call<Track[]>('tracks:getSimilar', id); }
  async updateTrack(id: string, data: Partial<Track> & { metadata?: any }): Promise<void> {
    await this.call('tracks:updateMetadata', id, data.filePath, data.rating, data.loved, data.metadata);
  }
  async bulkUpdateTracks(trackIds: string[], data: any): Promise<void> { await this.call('tracks:bulkUpdate', trackIds, data); }
  async deleteTrack(id: string): Promise<void> { await this.call('tracks:delete', id); }

  // Interactions
  async getMostPlayedTracks(range: string, limit?: number): Promise<Track[]> { return this.call('tracks:getMostPlayed', range, limit); }
  async rateTrack(id: string, rating: number): Promise<void> {
    const track = await this.getTrack(id);
    if (track) await this.call('tracks:rate', id, track.filePath, rating);
  }
  async rateAlbum(id: string, rating: number): Promise<void> { await this.call('albums:rate', id, rating); }
  async loveTrack(id: string, loved: boolean): Promise<void> {
    const track = await this.getTrack(id);
    if (track) await this.call('tracks:updateMetadata', id, track.filePath, track.rating, loved);
  }
  async toggleAlbumLoved(id: string, _loved: boolean): Promise<void> { await this.call('library:toggleAlbumLoved', id); }
  async toggleArtistLoved(id: string, loved: boolean): Promise<void> { await this.call('library:toggleArtistLoved', id, loved); }

  // Search
  async search(query: string): Promise<{ artists: Artist[]; albums: Album[]; tracks: Track[]; playlists: any[] }> {
    return this.call('library:search', query);
  }

  // Scanning
  async startScan(folderId: string, path: string): Promise<void> { await this.call('scanner:start', folderId, path); }
  async getScanStatus(): Promise<ScanProgress> { return this.call('scanner:getProgress'); }
  async getFolders(): Promise<MusicFolder[]> { return this.call('folders:getAll'); }
  async addFolder(path: string, watchEnabled: boolean): Promise<void> { await this.call('folders:add', path, watchEnabled); }
  async updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void> { await this.call('folders:updateWatch', folderId, watchEnabled); }
  async scanFolder(folderId: string): Promise<void> { await this.call('folders:scan', folderId); }
  async removeFolder(id: string): Promise<void> { await this.call('folders:remove', id); }

  // Playlists
  async getPlaylists(): Promise<any[]> { return this.call('playlists:getAll'); }
  async createPlaylist(name: string, trackIds: string[]): Promise<any> { return this.call('playlists:create', name, trackIds); }
  async deletePlaylist(id: string): Promise<void> { await this.call('playlists:delete', id); }
  async addToPlaylist(id: string, trackId: string): Promise<void> { await this.call('playlists:add', id, trackId); }
  async removeFromPlaylist(id: string, trackId: string, position: number): Promise<void> { await this.call('playlists:remove', id, trackId, position); }
  async removeFromPlaylistById(id: string, trackId: string): Promise<void> { await this.call('playlists:removeById', id, trackId); }
  async renamePlaylist(id: string, name: string): Promise<void> { await this.call('playlists:rename', id, name); }
  async reorderPlaylist(id: string, trackIds: string[]): Promise<void> { await this.call('playlists:reorder', id, trackIds); }

  // Smart Playlists
  async getSmartPlaylists(): Promise<any[]> { return this.call('smartplaylists:getAll'); }
  async getSmartPlaylist(id: string): Promise<any> { return this.call('smartplaylists:getById', id); }
  async createSmartPlaylist(data: any): Promise<any> { return this.call('smartplaylists:create', data); }
  async updateSmartPlaylist(id: string, data: any): Promise<any> { return this.call('smartplaylists:update', id, data); }
  async deleteSmartPlaylist(id: string): Promise<void> { await this.call('smartplaylists:delete', id); }
  async resolveSmartPlaylist(id: string): Promise<{ tracks: any[]; total: number }> { return this.call('smartplaylists:resolve', id); }
  async previewSmartPlaylist(data: any): Promise<{ tracks: any[]; total: number }> { return this.call('smartplaylists:preview', data); }

  // Settings
  async getSettings(): Promise<any> { return this.call('settings:getAll'); }
  async saveSetting(key: string, value: any): Promise<void> { await this.call('settings:save', key, value); }

  // Player
  async getSession(): Promise<any> { return this.call('player:getSession'); }
  async saveSession(session: any): Promise<void> { await this.call('player:saveSession', session); }

  // Scrobble & Auth
  async scrobble(artist: string, track: string, album?: string, duration?: number, timestamp?: number): Promise<void> { await this.call('scrobble:track', artist, track, album, duration, timestamp); }
  async updateNowPlaying(artist: string, track: string, album?: string, duration?: number): Promise<void> { await this.call('scrobble:updateNowPlaying', artist, track, album, duration); }
  async syncScrobble(lastfmUsername: string, listenbrainzUsername: string, writeToFile?: boolean): Promise<void> { await this.call('scrobble:sync', lastfmUsername, listenbrainzUsername, writeToFile); }
  async syncMusicBrainzRatings(): Promise<void> { await this.call('scrobble:syncMusicBrainz'); }
  async getSyncStatus(): Promise<any> { return this.call('scrobble:getSyncStatus'); }
  async getLastFmAuthToken(): Promise<any> { return this.call('scrobble:getLastFmAuthToken'); }
  async createLastFmSession(token: string): Promise<any> { return this.call('scrobble:getLastFmSession', token); }

  // Metadata
  async syncMetadata(): Promise<void> { await this.call('metadata:sync'); }
  async getFileSyncStatus(): Promise<any> { return this.call('metadata:getSyncStatus'); }
  async enhanceLibrary(writeToFiles?: boolean): Promise<void> { await this.call('metadata:enhance', writeToFiles); }
  async getEnhanceStatus(): Promise<any> { return this.call('metadata:getEnhanceStatus'); }
  async getCoverage(): Promise<any> { return this.call('metadata:getCoverage'); }
  async searchMetadata(artist: string, title?: string, album?: string, queryMbid?: string, currentTrackMbid?: string | null, currentAlbumMbid?: string | null): Promise<any[]> { return this.call('metadata:search', artist, title, album, queryMbid, currentTrackMbid, currentAlbumMbid); }
  async searchAlbums(artist: string, album: string, queryMbid?: string, currentAlbumMbid?: string | null): Promise<any[]> { return this.call('metadata:searchAlbums', artist, album, queryMbid, currentAlbumMbid); }
  async getArtistDetails(id: string): Promise<any> { return this.call('metadata:getArtistDetails', id); }
  async getArtistMembers(id: string): Promise<any[]> { return this.call('metadata:getArtistMembers', id); }
  async getArtistTopTracks(artist: string, limit?: number): Promise<{ name: string; playcount: string }[]> { return this.call('tracks:getArtistTop', artist, limit); }
  async getCandidates(trackId: string): Promise<{ candidates: any[] }> { return this.call('musicbrainz:getCandidates', trackId); }
  async applyCandidate(trackId: string, candidate: any, options: { writeToFile: boolean; selectedFields?: string[] }): Promise<void> { await this.call('musicbrainz:apply', trackId, candidate, options); }
  async tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number> { return this.call('musicbrainz:tag', albumId, mbAlbumId); }
  async previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]> { return this.call('metadata:previewMatchAlbum', albumId, mbAlbumId); }
  async getSimilarArtists(artist: string): Promise<any[]> { return this.call('library:getSimilarArtists', artist); }
  async openExternal(url: string): Promise<void> { await this.call('util:openExternal', url); }
  async enrichArtists(artistIds: string[]): Promise<void> { await this.call('enrich:artists', artistIds); }

  // System
  async getDrives(): Promise<any[]> { return this.call('system:getDrives'); }
  async getDirectory(path: string): Promise<any[]> { return this.call('system:getDirectory', path); }
  async browseNative(type?: 'file' | 'folder'): Promise<{ path: string | null }> {
    const path = await this.call<string | null>('folders:browse', type)
    return { path }
  }
  async showItemInFolder(path: string): Promise<void> { await this.call('util:showItemInFolder', path); }

  // Media URLs
  getCoverUrl(id: string): string { return `asset://album-cover/${id}`; }
  getArtistImageUrl(id: string): string { return `asset://artist-image/${id}`; }
  getAudioUrl(id: string): string { return `asset://stream/${id}`; }
  getWaveformUrl(id: string): string { return `asset://waveform/${id}`; }
  async getVibePlaylist(vibeId: string, limit?: number): Promise<Track[]> { return this.call('vibes:get', vibeId, limit); }
}

// REST client – uses fetch to talk to backend API
export class RestClient implements MusicClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async req<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, options);
    // Explicitly handle 204 No Content for void returns
    if (res.status === 204) return {} as T;
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    return res.json();
  }

  // Albums
  async getAlbums(sort?: string, genre?: string): Promise<Album[]> {
    const params = new URLSearchParams();
    if (sort) params.append('sort', sort);
    if (genre) params.append('genre', genre);
    return this.req<Album[]>(`/api/albums?${params.toString()}`);
  }

  async getAlbum(id: string): Promise<Album | null> {
    return this.req<Album | null>(`/api/albums/${id}`);
  }

  async getAlbumPerformers(id: string): Promise<any[]> {
    return this.req<any[]>(`/api/albums/${id}/performers`);
  }

  async updateAlbum(id: string, data: Partial<Album>): Promise<void> {
    await this.req<void>(`/api/albums/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.req<void>(`/api/albums/${id}`, { method: "DELETE" });
  }

  async pasteAlbumArtwork(id: string, imageBase64: string): Promise<{ path: string }> {
    return this.req<{ path: string }>(`/api/albums/${id}/artwork/paste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
    });
  }

  async getGenres(): Promise<{ genre: string; count: number }[]> {
    return this.req<{ genre: string; count: number }[]>(`/api/genres`);
  }

  // Artists
  async getArtists(): Promise<Artist[]> {
    return this.req<Artist[]>(`/api/artists`);
  }

  async getArtist(id: string): Promise<Artist | null> {
    return this.req<Artist | null>(`/api/artists/${id}`);
  }

  async updateArtist(id: string, updates: Partial<Artist>): Promise<void> {
    await this.req<void>(`/api/artists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  }

  // Tracks
  async getTracks(options?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]> {
    const params = new URLSearchParams(options as any);
    return this.req<Track[]>(`/api/tracks?${params.toString()}`);
  }

  async getTrack(id: string): Promise<Track | null> {
    return this.req<Track | null>(`/api/tracks/${id}`);
  }

  async getTrackInfo(id: string): Promise<any> {
    return this.req<any>(`/api/tracks/${id}/info`);
  }

  async getSimilarTracks(id: string): Promise<Track[]> {
    return this.req<Track[]>(`/api/tracks/${id}/similar`);
  }

  async updateTrack(id: string, data: Partial<Track> & { metadata?: any }): Promise<void> {
    await this.req<void>(`/api/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async bulkUpdateTracks(trackIds: string[], data: any): Promise<void> {
    await this.req<void>(`/api/tracks/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds, ...data })
    });
  }

  async deleteTrack(id: string): Promise<void> {
    await this.req<void>(`/api/tracks/${id}`, { method: 'DELETE' });
  }

  // Interactions
  async getMostPlayedTracks(range: string, limit: number = 10): Promise<Track[]> {
    return this.req<Track[]>(`/api/tracks/most-played?range=${range}&limit=${limit}`);
  }

  async rateTrack(id: string, rating: number): Promise<void> {
    await this.req<void>(`/api/tracks/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    });
  }

  async rateAlbum(id: string, rating: number): Promise<void> {
    await this.req<void>(`/api/albums/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    });
  }

  async loveTrack(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/tracks/${id}/loved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loved })
    });
  }

  async toggleAlbumLoved(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/albums/${id}/loved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loved })
    });
  }

  async toggleArtistLoved(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/artists/${id}/loved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loved })
    });
  }

  // Search
  async search(query: string): Promise<{ artists: Artist[]; albums: Album[]; tracks: Track[]; playlists: any[] }> {
    return this.req<any>(`/api/search?q=${encodeURIComponent(query)}`);
  }

  // Scanning
  async startScan(folderId: string, path: string): Promise<void> {
    await this.req<void>(`/api/scan/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId, path })
    });
  }

  async getScanStatus(): Promise<ScanProgress> {
    return this.req<ScanProgress>(`/api/scan/status`);
  }

  async getFolders(): Promise<MusicFolder[]> {
    return this.req<MusicFolder[]>(`/api/folders`);
  }

  async addFolder(path: string, watchEnabled: boolean): Promise<void> {
    await this.req<void>(`/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, watchEnabled })
    });
  }

  async updateFolderWatch(folderId: string, watchEnabled: boolean): Promise<void> {
    await this.req<void>(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchEnabled })
    });
  }

  async scanFolder(folderId: string): Promise<void> {
    await this.req<void>(`/api/folders/${folderId}/scan`, { method: 'POST' });
  }

  async removeFolder(id: string): Promise<void> {
    await this.req<void>(`/api/folders/${id}`, { method: 'DELETE' });
  }

  // Playlists
  async getPlaylists(): Promise<any[]> {
    return this.req<any[]>(`/api/playlists`);
  }

  async createPlaylist(name: string, trackIds: string[]): Promise<any> {
    return this.req<any>(`/api/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, trackIds })
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.req<void>(`/api/playlists/${id}`, { method: 'DELETE' });
  }

  async addToPlaylist(id: string, trackId: string): Promise<void> {
    await this.req<void>(`/api/playlists/${id}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId })
    });
  }

  async removeFromPlaylist(id: string, trackId: string, position: number): Promise<void> {
    await this.req<void>(`/api/playlists/${id}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, position })
    });
  }

  async removeFromPlaylistById(id: string, trackId: string): Promise<void> {
    await this.req<void>(`/api/playlists/${id}/remove-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId })
    });
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    await this.req<void>(`/api/playlists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  }

  async reorderPlaylist(id: string, trackIds: string[]): Promise<void> {
    await this.req<void>(`/api/playlists/${id}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds })
    });
  }

  // Smart Playlists
  async getSmartPlaylists(): Promise<any[]> {
    return this.req<any[]>(`/api/smartplaylists`);
  }

  async getSmartPlaylist(id: string): Promise<any> {
    return this.req<any>(`/api/smartplaylists/${id}`);
  }

  async createSmartPlaylist(data: any): Promise<any> {
    return this.req<any>(`/api/smartplaylists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async updateSmartPlaylist(id: string, data: any): Promise<any> {
    return this.req<any>(`/api/smartplaylists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async deleteSmartPlaylist(id: string): Promise<void> {
    await this.req<void>(`/api/smartplaylists/${id}`, { method: 'DELETE' });
  }

  async resolveSmartPlaylist(id: string): Promise<{ tracks: any[]; total: number }> {
    return this.req<{ tracks: any[]; total: number }>(`/api/smartplaylists/${id}/resolve`);
  }

  async previewSmartPlaylist(data: any): Promise<{ tracks: any[]; total: number }> {
    return this.req<{ tracks: any[]; total: number }>(`/api/smartplaylists/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  // Settings
  async getSettings(): Promise<any> {
    return this.req<any>(`/api/settings`);
  }

  async saveSetting(key: string, value: any): Promise<void> {
    await this.req<void>(`/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
  }

  // Player
  async getSession(): Promise<any> {
    return this.req<any>(`/api/player`);
  }

  async saveSession(session: any): Promise<void> {
    await this.req<void>(`/api/player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  }

  // Scrobble & Auth
  async scrobble(artist: string, track: string, album?: string, duration?: number, timestamp?: number): Promise<void> {
    await this.req<void>(`/api/scrobble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, track, album, duration, timestamp })
    });
  }

  async updateNowPlaying(artist: string, track: string, album?: string, duration?: number): Promise<void> {
    await this.req<void>(`/api/nowplaying`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, track, album, duration })
    });
  }

  async syncScrobble(lastfmUsername: string, listenbrainzUsername: string, writeToFile?: boolean): Promise<void> {
    await this.req<void>(`/api/sync/scrobble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastfmUsername, listenbrainzUsername, writeToFile })
    });
  }

  async syncMusicBrainzRatings(): Promise<void> {
    await this.req<void>(`/api/sync/mbratings`, { method: 'POST' });
  }

  async getSyncStatus(): Promise<any> {
    return this.req<any>(`/api/scrobble/sync/status`);
  }

  async getLastFmAuthToken(): Promise<any> {
    return this.req<any>(`/api/lastfm/token`);
  }

  async createLastFmSession(token: string): Promise<any> {
    return this.req<any>(`/api/lastfm/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  }

  // Metadata
  async syncMetadata(): Promise<void> {
    await this.req<void>(`/api/metadata/sync`, { method: 'POST' });
  }

  async getFileSyncStatus(): Promise<any> {
    return this.req<any>(`/api/metadata/sync/status`);
  }

  async enhanceLibrary(writeToFiles?: boolean): Promise<void> {
    await this.req<void>(`/api/metadata/enhance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writeToFiles })
    });
  }

  async getEnhanceStatus(): Promise<any> {
    return this.req<any>(`/api/metadata/enhance/status`);
  }
  async getCoverage(): Promise<any> {
    return this.req<any>(`/api/metadata/coverage`);
  }

  async searchMetadata(artist: string, title?: string, album?: string, mbid?: string, trackMbid?: string, albumMbid?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (artist) params.append('artist', artist)
    if (title) params.append('title', title)
    if (album) params.append('album', album)
    if (mbid) params.append('mbid', mbid)
    if (trackMbid) params.append('trackMbid', trackMbid)
    if (albumMbid) params.append('albumMbid', albumMbid)
    const res = await this.req<any>(`/api/metadata/search?${params.toString()}`)
    return res
  }

  async searchAlbums(artist: string, album: string, mbid?: string, albumMbid?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (artist) params.append('artist', artist)
    if (album) params.append('album', album)
    if (mbid) params.append('mbid', mbid)
    if (albumMbid) params.append('albumMbid', albumMbid)
    params.append('type', 'release')
    const res = await this.req<any>(`/api/metadata/search?${params.toString()}`)
    return res
  }

  async getArtistDetails(id: string): Promise<any> {
    return this.req<any>(`/api/metadata/artist/${id}`);
  }

  async getArtistMembers(id: string): Promise<any[]> {
    return this.req<any[]>(`/api/artists/${id}/members`);
  }

  async getArtistTopTracks(artist: string, limit: number = 50): Promise<{ name: string; playcount: string }[]> {
    return this.req<any[]>(`/api/artists/topTracks?artist=${encodeURIComponent(artist)}&limit=${limit}`);
  }

  async getCandidates(trackId: string): Promise<{ candidates: any[] }> {
    return this.req<{ candidates: any[] }>(`/api/musicbrainz/candidates?trackId=${trackId}`);
  }

  async applyCandidate(trackId: string, candidate: any, options: { writeToFile: boolean; selectedFields?: string[] }): Promise<void> {
    await this.req<void>(`/api/musicbrainz/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, candidate, options })
    });
  }

  async tagAlbumMetadata(albumId: string, mbAlbumId: string): Promise<number> {
    return this.req<number>(`/api/musicbrainz/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId, mbAlbumId })
    });
  }

  async previewMatchAlbum(albumId: string, mbAlbumId: string): Promise<any[]> {
    return this.req<any[]>(`/api/metadata/album/${albumId}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId, mbAlbumId })
    });
  }

  async getSimilarArtists(artist: string): Promise<any[]> {
    return this.req<any[]>(`/api/artists/similar?artist=${encodeURIComponent(artist)}`);
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  async enrichArtists(artistIds: string[]): Promise<void> {
    await this.req<void>(`/api/enrich/artists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistIds })
    });
  }

  // System
  async getDrives(): Promise<any[]> {
    return this.req<any[]>(`/api/system/drives`);
  }

  async getDirectory(path: string): Promise<any[]> {
    return this.req<any[]>(`/api/system/browse?path=${encodeURIComponent(path)}`);
  }

  async browseNative(type: 'file' | 'folder' = 'folder'): Promise<{ path: string | null }> {
    return this.req<{ path: string | null }>(`/api/system/browse-native?type=${type}`);
  }

  async showItemInFolder(path: string): Promise<void> {
    await this.req<void>(`/api/system/show-in-folder?path=${encodeURIComponent(path)}`);
  }

  // Media URLs
  getCoverUrl(id: string): string {
    return `${this.baseUrl}/api/cover/album/${id}`;
  }

  getArtistImageUrl(id: string): string {
    return `${this.baseUrl}/api/cover/artist/${id}`;
  }

  getAudioUrl(id: string): string {
    return `${this.baseUrl}/api/stream/${id}`;
  }

  getWaveformUrl(id: string): string {
    return `${this.baseUrl}/api/waveform/${id}`;
  }

  async getVibePlaylist(vibeId: string, limit: number = 100): Promise<Track[]> {
    const res = await this.req<any>(`/api/vibes/${vibeId}?limit=${limit}`);
    return res.tracks || [];
  }

  async updateTidalCredentials(_clientId: string, _clientSecret: string): Promise<boolean> {
    return false;
  }

  async getAuthUrl(): Promise<string> {
    return '';
  }

  async finishAuth(_code: string): Promise<boolean> {
    return false;
  }
}

// Hybrid client that uses IPC when available (Electron) or REST (Standalone/Web)
export class HybridClient implements MusicClient {
  private ipc = new IpcClient();
  private rest: RestClient;

  private get isElectron() {
    const electron = !!(window as any).api;
    if (electron) {
      // Log occasionally or just once
      if (!(window as any)._ipcLogged) {
        console.log('🔌 HybridClient: Using IPC (Electron) routing');
        (window as any)._ipcLogged = true;
      }
    } else {
      if (!(window as any)._restLogged) {
        console.warn('🌐 HybridClient: Fallback to REST routing');
        (window as any)._restLogged = true;
      }
    }
    return electron;
  }

  constructor(restBaseUrl: string) {
    this.rest = new RestClient(restBaseUrl);
  }

  // Route every call to the appropriate client
  // Desktop app uses IPC primarily for settings/tidal, REST for library (if server is also running)
  // BUT: The desktop app actually has IPC handlers for library too! 
  // We prefer IPC if it exists to allow the desktop app to work without a standalone server.

  getAlbums(sort?: string, genre?: string) { return this.isElectron ? this.ipc.getAlbums(sort, genre) : this.rest.getAlbums(sort, genre); }
  getAlbum(id: string) { return this.isElectron ? this.ipc.getAlbum(id) : this.rest.getAlbum(id); }
  getAlbumPerformers(id: string) { return this.isElectron ? this.ipc.getAlbumPerformers(id) : this.rest.getAlbumPerformers(id); }
  updateAlbum(id: string, updates: Partial<Album>) { return this.isElectron ? this.ipc.updateAlbum(id, updates) : this.rest.updateAlbum(id, updates); }
  deleteAlbum(id: string) { return this.isElectron ? this.ipc.deleteAlbum(id) : this.rest.deleteAlbum(id); }
  pasteAlbumArtwork(id: string, imageBase64: string) { return this.isElectron ? this.ipc.pasteAlbumArtwork(id, imageBase64) : this.rest.pasteAlbumArtwork(id, imageBase64); }
  getGenres() { return this.isElectron ? this.ipc.getGenres() : this.rest.getGenres(); }

  getArtists() { return this.isElectron ? this.ipc.getArtists() : this.rest.getArtists(); }
  getArtist(id: string) { return this.isElectron ? this.ipc.getArtist(id) : this.rest.getArtist(id); }
  updateArtist(id: string, updates: Partial<Artist>) { return this.isElectron ? this.ipc.updateArtist(id, updates) : this.rest.updateArtist(id, updates); }

  getTracks(options?: any) { return this.isElectron ? this.ipc.getTracks(options) : this.rest.getTracks(options); }
  getTrack(id: string) { return this.isElectron ? this.ipc.getTrack(id) : this.rest.getTrack(id); }
  getTrackInfo(id: string) { return this.isElectron ? this.ipc.getTrackInfo(id) : this.rest.getTrackInfo(id); }
  getSimilarTracks(id: string) { return this.isElectron ? this.ipc.getSimilarTracks(id) : this.rest.getSimilarTracks(id); }
  updateTrack(id: string, data: any) { return this.isElectron ? this.ipc.updateTrack(id, data) : this.rest.updateTrack(id, data); }
  bulkUpdateTracks(trackIds: string[], data: any) { return this.isElectron ? this.ipc.bulkUpdateTracks(trackIds, data) : this.rest.bulkUpdateTracks(trackIds, data); }
  deleteTrack(id: string) { return this.isElectron ? this.ipc.deleteTrack(id) : this.rest.deleteTrack(id); }

  getMostPlayedTracks(range: string, limit?: number) { return this.isElectron ? this.ipc.getMostPlayedTracks(range, limit) : this.rest.getMostPlayedTracks(range, limit); }
  rateTrack(id: string, rating: number) { return this.isElectron ? this.ipc.rateTrack(id, rating) : this.rest.rateTrack(id, rating); }
  rateAlbum(id: string, rating: number) { return this.isElectron ? this.ipc.rateAlbum(id, rating) : this.rest.rateAlbum(id, rating); }
  loveTrack(id: string, loved: boolean) { return this.isElectron ? this.ipc.loveTrack(id, loved) : this.rest.loveTrack(id, loved); }
  toggleAlbumLoved(id: string, loved: boolean) { return this.isElectron ? this.ipc.toggleAlbumLoved(id, loved) : this.rest.toggleAlbumLoved(id, loved); }
  toggleArtistLoved(id: string, loved: boolean) { return this.isElectron ? this.ipc.toggleArtistLoved(id, loved) : this.rest.toggleArtistLoved(id, loved); }

  search(query: string) { return this.isElectron ? this.ipc.search(query) : this.rest.search(query); }

  startScan(folderId: string, path: string) { return this.isElectron ? this.ipc.startScan(folderId, path) : this.rest.startScan(folderId, path); }
  getScanStatus() { return this.isElectron ? this.ipc.getScanStatus() : this.rest.getScanStatus(); }
  getFolders() { return this.isElectron ? this.ipc.getFolders() : this.rest.getFolders(); }
  addFolder(path: string, watchEnabled: boolean) { return this.isElectron ? this.ipc.addFolder(path, watchEnabled) : this.rest.addFolder(path, watchEnabled); }
  updateFolderWatch(folderId: string, watchEnabled: boolean) { return this.isElectron ? this.ipc.updateFolderWatch(folderId, watchEnabled) : this.rest.updateFolderWatch(folderId, watchEnabled); }
  scanFolder(folderId: string) { return this.isElectron ? this.ipc.scanFolder(folderId) : this.rest.scanFolder(folderId); }
  removeFolder(id: string) { return this.isElectron ? this.ipc.removeFolder(id) : this.rest.removeFolder(id); }

  getPlaylists() { return this.isElectron ? this.ipc.getPlaylists() : this.rest.getPlaylists(); }
  createPlaylist(name: string, trackIds: string[]) { return this.isElectron ? this.ipc.createPlaylist(name, trackIds) : this.rest.createPlaylist(name, trackIds); }
  deletePlaylist(id: string) { return this.isElectron ? this.ipc.deletePlaylist(id) : this.rest.deletePlaylist(id); }
  addToPlaylist(id: string, trackId: string) { return this.isElectron ? this.ipc.addToPlaylist(id, trackId) : this.rest.addToPlaylist(id, trackId); }
  removeFromPlaylist(id: string, trackId: string, position: number) { return this.isElectron ? this.ipc.removeFromPlaylist(id, trackId, position) : this.rest.removeFromPlaylist(id, trackId, position); }
  removeFromPlaylistById(id: string, trackId: string) { return this.isElectron ? this.ipc.removeFromPlaylistById(id, trackId) : this.rest.removeFromPlaylistById(id, trackId); }
  renamePlaylist(id: string, name: string) { return this.isElectron ? this.ipc.renamePlaylist(id, name) : this.rest.renamePlaylist(id, name); }
  reorderPlaylist(id: string, trackIds: string[]) { return this.isElectron ? this.ipc.reorderPlaylist(id, trackIds) : this.rest.reorderPlaylist(id, trackIds); }

  getSmartPlaylists() { return this.isElectron ? this.ipc.getSmartPlaylists() : this.rest.getSmartPlaylists(); }
  getSmartPlaylist(id: string) { return this.isElectron ? this.ipc.getSmartPlaylist(id) : this.rest.getSmartPlaylist(id); }
  createSmartPlaylist(data: any) { return this.isElectron ? this.ipc.createSmartPlaylist(data) : this.rest.createSmartPlaylist(data); }
  updateSmartPlaylist(id: string, data: any) { return this.isElectron ? this.ipc.updateSmartPlaylist(id, data) : this.rest.updateSmartPlaylist(id, data); }
  deleteSmartPlaylist(id: string) { return this.isElectron ? this.ipc.deleteSmartPlaylist(id) : this.rest.deleteSmartPlaylist(id); }
  resolveSmartPlaylist(id: string) { return this.isElectron ? this.ipc.resolveSmartPlaylist(id) : this.rest.resolveSmartPlaylist(id); }
  previewSmartPlaylist(data: any) { return this.isElectron ? this.ipc.previewSmartPlaylist(data) : this.rest.previewSmartPlaylist(data); }

  getSettings() { return this.isElectron ? this.ipc.getSettings() : this.rest.getSettings(); }
  saveSetting(key: string, value: any) { return this.isElectron ? this.ipc.saveSetting(key, value) : this.rest.saveSetting(key, value); }

  getSession() { return this.isElectron ? this.ipc.getSession() : this.rest.getSession(); }
  saveSession(session: any) { return this.isElectron ? this.ipc.saveSession(session) : this.rest.saveSession(session); }

  scrobble(artist: string, track: string, album?: string, duration?: number, timestamp?: number) { return this.isElectron ? this.ipc.scrobble(artist, track, album, duration, timestamp) : this.rest.scrobble(artist, track, album, duration, timestamp); }
  updateNowPlaying(artist: string, track: string, album?: string, duration?: number) { return this.isElectron ? this.ipc.updateNowPlaying(artist, track, album, duration) : this.rest.updateNowPlaying(artist, track, album, duration); }
  syncScrobble(lastfm: string, lb: string, file?: boolean) { return this.isElectron ? this.ipc.syncScrobble(lastfm, lb, file) : this.rest.syncScrobble(lastfm, lb, file); }
  syncMusicBrainzRatings() { return this.isElectron ? this.ipc.syncMusicBrainzRatings() : this.rest.syncMusicBrainzRatings(); }
  getSyncStatus() { return this.isElectron ? this.ipc.getSyncStatus() : this.rest.getSyncStatus(); }
  getLastFmAuthToken() { return this.isElectron ? this.ipc.getLastFmAuthToken() : this.rest.getLastFmAuthToken(); }
  createLastFmSession(token: string) { return this.isElectron ? this.ipc.createLastFmSession(token) : this.rest.createLastFmSession(token); }

  syncMetadata() { return this.isElectron ? this.ipc.syncMetadata() : this.rest.syncMetadata(); }
  getFileSyncStatus() { return this.isElectron ? this.ipc.getFileSyncStatus() : this.rest.getFileSyncStatus(); }
  enhanceLibrary(file?: boolean) { return this.isElectron ? this.ipc.enhanceLibrary(file) : this.rest.enhanceLibrary(file); }
  getEnhanceStatus() { return this.isElectron ? this.ipc.getEnhanceStatus() : this.rest.getEnhanceStatus(); }
  getCoverage() { return this.isElectron ? this.ipc.getCoverage() : this.rest.getCoverage(); }
  searchMetadata(a: string, t?: string, al?: string) { return this.isElectron ? this.ipc.searchMetadata(a, t, al) : this.rest.searchMetadata(a, t, al); }
  searchAlbums(a: string, al: string) { return this.isElectron ? this.ipc.searchAlbums(a, al) : this.rest.searchAlbums(a, al); }
  getArtistDetails(id: string) { return this.isElectron ? this.ipc.getArtistDetails(id) : this.rest.getArtistDetails(id); }
  getArtistMembers(id: string) { return this.isElectron ? this.ipc.getArtistMembers(id) : this.rest.getArtistMembers(id); }
  getArtistTopTracks(a: string, l?: number) { return this.isElectron ? this.ipc.getArtistTopTracks(a, l) : this.rest.getArtistTopTracks(a, l); }
  getCandidates(id: string) { return this.isElectron ? this.ipc.getCandidates(id) : this.rest.getCandidates(id); }
  applyCandidate(id: string, c: any, o: any) { return this.isElectron ? this.ipc.applyCandidate(id, c, o) : this.rest.applyCandidate(id, c, o); }
  tagAlbumMetadata(id: string, mbid: string) { return this.isElectron ? this.ipc.tagAlbumMetadata(id, mbid) : this.rest.tagAlbumMetadata(id, mbid); }
  previewMatchAlbum(id: string, mbid: string) { return this.isElectron ? this.ipc.previewMatchAlbum(id, mbid) : this.rest.previewMatchAlbum(id, mbid); }
  getSimilarArtists(a: string) { return this.isElectron ? this.ipc.getSimilarArtists(a) : this.rest.getSimilarArtists(a); }
  openExternal(url: string) { return this.isElectron ? this.ipc.openExternal(url) : this.rest.openExternal(url); }
  enrichArtists(ids: string[]) { return this.isElectron ? this.ipc.enrichArtists(ids) : this.rest.enrichArtists(ids); }

  getDrives() { return this.isElectron ? this.ipc.getDrives() : this.rest.getDrives(); }
  getDirectory(p: string) { return this.isElectron ? this.ipc.getDirectory(p) : this.rest.getDirectory(p); }
  browseNative(t?: any) { return this.isElectron ? this.ipc.browseNative(t) : this.rest.browseNative(t); }
  showItemInFolder(p: string) { return this.isElectron ? this.ipc.showItemInFolder(p) : this.rest.showItemInFolder(p); }

  getCoverUrl(id: string) { return this.isElectron ? this.ipc.getCoverUrl(id) : this.rest.getCoverUrl(id); }
  getArtistImageUrl(id: string) { return this.isElectron ? this.ipc.getArtistImageUrl(id) : this.rest.getArtistImageUrl(id); }
  getAudioUrl(id: string) { return this.isElectron ? this.ipc.getAudioUrl(id) : this.rest.getAudioUrl(id); }
  getWaveformUrl(id: string) { return this.isElectron ? this.ipc.getWaveformUrl(id) : this.rest.getWaveformUrl(id); }
  getVibePlaylist(id: string, l?: number) { return this.rest.getVibePlaylist(id, l); }
}

// Export a singleton client instance for the application
export const client: MusicClient = new HybridClient('http://localhost:3000');
