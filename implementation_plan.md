# System Features & Implementation Roadmap

## 1. Playlist System Overhaul (MusicWest Parity) [COMPLETED]

Bring the MusicMaster playlist system up to the standard of "MusicWest" with a focus on interactivity and visual polish.

### 🖱️ Drag-and-Drop System
- **Reordering**: Implement internal drag-and-drop in [QueueDrawer.tsx](file:///c:/Users/denni/Desktop/Apps/MusicMaster/desktop/src/renderer/src/components/QueueDrawer.tsx) using the HTML5 Drag and Drop API.
- **External Drop**: Allow dragging tracks and albums into the `QueueDrawer` from:
    - [TracksView.tsx](file:///c:/Users/denni/Desktop/Apps/MusicMaster/desktop/src/renderer/src/views/TracksView.tsx)
    - [AlbumsView.tsx](file:///c:/Users/denni/Desktop/Apps/MusicMaster/desktop/src/renderer/src/views/AlbumsView.tsx)
    - `ArtistDetailView.tsx`

### 🎨 Visual & UI Refinements
- **Thumbnails**: Add track thumbnails to [QueueDrawer.tsx](file:///c:/Users/denni/Desktop/Apps/MusicMaster/desktop/src/renderer/src/components/QueueDrawer.tsx) and improve the layout consistency.
- **Mosaic Covers**: Implement a 4-grid cover art generator for playlists in [PlaylistsView.tsx](file:///c:/Users/denni/Desktop/Apps/MusicMaster/desktop/src/renderer/src/views/PlaylistsView.tsx).
- **Queue Controls**: Add "Clear Queue" and "Shuffle" buttons directly to the `QueueDrawer` header.

### 💾 Backend & Persistence
- **Reordering Persistence**: Update IPC handlers to support reordering tracks within a playlist in the database.
- **Store Updates**: Sync the `usePlaylists` store with reordering actions.

## 2. Advanced Audio Features [COMPLETED - 2026-02-06]

### ⌨️ Universal Keyboard Shortcuts
- **Space**: Play/Pause toggle (works globally except in input fields)
- **Backspace**: Navigate back, close modals (priority: modal → navigation)
- **Esc**: Cancel/Close with priority handling (modals → search → queue panel)
- **Delete**: Clear queue with confirmation modal

### 🎚️ ReplayGain Normalization System
Complete implementation for volume normalization across tracks.

**Scanner Integration** (`desktop/src/main/scanner.ts`):
- Extract ReplayGain tags from FLAC files (REPLAYGAIN_TRACK_GAIN, REPLAYGAIN_ALBUM_GAIN)
- Store peak values (REPLAYGAIN_TRACK_PEAK, REPLAYGAIN_ALBUM_PEAK)
- Parse dB values correctly (e.g., "-7.5 dB" → -7.5)

**Database Schema** (`desktop/src/main/database/index.ts`):
- Added columns: `replaygain_track_gain`, `replaygain_album_gain`, `replaygain_track_peak`, `replaygain_album_peak`
- Migration system ensures existing databases get updated

**Player Implementation** (`desktop/src/renderer/src/store/player.ts`):
- Three modes: Track Gain, Album Gain, Off
- Apply volume adjustment: `audioElement.volume = baseVolume * (10 ^ (gain / 20))`
- Respects peak values to prevent clipping

**UI Components**:
- Settings: Mode selector (Track/Album/Off) in `SettingsView.tsx`
- PlayerBar: Green "RG" indicator when ReplayGain is active

### 🔄 Gapless Playback
Seamless transitions between tracks without silence.

**Architecture** (`desktop/src/renderer/src/store/player.ts`):
- Dual HTML5 Audio elements: `activeAudio` and `preloadAudio`
- Preload pipeline: Load next track while current is playing
- Crossfade: Swap audio elements on track end (`onended` event)
- State management: Track which element is active

**Bug Fixes**:
- Prevent dual-playback when rapidly skipping tracks
- Proper cleanup of preloaded audio on manual track change
- Handle edge cases (last track in queue, shuffle mode)

### 📊 Scrobbling System (ListenBrainz & Last.fm)
Complete offline-capable scrobbling with two-service support.

**Database Schema** (`desktop/src/main/database/index.ts`):
```sql
CREATE TABLE scrobble_queue (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    album TEXT,
    played_at INTEGER NOT NULL,
    lastfm_submitted INTEGER DEFAULT 0,
    listenbrainz_submitted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE play_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_count INTEGER DEFAULT 0
);
```

**Services** (`desktop/src/main/services/`):
- `lastfm.ts`: OAuth flow (auth.getToken → user approval → auth.getSession), MD5 signature authentication
- `listenbrainz.ts`: Token-based Bearer authentication
- Both services support: scrobbling, now playing, love/unlove tracks

**Background Worker**:
- 5-second interval checking `scrobble_queue`
- Respects enablement flags (`lastfmEnabled`, `listenbrainzEnabled`)
- Per-service submission tracking (prevents double-submission)
- Offline support: Queue stores plays when services are unreachable

**UI Integration** (`desktop/src/renderer/src/views/SettingsView.tsx`):
- API key/token input fields with instructions
- Links to Last.fm API creation and ListenBrainz profile
- OAuth authorization flow with step-by-step guidance
- Service indicators in PlayerBar (LFM/LB badges)

**Play Recording**:
- 50% rule: Only record scrobble after track reaches 50% completion
- Timestamp: Unix timestamp at time of 50% mark
- Automatic queue addition via IPC handler

### 📈 Play Count Tracking
Display play statistics across all views.

**Database Query** (`desktop/src/main/database/tracks.ts`):
- `getTrackPlayCount()`: Sum play_count from play_history for given track
- Called automatically in `dbTrackToTrack()` converter
- Efficient COALESCE query: `SELECT COALESCE(SUM(play_count), 0) as total`

**UI Display**:
- **TracksView**: Play count shown to left of rating stars
- **AlbumDetailView**: "Plays" column header, count displayed per track
- **AlbumListItem**: Play count in list mode albums view
- **Album Type**: Added `playCount` field to Album interface

**Visual Design**:
- Tabular numbers for alignment
- Muted color (doesn't compete with ratings)
- Only shows if playCount > 0 (clean when no plays)

### 📂 Library Management Enhancements

**Fast Watch Folder**:
- Auto-start watch mode on app startup for all folders with `watch_enabled = true`
- Implemented in `desktop/src/main/ipc.ts` initialization
- Uses `chokidar` for file system monitoring

**Preserve Loved Status**:
- Scanner checks existing track rating/loved before overwriting
- Only updates file metadata (title, artist, duration, etc.)
- Rating and loved flags remain unchanged during re-scans

## 3. Future Feature Roadmap (Phase 5+)

### 🎧 High-Fidelity Audio Engine
- **Exclusive Mode**: Implement WASAPI (Windows) and ASIO support to bypass the OS mixer for bit-perfect playback.
- **Android Mixer Bypass**: Direct hardware access for mobile app.

### 🧠 Smart Features ("Sonic Analysis")
- **Waveform Analysis**: Analyze audio files for BPM, key, and energy.
- **Sonic Similarity**: "Play songs that sound like this" feature (independent of tags).
- **Aura Visualizer**: Generate real-time ambient colors based on the current track's mood/energy.

### 🖥️ Desktop Experience
- **Taskbar Integration**: Add media controls (Prev/Play/Next) to the Windows taskbar preview.
- **Rescan Context Menu**: Right-click option to rescan individual files/folders

### ☁️ Sync & Connectivity
- **Two-way Rating Sync**: Import ratings/loved status from Last.fm back to local library
- **Playcount Sync**: Merge remote playcounts with local statistics

## 4. Play Count Sync System Overhaul [IN PROGRESS - 2026-02-06]

Complete debugging and implementation of personal playcount synchronization from external services.

### 🐛 Critical Bugs Fixed

**Rating Normalization Bug**:
- **Problem**: FMPS_RATING tag (0.0-1.0 scale) read by music-metadata as decimals
  - Example: 0.8 (4 stars) was being read as 0.04 and normalized to 0 stars
  - All ratings appeared as 1 star after sync because even 0.2 (1 star) became 0.01
- **Solution**: Read RATING tag directly (0-5 integer scale) instead of FMPS_RATING
- **Files Modified**: `desktop/src/main/scanner.ts` lines 216-265

**Play Count Not Saved to Database**:
- **Problem**: upsertTrack() missing play_count in both INSERT and UPDATE statements
- **Solution**: Added play_count to SQL statements and parameter bindings
- **Files Modified**: `desktop/src/main/database/tracks.ts` upsertTrack()

**Play Count Not Read from Files**:
- **Problem**: Scanner not extracting PLAY_COUNT tag from FLAC vorbis comments
- **Solution**: Added playCount extraction alongside rating/loved tags
- **Files Modified**: `desktop/src/main/scanner.ts` metadata reading section

**Play Count Not Displayed**:
- **Problem**: dbTrackToTrack() reading from play_history instead of tracks.play_count
- **Solution**: Changed to read directly from dbTrack.play_count column
- **Files Modified**: `desktop/src/main/database/tracks.ts` line 248

**Ratings Disappearing After Rescan**:
- **Problem**: Scanner overwriting ratings with 0 when re-scanning existing tracks
- **Solution**: Check existingTrack and preserve rating/loved if already set
- **Files Modified**: `desktop/src/main/scanner.ts` track comparison logic

### 🔧 API Limitations & Workarounds

**Last.fm Playcount Issue**:
- **Problem**: track.getInfo API returns global playcount even with username parameter
  - User's tracks showing millions of plays instead of personal ~100-200 plays
- **Investigation**: Tested with/without username, both return same global stats
- **Solution**: Disabled Last.fm playcount sync with warning message
- **Files Modified**: `desktop/src/main/services/lastfm.ts` getUserTrackPlayCount()

**ListenBrainz Stats Limitation**:
- **Problem**: `/stats/user/{username}/recordings` endpoint limited to top 100 tracks
  - User has 113,642 total listens but API only returns top 100 most-played
  - Tracks not in top 100 (like System of a Down) return 0 playcount
- **Investigation**: Verified via ListenBrainz API documentation and testing
- **Solution**: Created PowerShell workaround to download ALL listens

### 📥 ListenBrainz Full Download Solution

**PowerShell Script** (`desktop/download_listenbrainz.ps1`):
- Uses `/listens` endpoint with pagination to fetch all listen records
- Pagination via `max_ts` parameter (timestamp of oldest listen on current page)
- Fetches 1000 listens per page until all ~113k downloads complete
- Saves to `listenbrainz_listens.json` for local import
- Features:
  - Progress indicators showing page number and total count
  - 100ms delay between requests (API rate limit courtesy)
  - Error handling with graceful break on failure
  - Unicode UTF-8 encoding for international characters

**Syntax Fixes**:
- Fixed PowerShell do-while loop structure (requires contiguous `} while ($true)`)
- Removed blank lines between try-catch block and while clause

### 🚀 Next Steps: JSON Import Feature

**Backend Implementation** (`desktop/src/main/ipc.ts`):
1. Create `scrobble:importListenBrainzJSON` IPC handler
2. Read and parse JSON file with all listens
3. Group listens by track (artist + title or recording_mbid)
4. Count occurrences per track
5. Update tracks.play_count in database

**Matching Strategy**:
- **Primary**: Match via MusicBrainz recording_mbid if available
- **Fallback**: Fuzzy string matching on artist + title
- **Normalization**: Lowercase, trim, remove special characters for comparison

**UI Integration** (`desktop/src/renderer/src/views/SettingsView.tsx`):
1. Add "Import ListenBrainz JSON" button in Scrobbling section
2. Implement file picker dialog (Electron dialog.showOpenDialog)
3. Show progress indicator during import
4. Display success message with tracks updated count

**Files to Modify**:
- `desktop/src/main/ipc.ts` - Add import handler
- `desktop/src/preload/index.ts` - Expose import API
- `desktop/src/renderer/src/views/SettingsView.tsx` - Add UI button

### 🔍 Debugging Enhancements

**Extensive Logging Added**:
- `syncTrackPlayCount()` now logs:
  - Track ID, artist, title being synced
  - Token presence verification
  - Database play_count value before sync
  - API response (full JSON)
  - Final calculated playcount
  - Database update confirmation
- `getTrackPlayCount()` (ListenBrainz) logs:
  - API request URL
  - Response status and data
  - Extracted playcount value

**Removed Destructive Operations**:
- Deleted `library:reset` IPC handler (was deleting entire database)
- Prevented accidental data loss during debugging

### 📊 Current State

**Working**:
- ✅ Play counts read from FLAC/MP3 tags
- ✅ Play counts saved to database
- ✅ Play counts displayed in UI
- ✅ Ratings normalized correctly (0-5 scale)
- ✅ Ratings preserved during rescans
- ✅ ListenBrainz scrobbling active (113,642 total listens)
- ✅ PowerShell download script ready

**Pending**:
- ⏳ Download all ListenBrainz listens to JSON
- ⏳ Implement JSON import feature
- ⏳ Test full playcount sync workflow

**Known Issues**:
- ⚠️ Last.fm playcount sync disabled (returns global stats)
- ⚠️ ListenBrainz stats API limited to top 100 (workaround implemented)
