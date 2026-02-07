# MusicMaster

A high-fidelity desktop music player built with Electron, React, and TypeScript. MusicMaster has been refactored into a client-server architecture, featuring a headless Node.js/Express backend (Server) and a refined desktop frontend (Client).

## Architecture

MusicMaster now operates as two distinct components:

1.  **Server**: A headless Node.js application managing the database, file scanning, metadata (MusicBrainz/AcousticBrainz), and scrobbling. It provides a REST API for the client.
2.  **Client (Desktop)**: An Electron application delivering the premium user interface, audio playback, and visual experience. It communicates with the Server via the REST API.

## Features

###  Server
-   **Centralized Database**: `better-sqlite3` data store for all library metadata.
-   **Headless Scanning**: Fast, non-blocking file scanning (FLAC, MP3, M4A).
-   **Metadata Services**:
    -   MusicBrainz integration for track/artist/album identification.
    -   AcousticBrainz integration for BPM, key, and mood data.
    -   Writing metadata tags (rating, loved status) back to files (MP3/FLAC).
-   **Scrobbling**: Background submission to Last.fm and ListenBrainz.
-   **API**: Comprehensive REST API for all library operations.

###  Client (Desktop)
-   **High-Quality Audio**: Hardware-accelerated playback via Web Audio API.
-   **Gapless Playback**: Seamless transitions with dual-audio preloading.
-   **Modern UI**: React 18 + TailwindCSS with a custom premium dark theme.
-   **Rich Interactions**: Context menus, drag-and-drop queue, multi-select.
-   **Visualizations**: Scrobble status, ReplayGain indicators, loved ribbons.

## Development

### Prerequisites
-   Node.js 18+
-   npm or yarn
-   Docker (optional, for server deployment)

### Setup

#### 1. Server
```bash
cd server
npm install
npm start
# Server runs on http://localhost:3000
```

#### 2. Client
```bash
cd desktop
npm install
npm run dev
# Frontend runs in development mode, connecting to localhost:3000
```

### Production Build via Docker
You can run the full backend stack using Docker Compose:

```bash
docker-compose up -d
```

### Project Structure
```
/
├── server/                 # Backend Node.js Application
│   ├── src/
│   │   ├── api/           # REST API Routes & Controllers
│   │   ├── database/      # SQLite Schema & Queries
│   │   ├── services/      # External Services (MusicBrainz, Last.fm)
│   │   └── index.ts       # Server Entry Point
│   ├── Dockerfile
│   └── package.json
│
├── desktop/                # Frontend Electron Application
│   ├── src/
│   │   ├── main/          # Electron Main Process (Window Management)
│   │   ├── renderer/      # React Frontend (UI)
│   │   │   ├── api/       # API Client (RestClient)
│   │   │   ├── components/
│   │   │   ├── views/
│   │   │   └── store/
│   │   └── preload/
│   └── package.json
└── docker-compose.yml      # Container Orchestration
```

## Configuration

### Environment Variables (Server)
Create a `.env` file in `server/`:

```env
PORT=3000
MUSIC_PATH=/path/to/music      # For local dev or Docker volume
LISTENBRAINZ_TOKEN=...          # Optional
```

### Frontend Configuration
The frontend automatically connects to `http://localhost:3000` by default. This can be configured in `desktop/src/renderer/src/api/client.ts`.

## Database Schema
The server manages a SQLite database with tables for:
-   **Tracks**, **Albums**, **Artists**, **Genres**
-   **Playlists** & **PlaylistTracks**
-   **PlaybackState** (Session persistence)
-   **UserSettings**
-   **ScrobbleQueue** & **PlayHistory**
-   **MusicBrainz** (Cache & Metadata)

## Future Roadmap

-   **Frontend Migration**: Complete migration of all UI components to use the new `RestClient`.
-   **Authentication**: Add user accounts/auth to the Server API.
-   **Mobile App**: Potential mobile client consuming the Server API.
-   **Web Client**: Standalone web interface hosted by the server.

## License
MIT
