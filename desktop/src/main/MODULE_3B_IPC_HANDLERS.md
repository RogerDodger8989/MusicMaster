# Modul 3b - MusicBrainz IPC Handlers

## Översikt
IPC-handlers för att exponera MusicBrainz-funktionalitet från backend till frontend. Tillhandahåller API för att enhança tracks, synca metadata till filer, och visa coverage-statistik.

## Implementerade IPC Handlers

### 1. Coverage & Statistics

#### `musicbrainz:getCoverage`
**Returnerar:** MusicBrainz coverage-statistik för hela biblioteket

```typescript
{
  totalTracks: number
  tracksWithMBID: number
  tracksWithoutMBID: number
  coveragePercentage: number
  totalAlbums: number
  albumsWithMBID: number
  albumsWithoutMBID: number
}
```

**Användning:**
```typescript
const stats = await window.electron.ipcRenderer.invoke('musicbrainz:getCoverage')
console.log(`${stats.coveragePercentage}% tracks har MBIDs`)
```

---

### 2. Search & Match

#### `musicbrainz:searchTrack`
**Parametrar:**
```typescript
{
  artist: string
  title: string
  album?: string
  duration?: number  // i sekunder
  isrc?: string
}
```

**Returnerar:** MusicBrainz match med confidence score
```typescript
{
  mbid: string
  matchScore: number          // 0-100
  confidence: 'PERFECT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MISMATCH'
  recording: MBRecordingFull
}
```

**Användning:**
```typescript
const match = await window.electron.ipcRenderer.invoke('musicbrainz:searchTrack', {
  artist: 'Pink Floyd',
  title: 'Comfortably Numb',
  album: 'The Wall',
  duration: 382
})

if (match && match.confidence !== 'MISMATCH') {
  console.log(`Found MBID: ${match.mbid} with ${match.confidence} confidence`)
}
```

---

#### `musicbrainz:getRecordingDetails`
**Parametrar:** `recordingMBID: string`

**Returnerar:** Full MusicBrainz recording data
```typescript
{
  id: string
  title: string
  length: number
  'artist-credit': ArtistCredit[]
  releases: Release[]
  isrcs: string[]
  // ... etc
}
```

---

#### `musicbrainz:getAcousticBrainz`
**Parametrar:** `recordingMBID: string`

**Returnerar:** AcousticBrainz audio analysis
```typescript
{
  bpm: number
  key: string
  keySignature: string
  energy: number          // 0-1
  danceability: number    // 0-1
  acousticness: number    // 0-1
  valence: number         // 0-1
  instrumentalness: number // 0-1
}
```

---

### 3. Single Track Enhancement

#### `musicbrainz:enhanceTrack`
**Parametrar:**
- `trackId: number` - Internal track ID
- `writeToFile: boolean = true` - Om metadata ska skrivas till filen

**Returnerar:**
```typescript
{
  success: boolean
  confidence?: 'PERFECT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MISMATCH'
  matchScore?: number
  mbid?: string
  reason?: 'no_match'
}
```

**Process:**
1. Hämtar track från database
2. Söker MusicBrainz med `advancedMatch()`
3. Hämtar full recording details
4. Uppdaterar database med `updateTrackWithMBID()`
5. Försöker hämta AcousticBrainz data (optional)
6. Skriver metadata till fil (om `writeToFile = true`)

**Användning:**
```typescript
const result = await window.electron.ipcRenderer.invoke('musicbrainz:enhanceTrack', trackId, true)

if (result.success) {
  console.log(`✅ Enhanced with ${result.confidence} confidence`)
} else {
  console.log(`❌ Failed: ${result.reason}`)
}
```

---

### 4. Bulk Enhancement

#### `musicbrainz:enhanceTracks`
**Parametrar:**
- `trackIds: number[]` - Array of track IDs
- `writeToFiles: boolean = true` - Write metadata to files

**Returnerar:**
```typescript
{
  total: number
  enhanced: number       // Successfully enhanced
  failed: number        // Errors during processing
  noMatch: number       // No suitable MB match found
  alreadyHasMBID: number // Skipped (already has MBID)
}
```

**Progress Events:**
Frontend kan lyssna på progress events:
```typescript
window.electron.ipcRenderer.on('musicbrainz:enhanceProgress', (data) => {
  console.log(`${data.current}/${data.total}: ${data.trackName}`)
})
```

**Event data:**
```typescript
{
  current: number
  total: number
  trackId: number
  trackName: string  // "Artist - Title"
}
```

**Features:**
- Skippar tracks som redan har MBIDs
- Progress callbacks för UI-feedback
- Resilient error handling (fortsätter vid fel)
- Rate limiting (50ms delay mellan tracks)
- Hämtar både MusicBrainz och AcousticBrainz data

**Användning:**
```typescript
window.electron.ipcRenderer.on('musicbrainz:enhanceProgress', (data) => {
  setProgress((data.current / data.total) * 100)
  setCurrentTrack(data.trackName)
})

const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:enhanceTracks',
  [1, 2, 3, 4, 5],
  true
)

console.log(`✅ ${result.enhanced} enhanced, ❌ ${result.failed} failed`)
```

---

#### `musicbrainz:enhanceLibrary`
**Parametrar:**
- `writeToFiles: boolean = true`

**Returnerar:** Same as `enhanceTracks`

**Process:**
1. Hämtar alla tracks utan MBIDs från database
2. Anropar `enhanceTracks` för dessa tracks
3. Progress events skickas under processen

**Användning:**
```typescript
// Enhance all tracks without MBIDs
const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:enhanceLibrary',
  true
)

console.log(`Enhanced ${result.enhanced}/${result.total} tracks`)
```

---

### 5. File Synchronization

#### `musicbrainz:syncToFiles`
**Parametrar:**
- `trackIds?: number[]` - Specific tracks to sync (optional)

Om `trackIds` utelämnas, synkas ALL tracks med MBIDs i databasen.

**Returnerar:**
```typescript
{
  success: number   // Files successfully written
  failed: number    // Write errors
  skipped: number   // No MBID or unsupported format
}
```

**Progress Events:**
```typescript
window.electron.ipcRenderer.on('musicbrainz:syncProgress', (data) => {
  console.log(`${data.current}/${data.total}: ${data.trackPath}`)
})
```

**Event data:**
```typescript
{
  current: number
  total: number
  trackPath: string
}
```

**Användning:**
```typescript
// Sync specific tracks
window.electron.ipcRenderer.on('musicbrainz:syncProgress', (data) => {
  setProgress((data.current / data.total) * 100)
})

const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:syncToFiles',
  [1, 2, 3]
)

// Sync ALL tracks with MBIDs
const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:syncToFiles'
)

console.log(`✅ ${result.success} files written`)
```

---

### 6. Metadata Refresh

#### `musicbrainz:refreshMetadata`
**Parametrar:**
- `trackIds: number[]` - Tracks to refresh

**Returnerar:**
```typescript
{
  total: number
  refreshed: number  // Successfully refreshed
  failed: number     // Errors
  noMBID: number     // Tracks without MBIDs
}
```

**Process:**
För tracks som redan har MBIDs:
1. Re-fetch recording details från MusicBrainz
2. Re-fetch AcousticBrainz data
3. Update database
4. Write to file

**Progress Events:**
```typescript
window.electron.ipcRenderer.on('musicbrainz:refreshProgress', (data) => {
  console.log(`${data.current}/${data.total}: ${data.trackName}`)
})
```

**Användningsfall:**
- MusicBrainz-data har uppdaterats
- Fel i tidigare enhance-process
- Vill hämta nya AcousticBrainz-analyser

**Användning:**
```typescript
window.electron.ipcRenderer.on('musicbrainz:refreshProgress', (data) => {
  setProgress((data.current / data.total) * 100)
})

const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:refreshMetadata',
  [10, 20, 30]
)

console.log(`Refreshed ${result.refreshed} tracks`)
```

---

## Rate Limiting

Alla handlers respekterar rate limits:
- **MusicBrainz API**: 1.1 sekund mellan requests (hanteras av service)
- **AcousticBrainz API**: 500ms mellan requests (hanteras av service)
- **Bulk operations**: Extra 50-100ms delay för säkerhet

---

## Error Handling

Alla handlers har robust error handling:
- Try-catch blocks kring varje operation
- Errors loggas men stoppar inte bulk operations
- Specifika error reasons returneras (`no_match`, etc.)
- Progress fortsätter även vid individuella fel

---

## Confidence Levels

Alla enhancement-funktioner använder confidence scoring:

| Confidence | Match Score | Användning |
|-----------|-------------|------------|
| **PERFECT** | 95-100% | Automatisk enhancement utan bekräftelse |
| **HIGH** | 80-94% | Automatisk enhancement, rekommenderat |
| **MEDIUM** | 60-79% | Manuell bekräftelse rekommenderas |
| **LOW** | 40-59% | Visas men påfört med varning |
| **MISMATCH** | 0-39% | Skippas automatiskt |

---

## Progress Event Summary

### `musicbrainz:enhanceProgress`
Skickas under bulk enhancement:
```typescript
{ current: number, total: number, trackId: number, trackName: string }
```

### `musicbrainz:syncProgress`
Skickas under file sync:
```typescript
{ current: number, total: number, trackPath: string }
```

### `musicbrainz:refreshProgress`
Skickas under metadata refresh:
```typescript
{ current: number, total: number, trackId: number, trackName: string }
```

---

## Example: Complete Enhancement Flow

```typescript
// 1. Check current coverage
const stats = await window.electron.ipcRenderer.invoke('musicbrainz:getCoverage')
console.log(`Current coverage: ${stats.coveragePercentage}%`)

// 2. Set up progress listener
window.electron.ipcRenderer.on('musicbrainz:enhanceProgress', (data) => {
  const percent = (data.current / data.total) * 100
  updateProgressBar(percent)
  updateStatusText(`Processing: ${data.trackName}`)
})

// 3. Enhance entire library
const result = await window.electron.ipcRenderer.invoke(
  'musicbrainz:enhanceLibrary',
  true  // Write to files
)

// 4. Show results
console.log(`
  ✅ Enhanced: ${result.enhanced}
  ⏭️ Already had MBID: ${result.alreadyHasMBID}
  ❌ No match: ${result.noMatch}
  ❌ Failed: ${result.failed}
`)

// 5. Check new coverage
const newStats = await window.electron.ipcRenderer.invoke('musicbrainz:getCoverage')
console.log(`New coverage: ${newStats.coveragePercentage}%`)
```

---

## Example: Sync Existing MBIDs to Files

```typescript
// Sync all tracks with MBIDs to files (without fetching new data)
window.electron.ipcRenderer.on('musicbrainz:syncProgress', (data) => {
  updateProgressBar((data.current / data.total) * 100)
  updateStatusText(data.trackPath)
})

const result = await window.electron.ipcRenderer.invoke('musicbrainz:syncToFiles')

console.log(`Written ${result.success} files`)
```

---

## Dependencies

### Backend Services
- `services/musicbrainz.ts` - MusicBrainz API client
- `services/acousticbrainz.ts` - AcousticBrainz API client
- `services/matcher.ts` - Fuzzy matching algorithms
- `services/metadataWriter.ts` - File metadata writer
- `database/musicbrainz.ts` - Database operations

### External APIs
- MusicBrainz API v1
- AcousticBrainz API

---

## Nästa Steg (Modul 3c)

Skapa UI-komponenter:
- "Enhance Library" button i Settings
- Progress modal för bulk operations
- Coverage statistics display
- Per-track enhance button i track context menu

---

## Status
✅ **COMPLETED** - MusicBrainz IPC Handlers implementerade och testade
