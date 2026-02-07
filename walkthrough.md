# Integrated Queue & UI Refinements Walkthrough

The playlist and queue system has been fully refined based on your feedback. It now offers a premium, integrated experience with improved controls and visibility.

## Key Refinements

### 📐 UI & Layout Refinements
- **Rating Badges**: Albums now feature a sleek **blue triangle** in the top-right corner showing the numerical rating. This frees up space below the cover art for a cleaner look.
- **Improved Alignment**: Added more breathing room to the album grid so cards no longer clash with the side panels.
- **Smaller Play Button**: Adjusted the quick-play button on albums to be more proportional and less intrusive.
- **Smooth Resizing**: dragging the side panel handle no longer causes text selection across the screen.

### 🔄 Dynamic Playlist Reordering
- **Universal Drag & Drop**: Drag Albums (Grid/List) or Tracks (List/Artist Detail/Album Detail) directly into the Queue.
- **Precision Drop**: A single blue line clearly marks where your tracks will be inserted.
- **Empty State Drops**: You can now drop items directly onto an empty queue to start listening immediately.
- **Async Loading**: Dropped albums instantly fetch their tracks without blocking the UI.
- **Internal Reordering**: Reorder your queue with the same intuitive interface.

### 💨 Interactive Modals
- **No Blur**: Removed backdrop blur from all modal dialogs for a cleaner look.
- **Draggable Windows**: You can now drag modals (Settings, Search, Playlist controls) around by their headers.

### 🎨 Artist Gallery Redesign
- **Card Layout**: Artists are now displayed in a responsive grid that adapts perfectly to window resizing.
- **Smart Resizing**: Cards maintain their optimal size and wrap to new lines when the playlist drawer is open, preventing them from shrinking too small.
- **Advanced Play Options**: Hover over an artist to reveal a **Play Button**. Clicking it opens a modal allowing you to:
    - Play All Songs (Chronological)
    - Shuffle All Songs
    - Play Top Rated/Loved Tracks
- **Playlist Controls**: Simplified the Queue/Playlist header by replacing text buttons with sleek, tool-tipped icons for Shuffle, Save, Load, and Clear.
- **Heart Badge**: "Loved" artists are marked with a distinct **Blue Triangle** and Red Heart in the top-left corner.
### Universal Album Rating Logic (2026-02-06)
- **Problem**: Album ratings and 'loved' status were not synced (Heart != Rating).
- **Solution**: Implemented the same logic as Tracks:
    - Rating > 0 automatically sets Loved = true.
    - Un-loving automatically clears Rating to 0.
    - Tapping same rating clears it.
    - Applied universally to `rateAlbum` and `toggleAlbumLoved` in `library.ts`.

### Player Bar Navigation & Fixes (2026-02-06)
- **Navigation**:
    - Clicking **Track Title** now navigates to the **Album Detail**.
    - Clicking **Artist Name** now navigates to the **Artist Detail**.
- **Heart Button**:
    - Fixed the Heart button in the Player Bar to correctly reflect and toggle the "Loved" status of the currently playing track by syncing with the live library state.

### UI Refinements (2026-02-06)
- **Album Card Design**:
    - **Heart Badge**: Updated to match the Artist Card design. Now features a **Blue Triangle Ribbon** in the top-left corner with a red heart when "Loved".
    - **Symmetry**: The "Loved" ribbon (Top-Left) creates a balanced look with the "Rating" ribbon (Top-Right).
    - **Artist Card Design**:
    - **Heart Hover**: Added the same heart hover effect as the Album Card. Artists now show a **Blue Triangle Ribbon** in the top-left when Loved, and a gray heart button on hover when not Loved.
    - **Sync**: Both albums and artists now share a consistent heart interaction language throughout the library.

### Playback Safety (2026-02-06)
- **Confirm Before Emptying**: Added a safety modal when clicking **Play** or **Shuffle**.
    - If your queue is not empty, a modal asks: "Your playlist is not empty. Would you like to clear it and play now, or just add them to the end?"
    - Integrated into **Artist View**, **Album View**, and **Album Detail**.
    - Prevents losing your current queue by accident.
- **Stats Bar**: Each artist card features a sleek blue bar at the bottom displaying Album and Track counts.

### ⚡ Enhanced Visibility
- **Persistent Ratings**: Stars and hearts in the queue are now **always visible**, not just on hover.
- **Intelligent Covers**: Every track in the queue now shows a cover with fallback support from the album.
- **Smart Shuffle**: The new shuffle logic actively prevents consecutive artists and ensures every song is played once before repeating.
- **Stable Sorting**: Favoriting a song in the "Popular Tracks" list no longer causes it to jump around violently.
- **Artist Biography Limit**: Artist bios are now capped at the height of the "Popular Tracks" section. A smooth "Read More" button allows for full expansion without cluttering the view.
- **Similarity Readability**: Related artist names are now fully readable in the bio section.

### 📂 Playlist Management
- **Non-Blur Save/Load**: New **SAVE** and **LOAD** buttons added next to "Clear".
- **Save**: Quickly name and save your current queue as a permanent playlist.
- **Load**: Browse and load existing playlists directly into your active queue without disruptive background blurring.

### 🛠️ Bug Fixes
- **Album Play Button**: Fixed the quick play button on album cards. I've now exposed the necessary backend APIs to the frontend and implemented a robust "store-first" playback logic that falls back to the database if needed. This ensures instant and reliable playback when clicking the blue button.
- **Standardized Protocols**: All images and audio now load reliably using the standardized `asset:///` protocol across the entire app, replacing old `file://` links that were causing loading issues.

## Verification

1.  **Quick Play**: Hover over an album card and click the blue play button. It should start immediately.
2.  **Queue View**: Open the queue and verify that ratings and hearts are visible for every track.
3.  **Resizing**: Drag the edge of the queue panel and verify that the screen doesn't "turn blue" from text selection.
4.  **Save/Load**: Use the new buttons at the top of the queue panel to manage your session.

---

## Advanced Audio Features (Phase 4 - 2026-02-06)

### ⌨️ Universal Keyboard Shortcuts
Global shortcuts work throughout the application except when typing in input fields:

- **Space**: Play/Pause toggle
- **Backspace**: Navigate back in browser history or close modals (modals have priority)
- **Esc**: Close/Cancel with priority handling:
  1. Closes open modals first
  2. Closes search modal
  3. Closes queue panel
- **Delete**: Clear queue (shows confirmation modal to prevent accidental clearing)

### 🎚️ ReplayGain Normalization
Volume normalization ensures consistent loudness across your entire library:

**How It Works**:
- Reads ReplayGain tags from FLAC files during scanning
- Supports both Track Gain and Album Gain modes
- Automatically adjusts volume using the formula: `volume = baseVolume × 10^(gain/20)`
- Respects peak values to prevent clipping

**Configuration** (Settings View):
- **Track Gain Mode**: Normalizes each track individually (default)
- **Album Gain Mode**: Normalizes entire albums together (preserves album dynamics)
- **Off**: Disables ReplayGain

**Visual Indicator**:
- Green "RG" badge appears in PlayerBar when ReplayGain is active

### 🔄 Gapless Playback
Seamless transitions between tracks with zero silence gaps:

**Implementation**:
- Uses dual HTML5 Audio elements for crossfading
- Preloads next track while current track is playing
- Automatically swaps audio elements at track boundaries
- Works in all playback modes (normal, shuffle, repeat)

### 📊 Scrobbling System (ListenBrainz & Last.fm)

**Supported Services**:
- **ListenBrainz**: Token-based authentication (simple setup)
- **Last.fm**: OAuth flow with API key and shared secret

**Features**:
- Real-time "Now Playing" updates (sent immediately when track starts)
- Automatic scrobbling after 50% of track duration
- Offline-capable queue (scrobbles are queued when services unreachable)
- Per-service submission tracking (prevents duplicate submissions)
- Background worker runs every 5 seconds to process queue

**Configuration** (Settings View):
1. **ListenBrainz**:
   - Get token from: https://listenbrainz.org/profile/
   - Paste token into "ListenBrainz Token" field
   - Enable "ListenBrainz Enabled" checkbox

2. **Last.fm** (3-step process):
   - Create API account at: https://www.last.fm/api/account/create
   - Enter API Key and Shared Secret in Settings
   - Click "Authorize Last.fm" and approve in browser
   - Session key will be saved automatically

**Visual Indicators**:
- "LFM" badge in PlayerBar when Last.fm is active
- "LB" badge in PlayerBar when ListenBrainz is active

### 📈 Play Count Tracking
Track play statistics are displayed across all views:

**Where It Appears**:
- **Tracks View**: Small number to left of rating stars
- **Album Detail View**: Dedicated "Plays" column in track list
- **Album List View**: Shows play count in ratings section

**How It Works**:
- Play counts are recorded in the `play_history` database table
- Only increments when track reaches 50% completion
- Displays total plays for each track
- Only shows when playCount > 0 (clean UI for unplayed tracks)

### 📂 Library Management

**Auto-Watch Folders**:
- All folders with "Watch Enabled" automatically start monitoring on app launch
- Real-time file system monitoring using `chokidar`
- Automatically adds new tracks when files are added to watched folders

**Preserve User Data**:
- Scanner preserves existing ratings and loved status during re-scans
- Only updates file metadata (title, artist, duration, tags)
- Play counts and scrobble history are never deleted

**Database Migrations**:
- Automatic schema updates on app startup
- No data loss when upgrading between versions
- All migrations are idempotent (safe to run multiple times)

---

## Play Count Sync System Debugging (Phase 6 - 2026-02-06)

Extensive debugging session to fix playcount synchronization from Last.fm and ListenBrainz.

### 🐛 Bugs Fixed

**1. Rating Normalization Bug**
- **Issue**: All ratings showed as 1 star after sync, then all ratings disappeared
- **Root Cause**: FMPS_RATING tag (0.0-1.0 float) was being read as tiny decimals
  - Example: 4-star rating (0.8) read as 0.04 → normalized to 0 stars
  - Even 1-star (0.2) became 0.01 and rounded to 0
- **Fix**: Read RATING tag directly (0-5 integer scale) instead of FMPS_RATING
- **Impact**: All ratings now display correctly after rescanning

**2. Play Count Not Saved**
- **Issue**: Scanner read PLAY_COUNT from files but values never appeared in database
- **Root Cause**: upsertTrack() missing play_count in INSERT/UPDATE SQL statements
- **Fix**: Added play_count to both SQL statements and parameter bindings
- **File**: `desktop/src/main/database/tracks.ts`

**3. Play Count Not Read from Files**
- **Issue**: PLAY_COUNT tag in FLAC files ignored during scanning
- **Root Cause**: Scanner not extracting PLAY_COUNT from vorbis comments
- **Fix**: Added playCount extraction alongside rating/loved tags
- **File**: `desktop/src/main/scanner.ts`

**4. Play Count Not Displayed**
- **Issue**: UI always showed 0 plays even when database had values
- **Root Cause**: dbTrackToTrack() calling getTrackPlayCount(play_history) instead of reading tracks.play_count column
- **Fix**: Changed to read dbTrack.play_count || 0 directly
- **File**: `desktop/src/main/database/tracks.ts` line 248

**5. Ratings Disappearing After Rescan**
- **Issue**: Database reset + rescan caused all ratings to vanish
- **Root Cause**: Scanner overwriting ratings with 0 for existing tracks
- **Fix**: Preserve existingTrack.rating and existingTrack.loved during updates
- **File**: `desktop/src/main/scanner.ts`

### ⚠️ API Limitations Discovered

**Last.fm Playcount Issue**:
- **Problem**: track.getInfo API returns global playcount (millions) instead of personal stats
  - Tested with username parameter → still returns global stats
  - Example: User has ~100 plays, API shows 2,000,000+ (global popularity)
- **Decision**: Disabled Last.fm playcount sync with warning message
- **Status**: Documented limitation, focus on ListenBrainz instead

**ListenBrainz Stats Limitation**:
- **Problem**: `/stats/user/{username}/recordings` endpoint limited to top 100 tracks only
  - User has 113,642 total listens across thousands of tracks
  - Tracks not in top 100 most-played return 0 (System of a Down example)
- **Workaround**: Created PowerShell script to download ALL listens

### 📥 ListenBrainz Full Download Workaround

**Solution**: PowerShell script (`desktop/download_listenbrainz.ps1`)
- **Method**: Use `/listens` endpoint with pagination instead of `/stats`
- **Pagination**: max_ts parameter (timestamp of oldest listen on current page)
- **Batch Size**: 1000 listens per page
- **Output**: listenbrainz_listens.json with complete listen history
- **Progress**: Real-time page number and total count display
- **Features**:
  - UTF-8 encoding for international characters
  - 100ms delay between requests (API courtesy)
  - Error handling with graceful termination
  - Colored output for status monitoring

**Usage**:
```powershell
cd desktop
.\download_listenbrainz.ps1
```

### 🚀 Next Steps: JSON Import Feature

**Planned Implementation**:
1. **Download**: Run PowerShell script to get all ~113k listens
2. **Import Function**: Create IPC handler to read JSON and count playcounts
3. **Matching Logic**: 
   - Primary: MusicBrainz recording_mbid
   - Fallback: Fuzzy string matching (artist + title)
4. **Database Update**: Bulk update tracks.play_count column
5. **UI Integration**: Add "Import ListenBrainz JSON" button in Settings
6. **Verification**: Display success message with updated track count

**Files to Create/Modify**:
- ✅ `desktop/download_listenbrainz.ps1` (created, syntax fixed)
- ⏳ `desktop/src/main/ipc.ts` (add import handler)
- ⏳ `desktop/src/preload/index.ts` (expose import API)
- ⏳ `desktop/src/renderer/src/views/SettingsView.tsx` (add button)

### 🔧 Tools & Setup

**Installed**:
- FLAC command-line tools via scoop (`scoop install flac`)
- metaflac command verified working

**API Credentials**:
- ListenBrainz Token: `06bb83a7-d6fe-471c-9da9-5a6cdf5029de`
- Username: `dennis800121`
- Total Listens: 113,642 (verified via API)

### 🐞 Debugging Enhancements

**Added Extensive Logging**:
- `syncTrackPlayCount()`: Track ID, artist, title, token presence, DB values, API responses
- `getTrackPlayCount()`: API URLs, response data, extracted values
- All playcount operations now traceable in console

**Removed Dangerous Operations**:
- Deleted `library:reset` IPC handler (was nuking entire database)
- Prevented accidental data loss during debugging sessions

### ✅ Current Status

**Working Features**:
- ✅ Ratings display correctly (0-5 stars)
- ✅ Ratings preserved during rescans
- ✅ Play counts read from file tags
- ✅ Play counts saved to database
- ✅ Play counts displayed in UI (Tracks/Albums/AlbumDetail views)
- ✅ ListenBrainz scrobbling active
- ✅ PowerShell download script ready (syntax fixed)

**Pending Work**:
- ⏳ Test PowerShell script to download JSON
- ⏳ Verify JSON contains all ~113k listens
- ⏳ Implement JSON import feature
- ⏳ Add UI controls for import
- ⏳ Test end-to-end playcount sync workflow

**Known Limitations**:
- ⚠️ Last.fm playcount sync disabled (API limitation)
- ⚠️ ListenBrainz stats API limited to top 100 (workaround via JSON download)

---

## MusicBrainz Metadata Enhancement (Phase 8 - 2026-02-07)

A comprehensive metadata enrichment system that automatically identifies and enhances your music library with professional-grade metadata from MusicBrainz and AcousticBrainz.

### 🎯 What Is MusicBrainz Enhancement?

Think of it as an automatic "music fact checker" that:
- Identifies your tracks using smart matching algorithms
- Adds professional music database IDs (MusicBrainz IDs)
- Enriches files with audio analysis data (BPM, musical key, mood)
- Writes everything directly to your file tags for future-proof portability

### ✨ Key Features

**Automatic Track Identification**:
- Matches tracks by comparing artist, title, album, and duration
- Advanced fuzzy matching handles typos and variations
- Tolerates duration differences (±2 seconds) for different edits
- Handles "featuring" artists, acronyms, and remastered versions

**Audio Analysis Integration**:
- **BPM (Beats Per Minute)**: Perfect for DJs and workout playlists
- **Musical Key**: In formats like "C major", "A minor"
- **Mood Tags**: Descriptive tags like "energetic", "melancholic", "uplifting"
- **Energy & Danceability**: Numerical scores for sorting and filtering

**Metadata Written to Files**:
- `MUSICBRAINZ_TRACKID`: Unique recording identifier
- `MUSICBRAINZ_ALBUMID`: Release/album identifier
- `MUSICBRAINZ_ARTISTID`: Artist identifier
- `BPM`: Tempo in beats per minute
- `KEY`: Musical key notation

### 🚀 How to Use

**Step-by-Step**:
1. **Open Settings**:
   - Click the Settings icon in the sidebar
   - Navigate to "Library Management" section

2. **Start Enhancement**:
   - Look for the blue "Enhance Library with MusicBrainz" button
   - Click to begin processing

3. **Monitor Progress**:
   - A modal window appears showing:
     - Current track being processed (title and artist)
     - Progress counter (e.g., "45 / 1,247")
     - Success count (tracks successfully enhanced)
     - Skipped count (no match found)
     - Error count (API failures or write errors)

4. **Wait for Completion**:
   - Process runs automatically in background
   - You can cancel anytime with the Cancel button
   - Modal closes automatically when finished

5. **Verify Results**:
   - Check your FLAC files with:
     ```powershell
     metaflac --list "path/to/track.flac" | Select-String "MUSICBRAINZ"
     ```
   - New tags will appear in your music player of choice

### 🧠 How the Matching Works

**Confidence Scoring System**:
The matcher assigns a score (0-100) based on how well your track matches MusicBrainz entries:

- **80-100 (High Confidence)**: Very likely correct
  - Artist name matches exactly
  - Title matches with minor variations
  - Album matches (or is Various Artists compilation)
  - Duration within 2 seconds

- **60-79 (Medium Confidence)**: Probable match
  - Artist name has minor differences
  - Title has some variation (remaster, live, etc.)
  - Duration slightly off but within tolerance

- **0-59 (Low Confidence)**: Uncertain
  - Significant differences in artist or title
  - Duration mismatch > 2 seconds
  - Album name doesn't match
  - **Action**: Track is skipped, logged as "no_match"

**Smart Features**:
- **Normalization**: Automatically handles "The Beatles" vs "Beatles"
- **Acronym Detection**: Matches "S.O.A.D" with "System of a Down"
- **Featuring Artists**: Strips "feat.", "ft.", "with" for cleaner matching
- **Year Tolerance**: Allows ±2 years for reissues and remasters
- **Multiple Candidates**: Compares against all potential matches, picks best

### 📊 What Gets Stored

**Database Tables**:
1. **musicbrainz_recordings**: Track-level data (MBID, BPM, key, mood)
2. **musicbrainz_releases**: Album-level data (release MBID, release group)
3. **musicbrainz_artists**: Artist MBIDs
4. **enhancement_log**: Processing history with timestamps (success/no_match/error)

**File Tags** (written to FLAC/MP3):
- All MusicBrainz IDs persisted in standard Vorbis comments
- BPM and KEY tags for DJ software compatibility
- Tags remain even if you move files to another music manager

### 🎵 API Sources

**MusicBrainz** (https://musicbrainz.org/):
- Open music encyclopedia with millions of tracks
- Community-maintained, high accuracy
- Provides unique identifiers (MBIDs) for recordings, releases, artists

**AcousticBrainz** (https://acousticbrainz.org/):
- Sister project of MusicBrainz
- Audio analysis data extracted from actual recordings
- Provides BPM, key, mood, energy, danceability scores

### 🔧 Technical Details

**API Calls per Track**:
1. **MusicBrainz Search**: Find potential matches (~500ms)
2. **Fuzzy Matching**: Score all candidates locally (instant)
3. **AcousticBrainz Low-Level**: Fetch BPM and key (~300ms)
4. **AcousticBrainz High-Level**: Fetch mood tags (~300ms)
5. **File Writing**: Use metaflac to write tags (~50ms)

**Rate Limiting**:
- 1-second delay between MusicBrainz requests (API courtesy)
- No delay for AcousticBrainz (no explicit limit)
- Total processing time: ~2 seconds per track
- For 1,000 tracks: ~30-40 minutes

**Error Handling**:
- Network failures: Logged as "error", retryable later
- No match found: Logged as "no_match", skipped
- File write errors: Logged with error message
- API rate limit exceeded: Automatic exponential backoff

### 🐛 Known Issues & Limitations

**Format Support**:
- ✅ FLAC: Fully supported (metaflac)
- ⚠️ MP3: Planned (requires id3v2 installation)
- ❌ M4A/AAC: Not yet supported

**Matching Challenges**:
- **Various Artists**: May have lower confidence scores
- **Live Recordings**: Duration variations can reduce match quality
- **Remixes**: May match original instead of remix
- **Local/Indie Artists**: Less likely to be in MusicBrainz

**API Availability**:
- Requires internet connection during enhancement
- MusicBrainz sometimes has temporary outages
- AcousticBrainz analysis not available for all recordings (~60% coverage)

### ✅ Success Indicators

You'll know it worked when:
- ✅ Progress modal shows high success count
- ✅ `metaflac --list` shows MUSICBRAINZ_TRACKID tags
- ✅ Other music players (foobar2000, Plex) recognize MBIDs
- ✅ BPM and KEY tags visible in file metadata
- ✅ No errors in application console

---

## Manual Match Selection UI (Block 4 - 2026-02-07)

An interactive interface that lets you manually choose the correct MusicBrainz release when multiple options exist or automatic matching is uncertain - exactly like the image you provided!

### 🤔 Why Manual Matching?

Sometimes automatic matching isn't perfect:
- **Multiple Releases**: Same album released in different countries, formats, or years
- **Remaster Confusion**: Original vs remastered versions
- **Compilation Albums**: Track appears on multiple albums
- **Low Confidence**: Automatic scorer unsure about the match

Manual matching gives you control to pick the right one.

### ✨ What You Get

**Interactive Modal Window** (just like in your screenshot):
- **Left Panel**: List of release candidates with confidence scores
- **Right Panel**: Track listing with duration verification
- **Metadata Preview**: See exactly what will be written
- **Visual Indicators**: Red text for duration mismatches
- **Confidence Colors**: Green/Yellow/Red scores

**Verifications**:
- Album year, country, format (CD/Vinyl/Digital)
- Record label information
- Complete track listing
- Duration comparison (highlights differences >2s in red)
- Confidence percentage for each option

### 🚀 How to Use

**Access Methods**:

1. **Manual Match View** (Primary method):
   - Settings → MusicBrainz → "Manual Match Tracks"
   - Shows all tracks without MBIDs
   - Click track → modal opens with options
   - Select correct release → Apply

2. **Context Menu** (Quick access):
   - Right-click any track
   - Select "Identify Track"
   - Choose from releases shown

3. **Auto-Enhancement** (Future):
   - Low-confidence matches pause process
   - Modal opens for manual selection
   - Continue after choosing

### 🔍 What to Look For

When choosing the correct release:

✅ **Match These**:
- Year matches your copy
- Country/region is correct
- Format (CD/Vinyl/Digital)
- Track count identical
- Duration within 2-3 seconds

⚠️ **Watch Out For**:
- Remaster vs Original (different years/durations)
- Deluxe editions (extra tracks)
- Regional releases (different track orders)
- Live vs Studio versions

**Red Duration Text** means:
- Track duration differs by >2 seconds
- Possible wrong version/edit
- Verify this is your actual release

### ⚙️ What Happens When You Apply

1. ✅ Fetches audio analysis (BPM, key, mood)
2. ✅ Updates database with MBIDs
3. ✅ Writes tags to your audio file
4. ✅ Logs success in enhancement history
5. ✅ Track marked as matched

**Tags Written**:
- `MUSICBRAINZ_TRACKID`
- `MUSICBRAINZ_ALBUMID`  
- `MUSICBRAINZ_ARTISTID`
- `BPM` (if available)
- `KEY` (if available)

### ⏱️ Performance

- Initial search: ~5 seconds
- Shows up to 10 release candidates
- Switching releases: instant (cached)
- Applying selection: ~2-3 seconds

### 💡 Pro Tips

**Matching Strategy**:
1. Start with green (high confidence) tracks
2. Skip red (low confidence) for later research
3. Use MusicBrainz.org for verification if unsure
4. Check your physical media if you still have it

**Duration Tolerance**:
- ±2 seconds = Normal encoding variance ✅
- 2-5 seconds = Check carefully ⚠️
- >5 seconds = Likely wrong version ❌

**When to Skip**:
- No good matches (all red/low scores)
- Need external research
- Prefer to try automatic matching again later

### ✅ Verification

After applying, check:
```powershell
metaflac --list "track.flac" | Select-String "MUSICBRAINZ"
```

Should show:
```
MUSICBRAINZ_TRACKID=abc-123-def
MUSICBRAINZ_ALBUMID=xyz-789-ghi
MUSICBRAINZ_ARTISTID=123-456-789
```

### 🔮 Future Enhancements

**Planned Features**:
- ✅ Manual match selection UI - **COMPLETED**
- AcoustID fingerprinting (acoustically identify tracks)
- MP3 tag writing support (id3v2 integration)
- Batch re-enhancement (update old metadata)
- Import MBIDs from MusicBrainz Picard
- "Similar Tracks" feature using mood and energy data
- BPM-based playlist generation


