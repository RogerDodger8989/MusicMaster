-- MusicMaster MusicBrainz Extended Schema
-- Module 1: Core MusicBrainz ID (MBID) Management & Metadata
-- This schema extends the base database with comprehensive MusicBrainz support

-- ============================================================================
-- MBID CORE TABLES - Central registry for all MusicBrainz identifiers
-- ============================================================================

-- Artists - Extended with MusicBrainz data
-- Handles: Artist names, sort order, type, country, life span, website
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_sort_order TEXT,                    -- How to sort (e.g., "Beatles, The" sorts as "The Beatles")
    mbid TEXT UNIQUE,                        -- MusicBrainz Artist ID
    country TEXT,                            -- ISO 3166-1 alpha-2 code
    area TEXT,                               -- Birth/origin area
    life_span_begin TEXT,                    -- Birth date (YYYY-MM-DD)
    life_span_end TEXT,                      -- Death date (YYYY-MM-DD)
    artist_type TEXT CHECK(artist_type IN ('Person', 'Group', 'Orchestra', 'Choir', 'Character', 'Other')),
    gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
    gender_other TEXT,                       -- If 'Other', store description
    website TEXT,                            -- Official website
    bio TEXT,                                -- Biography/description
    image_path TEXT,                         -- Local image cache
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    loved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, country)                    -- Same artist name in different countries
);

-- Albums - Extended with MusicBrainz data
-- Handles: Album type, status, release info, barcode, labels, etc.
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    album_artist_id TEXT,                    -- Primary artist (FK to artists)
    mbid TEXT UNIQUE,                        -- MusicBrainz Album ID (Release Group)
    album_type TEXT CHECK(album_type IN ('Album', 'EP', 'Single', 'Broadcast', 'Other', 'Compilation', 'Soundtrack', 'Remix Album', 'Live Album')),
    status TEXT CHECK(status IN ('Official', 'Promotion', 'Bootleg', 'Pseudorelease')),
    year INTEGER,                            -- Original release year
    release_date TEXT,                       -- Full release date (YYYY-MM-DD)
    original_release_date TEXT,              -- Original release date if different
    release_country TEXT,                    -- ISO 3166-1 alpha-2 code
    barcode TEXT,                            -- EAN/UPC code
    asin TEXT,                               -- Amazon Standard Identification Number
    script TEXT,                             -- Script code (Latn, Cyrl, etc.)
    language TEXT,                           -- Language code
    release_text_language TEXT,              -- Language of album text/sleeve
    packaging TEXT,                          -- Album packaging type
    disc_count INTEGER DEFAULT 1,
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER,                  -- Total duration in milliseconds
    cover_art_path TEXT,
    rating REAL DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    genre TEXT,                              -- Primary genre (can have multiple via genre_tags table)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_artist_id) REFERENCES artists(id) ON DELETE SET NULL
);

-- Tracks - Extended with MusicBrainz data
-- Handles: Track MBID, multiple artists, work/movement info, recording MBID
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    file_hash TEXT,
    
    -- Basic metadata
    title TEXT NOT NULL,
    artist TEXT,                             -- Semicolon-separated artists (display)
    album TEXT,
    album_artist TEXT,
    year INTEGER,
    genre TEXT,
    track_num INTEGER,
    disc_num INTEGER,
    movement_num INTEGER,                    -- Movement number (e.g., in classical music)
    movement_name TEXT,                      -- Movement name (e.g., "Allegro")
    
    -- MusicBrainz IDs
    mbid TEXT UNIQUE,                        -- MusicBrainz Recording ID
    mbid_track_id TEXT,                      -- MusicBrainz Track ID (different from Recording ID)
    mbid_album_id TEXT,                      -- MusicBrainz Release ID
    mbid_artist_id TEXT,                     -- Primary artist MBID
    mbid_work_id TEXT,                       -- MusicBrainz Work ID (for classical music)
    
    -- Fingerprints & Identification
    acoustid_fingerprint TEXT,               -- AcousticID fingerprint
    acoustid_id TEXT,                        -- AcousticID recording ID
    isrc TEXT,                               -- International Standard Recording Code
    
    -- Audio Properties
    duration INTEGER,
    bitrate INTEGER,
    sample_rate INTEGER,
    bit_depth INTEGER,
    format TEXT CHECK(format IN ('flac', 'mp3', 'ogg', 'aac', 'm4a', 'wma', 'opus')),
    channels INTEGER,
    
    -- Audio Quality & Normalization
    cover_art_path TEXT,
    rating INTEGER DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    
    -- ReplayGain metadata (in dB)
    replaygain_track_gain REAL,
    replaygain_album_gain REAL,
    replaygain_track_peak REAL,
    replaygain_album_peak REAL,
    
    -- Release & Date Info
    release_date TEXT,
    recording_date TEXT,                     -- When track was recorded
    
    -- Metadata Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES music_folders(id) ON DELETE CASCADE
);

-- ============================================================================
-- ARTIST RELATIONSHIP TABLES - Handle multiple artists per track/album
-- ============================================================================

-- Track Artists - Links tracks to multiple artists with roles
-- Handles: Track can have multiple artists, producers, performers, etc.
CREATE TABLE IF NOT EXISTS track_artists (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('Main', 'Featured', 'Guest', 'Remixer', 'Arranger', 'Producer', 'Conductor', 'Performer', 'Composer', 'Lyricist', 'Other')),
    instrument TEXT,                         -- Specific instrument (Vocals, Guitar, Piano, etc.)
    credited_as TEXT,                        -- How they're credited (may differ from artist.name)
    sort_position INTEGER,                   -- Order in credits
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(track_id, artist_id, role, instrument)
);

-- Album Artists - Links albums to multiple artists/labels
-- Handles: Album artists, various artists compilations, etc.
CREATE TABLE IF NOT EXISTS album_artists (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('Main', 'Featured', 'Guest', 'Compilation', 'Various Artists')),
    credited_as TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(album_id, artist_id, role)
);

-- Performers - Detailed performer information
-- Handles: Singers, instrumentalists, orchestras, etc.
CREATE TABLE IF NOT EXISTS performers (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT NOT NULL,                      -- Main, Featured, Guest, Vocals, Guitar, Piano, Drums, Orchestration, etc.
    instrument TEXT,
    credited_as TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Credits - Comprehensive credits for albums
-- Handles: Producers, editors, engineers, conductors, arrangers, etc.
CREATE TABLE IF NOT EXISTS album_credits (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('Producer', 'Editor', 'Engineer', 'Conductor', 'Arranger', 'Composer', 'Lyricist', 'Orchestrator', 'Sound Designer', 'Mixer', 'Mastering Engineer')),
    credited_as TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- ============================================================================
-- RELEASE & PACKAGING INFORMATION
-- ============================================================================

-- Release Info - Different versions/pressings of the same album
-- Handles: Remastered, deluxe editions, regional variants, etc.
CREATE TABLE IF NOT EXISTS release_info (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    mbid TEXT UNIQUE,                        -- MusicBrainz Release ID (specific pressing)
    title TEXT,                              -- Often same as album, but may include "Remastered", etc.
    status TEXT CHECK(status IN ('Official', 'Promotion', 'Bootleg', 'Pseudorelease')),
    release_date TEXT,                       -- YYYY-MM-DD
    release_country TEXT,                    -- ISO country code
    packaging TEXT,                          -- Jewel Case, Digipak, etc.
    barcode TEXT,
    asin TEXT,
    script TEXT,
    language TEXT,
    disc_count INTEGER DEFAULT 1,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Labels - Record labels for albums
-- Handles: Multiple labels (for different regions), catalog numbers, etc.
CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    mbid TEXT UNIQUE,                        -- MusicBrainz Label ID
    label_type TEXT,                         -- Production, Distributor, etc.
    country TEXT,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Album Labels - Links albums to labels with catalog numbers
CREATE TABLE IF NOT EXISTS album_labels (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    release_id TEXT,                         -- Link to specific release variant
    label_id TEXT NOT NULL,
    catalog_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- ============================================================================
-- EXTERNAL LINKS & IDENTIFIERS
-- ============================================================================

-- External Links - Links to other music databases
-- Handles: Discogs, Last.fm, Wikipedia, Wikidata, IMDB, etc.
CREATE TABLE IF NOT EXISTS external_links (
    id TEXT PRIMARY KEY,
    entity_type TEXT CHECK(entity_type IN ('artist', 'album', 'track', 'release', 'label')),
    entity_id TEXT NOT NULL,
    link_type TEXT CHECK(link_type IN ('wikipedia', 'wikidata', 'discogs', 'lastfm', 'imdb', 'musicbrainz', 'bandcamp', 'soundcloud', 'youtube', 'official', 'other')),
    url TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, link_type)
);

-- Identifiers - Store external IDs for entities
-- Handles: Spotify ID, Apple Music ID, ISRC, etc.
CREATE TABLE IF NOT EXISTS external_identifiers (
    id TEXT PRIMARY KEY,
    entity_type TEXT CHECK(entity_type IN ('artist', 'album', 'track')),
    entity_id TEXT NOT NULL,
    identifier_type TEXT CHECK(identifier_type IN ('isrc', 'ean', 'upc', 'asin', 'isil', 'iswc', 'ipi', 'grid', 'spotify', 'apple_music', 'deezer', 'tidal', 'youtube_music', 'bandcamp', 'soundcloud', 'musicbrainz', 'acoustid', 'other')),
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, identifier_type)
);

-- ============================================================================
-- MUSIC METADATA & CLASSIFICATION
-- ============================================================================

-- Genres - Normalized genre table for consistency
-- Handles: Track and album genres with hierarchical structure
CREATE TABLE IF NOT EXISTS genres (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    parent_genre_id TEXT,                    -- For hierarchical genres
    mbid TEXT,                               -- MusicBrainz Genre ID if available
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_genre_id) REFERENCES genres(id) ON DELETE SET NULL
);

-- Genre Tags - Links genres to entities
CREATE TABLE IF NOT EXISTS genre_tags (
    id TEXT PRIMARY KEY,
    entity_type TEXT CHECK(entity_type IN ('artist', 'album', 'track')),
    entity_id TEXT NOT NULL,
    genre_id TEXT NOT NULL,
    confidence REAL CHECK(confidence BETWEEN 0 AND 1),  -- 0-1 confidence score
    sort_position INTEGER,                   -- Primary, secondary, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- Works - For classical music and compositions
-- Handles: Work MBID, composition info, movements, parts
CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY,
    mbid TEXT UNIQUE,                        -- MusicBrainz Work ID
    title TEXT NOT NULL,
    artist_id TEXT,                          -- Composer
    work_type TEXT,                          -- Composition, Opera, Sonata, Symphony, etc.
    language TEXT,                           -- Language of work
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);

-- ============================================================================
-- ACOUSTICBRAINZ & MOOD DATA
-- ============================================================================

-- AcousticBrainz Data - Audio analysis results
-- Handles: BPM, mood, danceability, energy, etc.
CREATE TABLE IF NOT EXISTS acousticbrainz_data (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    mbid TEXT,                               -- MusicBrainz Recording ID
    
    -- Low-level features
    bpm INTEGER,                             -- Beats per minute
    bpm_confidence REAL CHECK(bpm_confidence BETWEEN 0 AND 1),
    
    -- Tonal features
    key TEXT,                                -- Musical key (C, C#, D, etc.)
    key_confidence REAL CHECK(key_confidence BETWEEN 0 AND 1),
    
    -- Mood & Energy (0-1 scale)
    energy REAL CHECK(energy BETWEEN 0 AND 1),
    danceability REAL CHECK(danceability BETWEEN 0 AND 1),
    acousticness REAL CHECK(acousticness BETWEEN 0 AND 1),
    instrumentalness REAL CHECK(instrumentalness BETWEEN 0 AND 1),
    liveness REAL CHECK(liveness BETWEEN 0 AND 1),
    speechiness REAL CHECK(speechiness BETWEEN 0 AND 1),
    valence REAL CHECK(valence BETWEEN 0 AND 1),
    
    -- Loudness
    loudness_integrated REAL,                -- LUFS
    loudness_short_term REAL,                -- LUFS
    
    -- Tempo confidence
    tempo_confidence REAL CHECK(tempo_confidence BETWEEN 0 AND 1),
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- ============================================================================
-- BARCODE & EAN/UPC INFORMATION
-- ============================================================================

-- Barcodes - Store barcode data for albums
CREATE TABLE IF NOT EXISTS barcodes (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL,                -- FK to release_info
    barcode TEXT UNIQUE,
    barcode_type TEXT CHECK(barcode_type IN ('EAN', 'UPC', 'JAN')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE CASCADE
);

-- ============================================================================
-- DISC & TRACK INFORMATION
-- ============================================================================

-- Discs - For multi-disc albums
CREATE TABLE IF NOT EXISTS discs (
    id TEXT PRIMARY KEY,
    release_id TEXT,                         -- FK to release_info
    album_id TEXT NOT NULL,                  -- FK to albums
    disc_num INTEGER,
    title TEXT,                              -- Disc-specific title if any
    disc_id TEXT,                            -- MusicBrainz Disc ID (XA disc ID)
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE SET NULL,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- ============================================================================
-- PERFORMANCE TRACKING
-- ============================================================================

-- Play History (Extended)
CREATE TABLE IF NOT EXISTS play_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    played_at DATETIME NOT NULL,
    play_count INTEGER DEFAULT 1,
    fraction_played REAL DEFAULT 1.0,        -- 0.5 if only played 50% through
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Scrobble Queue (Unchanged, but keeping for completeness)
CREATE TABLE IF NOT EXISTS scrobble_queue (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    album TEXT,
    played_at INTEGER NOT NULL,
    lastfm_submitted INTEGER DEFAULT 0,
    listenbrainz_submitted INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Artist indexes
CREATE INDEX IF NOT EXISTS idx_artists_mbid ON artists(mbid);
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country);
CREATE INDEX IF NOT EXISTS idx_artists_name_sort ON artists(name_sort_order);

-- Album indexes
CREATE INDEX IF NOT EXISTS idx_albums_mbid ON albums(mbid);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date);

-- Track indexes
CREATE INDEX IF NOT EXISTS idx_tracks_mbid ON tracks(mbid);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder_id);
CREATE INDEX IF NOT EXISTS idx_tracks_acoustid ON tracks(acoustid_id);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);

-- Artist relationship indexes
CREATE INDEX IF NOT EXISTS idx_track_artists_track ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_album ON album_artists(album_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_artist ON album_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_performers_track ON performers(track_id);
CREATE INDEX IF NOT EXISTS idx_performers_artist ON performers(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_credits_album ON album_credits(album_id);
CREATE INDEX IF NOT EXISTS idx_album_credits_artist ON album_credits(artist_id);

-- Genre indexes
CREATE INDEX IF NOT EXISTS idx_genre_tags_entity ON genre_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_genre_tags_genre ON genre_tags(genre_id);

-- External data indexes
CREATE INDEX IF NOT EXISTS idx_external_links ON external_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_identifiers ON external_identifiers(entity_type, entity_id);

-- AcousticBrainz indexes
CREATE INDEX IF NOT EXISTS idx_acousticbrainz_track ON acousticbrainz_data(track_id);
CREATE INDEX IF NOT EXISTS idx_acousticbrainz_bpm ON acousticbrainz_data(bpm);
CREATE INDEX IF NOT EXISTS idx_acousticbrainz_key ON acousticbrainz_data(key);

-- Play history indexes
CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_play_history_date ON play_history(played_at);

-- ============================================================================
-- FULL-TEXT SEARCH (Enhanced)
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title,
    artist,
    album,
    genre,
    content=tracks,
    content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS albums_fts USING fts5(
    name,
    artist,
    genre,
    content=albums,
    content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS artists_fts USING fts5(
    name,
    country,
    content=artists,
    content_rowid=rowid
);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Full track view with all relationships
CREATE VIEW IF NOT EXISTS tracks_full AS
SELECT 
    t.id,
    t.title,
    t.album,
    t.year,
    t.duration,
    t.bitrate,
    t.sample_rate,
    t.bit_depth,
    t.format,
    t.rating,
    t.loved,
    t.play_count,
    t.mbid,
    t.mbid_album_id,
    GROUP_CONCAT(DISTINCT a.name, '; ') as all_artists,
    ab.name as album_name,
    ab.mbid as album_mbid,
    a1.bpm,
    a1.key,
    a1.energy,
    a1.danceability
FROM tracks t
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
LEFT JOIN albums ab ON t.album = ab.name
LEFT JOIN acousticbrainz_data a1 ON t.id = a1.track_id
GROUP BY t.id;

-- Album view with artist info
CREATE VIEW IF NOT EXISTS albums_full AS
SELECT 
    al.id,
    al.name,
    al.album_type,
    al.status,
    al.year,
    al.release_date,
    al.disc_count,
    al.track_count,
    al.rating,
    al.loved,
    al.play_count,
    al.mbid,
    ar.name as artist_name,
    ar.mbid as artist_mbid,
    ar.country as artist_country,
    GROUP_CONCAT(DISTINCT ab.name, '; ') as label_names
FROM albums al
LEFT JOIN artists ar ON al.album_artist_id = ar.id
LEFT JOIN album_labels abl ON al.id = abl.album_id
LEFT JOIN labels ab ON abl.label_id = ab.id
GROUP BY al.id;
