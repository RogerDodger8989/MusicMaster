import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database | null = null

// SQL Schema
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    lastfm_url TEXT,
    rating REAL DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
`

/**
 * Initialize the SQLite database
 */
export function initDatabase(): Database.Database {
    if (db) return db

    try {
        // Create database directory if it doesn't exist
        const userDataPath = app.getPath('userData')
        const dbPath = path.join(userDataPath, 'musicmaster.db')

        console.log('Initializing database at:', dbPath)

        // Create database connection
        db = new Database(dbPath)

        // Enable foreign keys
        db.pragma('foreign_keys = ON')

        // Execute schema (split by semicolon and execute each statement)
        const statements = SCHEMA.split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        for (const statement of statements) {
            try {
                db.exec(statement)
            } catch (error) {
                console.error('Error executing schema statement:', error)
            }
        }

        // Run migrations for existing tables (ignore errors if columns exist)
        const migrations = [
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
            "ALTER TABLE albums_cache ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE albums_cache ADD COLUMN bio TEXT",
            "ALTER TABLE artists ADD COLUMN loved INTEGER DEFAULT 0",
            "ALTER TABLE artists ADD COLUMN musicbrainz_artist_id TEXT",
            "ALTER TABLE artists ADD COLUMN country TEXT",
            "ALTER TABLE artists ADD COLUMN life_span_begin TEXT",
            "ALTER TABLE artists ADD COLUMN life_span_end TEXT",
            "ALTER TABLE artists ADD COLUMN type TEXT",
            "ALTER TABLE artists ADD COLUMN gender TEXT",
            "ALTER TABLE artists ADD COLUMN website TEXT",
            "CREATE TABLE IF NOT EXISTS playback_state (id TEXT PRIMARY KEY DEFAULT 'default', current_track_id TEXT, queue_ids TEXT, current_index INTEGER DEFAULT -1, volume REAL DEFAULT 1.0, is_shuffle INTEGER DEFAULT 0, repeat_mode TEXT DEFAULT 'normal', current_time REAL DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS scrobble_queue (id TEXT PRIMARY KEY, track_id TEXT NOT NULL, artist TEXT NOT NULL, title TEXT NOT NULL, album TEXT, played_at INTEGER NOT NULL, lastfm_submitted INTEGER DEFAULT 0, listenbrainz_submitted INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS play_history (id TEXT PRIMARY KEY, track_id TEXT NOT NULL, played_at DATETIME DEFAULT CURRENT_TIMESTAMP, play_count INTEGER DEFAULT 0)",
            "ALTER TABLE play_history ADD COLUMN play_count INTEGER DEFAULT 0"
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

// Export types for database operations
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
