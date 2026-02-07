# Modul 3c & 3d - UI: Enhance Library & Progress Display

## Översikt
Frontend UI-komponenter för MusicBrainz library enhancement med fullständig progress tracking och statistics display.

## Implementerade Komponenter

### 1. MusicBrainzProgressModal
**Fil:** `components/modals/MusicBrainzProgressModal.tsx`

Modal-komponent för att visa progress och resultat från MusicBrainz-operationer.

#### Props
```typescript
interface MusicBrainzProgressModalProps {
    isOpen: boolean
    onClose: () => void
    progress: {
        current: number
        total: number
        trackName?: string
        trackPath?: string
    }
    results?: {
        total: number
        enhanced?: number
        success?: number
        failed: number
        noMatch?: number
        alreadyHasMBID?: number
        skipped?: number
    }
    isComplete: boolean
    operation: 'enhance' | 'sync' | 'refresh'
}
```

#### Features
- **Real-time Progress Bar**: Visuell progress med percentage
- **Current Track Display**: Visar vilket track som processas just nu
- **Operation-specific Titles**: Olika titlar för enhance/sync/refresh
- **Results Summary**: Detaljerad sammanfattning när operation är klar
- **Color-coded Stats**: Grön för success, gul för warnings, röd för failures
- **Animated Icons**: Pulsande icon under processing, check när klar
- **Backdrop Blur**: Modern glassmorphism-effekt

#### UI Layout
**Header:**
- Operation icon (pulserar under processing)
- Dynamic operation title
- Close button (endast när complete)

**Progress Section (när pågående):**
- Progress bar (gradient blue-to-purple)
- Current/Total counter med percentage
- Currently processing track name
- Informational alert om processing time

**Results Section (när färdig):**
- Success summary med check icon
- Detailed metrics grid:
  - Enhanced/Written/Refreshed count (grön)
  - Already tagged count (blå)
  - No match found count (gul)
  - Skipped count (gul)
  - Failed count (röd)
- Warning alert om failures finns
- Close button

---

### 2. SettingsView - MusicBrainz Section
**Fil:** `views/SettingsView.tsx`

Uppdaterad SettingsView med fullständig MusicBrainz integration section.

#### State Management
```typescript
// MusicBrainz Coverage Statistics
const [mbCoverage, setMbCoverage] = useState<{
    totalTracks: number
    tracksWithMBID: number
    coveragePercentage: number
} | null>(null)

// Enhancement Progress State
const [mbEnhanceProgress, setMbEnhanceProgress] = useState<{
    isOpen: boolean
    current: number
    total: number
    trackName?: string
    isComplete: boolean
    results?: any
    operation: 'enhance' | 'sync' | 'refresh'
}>({...})

// Write-to-files option
const [mbWriteToFiles, setMbWriteToFiles] = useState(true)
```

#### Event Listeners
**Enhancement Progress:**
```typescript
useEffect(() => {
    const unsubscribe = window.api.musicbrainz.onEnhanceProgress((progress) => {
        setMbEnhanceProgress(prev => ({
            ...prev,
            current: progress.current,
            total: progress.total,
            trackName: progress.trackName
        }))
    })
    return () => { unsubscribe() }
}, [])
```

**Sync Progress:**
```typescript
useEffect(() => {
    const unsubscribe = window.api.musicbrainz.onSyncProgress((progress) => {
        setMbEnhanceProgress(prev => ({
            ...prev,
            current: progress.current,
            total: progress.total,
            trackName: progress.trackPath
        }))
    })
    return () => { unsubscribe() }
}, [])
```

#### Handler Functions

**handleEnhanceLibrary():**
- Visar confirmation dialog
- Öppnar progress modal
- Anropar `window.api.musicbrainz.enhanceLibrary(mbWriteToFiles)`
- Visar resultat i modal
- Uppdaterar coverage stats
- Reloads library för att visa nya data

**handleSyncToFiles():**
- Validerar att tracks med MBIDs finns
- Visar confirmation med antal tracks
- Anropar `window.api.musicbrainz.syncToFiles()`
- Visar resultat i modal

**loadMbCoverage():**
- Hämtar coverage stats från backend
- Uppdaterar `mbCoverage` state
- Kan anropas manuellt med refresh-knapp

---

### 3. UI Section: MusicBrainz Integration

#### Coverage Statistics Display
```tsx
<div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
    <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">Library Coverage</span>
        <span className="text-2xl font-bold text-blue-400">
            {mbCoverage.coveragePercentage.toFixed(1)}%
        </span>
    </div>
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div
            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
            style={{ width: `${mbCoverage.coveragePercentage}%` }}
        />
    </div>
    <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{mbCoverage.tracksWithMBID} / {mbCoverage.totalTracks} tracks have MBIDs</span>
        <button onClick={loadMbCoverage}>
            <RefreshCw className="w-3 h-3" />
        </button>
    </div>
</div>
```

**Features:**
- Large percentage display (2xl font, blue color)
- Gradient progress bar (animerad övergång)
- Track count summary
- Refresh button för att uppdatera stats

#### Enhancement Options

**Write to Files Toggle:**
```tsx
<div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
    <div>
        <p className="text-sm font-medium text-white">Write MBIDs to Files</p>
        <p className="text-xs text-zinc-500 mt-1">
            Save MusicBrainz metadata directly to audio files (FLAC/MP3)
        </p>
    </div>
    <button
        onClick={() => setMbWriteToFiles(!mbWriteToFiles)}
        className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            mbWriteToFiles ? 'bg-blue-600' : 'bg-zinc-700'
        )}
    >
        <div className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
            mbWriteToFiles && 'translate-x-6'
        )} />
    </button>
</div>
```

**Features:**
- Toggle switch design
- Blue when enabled, gray when disabled
- Smooth slide animation
- Descriptive text explaining function

**Enhance Library Button:**
```tsx
<button
    onClick={handleEnhanceLibrary}
    disabled={mbEnhanceProgress.isOpen && !mbEnhanceProgress.isComplete}
    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
    <Database className="w-5 h-5" />
    Enhance Library with MusicBrainz
</button>
```

**Features:**
- Gradient background (blue-to-purple)
- Database icon
- Full-width button
- Disabled state during operations
- Hover effects

**Sync to Files Button:**
```tsx
{mbCoverage && mbCoverage.tracksWithMBID > 0 && (
    <button
        onClick={handleSyncToFiles}
        disabled={mbEnhanceProgress.isOpen && !mbEnhanceProgress.isComplete}
        className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <RefreshCw className="w-5 h-5" />
        Sync MBIDs to Files ({mbCoverage.tracksWithMBID} tracks)
    </button>
)}
```

**Features:**
- Endast synlig om tracks med MBIDs finns
- Visar antal tracks i button text
- RefreshCw icon
- Subtlare färg (zinc-800)

#### Info Box
```tsx
<div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg">
    <p className="text-xs text-blue-300">
        <strong>MusicBrainz Enhancement</strong> searches for high-quality metadata including:
        recording MBIDs, ISRCs, album types, genres, audio analysis (BPM, key, mood), and more.
        This data is saved to your database and optionally written to audio file tags.
    </p>
</div>
```

**Features:**
- Blue-tinted background
- Educational text om vad MusicBrainz enhancement gör
- Liten text men läsbar

---

## Preload API Updates

### Type Definitions (index.d.ts)
Lagt till fullständig `musicbrainz` API-definition med alla handlers:
- `getCoverage()`
- `searchTrack()`
- `getRecordingDetails()`
- `getAcousticBrainz()`
- `enhanceTrack()`
- `enhanceTracks()`
- `enhanceLibrary()`
- `syncToFiles()`
- `refreshMetadata()`
- Progress event listeners

### Implementation (index.ts)
Exponerar alla MusicBrainz IPC handlers till renderer:
```typescript
musicbrainz: {
    getCoverage: () => ipcRenderer.invoke('musicbrainz:getCoverage'),
    enhanceLibrary: (writeToFiles = true) => ipcRenderer.invoke('musicbrainz:enhanceLibrary', writeToFiles),
    syncToFiles: (trackIds?: number[]) => ipcRenderer.invoke('musicbrainz:syncToFiles', trackIds),
    onEnhanceProgress: (callback) => {
        const listener = (_: any, progress: any): void => callback(progress)
        ipcRenderer.on('musicbrainz:enhanceProgress', listener)
        return () => ipcRenderer.removeListener('musicbrainz:enhanceProgress', listener)
    },
    // ... etc
}
```

---

## User Flow

### Första gången användaren öppnar Settings
1. SettingsView laddas och visar MusicBrainz section
2. `loadMbCoverage()` anropas automatiskt
3. Coverage stats visas (troligen 0% första gången)
4. "Write MBIDs to Files" toggle är ON som default

### Användaren klickar "Enhance Library"
1. Confirmation dialog visas
2. Progress modal öppnas
3. `enhanceLibrary()` IPC call startar
4. Backend börjar söka MusicBrainz för alla tracks utan MBIDs
5. Progress events skickas kontinuerligt till frontend
6. Modal uppdateras med current track och progress bar
7. När klar: Results summary visas i modal
8. Coverage stats uppdateras automatiskt
9. Library reloads för att visa nya data

### Användaren vill synca befintliga MBIDs till filer
1. "Sync MBIDs to Files" button visas (om tracks med MBIDs finns)
2. Button text visar antal tracks
3. Confirmation dialog
4. Progress modal öppnas med 'sync' operation
5. Metadata skrivs till audio filer
6. Results visas i modal

---

## Design Principles

### Colors
- **Primary**: Blue (#2563eb) → Purple gradient
- **Success**: Green (#22c55e)
- **Info**: Blue (#3b82f6)
- **Warning**: Yellow (#eab308)
- **Error**: Red (#ef4444)
- **Background**: Zinc shades (#09090b, #18181b, #27272a)

### Spacing
- Consistent padding: p-3, p-4, p-6
- Gap between elements: gap-2, gap-3, gap-4
- Margin bottom: mb-3, mb-4, mb-6

### Typography
- Headers: text-lg, text-xl, font-semibold/bold
- Body: text-sm, text-zinc-400/300
- Stats: text-2xl, font-bold for large numbers
- Info: text-xs for helper text

### Animations
- Progress bar: transition-all duration-300/500
- Toggle switch: transition-transform
- Icons: animate-pulse during operations
- Hover: transition-colors

---

## Accessibility
- Disabled states clearly indicated (opacity-50, cursor-not-allowed)
- Descriptive button text och helper text
- Icons kombinerat med text för clarity
- Color-coded results med text labels (inte bara färger)
- Confirmation dialogs innan destructive operations

---

## Error Handling
- Try-catch blocks kring alla async operations
- Alert dialogs visar error messages
- Modal stängs automatiskt vid fel
- Errors loggas till console för debugging
- Failed count visas tydligt i results

---

## Performance
- Progress updates batched (inte varje enskild file)
- Modal rendering conditional (endast när isOpen)
- Coverage stats cached i state
- IPC event listeners cleanup i useEffect return

---

## Next Steps / Future Enhancements
- [ ] Per-track "Enhance with MusicBrainz" i context menu
- [ ] Manual match selection för low-confidence matches
- [ ] Batch selection för multi-track enhancement
- [ ] Export MusicBrainz data to CSV
- [ ] View detailed MBID info för enskilda tracks
- [ ] Re-match funktionalitet för dåliga matches

---

## Status
✅ **COMPLETED** - MusicBrainz UI fully implemented with:
- Coverage statistics display med gradient progress bar
- Enhance Library button med write-to-files toggle
- Sync to Files button för befintliga MBIDs
- Progress modal med real-time updates
- Results summary med detaljerad metrics
- Event listeners för progress tracking
- Full preload API integration
- Error handling och user confirmations
