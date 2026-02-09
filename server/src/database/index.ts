import Database from 'better-sqlite3'
import path from 'path'
import * as fs from 'fs'

let db: Database.Database | null = null

// SQL Schema - Load MusicBrainz extended schema
const SCHEMA_MB = `
-- ============================================================================
-- MUSICBRAINZ EXTENDED SCHEMA - Module 1
-- ============================================================================

-- Extended Artists table with MusicBrainz support
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_sort_order TEXT,
    mbid TEXT UNIQUE,
    country TEXT,
    area TEXT,
    life_span_begin TEXT,
    life_span_end TEXT,
    artist_type TEXT,
    gender TEXT,
    gender_other TEXT,
    website TEXT,
    bio TEXT,
    image_path TEXT,
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    loved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, country)
);

-- Extended Albums table with MusicBrainz support
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    album_artist_id TEXT,
    mbid TEXT UNIQUE,
    album_type TEXT,
    release_group_mbid TEXT,
    status TEXT,
    release_title TEXT, -- e.g. "Remastered"
    year INTEGER,
    release_date TEXT,
    original_release_date TEXT,
    release_country TEXT,
    barcode TEXT,
    asin TEXT,
    label TEXT, -- Primary label name (denormalized for convenience)
    catalog_number TEXT,
    script TEXT,
    language TEXT,
    release_text_language TEXT,
    packaging TEXT,
    disc_count INTEGER DEFAULT 1,
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER,
    cover_art_path TEXT,
    rating REAL DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    genre TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_artist_id) REFERENCES artists(id) ON DELETE SET NULL
);

-- Artist relationships for tracks
CREATE TABLE IF NOT EXISTS track_artists (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT,
    instrument TEXT,
    credited_as TEXT,
    join_phrase TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(track_id, artist_id, role, instrument)
);

-- Artist relationships for albums
CREATE TABLE IF NOT EXISTS album_artists (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT,
    credited_as TEXT,
    join_phrase TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums_cache(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(album_id, artist_id, role)
);

-- Performers info
CREATE TABLE IF NOT EXISTS performers (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT NOT NULL,
    instrument TEXT,
    credited_as TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(track_id, artist_id, role)
);

-- Album credits
CREATE TABLE IF NOT EXISTS album_credits (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    role TEXT,
    credited_as TEXT,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums_cache(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
    UNIQUE(album_id, artist_id, role)
);

-- Release info for different pressings
CREATE TABLE IF NOT EXISTS release_info (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    mbid TEXT UNIQUE,
    title TEXT,
    status TEXT,
    release_date TEXT,
    release_country TEXT,
    packaging TEXT,
    barcode TEXT,
    asin TEXT,
    script TEXT,
    language TEXT,
    disc_count INTEGER DEFAULT 1,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums_cache(id) ON DELETE CASCADE
);

-- Labels
CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    mbid TEXT UNIQUE,
    label_type TEXT,
    country TEXT,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Album labels
CREATE TABLE IF NOT EXISTS album_labels (
    id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    release_id TEXT,
    label_id TEXT NOT NULL,
    catalog_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (album_id) REFERENCES albums_cache(id) ON DELETE CASCADE,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE SET NULL,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- External links
CREATE TABLE IF NOT EXISTS external_links (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    link_type TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, link_type)
);

-- External identifiers
CREATE TABLE IF NOT EXISTS external_identifiers (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, identifier_type)
);

-- Genres
CREATE TABLE IF NOT EXISTS genres (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    parent_genre_id TEXT,
    mbid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_genre_id) REFERENCES genres(id) ON DELETE SET NULL
);

-- Genre tags
CREATE TABLE IF NOT EXISTS genre_tags (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    genre_id TEXT NOT NULL,
    confidence REAL,
    sort_position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- Works (for classical music)
CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY,
    mbid TEXT UNIQUE,
    title TEXT NOT NULL,
    artist_id TEXT,
    work_type TEXT,
    language TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
);

-- AcousticBrainz data
CREATE TABLE IF NOT EXISTS acousticbrainz_data (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    mbid TEXT,
    bpm INTEGER,
    bpm_confidence REAL,
    key TEXT,
    key_confidence REAL,
    energy REAL,
    danceability REAL,
    acousticness REAL,
    instrumentalness REAL,
    liveness REAL,
    speechiness REAL,
    valence REAL,
    loudness_integrated REAL,
    loudness_short_term REAL,
    tempo_confidence REAL,
    mood_acoustic REAL,
    mood_aggressive REAL,
    mood_electronic REAL,
    mood_happy REAL,
    mood_sad REAL,
    mood_relaxed REAL,
    mood_party REAL,
    key_signature TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Custom vibes created by user
CREATE TABLE IF NOT EXISTS custom_vibes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    description TEXT,
    energy_min REAL,
    energy_max REAL,
    danceability_min REAL,
    danceability_max REAL,
    mood_filters TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Barcodes
CREATE TABLE IF NOT EXISTS barcodes (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL,
    barcode TEXT UNIQUE,
    barcode_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE CASCADE
);

-- Discs
CREATE TABLE IF NOT EXISTS discs (
    id TEXT PRIMARY KEY,
    release_id TEXT,
    album_id TEXT NOT NULL,
    disc_num INTEGER,
    title TEXT,
    disc_id TEXT,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES release_info(id) ON DELETE SET NULL,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Indexes for MusicBrainz data
CREATE INDEX IF NOT EXISTS idx_artists_mbid ON artists(mbid);
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);

CREATE INDEX IF NOT EXISTS idx_albums_mbid ON albums(mbid);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(album_artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date);

CREATE INDEX IF NOT EXISTS idx_track_artists_track ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_album ON album_artists(album_id);
CREATE INDEX IF NOT EXISTS idx_album_artists_artist ON album_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_performers_track ON performers(track_id);
CREATE INDEX IF NOT EXISTS idx_performers_artist ON performers(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_credits_album ON album_credits(album_id);

CREATE INDEX IF NOT EXISTS idx_genre_tags_entity ON genre_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_genre_tags_genre ON genre_tags(genre_id);

CREATE INDEX IF NOT EXISTS idx_external_links ON external_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_identifiers ON external_identifiers(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_acousticbrainz_track ON acousticbrainz_data(track_id);
CREATE INDEX IF NOT EXISTS idx_acousticbrainz_bpm ON acousticbrainz_data(bpm);
CREATE INDEX IF NOT EXISTS idx_acousticbrainz_key ON acousticbrainz_data(key);
`

// Legacy schema (kept for backward compatibility)
const SCHEMA = `
CREATE TABLE IF NOT EXISTS music_folders (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    watch_enabled INTEGER DEFAULT 0,
    last_scanned DATETIME,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    file_hash TEXT,
    title TEXT,
    artist TEXT,
    album TEXT,
    album_artist TEXT,
    year INTEGER,
    genre TEXT,
    track_num INTEGER,
    disc_num INTEGER,
    duration INTEGER,
    bitrate INTEGER,
    sample_rate INTEGER,
    bit_depth INTEGER,
    format TEXT CHECK(format IN ('flac', 'mp3')),
    cover_art_path TEXT,
    rating REAL DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    release_date TEXT,
    musicbrainz_track_id TEXT,
    musicbrainz_album_id TEXT,
    musicbrainz_artist_id TEXT,
    publisher TEXT,
    isrc TEXT,
    musicbrainz_recording_id TEXT,
    musicbrainz_release_group_id TEXT,
    musicbrainz_work_id TEXT,
    replaygain_track_gain REAL,
    replaygain_album_gain REAL,
    replaygain_track_peak REAL,
    replaygain_album_peak REAL,
    movement TEXT,
    movement_num INTEGER,
    movement_total INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES music_folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS albums_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER,
    release_date TEXT,
    genre TEXT,
    disc_count INTEGER DEFAULT 1,
    track_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    cover_art_path TEXT,
    musicbrainz_album_id TEXT,
    album_type TEXT,
    status TEXT,
    original_release_date TEXT,
    label TEXT,
    catalog_number TEXT,
    barcode TEXT,
    country TEXT,
    media TEXT,
    release_group_mbid TEXT,
    lastfm_url TEXT,
    rating REAL DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    enriched_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, artist)
);

CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    bio TEXT,
    image_path TEXT,
    musicbrainz_artist_id TEXT,
    country TEXT,
    life_span_begin TEXT,
    life_span_end TEXT,
    type TEXT,
    gender TEXT,
    website TEXT,
    loved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

CREATE TABLE IF NOT EXISTS playback_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_played INTEGER,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_history (
    id TEXT PRIMARY KEY,
    folder_id TEXT,
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    files_scanned INTEGER DEFAULT 0,
    files_added INTEGER DEFAULT 0,
    files_updated INTEGER DEFAULT 0,
    files_removed INTEGER DEFAULT 0,
    errors TEXT,
    FOREIGN KEY (folder_id) REFERENCES music_folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playback_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    current_track_id TEXT,
    queue_ids TEXT, -- JSON array of track IDs
    current_index INTEGER DEFAULT -1,
    volume REAL DEFAULT 1.0,
    is_shuffle INTEGER DEFAULT 0,
    repeat_mode TEXT DEFAULT 'normal',
    current_time REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year);
CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder_id);
CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating DESC);
CREATE INDEX IF NOT EXISTS idx_albums_cache_genre ON albums_cache(genre);
CREATE INDEX IF NOT EXISTS idx_albums_cache_rating ON albums_cache(rating DESC);
CREATE INDEX IF NOT EXISTS idx_albums_cache_last_played ON albums_cache(last_played DESC);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_playback_history_track ON playback_history(track_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_played_at ON playback_history(played_at DESC);

-- ============================================================================
-- ENRICHMENT LOG - Phase 9
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_log (
    id TEXT PRIMARY KEY,
    album_mbid TEXT,
    status TEXT DEFAULT 'pending',
    performers_fetched INTEGER DEFAULT 0,
    acousticbrainz_fetched INTEGER DEFAULT 0,
    relationships_fetched INTEGER DEFAULT 0,
    tracks_updated INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_album ON enrichment_log(album_mbid);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_status ON enrichment_log(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_created ON enrichment_log(created_at DESC);
`

/**
 * Initialize the SQLite database
 */
export function initDatabase(): Database.Database {
    if (db) return db

    try {
        // Use environment variable or local data directory
        const userDataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data')

        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true })
        }

        const dbPath = path.join(userDataPath, 'musicmaster.db')

        console.log('Initializing database at:', dbPath)

        // Create database connection
        db = new Database(dbPath)

        // Enable foreign keys
        db.pragma('foreign_keys = ON')

        // Execute MusicBrainz extended schema first (Module 1)
        console.log('Loading MusicBrainz extended schema (Module 1)...')
        const mbStatements = SCHEMA_MB.split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        for (const statement of mbStatements) {
            try {
                db.exec(statement)
            } catch (error) {
                // Ignore"table already exists" errors
                if (!(error as Error).message.includes('already exists')) {
                    console.error('Error executing MusicBrainz schema statement:', error)
                }
            }
        }

        // Execute legacy schema (split by semicolon and execute each statement)
        const statements = SCHEMA.split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        for (const statement of statements) {
            try {
                db.exec(statement)
            } catch (error) {
                // Ignore table/index already exists errors
                if (!(error as Error).message.includes('already exists')) {
                    console.error('Error executing legacy schema statement:', error)
                }
            }
        }

        // Run migrations for existing tables (ignore errors if columns exist)
        const migrations = [
            // Basic tracks columns
            "ALTER TABLE tracks ADD COLUMN rating REAL DEFAULT 0",
            "ALTER TABLE tracks ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0",
            "ALTER TABLE tracks ADD COLUMN last_played DATETIME",
            "ALTER TABLE tracks ADD COLUMN release_date TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_track_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_album_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_artist_id TEXT",
            "ALTER TABLE tracks ADD COLUMN sample_rate INTEGER",
            "ALTER TABLE tracks ADD COLUMN bit_depth INTEGER",
            "ALTER TABLE tracks ADD COLUMN replaygain_track_gain REAL",
            "ALTER TABLE tracks ADD COLUMN replaygain_album_gain REAL",
            "ALTER TABLE tracks ADD COLUMN replaygain_track_peak REAL",
            "ALTER TABLE tracks ADD COLUMN replaygain_album_peak REAL",

            // Extended MusicBrainz tracks columns
            "ALTER TABLE tracks ADD COLUMN movement_num INTEGER",
            "ALTER TABLE tracks ADD COLUMN movement TEXT",
            "ALTER TABLE tracks ADD COLUMN movement_total INTEGER",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_track_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_album_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_artist_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_work_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_release_group_id TEXT",
            "ALTER TABLE tracks ADD COLUMN musicbrainz_recording_id TEXT",
            "ALTER TABLE tracks ADD COLUMN mbid TEXT",
            "ALTER TABLE tracks ADD COLUMN recording_date TEXT",

            // Albums cache columns
            "ALTER TABLE albums_cache ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE albums_cache ADD COLUMN bio TEXT",
            "ALTER TABLE albums_cache ADD COLUMN album_type TEXT",
            "ALTER TABLE albums_cache ADD COLUMN status TEXT",
            "ALTER TABLE albums_cache ADD COLUMN original_release_date TEXT",
            "ALTER TABLE albums_cache ADD COLUMN label TEXT",
            "ALTER TABLE albums_cache ADD COLUMN catalog_number TEXT",
            "ALTER TABLE albums_cache ADD COLUMN barcode TEXT",
            "ALTER TABLE albums_cache ADD COLUMN country TEXT",
            "ALTER TABLE albums_cache ADD COLUMN media TEXT",
            "ALTER TABLE albums_cache ADD COLUMN release_group_mbid TEXT",
            "ALTER TABLE albums_cache ADD COLUMN release_title TEXT",
            "ALTER TABLE albums_cache ADD COLUMN enriched_at DATETIME",
            "ALTER TABLE albums_cache ADD COLUMN script TEXT",
            "ALTER TABLE albums_cache ADD COLUMN total_discs INTEGER",
            "ALTER TABLE albums_cache ADD COLUMN total_tracks INTEGER",

            // Missing tracks columns for MusicBrainz
            "ALTER TABLE tracks ADD COLUMN movement TEXT",
            "ALTER TABLE tracks ADD COLUMN movement_num INTEGER",
            "ALTER TABLE tracks ADD COLUMN movement_total INTEGER",

            // Missing acousticbrainz columns
            "ALTER TABLE acousticbrainz_data ADD COLUMN key_signature TEXT",

            // Extended albums columns (if using non-MB schema)
            "ALTER TABLE albums ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE albums ADD COLUMN bio TEXT",
            "ALTER TABLE albums ADD COLUMN mbid TEXT",

            // Artists columns
            "ALTER TABLE artists ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE artists ADD COLUMN musicbrainz_artist_id TEXT",
            "ALTER TABLE artists ADD COLUMN country TEXT",
            "ALTER TABLE artists ADD COLUMN life_span_begin TEXT",
            "ALTER TABLE artists ADD COLUMN life_span_end TEXT",
            "ALTER TABLE artists ADD COLUMN type TEXT",
            "ALTER TABLE artists ADD COLUMN gender TEXT",
            "ALTER TABLE artists ADD COLUMN website TEXT",

            // Extended artists columns
            "ALTER TABLE artists ADD COLUMN name_sort_order TEXT",
            "ALTER TABLE artists ADD COLUMN mbid TEXT",
            "ALTER TABLE artists ADD COLUMN area TEXT",
            "ALTER TABLE artists ADD COLUMN artist_type TEXT",
            "ALTER TABLE artists ADD COLUMN gender_other TEXT",

            "ALTER TABLE track_artists ADD COLUMN join_phrase TEXT",
            "ALTER TABLE album_artists ADD COLUMN join_phrase TEXT",
            "ALTER TABLE albums ADD COLUMN release_group_mbid TEXT",
            "ALTER TABLE albums ADD COLUMN release_title TEXT",
            "ALTER TABLE albums ADD COLUMN label TEXT",
            "ALTER TABLE albums ADD COLUMN catalog_number TEXT",
            "ALTER TABLE tracks ADD COLUMN publisher TEXT",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_acoustic REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_aggressive REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_electronic REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_happy REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_sad REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_relaxed REAL",
            "ALTER TABLE acousticbrainz_data ADD COLUMN mood_party REAL",

            // Playback tables
            "CREATE TABLE IF NOT EXISTS playback_state (id TEXT PRIMARY KEY DEFAULT 'default', current_track_id TEXT, queue_ids TEXT, current_index INTEGER DEFAULT -1, volume REAL DEFAULT 1.0, is_shuffle INTEGER DEFAULT 0, repeat_mode TEXT DEFAULT 'normal', current_time REAL DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS scrobble_queue (id TEXT PRIMARY KEY, track_id TEXT NOT NULL, artist TEXT NOT NULL, title TEXT NOT NULL, album TEXT, played_at INTEGER NOT NULL, lastfm_submitted INTEGER DEFAULT 0, listenbrainz_submitted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS play_history (id TEXT PRIMARY KEY, track_id TEXT NOT NULL, played_at DATETIME DEFAULT CURRENT_TIMESTAMP, play_count INTEGER DEFAULT 0)",
            "ALTER TABLE play_history ADD COLUMN play_count INTEGER DEFAULT 0",
            "ALTER TABLE play_history ADD COLUMN fraction_played REAL DEFAULT 1.0",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_performers_unique ON performers(track_id, artist_id, role)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_album_credits_unique ON album_credits(album_id, artist_id, role)",
            "ALTER TABLE performers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE album_credits ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
        ]

        for (const migration of migrations) {
            try {
                db.exec(migration)
            } catch (error) {
                // Ignore "duplicate column name" errors
                if (!(error as Error).message.includes('duplicate column name')) {
                    console.log(`Migration validation: ${(error as Error).message}`)
                }
            }
        }

        console.log('Database initialized successfully')
        return db
    } catch (error) {
        console.error('Failed to initialize database:', error)
        throw error
    }
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
    if (!db) {
        return initDatabase()
    }
    return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close()
        db = null
    }
}

// Export types for database operations - Matching local interfaces
export interface DbMusicFolder {
    id: string
    path: string
    name: string
    watch_enabled: number
    last_scanned: string | null
    track_count: number
    created_at: string
}

export interface DbTrack {
    id: string
    folder_id: string
    file_path: string
    file_hash: string | null
    title: string
    artist: string
    album: string
    album_artist: string | null
    year: number | null
    genre: string | null
    track_num: number | null
    disc_num: number | null
    duration: number
    bitrate: number
    sample_rate: number | null
    bit_depth: number | null
    format: 'flac' | 'mp3'
    cover_art_path: string | null
    rating: number
    loved: number
    play_count: number
    last_played: string | null
    release_date: string | null
    musicbrainz_track_id: string | null
    musicbrainz_album_id: string | null
    musicbrainz_artist_id: string | null
    publisher: string | null
    isrc: string | null
    musicbrainz_recording_id: string | null
    musicbrainz_release_group_id: string | null
    musicbrainz_work_id: string | null
    replaygain_track_gain: number | null
    replaygain_album_gain: number | null
    replaygain_track_peak: number | null
    replaygain_album_peak: number | null
    movement: string | null
    movement_num: number | null
    movement_total: number | null
    created_at: string
    updated_at: string
}

export interface DbAlbumCache {
    id: string
    name: string
    artist: string
    year: number | null
    release_date: string | null
    genre: string | null
    disc_count: number
    track_count: number
    total_duration: number
    cover_art_path: string | null
    musicbrainz_album_id: string | null
    release_group_mbid: string | null
    release_title: string | null
    label: string | null
    catalog_number: string | null
    lastfm_url: string | null
    rating: number
    loved: number
    play_count: number
    last_played: string | null
    bio: string | null
    created_at: string
    updated_at: string
}

export interface DbArtist {
    id: string
    name: string
    album_count: number
    track_count: number
    bio: string | null
    image_path: string | null
    musicbrainz_artist_id: string | null
    country: string | null
    life_span_begin: string | null
    life_span_end: string | null
    type: string | null
    gender: string | null
    website: string | null
    loved: number
    created_at: string
}

export interface DbUserSetting {
    id: string
    user_id: string
    setting_key: string
    setting_value: string
    updated_at: string
}

export interface DbPlaybackHistory {
    id: string
    track_id: string
    played_at: string
    duration_played: number
}

export interface DbPlaybackState {
    id: string
    current_track_id: string | null
    queue_ids: string | null
    current_index: number
    volume: number
    is_shuffle: number
    repeat_mode: string
    current_time: number
    updated_at: string
}
// Export MusicBrainz types from types.musicbrainz.ts
export * from './types.musicbrainz'
