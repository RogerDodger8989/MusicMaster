-- MusicMaster Database Schema
-- SQLite database for local music library

-- Music Folders Configuration
CREATE TABLE IF NOT EXISTS music_folders (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    watch_enabled INTEGER DEFAULT 0,
    last_scanned DATETIME,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks (Music Files)
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
    format TEXT CHECK(format IN ('flac', 'mp3')),
    cover_art_path TEXT,
    sample_rate INTEGER,
    bit_depth INTEGER,
    rating INTEGER DEFAULT 0,
    loved INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    release_date TEXT,
    musicbrainz_track_id TEXT,
    musicbrainz_album_id TEXT,
    -- ReplayGain metadata (in dB)
    replaygain_track_gain REAL,
    replaygain_album_gain REAL,
    replaygain_track_peak REAL,
    replaygain_album_peak REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES music_folders(id) ON DELETE CASCADE
);

-- Albums (Normalized)
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT,
    year INTEGER,
    cover_art_path TEXT,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artists (Normalized)
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    album_count INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    bio TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scan History
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

-- Scrobble Queue (for offline support)
CREATE TABLE IF NOT EXISTS scrobble_queue (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    album TEXT,
    played_at INTEGER NOT NULL,
    submitted INTEGER DEFAULT 0,
    lastfm_submitted INTEGER DEFAULT 0,
    listenbrainz_submitted INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Play History
CREATE TABLE IF NOT EXISTS play_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    played_at DATETIME NOT NULL,
    play_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Scrobbling Configuration
CREATE TABLE IF NOT EXISTS scrobble_settings (
    id TEXT PRIMARY KEY DEFAULT 'config',
    lastfm_username TEXT,
    lastfm_session_key TEXT,
    lastfm_enabled INTEGER DEFAULT 0,
    listenbrainz_enabled INTEGER DEFAULT 1,
    sync_loved_status INTEGER DEFAULT 1,
    sync_playcount INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year);
CREATE INDEX IF NOT EXISTS idx_tracks_folder ON tracks(folder_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);

-- Full-text search index for tracks
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
    title,
    artist,
    album,
    genre,
    content=tracks,
    content_rowid=rowid
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
    INSERT INTO tracks_fts(rowid, title, artist, album, genre)
    VALUES (new.rowid, new.title, new.artist, new.album, new.genre);
END;

CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
    DELETE FROM tracks_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
    UPDATE tracks_fts SET
        title = new.title,
        artist = new.artist,
        album = new.album,
        genre = new.genre
    WHERE rowid = new.rowid;
END;
