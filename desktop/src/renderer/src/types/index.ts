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
  musicbrainzArtistId?: string
  musicbrainzRecordingId?: string
  musicbrainzReleaseGroupId?: string
  musicbrainzWorkId?: string
  albumId?: string // Joined from albums_cache for navigation
  // ReplayGain metadata (in dB)
  replayGainTrack?: number
  replayGainAlbum?: number
  replayGainTrackPeak?: number
  replayGainAlbumPeak?: number

  // Audio Analysis (AcousticBrainz)
  bpm?: number
  key?: string
  moodAcoustic?: number
  moodAggressive?: number
  moodElectronic?: number
  moodHappy?: number
  moodSad?: number
  moodRelaxed?: number
  moodParty?: number
  energy?: number
  danceability?: number

  composer?: string
  lyrics?: string
  comment?: string
  trackTotal?: number
  discTotal?: number
  instrumentalness?: number
  mood?: string
  publisher?: string
  conductor?: string
  grouping?: string
  albumRating?: number
  originalArtist?: string
  originalAlbum?: string
  originalYear?: number
  tempo?: string
  occasion?: string
  keywords?: string
  language?: string
  // Utgivningsfält
  barcode?: string
  script?: string
  releaseCountry?: string
  releaseStatus?: string
  releaseType?: string
  lyricist?: string
  arranger?: string
  mixer?: string
  catalogNumber?: string
  // Custom-fält
  custom1?: string
  custom2?: string
  custom3?: string
  custom4?: string
  custom5?: string
  custom6?: string
  custom7?: string
  custom8?: string
  custom9?: string
  custom10?: string
  custom11?: string
  custom12?: string
  custom13?: string
  custom14?: string
  custom15?: string
  custom16?: string
  custom17?: string
  custom18?: string
  custom19?: string
  custom20?: string

  createdAt: Date
  updatedAt: Date
  performers?: Array<{ name: string; role: string; id: string }>
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
  label?: string
  country?: string
  catalogNumber?: string
  barcode?: string
  albumType?: string
  status?: string
  enrichedAt?: Date
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
  musicbrainzArtistId?: string
  country?: string
  lifeSpanBegin?: string
  lifeSpanEnd?: string
  type?: string
  gender?: string
  website?: string
  listeners?: string | number
  loved: boolean
}

export interface ScanProgress {
  isScanning: boolean
  totalFiles: number
  scannedFiles: number
  currentFile: string
  errors: string[]
}

export type ViewMode = 'grid' | 'list' | 'cover'
export type SortField = 'title' | 'artist' | 'album' | 'year' | 'duration' | 'bitrate' | 'playCount' | 'rating' | 'createdAt'
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
