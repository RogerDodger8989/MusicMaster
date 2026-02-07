export interface Track {
    id: string
    filePath: string
    fileHash?: string
    title: string
    artist: string
    album: string
    albumArtist?: string
    year?: number
    genre?: string
    trackNum?: number
    discNum?: number
    duration: number
    bitrate: number
    sampleRate?: number
    bitDepth?: number
    format: 'flac' | 'mp3'
    coverArtPath?: string
    rating: number
    loved: boolean
    playCount: number
    releaseDate?: string
    musicbrainzTrackId?: string
    musicbrainzAlbumId?: string
    // ReplayGain metadata (in dB)
    replayGainTrack?: number
    replayGainAlbum?: number
    replayGainTrackPeak?: number
    replayGainAlbumPeak?: number
    createdAt: Date
    updatedAt: Date
}

export interface Album {
    id: string
    name: string
    artist: string
    year?: number
    genre?: string
    coverArtPath?: string
    discCount: number
    trackCount: number
    totalDuration: number
    rating: number // 0-5
    loved: boolean
    playCount: number
    lastPlayed?: Date
    releaseDate?: string
    musicbrainzAlbumId?: string
    bio?: string
    createdAt: Date
    updatedAt: Date
}

export interface Artist {
    id: string
    name: string
    albumCount: number
    trackCount: number
    bio?: string
    imagePath?: string
    listeners?: string | number
    loved?: boolean
}

export interface ScanProgress {
    isScanning: boolean
    totalFiles: number
    scannedFiles: number
    currentFile: string
    errors: string[]
}

export type ViewMode = 'grid' | 'list' | 'cover'
export type SortField = 'title' | 'artist' | 'album' | 'year' | 'duration' | 'bitrate'
export type SortOrder = 'asc' | 'desc'

export interface FilterOptions {
    search?: string
    artist?: string
    album?: string
    genre?: string
    year?: number
    format?: 'flac' | 'mp3'
}

export interface MusicFolder {
    id: string
    path: string
    name: string
    watchEnabled: boolean
    lastScanned?: Date
    trackCount: number
    createdAt: Date
}

export interface ScanOptions {
    folders: string[]
    fileTypes: string[]
    ignorePatterns?: string[]
}
