// Types shared between renderer and server
import { Album, Artist, Track, MusicFolder, ScanProgress } from '../types';

// Interface defining the contract for both Desktop and Server clients
export interface MusicClient {
  // Albums
  getAlbums(sort?: string, genre?: string): Promise<Album[]>;
  getAlbum(id: string): Promise<Album | null>;
  getAlbumPerformers(id: string): Promise<any[]>;
  updateAlbum(id: string, updates: Partial<Album>): Promise<void>;
  getGenres(): Promise<{ genre: string; count: number }[]>;

  // Artists
  getArtists(): Promise<Artist[]>;
  getArtist(id: string): Promise<Artist | null>;
  updateArtist(id: string, updates: Partial<Artist>): Promise<void>;

  // Tracks
  getTracks(filter?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]>;
  getTrack(id: string): Promise<Track | null>;
  getTrackInfo(id: string): Promise<any>;
  updateTrack(id: string, updates: Partial<Track>): Promise<void>;

  // Interactions
  rateTrack(id: string, rating: number): Promise<void>;
  rateAlbum(id: string, rating: number): Promise<void>;
  toggleTrackLoved(id: string, loved: boolean): Promise<void>;
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
  searchMetadata(artist: string, title?: string, album?: string): Promise<any[]>;
  searchAlbums(artist: string, album: string): Promise<any[]>;
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
  showItemInFolder(path: string): Promise<void>;

  // Media URLs
  getCoverUrl(id: string): string;
  getArtistImageUrl(id: string): string;
  getAudioUrl(id: string): string;
  getWaveformUrl(id: string): string;
  getVibePlaylist(vibeId: string, limit?: number): Promise<Track[]>;
}

// Legacy DOM client (fallback) – minimal stub implementation
export class DomClient implements MusicClient {
  private api = (window as any).api;

  // Albums
  async getAlbums(_sort?: string, _genre?: string): Promise<Album[]> { return []; }
  async getAlbum(_id: string): Promise<Album | null> { return null; }
  async getAlbumPerformers(_id: string): Promise<any[]> { return []; }
  async updateAlbum(_id: string, _updates: Partial<Album>): Promise<void> { }
  async getGenres(): Promise<{ genre: string; count: number }[]> { return []; }

  // Artists
  async getArtists(): Promise<Artist[]> { return []; }
  async getArtist(_id: string): Promise<Artist | null> { return null; }
  async updateArtist(_id: string, _updates: Partial<Artist>): Promise<void> { }

  // Tracks
  async getTracks(_filter?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]> { return []; }
  async getTrack(_id: string): Promise<Track | null> { return null; }
  async getTrackInfo(_id: string): Promise<any> { return null; }
  async updateTrack(_id: string, _updates: Partial<Track>): Promise<void> { }

  // Interactions
  async rateTrack(_id: string, _rating: number): Promise<void> { }
  async rateAlbum(_id: string, _rating: number): Promise<void> { }
  async toggleTrackLoved(_id: string, _loved: boolean): Promise<void> { }
  async toggleAlbumLoved(_id: string, _loved: boolean): Promise<void> { }
  async toggleArtistLoved(_id: string, _loved: boolean): Promise<void> { }

  // Search
  async search(_query: string): Promise<{ artists: Artist[]; albums: Album[]; tracks: Track[]; playlists: any[] }> {
    return { artists: [], albums: [], tracks: [], playlists: [] };
  }

  // Scanning
  async startScan(_folderId: string, _path: string): Promise<void> { }
  async getScanStatus(): Promise<ScanProgress> {
    return { isScanning: false, totalFiles: 0, scannedFiles: 0, currentFile: '', errors: [] };
  }
  async getFolders(): Promise<MusicFolder[]> { return []; }
  async addFolder(_path: string, _watchEnabled: boolean): Promise<void> { }
  async updateFolderWatch(_folderId: string, _watchEnabled: boolean): Promise<void> { }
  async scanFolder(_folderId: string): Promise<void> { }
  async removeFolder(_id: string): Promise<void> { }

  // Playlists
  async getPlaylists(): Promise<any[]> { return []; }
  async createPlaylist(_name: string, _trackIds: string[]): Promise<any> { return null; }
  async deletePlaylist(_id: string): Promise<void> { }
  async addToPlaylist(_id: string, _trackId: string): Promise<void> { }
  async removeFromPlaylist(_id: string, _trackId: string, _position: number): Promise<void> { }
  async removeFromPlaylistById(_id: string, _trackId: string): Promise<void> { }
  async renamePlaylist(_id: string, _name: string): Promise<void> { }
  async reorderPlaylist(_id: string, _trackIds: string[]): Promise<void> { }

  // Smart Playlists
  async getSmartPlaylists(): Promise<any[]> { return []; }
  async getSmartPlaylist(_id: string): Promise<any> { return null; }
  async createSmartPlaylist(_data: any): Promise<any> { return null; }
  async updateSmartPlaylist(_id: string, _data: any): Promise<any> { return null; }
  async deleteSmartPlaylist(_id: string): Promise<void> { }
  async resolveSmartPlaylist(_id: string): Promise<{ tracks: any[]; total: number }> { return { tracks: [], total: 0 }; }
  async previewSmartPlaylist(_data: any): Promise<{ tracks: any[]; total: number }> { return { tracks: [], total: 0 }; }

  // Settings
  async getSettings(): Promise<any> { return {}; }
  async saveSetting(_key: string, _value: any): Promise<void> { }

  // Player
  async getSession(): Promise<any> { return {}; }
  async saveSession(_session: any): Promise<void> { }

  // Scrobble & Auth
  async scrobble(_artist: string, _track: string, _album?: string, _duration?: number, _timestamp?: number): Promise<void> { }
  async updateNowPlaying(_artist: string, _track: string, _album?: string, _duration?: number): Promise<void> { }
  async syncScrobble(_lastfmUsername: string, _listenbrainzUsername: string, _writeToFile?: boolean): Promise<void> { }
  async syncMusicBrainzRatings(): Promise<void> { }
  async getSyncStatus(): Promise<any> { return {}; }
  async getLastFmAuthToken(): Promise<any> { return {}; }
  async createLastFmSession(_token: string): Promise<any> { return {}; }

  // Metadata
  async syncMetadata(): Promise<void> { }
  async getFileSyncStatus(): Promise<any> { return {}; }
  async enhanceLibrary(_writeToFiles?: boolean): Promise<void> { }
  async getEnhanceStatus(): Promise<any> {
    return { isRunning: false, current: 0, total: 0, artistName: '', percentage: 0, errors: [] };
  }
  async getCoverage(): Promise<any> { return {}; }
  async searchMetadata(_artist: string, _title?: string, _album?: string): Promise<any[]> { return []; }
  async searchAlbums(_artist: string, _album: string): Promise<any[]> { return []; }
  async getArtistDetails(_id: string): Promise<any> { return {}; }
  async getArtistMembers(_id: string): Promise<any[]> { return []; }
  async getArtistTopTracks(_artist: string, _limit?: number): Promise<{ name: string; playcount: string }[]> { return []; }
  async getCandidates(_trackId: string): Promise<{ candidates: any[] }> { return { candidates: [] }; }
  async applyCandidate(_trackId: string, _candidate: any, _options: { writeToFile: boolean; selectedFields?: string[] }): Promise<void> { }
  async tagAlbumMetadata(_albumId: string, _mbAlbumId: string): Promise<number> { return 0; }
  async previewMatchAlbum(_albumId: string, _mbAlbumId: string): Promise<any[]> { return []; }
  async getSimilarArtists(_artist: string): Promise<any[]> { return []; }
  async openExternal(url: string): Promise<void> {
    if (this.api?.util?.openExternal) {
      this.api.util.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }
  async enrichArtists(_artistIds: string[]): Promise<void> { }

  // System
  async getDrives(): Promise<any[]> { return []; }
  async getDirectory(_path: string): Promise<any[]> { return []; }
  async showItemInFolder(path: string): Promise<void> {
    if (this.api?.util?.showItemInFolder) {
      this.api.util.showItemInFolder(path);
    }
  }

  // Media URLs
  getCoverUrl(_id: string): string { return ''; }
  getArtistImageUrl(_id: string): string { return ''; }
  getAudioUrl(_id: string): string { return ''; }
  getWaveformUrl(_id: string): string { return ''; }
  async getVibePlaylist(_vibeId: string, _limit?: number): Promise<Track[]> { return []; }
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

  async updateAlbum(id: string, updates: Partial<Album>): Promise<void> {
    await this.req<void>(`/api/albums/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  }

  // Tracks
  async getTracks(filter?: { folderId?: string; albumId?: string; artistId?: string }): Promise<Track[]> {
    const params = new URLSearchParams(filter as any);
    return this.req<Track[]>(`/api/tracks?${params.toString()}`);
  }

  async getTrack(id: string): Promise<Track | null> {
    return this.req<Track | null>(`/api/tracks/${id}`);
  }

  async getTrackInfo(id: string): Promise<any> {
    return this.req<any>(`/api/tracks/${id}/info`);
  }

  async updateTrack(id: string, updates: Partial<Track>): Promise<void> {
    await this.req<void>(`/api/tracks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  }

  // Interactions
  async rateTrack(id: string, rating: number): Promise<void> {
    await this.req<void>(`/api/tracks/${id}/rating?rating=${rating}`, { method: 'POST' });
  }

  async rateAlbum(id: string, rating: number): Promise<void> {
    await this.req<void>(`/api/albums/${id}/rating?rating=${rating}`, { method: 'POST' });
  }

  async toggleTrackLoved(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/tracks/${id}/loved?loved=${loved}`, { method: 'POST' });
  }

  async toggleAlbumLoved(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/albums/${id}/loved?loved=${loved}`, { method: 'POST' });
  }

  async toggleArtistLoved(id: string, loved: boolean): Promise<void> {
    await this.req<void>(`/api/artists/${id}/loved?loved=${loved}`, { method: 'POST' });
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

  async searchMetadata(artist: string, title?: string, album?: string): Promise<any[]> {
    const params = new URLSearchParams({ artist });
    if (title) params.append('title', title);
    if (album) params.append('album', album);
    return this.req<any[]>(`/api/metadata/search?${params.toString()}`);
  }

  async searchAlbums(artist: string, album: string): Promise<any[]> {
    const params = new URLSearchParams({ artist, album });
    return this.req<any[]>(`/api/metadata/searchAlbums?${params.toString()}`);
  }

  async getArtistDetails(id: string): Promise<any> {
    return this.req<any>(`/api/metadata/artist/${id}`);
  }

  async getArtistMembers(id: string): Promise<any[]> {
    return this.req<any[]>(`/api/metadata/artist/${id}/members`);
  }

  async getArtistTopTracks(artist: string, limit: number = 50): Promise<{ name: string; playcount: string }[]> {
    return this.req<any[]>(`/api/metadata/artist/${encodeURIComponent(artist)}/top-tracks?limit=${limit}`);
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
    return this.req<any[]>(`/api/musicbrainz/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId, mbAlbumId })
    });
  }

  async getSimilarArtists(artist: string): Promise<any[]> {
    return this.req<any[]>(`/api/musicbrainz/similar?artist=${encodeURIComponent(artist)}`);
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  async enrichArtists(artistIds: string[]): Promise<void> {
    await this.req<void>(`/api/metadata/enrich`, {
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
}

// Export a singleton client instance for the application
export const client = new RestClient('http://localhost:3000');
