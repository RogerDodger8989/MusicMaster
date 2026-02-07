# MusicMaster

A high-fidelity desktop music player built with Electron, React, and TypeScript. MusicMaster provides a premium listening experience with advanced audio features, scrobbling support, and intelligent library management.

## Features

###  Core Playback
- **High-Quality Audio**: Hardware-accelerated playback for FLAC, MP3, M4A, and more
- **Gapless Playback**: Seamless transitions between tracks with dual-audio preloading
- **ReplayGain Normalization**: Consistent volume across your entire library (Track/Album modes)
- **Smart Queue Management**: Drag-and-drop reordering, persistent playlists
- **Universal Shortcuts**: Space (Play/Pause), Backspace (Navigate), Esc (Close), Delete (Clear Queue)

###  Scrobbling & Statistics
- **ListenBrainz Integration**: Token-based scrobbling with offline queue support
- **Last.fm Integration**: Full OAuth flow with "Now Playing" and scrobble submission
- **Play Count Tracking**: Track-level statistics displayed across all views
- **50% Rule**: Scrobbles only recorded after track reaches 50% duration

###  Library Management
- **Fast Scanner**: Multi-threaded FLAC/MP3 metadata extraction with ReplayGain support
- **Watch Folders**: Automatic library updates with file system monitoring
- **Smart Ratings**: Universal rating logic (0-5 stars) with automatic loved status sync
- **Album Art**: Embedded cover extraction with fallback support

###  Modern UI
- **Responsive Design**: Adapts beautifully to any window size
- **Interactive Cards**: Album/Artist cards with quick-play buttons and rating badges
- **Draggable Modals**: Settings, search, and playlist controls can be repositioned
- **Visual Indicators**: ReplayGain badge, scrobbling status (LFM/LB), loved ribbons

## Technology Stack

- **Frontend**: React 18 + TypeScript + Zustand (state management)
- **Backend**: Electron + Node.js + better-sqlite3
- **Audio**: HTML5 Web Audio API with dual-element gapless architecture
- **Styling**: TailwindCSS with custom dark theme
- **Build**: Vite + electron-builder

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
cd desktop
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Project Structure
```
desktop/
 src/
    main/           # Electron main process
       database/   # SQLite schema & queries
       services/   # Last.fm, ListenBrainz, metadata
       scanner.ts  # Library scanning with ReplayGain
       ipc.ts      # IPC handlers
    renderer/       # React frontend
       components/ # UI components
       views/      # Main application views
       store/      # Zustand stores
       hooks/      # Custom React hooks
    preload/        # Electron preload scripts
```

## Configuration

### Scrobbling Setup

**ListenBrainz**:
1. Get your token from: https://listenbrainz.org/profile/
2. Paste token in Settings  ListenBrainz Token
3. Enable "ListenBrainz Enabled" checkbox

**Last.fm**:
1. Create API account: https://www.last.fm/api/account/create
2. Enter API Key and Shared Secret in Settings
3. Click "Authorize Last.fm" and approve in browser
4. Session key saves automatically

### ReplayGain
- Scans REPLAYGAIN_* tags from FLAC files automatically
- Configure in Settings: Track Gain, Album Gain, or Off
- Green "RG" indicator appears in PlayerBar when active

### Watch Folders
- Enable "Watch Enabled" for any music folder in Settings
- Folders automatically monitor for new files on app startup
- Changes detected in real-time using file system watchers

## Database Schema

**Tracks**: Core music library with metadata, ratings, and ReplayGain values  
**Albums**: Album metadata with aggregated ratings and play counts  
**Artists**: Artist information with Last.fm biographies and similar artists  
**Playlists**: Named track collections with ordering  
**Scrobble Queue**: Offline-capable scrobbling with per-service submission tracking  
**Play History**: Track play records with play count aggregation  

## Advanced Features

### Dual-Audio Gapless Architecture
Uses two HTML5 Audio elements to eliminate gaps:
1. `activeAudio`: Currently playing track
2. `preloadAudio`: Next track preloaded and ready
3. Seamless swap on track boundaries using `onended` event

### Offline Scrobbling
- Scrobbles queued locally when services unreachable
- Background worker processes queue every 5 seconds
- Per-service tracking prevents duplicate submissions
- Automatic retry with exponential backoff

### Smart Scanner
- Multi-threaded metadata extraction
- Preserves user ratings and loved status during re-scans
- ReplayGain tag extraction (TRACK_GAIN, ALBUM_GAIN, PEAK values)
- Automatic album art embedding with fallback support

### Play Count Sync & Management
- **File Tag Reading**: Extracts PLAY_COUNT from FLAC/MP3 tags during scanning
- **Database Persistence**: Stores play counts in tracks.play_count column
- **ListenBrainz Import**: PowerShell script (`download_listenbrainz.ps1`) downloads all listen history
- **Known Limitations**: 
  - Last.fm API returns global playcounts instead of personal stats (disabled)
  - ListenBrainz `/stats` endpoint limited to top 100 tracks
  - Solution: Download full listen history via `/listens` endpoint with pagination

### Rating System Fixes (2026-02-06)
- **Fixed**: Rating normalization bug where FMPS_RATING (0.8) was read as 0.04
- **Solution**: Read RATING tag directly (0-5 integer scale) instead of FMPS_RATING
- **Fixed**: All ratings disappearing after database reset + rescan
- **Solution**: Preserve existing track ratings during scan, don't overwrite with 0

## Future Roadmap

Check out the full [Project Roadmap](ROADMAP.md) for detailed feature plans.

- **Universal Delete Control**: Modal-confirmed deletion from playlists
- **History Menu**: Right-click Back/Forward buttons for navigation history
- **MusicBrainz Integration**: Comprehensive tagging (MBID, AcoustID) and fact fetching
- **Library Management**: Missing tracks modal and automatic "Inbox" folder handling
- **Playback Connectivity**: Chromecast, Apple, and Sonos support
- **Integrated Last.fm Dashboard**: In-app statistics, reports, and private listening mode
- **Exclusive Mode**: WASAPI/ASIO support for bit-perfect playback
- **Sonic Analysis**: BPM, key detection, and similarity matching
- **Taskbar Controls**: Windows taskbar media integration
- **Two-way Sync**: Import ratings/playcounts from Last.fm

## License

MIT
