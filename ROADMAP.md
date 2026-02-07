# MusicMaster Project Roadmap

This document outlines the planned features and enhancements for MusicMaster, categorized by functional area.

## 🚀 Priority Backlog

### Core UI & Navigation
- [ ] **Universal Delete Key**: Pressing `Delete` on a selected item in a playlist triggers a confirmation modal (Enter to OK, Esc to Cancel).
- [ ] **Navigation History**: Right-click on the Back/Forward buttons to show a history menu (Artist, Album, etc.) for direct jumps.
- [ ] **Locate File**: Add "Locate file in explorer" to the track context menu.
- [ ] **Played Column**: Add a "Played" (play count) column to the left of the rating in both Album Detail and Tracks views.

### Metadata & Tagging (MusicBrainz/AcoustID)
- [ ] **MusicBrainz Integration UI**:
    - UI for tagging files with MusicBrainz data (MBID, AcoustID).
    - Fetch and display comprehensive metadata (facts about track/album/artist).
    - Sync local ratings with MusicBrainz/Last.fm.
- [ ] **ReplayGain**: Implement ReplayGain calculation for tracks and albums to normalize loudness.
- [ ] **Tagging Scenarios**: Add specialized tagging presets for soundtracks, podcasts, and holiday music.

### Library Management
- [ ] **Missing Tracks Modal**: If tracks are moved or deleted externally, show a modal to:
    - Delete orphan entries.
    - Re-locate/Update paths.
    - Export a CSV of missing files with full paths.
- [ ] **Unsorted / Inbox Folder**: A folder for new music that can be tagged (Picard-style) and automatically moved into the main library structure.
- [ ] **Duplicate Management**: Tool to identify and handle duplicate tracks in the library.

### Playback & Connectivity
- [ ] **Cast Support**: Support for Chromecast, Apple AirPlay, and Sonos.
- [ ] **Theater View**: A dedicated full-screen "Now Playing" view for large displays.
- [ ] **Mood Playback**: Play sequences based on the "mood" of tracks.

### Integrated Last.fm stats
- [ ] **In-App Last.fm Dashboard**:
    - Full scrobble history (last 50 tracks) with links to albums.
    - Reports & Statistics: Day, Week, Month, Year views.
    - Top Lists: Artists, Genres, and Tracks.
- [ ] **Privacy & Social**:
    - **Private Listening**: Toggle to temporarily stop scrobbling/history recording.
    - **Now Playing Status**: Update external profile status immediately.
    - **🔥 Top Played Icon**: Mark tracks in the library that are among the most played on Last.fm.
