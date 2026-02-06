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

## 2. Future Feature Roadmap (Phase 4+)

### 🎧 High-Fidelity Audio Engine
- **Exclusive Mode**: Implement WASAPI (Windows) and ASIO support to bypass the OS mixer for bit-perfect playback.
- **Gapless Playback**: Pre-load the next track buffer to ensure zero-latency transitions.
- **ReplayGain**: Read `REPLAYGAIN_*` tags and apply volume normalization per track/album.

### 🧠 Smart Features ("Sonic Analysis")
- **Waveform Analysis**: Analyze audio files for BPM, key, and energy.
- **Sonic Similarity**: "Play songs that sound like this" feature (independent of tags).
- **Aura Visualizer**: Generate real-time ambient colors based on the current track's mood/energy.

### 🖥️ Desktop Experience
- **Taskbar Integration**: Add media controls (Prev/Play/Next) to the Windows taskbar preview.
- **Global Shortcuts**:
    - `Space`: Play/Pause
    - `Enter`: Confirm
    - `Esc`: Cancel/Back
    - `Backspace`: Navigate Back
- **Rescan & Watch**: Implement file system watchers (`chokidar`) to auto-update the library when files change.

### ☁️ Sync & Connectivity
- **ListenBrainz/Last.fm**:
    - Two-way sync for Ratings (0-5 stars) and "Loved" status.
    - Submit "Now Playing" immediately.
    - Submit "Scrobble" only after 50% of the track is played.
