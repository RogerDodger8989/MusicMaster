# Modul 3a - Enhanced Metadata Writer

## Översikt
Utökad metadata writer som skriver MusicBrainz-data och AcousticBrainz-analys tillbaka till ljudfiler (FLAC/MP3).

## Implementerade Funktioner

### 1. Utökat MusicBrainzWriteData Interface
Stöd för alla MusicBrainz-fält:

#### Recording/Track IDs
- `recordingMBID` / `trackId` - MUSICBRAINZ_TRACKID
- `isrc` - ISRC identifier

#### Album IDs
- `albumId` - MUSICBRAINZ_ALBUMID
- `releaseGroupMBID` - MUSICBRAINZ_RELEASEGROUPID

#### Artist IDs (Multi-artist support)
- `artistId` - Primär artist MBID
- `artistMBIDs[]` - Alla track artist MBIDs
- `albumArtistMBID` - Primär album artist
- `albumArtistMBIDs[]` - Alla album artist MBIDs

#### Release Metadata
- `releaseDate` - DATE
- `originalDate` - ORIGINALDATE
- `label` - ORGANIZATION/LABEL
- `catalogNumber` - CATALOGNUMBER
- `barcode` - BARCODE
- `country` - RELEASECOUNTRY
- `media` - MEDIA (CD, Vinyl, etc.)
- `albumType` - MUSICBRAINZ_ALBUMTYPE (album, single, EP, etc.)
- `releaseStatus` - MUSICBRAINZ_ALBUMSTATUS (official, promotion, etc.)

#### AcousticBrainz Audio Analysis
- `bpm` - BPM
- `key` - INITIALKEY
- `keySignature` - KEY_SIGNATURE
- `energy` - ENERGY (0-1)
- `danceability` - DANCEABILITY (0-1)
- `acousticness` - ACOUSTICNESS (0-1)
- `valence` - VALENCE (0-1, mood positivity)
- `instrumentalness` - INSTRUMENTALNESS (0-1)

#### Movement/Work Metadata
- `workMBID` - MUSICBRAINZ_WORKID
- `movement` - MOVEMENTNAME
- `movementNumber` - MOVEMENT
- `movementTotal` - MOVEMENTTOTAL

### 2. FLAC Metadata Writing
**Funktion:** `writeFLACMetadata()`
- Använder `metaflac` command-line tool
- Skriver alla Vorbis Comments för MusicBrainz
- Stöd för multiple artist MBIDs (multi-value tags)
- Skriver AcousticBrainz-analys som custom tags
- Bevarar befintliga rating/loved/playcount tags

### 3. MP3 Metadata Writing
**Funktion:** `writeMP3Metadata()`
- Använder `node-id3` library
- Standard ID3v2 frames: DATE, TPUB (publisher), BPM, INITIALKEY
- TXXX (User Defined Text) frames för MusicBrainz IDs
- Multiple artist MBIDs separeras med semicolon (;)
- AcousticBrainz-data som TXXX frames

### 4. Database Integration

#### buildMusicBrainzDataFromDb()
Hämtar komplett MusicBrainz-data från databasen för en track:
- Joins: tracks → albums → artists
- Hämtar track_artists (multi-artist tracks)
- Hämtar album_artists (multi-artist albums)
- Hämtar genres från track_genres (top 5 baserat på vote_count)
- Hämtar AcousticBrainz-data från acousticbrainz_data-tabellen
- Returnerar MusicBrainzWriteData-objekt redo för filskrivning

#### writeMusicBrainzDataToFile()
Skriver MusicBrainz-data från DB till ljudfil:
1. Hämtar track path från databasen
2. Bygger MusicBrainzWriteData med `buildMusicBrainzDataFromDb()`
3. Bevarar befintlig rating/loved/playcount
4. Anropar `writeMetadata()` med komplett data
5. Returnerar success/failure status

### 5. Bulk Operations

#### bulkWriteMusicBrainzData()
**Parametrar:**
- `db` - Database instance
- `trackIds[]` - Array av track IDs att uppdatera
- `onProgress()` - Optional callback för progress updates

**Returnerar:**
```typescript
{
  success: number,  // Antal framgångsrika skrivningar
  failed: number,   // Antal misslyckade
  skipped: number   // Antal överhoppade (no data/already written)
}
```

**Features:**
- Progress callback med (current, total, trackPath)
- Error handling per track (fortsätter vid fel)
- 10ms delay mellan tracks för att undvika system overload

#### syncAllMusicBrainzData()
Synkar ALL MusicBrainz-data till filer:
- Hämtar alla tracks med MBID från databasen
- Anropar `bulkWriteMusicBrainzData()` för alla tracks
- Använd för initial sync eller full re-sync

## Tag Mapping

### FLAC (Vorbis Comments)
```
MUSICBRAINZ_TRACKID         → Recording MBID
MUSICBRAINZ_RELEASETRACKID  → Release-specific recording MBID
ISRC                        → ISRC code
MUSICBRAINZ_ALBUMID         → Release MBID
MUSICBRAINZ_RELEASEGROUPID  → Release group MBID
MUSICBRAINZ_ARTISTID        → Artist MBID(s) - multi-value
MUSICBRAINZ_ALBUMARTISTID   → Album artist MBID(s) - multi-value
DATE                        → Release date
ORIGINALDATE                → Original release date
ORGANIZATION/LABEL          → Label name
CATALOGNUMBER               → Catalog number
BARCODE                     → Barcode/EAN
RELEASECOUNTRY              → Release country
MEDIA                       → Media format
MUSICBRAINZ_ALBUMTYPE       → Album type
MUSICBRAINZ_ALBUMSTATUS     → Release status
GENRE                       → Genre tags - multi-value
BPM                         → Tempo
INITIALKEY                  → Key
ENERGY                      → Energy level (0-1)
DANCEABILITY                → Danceability (0-1)
ACOUSTICNESS                → Acousticness (0-1)
VALENCE                     → Mood positivity (0-1)
INSTRUMENTALNESS            → Instrumentalness (0-1)
MUSICBRAINZ_WORKID          → Work MBID
MOVEMENTNAME                → Movement name
MOVEMENT                    → Movement number
MOVEMENTTOTAL               → Total movements
```

### MP3 (ID3v2)
**Standard frames:**
```
DATE (TDRC)       → Release date
TPUB              → Publisher/Label
BPM (TBPM)        → Tempo
INITIALKEY (TKEY) → Key
TCON              → Genre (semicolon-separated)
```

**TXXX frames (User Defined Text):**
```
MusicBrainz Release Track Id  → Recording MBID
MUSICBRAINZ_TRACKID           → Recording MBID
MUSICBRAINZ_RELEASETRACKID    → Release recording MBID
ISRC                          → ISRC code
MusicBrainz Album Id          → Release MBID
MUSICBRAINZ_ALBUMID           → Release MBID
MUSICBRAINZ_RELEASEGROUPID    → Release group MBID
MusicBrainz Artist Id         → Artist MBID(s) - semicolon-separated
MUSICBRAINZ_ARTISTID          → Artist MBID(s)
MUSICBRAINZ_ALBUMARTISTID     → Album artist MBID(s)
CATALOGNUMBER                 → Catalog number
BARCODE                       → Barcode
RELEASECOUNTRY                → Country
MEDIA                         → Media format
MUSICBRAINZ_ALBUMTYPE         → Album type
MUSICBRAINZ_ALBUMSTATUS       → Release status
ENERGY                        → Energy (0-1)
DANCEABILITY                  → Danceability (0-1)
ACOUSTICNESS                  → Acousticness (0-1)
VALENCE                       → Valence (0-1)
INSTRUMENTALNESS              → Instrumentalness (0-1)
MUSICBRAINZ_WORKID            → Work MBID
MOVEMENTNAME                  → Movement name
MOVEMENT                      → Movement number
MOVEMENTTOTAL                 → Total movements
```

## Användningsexempel

### Skriv MusicBrainz-data för en track
```typescript
import { writeMusicBrainzDataToFile } from './services/metadataWriter'

// Skriv MusicBrainz-data från DB till fil
const success = await writeMusicBrainzDataToFile(db, trackId)
```

### Bulk-uppdatering med progress
```typescript
import { bulkWriteMusicBrainzData } from './services/metadataWriter'

const trackIds = [1, 2, 3, 4, 5]

const result = await bulkWriteMusicBrainzData(
  db,
  trackIds,
  (current, total, path) => {
    console.log(`Processing ${current}/${total}: ${path}`)
    // Skicka progress till UI via IPC
  }
)

console.log(`✅ ${result.success} successful, ❌ ${result.failed} failed`)
```

### Synka allt
```typescript
import { syncAllMusicBrainzData } from './services/metadataWriter'

const result = await syncAllMusicBrainzData(
  db,
  (current, total, path) => {
    const percent = Math.round((current / total) * 100)
    console.log(`${percent}% - ${path}`)
  }
)
```

## Dependencies
- `music-metadata` - Metadata parsing
- `node-id3` - MP3 ID3 tag writing
- `metaflac` - FLAC metadata writing (system command, must be installed)

## Krav
- **FLAC**: Kräver `metaflac` command-line tool installerat
  - Windows: Installera FLAC tools från https://xiph.org/flac/
  - Kontrollera: `metaflac --version`
- **MP3**: Kräver `node-id3` (already installed)

## Multi-Artist Support
### FLAC
Multiple artist MBIDs skrivs som multi-value Vorbis Comments:
```
MUSICBRAINZ_ARTISTID=<mbid1>
MUSICBRAINZ_ARTISTID=<mbid2>
MUSICBRAINZ_ARTISTID=<mbid3>
```

### MP3
Multiple artist MBIDs sammanfogas med semicolon:
```
TXXX:MUSICBRAINZ_ARTISTID=<mbid1>;<mbid2>;<mbid3>
```

## Error Handling
- Skrivfel loggas men kastar inte exceptions
- `bulkWriteMusicBrainzData()` fortsätter vid fel (resilient)
- Tracks utan MusicBrainz-data skippas automatiskt
- Filformat som inte stöds (varken FLAC eller MP3) skippas

## Performance
- 10ms delay mellan bulk writes
- Progress callbacks varje track
- Async/await för non-blocking operations

## Nästa Steg (Modul 3b)
Skapa IPC handlers för att exponera dessa funktioner till frontend:
- `musicbrainz:enhance-track` - Enhance single track
- `musicbrainz:enhance-library` - Bulk enhance with progress
- `musicbrainz:write-to-files` - Write MBIDs to files
- `musicbrainz:sync-all` - Full library sync

## Status
✅ **COMPLETED** - Enhanced Metadata Writer implementerad och testad
