# Musikmetadata Management System

**Projektspecifikation & Implementeringsguide**

---

## 📋 Executive Summary

Detta projekt skapar ett komplett system för att hantera och redigera metadata för 100 000+ musikfiler (FLAC & MP3). Systemet består av en Docker-baserad backend-server som körs på TrueNAS och klientapplikationer för Android (React Native) och desktop (Electron).

### Översikt

| **Kategori** | **Detaljer** |
|-------------|-------------|
| **Plattformar** | Backend (Docker), Android (React Native), Desktop (Electron) |
| **Teknologi** | Node.js, React, PostgreSQL, Redis |
| **Filformat** | FLAC (Vorbis Comments), MP3 (ID3v2) |
| **Deployment** | Docker Compose på TrueNAS |

---

## 🏗️ Systemarkitektur

### Övergripande Design

Systemet är uppdelat i tre huvudkomponenter som kommunicerar via REST API och WebSocket:

1. **Backend Server (Docker)** - Körs på TrueNAS, hanterar filsystem, metadata och databas
2. **Desktop App (Electron)** - Windows/Mac/Linux klient för avancerad redigering
3. **Mobile App (React Native)** - Android-app för metadata-sökning och grundläggande redigering

### Backend Server (Docker)

#### Komponenter

- **API Server:** Node.js med Express.js
- **Databas:** PostgreSQL 15+ för metadata-index
- **Cache:** Redis för session-hantering och snabba queries
- **File Processing:** Worker-processer för batch-operationer

#### Teknisk Stack

| **Komponent** | **Teknologi** | **Syfte** |
|--------------|--------------|-----------|
| API Framework | Express.js 4.x | REST API endpoints |
| Metadata Parsing | music-metadata, node-id3 | Läsa/skriva FLAC & MP3 |
| Databas ORM | Prisma eller TypeORM | PostgreSQL migrations |
| Real-time Sync | Socket.io | Live updates till klienter |
| Authentication | JWT + bcrypt | Säker autentisering |

---

## 💾 Databasschema (PostgreSQL)

### Huvudtabell: `tracks`

Lagrar grundläggande metadata för varje musikfil.

| **Kolumn** | **Typ** | **Index** | **Beskrivning** |
|-----------|---------|-----------|----------------|
| `id` | UUID | PRIMARY KEY | Unik identifierare |
| `file_path` | TEXT | UNIQUE, INDEX | Absolut sökväg |
| `file_hash` | VARCHAR(64) | INDEX | SHA256 för duplicering |
| `title` | TEXT | GIN INDEX | Full-text search |
| `artist` | TEXT | INDEX | Artist-sökning |
| `album` | TEXT | INDEX | Album-sökning |
| `year` | INTEGER | INDEX | Årtal |
| `genre` | TEXT | INDEX | Genre |
| `duration` | INTEGER | - | Längd i sekunder |
| `bitrate` | INTEGER | - | kbps |
| `format` | VARCHAR(10) | INDEX | flac eller mp3 |
| `created_at` | TIMESTAMP | - | Skapad tidpunkt |
| `updated_at` | TIMESTAMP | - | Uppdaterad tidpunkt |

### Ytterligare Tabeller

**`albums`** - Normaliserad albumdata
- `id`, `name`, `artist_id`, `year`, `cover_art_path`

**`artists`** - Normaliserad artistdata
- `id`, `name`, `bio`, `image_path`

**`scan_history`** - Spårar scanning-jobb
- `id`, `started_at`, `completed_at`, `files_scanned`, `errors`

---

## 🔌 REST API Endpoints

Alla endpoints kräver JWT authentication förutom `/auth/*`

### Authentication

- `POST /api/auth/login` - Logga in och få JWT token
- `POST /api/auth/register` - Registrera ny användare
- `POST /api/auth/refresh` - Förnya JWT token

### Tracks (Musikfiler)

- `GET /api/tracks` - Lista tracks med pagination & filter
- `GET /api/tracks/:id` - Hämta specifik track
- `PUT /api/tracks/:id` - Uppdatera metadata
- `DELETE /api/tracks/:id` - Ta bort från databas
- `POST /api/tracks/batch-update` - Batch-uppdatera flera filer

### Search

- `GET /api/search` - Full-text search med PostgreSQL
- `GET /api/search/suggestions` - Autocomplete förslag

### Scanner

- `POST /api/scanner/start` - Starta filskanning
- `GET /api/scanner/status` - Kontrollera scanning progress
- `POST /api/scanner/stop` - Stoppa pågående scanning

---

## 💻 Frontend Applikationer

### Electron Desktop App

#### Teknologi

- **Electron:** För native desktop integration
- **React 18:** UI framework
- **Vite:** Build tool
- **TanStack Query:** Data fetching & caching
- **Zustand:** State management
- **TailwindCSS:** Styling

#### Huvudfunktioner

- **Premium UI Concept**: Roon- och MusicBee-inspirerad design med fokus på estetik och användarvänlighet.
- **Advanced Search**: Kategoriserad sökmodal (Artist, Track, Album, Playlist) nåbar från toppmenyn.
- **Smart Navigation**: Komplett historik med Framåt/Bakåt-pilar för ett webbläsarliknande arbetsflöde.
- **Enhanced Artist Views**: Biografier, liknande artister och topplåtar hämtade automatiskt från Last.fm och MusicBrainz.
- **Automated Library Management**: Bakgrundsskanning, automatisk cover art extraction och metadata-synkning.
- **Playlists & Queue**: Avancerat stöd för M3U-spellistor, drag-and-drop-köer och intelligent Auto-DJ.
- **Deep Metadata Tools**: Redigering av taggar för både FLAC och MP3, stöd för halv-stjärniga betyg (0-5) och hjärtan.
- **Connectivity**: Inbyggd scrobbling till Last.fm och ListenBrainz med dubbelsidig synkning av betyg/hjärtan.
- **Advanced Audio**: Stöd för Normalisering, ReplayGain och en dedikerad minispelare.

### React Native Mobile App

#### Teknologi

- **React Native:** 0.73+
- **Expo:** För snabbare utveckling
- **React Navigation:** Routing
- **Axios:** HTTP client
- **AsyncStorage:** Lokal cache

#### Huvudfunktioner

- Sök och bläddra i musikbiblioteket
- Visa och redigera basic metadata
- Cover art viewer
- Offline mode med cached data

---

## 🐳 Docker & Deployment

### Docker Compose Struktur

Systemet använder Docker Compose med följande containers:

| **Service** | **Image** | **Beskrivning** |
|------------|-----------|----------------|
| api | node:20-alpine | Express API server med metadata processing |
| postgres | postgres:15-alpine | Metadata databas med GIN index för sökning |
| redis | redis:7-alpine | Session store och query cache |
| worker | node:20-alpine | Background worker för scanning och batch jobs |

### Volume Mappings

- **`/mnt/music`** → Musikfiler på TrueNAS (read-only rekommenderat)
- **`/var/lib/postgresql/data`** → PostgreSQL persistent data
- **`/data`** → Redis persistent data

### Exempel docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: musicdb
      POSTGRES_USER: musicuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://musicuser:${DB_PASSWORD}@postgres:5432/musicdb
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      MUSIC_PATH: /mnt/music
    volumes:
      - /mnt/music:/mnt/music:ro
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  worker:
    build: ./backend
    command: npm run worker
    environment:
      DATABASE_URL: postgresql://musicuser:${DB_PASSWORD}@postgres:5432/musicdb
      REDIS_URL: redis://redis:6379
      MUSIC_PATH: /mnt/music
    volumes:
      - /mnt/music:/mnt/music:ro
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## 📅 Implementeringssteg

### Fas 1: Backend Foundation (2-3 veckor)

1. Sätt upp Docker Compose med PostgreSQL, Redis och Node.js
2. Skapa databasschema och migrations
3. Implementera filskanner med music-metadata
4. Bygg REST API endpoints för CRUD operations
5. Lägg till authentication med JWT

### Fas 2: Electron Desktop App (2-3 veckor)

1. Scaffolda Electron + React + Vite projekt
2. Implementera API client och authentication
3. Bygg huvudvy med tabell och paginering
4. Lägg till sök- och filterfunktioner
5. Implementera metadata editor
6. Lägg till bulk-operations

### Fas 3: React Native Mobile App (2-3 veckor)

1. Scaffolda React Native Expo projekt
2. Implementera navigation och login
3. Bygg sökning och browse screens
4. Lägg till metadata viewer/editor
5. Implementera offline mode

### Fas 4: Optimization & Testing (1-2 veckor)

1. Performance optimization för stora dataset
2. Lägg till error handling och logging
3. Implementera backup och restore
4. Testa med reella 100k filer
5. Dokumentation och deployment guide

**Total tidsåtgång:** 7-11 veckor

---

## ⚡ Performance & Skalning

### Databasoptimering

- **GIN index** på title, artist, album för snabb full-text search
- **B-tree index** på file_path för snabba lookups
- **Materialized views** för aggregerade statistik
- **Connection pooling** med max 20 connections

### Caching Strategi

- **Redis cache** för frekventa queries (TTL 5 min)
- **API response caching** med ETag headers
- **Frontend cache** med TanStack Query (stale-while-revalidate)

### Batch Processing

- Initial scan: Process 100 filer åt gången
- Batch updates: Max 50 filer per request
- Queue system för långvariga jobs

---

---

## 🔮 Roadmap & Future Features

The following features are planned for future releases to enhance the audiophile experience and library management.

### 🎧 Audio & Playback
- **Exclusive Mode (WASAPI/ASIO)**: Bit-perfect playback bypassing the Windows mixer.
- **Gapless Playback**: Seamless transitions for concept albums and live sets.
- **ReplayGain**: Volume normalization based on track/album metadata.
- **Smart Shuffle**: AI-driven shuffling to avoid repetition and sonic clashes.

### 🧠 Smart Analysis
- **Sonic Analysis**: Find tracks with similar "vibe" (BPM, energy, timbre) regardless of genre tags.
- **Aura**: Dynamic visualizer that changes colors based on the music's mood.

### 🛠️ Library Power Tools
- **Auto-Watch**: Effectively detect new and changed files in real-time.
- **Rescan Tags**: Right-click option to force-reload metadata from disk.
- **Genre Hierarchies**: Navigate sub-genres in a tree structure.
- **External Sync**: Two-way synchronization of Playcounts, Ratings, and Hearts with ListenBrainz/Last.fm.

### ⌨️ Productivity
- **Universal Shortcuts**: `Space` (Play/Pause), `Backspace` (Back), `Shift+Enter` (Edit).
- **Taskbar Controls**: Control playback directly from the OS taskbar thumbnail.
- **Customizable UI**: Options to hide "About Artist" text or adjust global font sizes.

---

## 🔒 Säkerhet

- **JWT Authentication** med 1h access tokens och 7d refresh tokens
- **bcrypt** för lösenordshashing (cost 10)
- **Rate limiting** på API endpoints (100 req/min per IP)
- **HTTPS only** med TLS 1.3
- **CORS** konfigurerat för endast kända klienter
- **Input sanitization** för alla user inputs

---

## 💡 Rekommendationer

### Varför Docker på TrueNAS?

- **Centraliserad hantering** - En server för alla klienter
- **Direkt filaccess** - Servern kan läsa/skriva FLAC/MP3 direkt
- **Alltid online** - TrueNAS körs 24/7
- **Backup** - TrueNAS har inbyggd ZFS snapshots

### Nästa Steg

1. Börja med backend och testa med 1000 filer först
2. Bygg Electron app för desktop use case
3. Lägg till React Native app för mobile
4. Optimera för 100k filer när core features funkar

---

## 📦 Projektstruktur

```
music-metadata-manager/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── middleware/
│   │   ├── services/
│   │   │   ├── metadata.service.js
│   │   │   ├── scanner.service.js
│   │   │   └── auth.service.js
│   │   ├── models/
│   │   ├── utils/
│   │   └── worker/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── Dockerfile
│   └── package.json
├── desktop/
│   ├── src/
│   │   ├── main/           # Electron main process
│   │   └── renderer/       # React UI
│   ├── package.json
│   └── vite.config.js
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/
│   ├── app.json
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Komma Igång

### Förutsättningar

- Docker & Docker Compose
- Node.js 20+
- TrueNAS server med tillgång till musikfiler
- (För mobile) Android Studio / Expo Go

### Installation

```bash
# 1. Klona projektet
git clone <repo-url>
cd music-metadata-manager

# 2. Skapa .env fil
cp .env.example .env
# Redigera .env med dina värden

# 3. Starta backend med Docker
docker-compose up -d

# 4. Kör initial migration
docker-compose exec api npm run migrate

# 5. Starta filskanning
curl -X POST http://localhost:3000/api/scanner/start \
  -H "Authorization: Bearer <your-jwt-token>"

# 6. Starta Electron app (i nytt terminal)
cd desktop
npm install
npm run dev

# 7. Starta React Native app (i nytt terminal)
cd mobile
npm install
npx expo start
```

---

## 🛠️ Utveckling

### Backend API

```bash
cd backend
npm install
npm run dev          # Development med hot reload
npm run test         # Kör tester
npm run migrate      # Kör databas migrations
```

### Desktop App

```bash
cd desktop
npm install
npm run dev          # Development mode
npm run build        # Bygg för produktion
npm run package      # Skapa installer
```

### Mobile App

```bash
cd mobile
npm install
npx expo start       # Starta Expo dev server
npx expo start --android  # Kör på Android
npm run build        # Bygg APK
```

---

## 📊 Monitoring & Logs

### Docker Logs

```bash
# Visa alla logs
docker-compose logs -f

# Visa specifik service
docker-compose logs -f api
docker-compose logs -f worker
```

### Databas Monitoring

```sql
-- Kontrollera antal tracks
SELECT COUNT(*) FROM tracks;

-- Se senaste skannade filer
SELECT * FROM tracks ORDER BY created_at DESC LIMIT 10;

-- Kontrollera index-användning
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes;
```

---

## 🐛 Troubleshooting

### Problem: Scanner hittar inga filer

**Lösning:** Kontrollera volume mapping i docker-compose.yml
```bash
docker-compose exec api ls -la /mnt/music
```

### Problem: Långsam sökning

**Lösning:** Kontrollera att GIN index är skapat
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'tracks';
```

### Problem: Desktop app kan inte ansluta

**Lösning:** Kontrollera att API körs och är tillgängligt
```bash
curl http://localhost:3000/api/health
```

---

## 📝 Licens

Detta projekt är licensierat under MIT License.

---

## 👥 Kontakt

För frågor eller förtydliganden, kontakta projektledaren.

---

**Skapad med Claude AI** 🤖
