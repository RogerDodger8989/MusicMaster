# MusicMaster

En högkvalitativ skrivbordsmusikspelare byggd med Electron, React och TypeScript. MusicMaster använder en klient-server-arkitektur med en headless Node.js/Express-backend och en Electron-klient.

## Arkitektur

MusicMaster består av två komponenter:

1. **Server** – Headless Node.js-app som hanterar databas, filskanning, metadata (MusicBrainz) och scrobbling. Serverar ett REST API.
2. **Klient (Desktop)** – Electron-app med React-UI, uppspelning och visualiseringar. Kommunicerar med servern via REST.

## Funktioner

### 🖥️ Server
- **Databas**: SQLite via `better-sqlite3` för all bibliotekets metadata
- **Filskanning**: Snabb, icke-blockerande skanning (FLAC, MP3, M4A)
- **Metadata-tjänster**:
  - MusicBrainz för identifiering av spår/artist/album
  - Automatisk bakgrundsberikning med artistbilder och biografi (Last.fm/Spotify)
  - **Komplett tagg-skrivning** – alla Vorbis-taggar (FLAC) och ID3-taggar (MP3) stöds
- **Scrobbling**: Automatisk synk mot Last.fm och ListenBrainz
- **REST API**: Komplett API för alla biblioteksoperationer

### 🎵 Klient (Desktop)
- **Högkvalitativt ljud**: Hårdvaruaccelererad uppspelning via Web Audio API
- **Gapless playback**: Sömlösa övergångar med dubbel förhandsladning
- **Modernt UI**: React 18 med premiumdesign i mörkt tema
- **Tag Editor**: Redigera och spara 30+ metadata-fält direkt i FLAC/MP3-filer

## Stödda metadata-fält (Tag Editor)

| Kategori | Fält |
|---|---|
| Grundfält | Titel, Artist, Album, Albumartist, Genre, År |
| Spårinfo | Spårnummer/totalt, Skivnummer/totalt |
| Upphovsrätt | Kompositör, Skivbolag (→ ORGANIZATION), Dirigent, Katalognummer, ISRC, Streckkod |
| Utgivning | Media, Skript, Utgivningsland, Utgivningsstatus, Utgivningstyp |
| Kategorisering | Språk, Tempo, Humör, Nyckelord, Tillfälle |
| Original | Ursprunglig artist/album/år, Ursprungligt datum |
| Sortering | Artist sorteringsordning, Albumartist sorteringsordning |
| MusicBrainz | Track ID, Album ID, Artist ID, Release Group ID, Work ID, Recording ID |
| Analys | BPM, Energi, Dansbarhet, Valens, Instrumentalitet |
| Betyg | Betyg (1–5), Loved, Spelantal |
| Anpassat | Custom 1–20 |

## Kom igång

### Förutsättningar
- Node.js 18+
- npm

### Installation

```bash
# 1. Server
cd server
npm install
npm run dev
# Servern körs på http://localhost:3000

# 2. Klient
cd desktop
npm install
npm run dev:web
# Öppnar i webbläsaren på http://localhost:5173
```

### Docker
```bash
docker-compose up -d
```

## Projektstruktur
```
/
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── api/           # REST API Routes & Controllers
│   │   ├── database/      # SQLite Schema & Queries
│   │   ├── services/      # Externa tjänster (MusicBrainz, Last.fm, metadata-skrivning)
│   │   └── index.ts       # Entry Point
│   └── package.json
│
├── desktop/                # Frontend Electron/Vite
│   ├── src/
│   │   └── renderer/      # React-app
│   │       ├── api/       # REST-klient
│   │       ├── components/
│   │       └── store/
│   └── package.json
│
└── docker-compose.yml
```

## Miljövariabler (Server)

Skapa `.env` i `server/`:

```env
PORT=3000
LASTFM_API_KEY=...        # Valfritt – för scrobbling
SPOTIFY_CLIENT_ID=...      # Valfritt – för artistbilder
LISTENBRAINZ_TOKEN=...     # Valfritt – för ListenBrainz
```

## Databas-schema

SQLite-databasen innehåller tabeller för:
- **Tracks, Albums, Artists, Genres**
- **Playlists & PlaylistTracks**
- **PlaybackState** (session-persistens)
- **UserSettings**
- **ScrobbleQueue & PlayHistory**
- **Performers** (kompositörer, producenter, textförfattare m.m.)

## Licens
MIT
