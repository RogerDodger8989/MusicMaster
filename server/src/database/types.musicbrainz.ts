/**
 * MusicBrainz Database Types - Module 1
 * Comprehensive type definitions for MusicBrainz schema
 */

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface DbArtist {
    id: string
    name: string
    name_sort_order: string | null
    mbid: string | null
    country: string | null
    area: string | null
    life_span_begin: string | null
    life_span_end: string | null
    artist_type: 'Person' | 'Group' | 'Orchestra' | 'Choir' | 'Character' | 'Other' | null
    gender: 'Male' | 'Female' | 'Other' | null
    gender_other: string | null
    website: string | null
    bio: string | null
    image_path: string | null
    album_count: number
    track_count: number
    loved: number
    created_at: string
    updated_at: string
}

export interface DbAlbum {
    id: string
    name: string
    album_artist_id: string | null
    mbid: string | null
    album_type: 'Album' | 'EP' | 'Single' | 'Broadcast' | 'Other' | 'Compilation' | 'Soundtrack' | 'Remix Album' | 'Live Album' | null
    release_group_mbid: string | null
    status: 'Official' | 'Promotion' | 'Bootleg' | 'Pseudorelease' | null
    release_title: string | null
    year: number | null
    release_date: string | null
    original_release_date: string | null
    release_country: string | null
    barcode: string | null
    asin: string | null
    label: string | null
    catalog_number: string | null
    script: string | null
    language: string | null
    release_text_language: string | null
    packaging: string | null
    disc_count: number
    track_count: number
    total_duration: number | null
    cover_art_path: string | null
    rating: number
    loved: number
    play_count: number
    last_played: string | null
    genre: string | null
    created_at: string
    updated_at: string
}

export interface DbTrack {
    id: string
    folder_id: string
    file_path: string
    file_hash: string | null
    title: string
    artist: string | null
    album: string | null
    album_artist: string | null
    year: number | null
    genre: string | null
    track_num: number | null
    disc_num: number | null
    movement_num: number | null
    movement_name: string | null
    mbid: string | null
    musicbrainz_track_id: string | null
    musicbrainz_album_id: string | null
    musicbrainz_artist_id: string | null
    musicbrainz_work_id: string | null
    musicbrainz_release_group_id: string | null
    acoustid_fingerprint: string | null
    acoustid_id: string | null
    isrc: string | null
    duration: number | null
    bitrate: number | null
    sample_rate: number | null
    bit_depth: number | null
    format: 'flac' | 'mp3' | 'ogg' | 'aac' | 'm4a' | 'wma' | 'opus' | null
    channels: number | null
    cover_art_path: string | null
    rating: number
    loved: number
    play_count: number
    last_played: string | null
    release_date: string | null
    recording_date: string | null
    publisher: string | null
    replaygain_track_gain: number | null
    replaygain_album_gain: number | null
    replaygain_track_peak: number | null
    replaygain_album_peak: number | null
    created_at: string
    updated_at: string
}

// ============================================================================
// ARTIST RELATIONSHIPS
// ============================================================================

export interface DbTrackArtist {
    id: string
    track_id: string
    artist_id: string
    role: 'Main' | 'Featured' | 'Guest' | 'Remixer' | 'Arranger' | 'Producer' | 'Conductor' | 'Performer' | 'Composer' | 'Lyricist' | 'Other'
    instrument: string | null
    credited_as: string | null
    join_phrase: string | null
    sort_position: number | null
    created_at: string
}

export interface DbAlbumArtist {
    id: string
    album_id: string
    artist_id: string
    role: 'Main' | 'Featured' | 'Guest' | 'Compilation' | 'Various Artists'
    credited_as: string | null
    join_phrase: string | null
    sort_position: number | null
    created_at: string
}

export interface DbPerformer {
    id: string
    track_id: string
    artist_id: string
    role: string
    instrument: string | null
    credited_as: string | null
    sort_position: number | null
    created_at: string
}

export interface DbAlbumCredit {
    id: string
    album_id: string
    artist_id: string
    role: 'Producer' | 'Editor' | 'Engineer' | 'Conductor' | 'Arranger' | 'Composer' | 'Lyricist' | 'Orchestrator' | 'Sound Designer' | 'Mixer' | 'Mastering Engineer'
    credited_as: string | null
    sort_position: number | null
    created_at: string
}

// ============================================================================
// RELEASE & PACKAGING
// ============================================================================

export interface DbReleaseInfo {
    id: string
    album_id: string
    mbid: string | null
    title: string | null
    status: 'Official' | 'Promotion' | 'Bootleg' | 'Pseudorelease' | null
    release_date: string | null
    release_country: string | null
    packaging: string | null
    barcode: string | null
    asin: string | null
    script: string | null
    language: string | null
    disc_count: number
    track_count: number
    created_at: string
}

export interface DbLabel {
    id: string
    name: string
    mbid: string | null
    label_type: string | null
    country: string | null
    website: string | null
    created_at: string
}

export interface DbAlbumLabel {
    id: string
    album_id: string
    release_id: string | null
    label_id: string
    catalog_number: string | null
    created_at: string
}

// ============================================================================
// EXTERNAL LINKS & IDENTIFIERS
// ============================================================================

export interface DbExternalLink {
    id: string
    entity_type: 'artist' | 'album' | 'track' | 'release' | 'label'
    entity_id: string
    link_type: 'wikipedia' | 'wikidata' | 'discogs' | 'lastfm' | 'imdb' | 'musicbrainz' | 'bandcamp' | 'soundcloud' | 'youtube' | 'official' | 'other'
    url: string
    description: string | null
    created_at: string
}

export interface DbExternalIdentifier {
    id: string
    entity_type: 'artist' | 'album' | 'track'
    entity_id: string
    identifier_type: 'isrc' | 'ean' | 'upc' | 'asin' | 'isil' | 'iswc' | 'ipi' | 'grid' | 'spotify' | 'apple_music' | 'deezer' | 'tidal' | 'youtube_music' | 'bandcamp' | 'soundcloud' | 'musicbrainz' | 'acoustid' | 'other'
    value: string
    created_at: string
}

// ============================================================================
// MUSIC METADATA & CLASSIFICATION
// ============================================================================

export interface DbGenre {
    id: string
    name: string
    parent_genre_id: string | null
    mbid: string | null
    created_at: string
}

export interface DbGenreTag {
    id: string
    entity_type: 'artist' | 'album' | 'track'
    entity_id: string
    genre_id: string
    confidence: number
    sort_position: number | null
    created_at: string
}

export interface DbWork {
    id: string
    mbid: string | null
    title: string
    artist_id: string | null
    work_type: string | null
    language: string | null
    description: string | null
    created_at: string
}

// ============================================================================
// ACOUSTICBRAINZ DATA
// ============================================================================

export interface DbAcousticBrainzData {
    id: string
    track_id: string
    mbid: string | null
    bpm: number | null
    bpm_confidence: number | null
    key: string | null
    key_confidence: number | null
    energy: number | null
    danceability: number | null
    acousticness: number | null
    instrumentalness: number | null
    liveness: number | null
    speechiness: number | null
    valence: number | null
    loudness_integrated: number | null
    loudness_short_term: number | null
    tempo_confidence: number | null
    mood_acoustic: number | null
    mood_aggressive: number | null
    mood_electronic: number | null
    mood_happy: number | null
    mood_sad: number | null
    mood_relaxed: number | null
    mood_party: number | null
    updated_at: string
    created_at: string
}

// ============================================================================
// BARCODE & DISC INFORMATION
// ============================================================================

export interface DbBarcode {
    id: string
    release_id: string
    barcode: string
    barcode_type: 'EAN' | 'UPC' | 'JAN'
    created_at: string
}

export interface DbDisc {
    id: string
    release_id: string | null
    album_id: string
    disc_num: number | null
    title: string | null
    disc_id: string | null
    track_count: number
    created_at: string
}

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

export interface DbPlayHistory {
    id: string
    track_id: string
    played_at: string
    play_count: number
    fraction_played: number
    created_at: string
}

// ============================================================================
// COMPOSITE/VIEW INTERFACES
// ============================================================================

/**
 * Complete track information with all relationships
 */
export interface TrackFull {
    id: string
    title: string
    album: string | null
    year: number | null
    duration: number | null
    bitrate: number | null
    sample_rate: number | null
    bit_depth: number | null
    format: string | null
    rating: number
    loved: number
    play_count: number
    mbid: string | null
    musicbrainz_track_id: string | null
    musicbrainz_album_id: string | null

    // Artists
    all_artists: string | null  // Semicolon-separated

    // Album
    album_name: string | null
    album_mbid: string | null

    // Audio Analysis
    bpm: number | null
    key: string | null
    energy: number | null
    danceability: number | null
}

/**
 * Complete album information with all relationships
 */
export interface AlbumFull {
    id: string
    name: string
    album_type: string | null
    status: string | null
    year: number | null
    release_date: string | null
    disc_count: number
    track_count: number
    rating: number
    loved: number
    play_count: number
    mbid: string | null

    // Artist
    artist_name: string | null
    artist_mbid: string | null
    artist_country: string | null

    // Label
    label_names: string | null  // Semicolon-separated
}

// ============================================================================
// API RESPONSE TYPES (for MusicBrainz API)
// ============================================================================

/**
 * MusicBrainz Artist API Response (simplified)
 */
export interface MBArtistResponse {
    id: string
    name: string
    'sort-name': string
    type: string
    country: string
    area: {
        name: string
    }
    'life-span': {
        begin: string
        end: string
        ended: boolean
    }
    relations?: Array<{
        type: string
        url: {
            resource: string
        }
    }>
}

/**
 * MusicBrainz Album (Release) API Response (simplified)
 */
export interface MBReleaseResponse {
    id: string
    title: string
    'artist-credit': Array<{
        artist: {
            id: string
            name: string
        }
        name: string
    }>
    status: string
    date: string
    'release-group': {
        'primary-type': string
    }
    media: Array<{
        'disc-count': number
        'track-count': number
    }>
    barcode: string
    packaging: string
    relations?: Array<{
        type: string
        url: {
            resource: string
        }
    }>
}

/**
 * MusicBrainz Recording (Track) API Response (simplified)
 */
export interface MBRecordingResponse {
    id: string
    title: string
    'artist-credit': Array<{
        artist: {
            id: string
            name: string
        }
        name: string
    }>
    length: number
    isrcs: string[]
    relations?: Array<{
        type: string
        url: {
            resource: string
        }
    }>
}

/**
 * AcousticBrainz API Response
 */
export interface AcousticBrainzResponse {
    mbid: string
    result: {
        features: {
            bpm: number
            key_key: string
            key_scale: string
        }
        highlevel: {
            danceability: {
                danceable: number
                not_danceable: number
            }
            energy: {
                energetic: number
                not_energetic: number
            }
            mood_acoustic: {
                acoustic: number
                not_acoustic: number
            }
        }
    }
}

// ============================================================================
// INPUT/PROCESSING TYPES
// ============================================================================

/**
 * Artist for importing/processing
 */
export interface ArtistInput {
    name: string
    mbid?: string
    country?: string
    bio?: string
    imageUrl?: string
    externalLinks?: {
        type: string
        url: string
    }[]
}

/**
 * Album for importing/processing
 */
export interface AlbumInput {
    name: string
    artists: string[]
    mbid?: string
    type?: string
    releaseDate?: string
    barcode?: string
    labels?: string[]
    externalLinks?: {
        type: string
        url: string
    }[]
}

/**
 * Track for importing/processing with full artist info
 */
export interface TrackInput {
    title: string
    artists: Array<{
        name: string
        mbid?: string
        role?: string
    }>
    album: string
    mbid?: string
    Duration?: number
    isrc?: string
    externalLinks?: {
        type: string
        url: string
    }[]
}
