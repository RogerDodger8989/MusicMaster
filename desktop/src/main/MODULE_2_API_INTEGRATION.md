# Block 2: MusicBrainz API Integration & Metadata Matching

## Överview

**Block 2** implementerar fullständig MusicBrainz- och AcousticBrainz-integration. Detta är grunden för att automatiskt hämta, matcha och lagra all MusicBrainz-metadata för musikbibliotek.

## Modulstruktur

### ✅ Modul 2a: MusicBrainz API Client
**Fil**: [services/musicbrainz.ts](../services/musicbrainz.ts)

**Funktionalitet**:
- **Rate-limiting** (1,1 sekund mellan requests för att följa MB guidelines)
- **Caching** (1 timme TTL för att minska API-belastning)
- **Multi-strategy search**:
  - Specifik sökning: `artist:"X" AND recording:"Y" AND release:"Z"`
  - Flexibel sökning: utan album om ingen träff
  - Fuzzy sökning: utan citattecken för bättre matchning

**API-metoder**:
```typescript
// Sökningar
searchTrack(artist, title, album?)      // Söka efter track
searchAlbum(artist, album)               // Söka efter album
searchArtist(name)                       // Söka efter artist
searchByISRC(isrc)                       // Söka via ISRC code

// Detaljerade lookups
getRecordingDetails(recordingId)         // Full recording med artist-credit, releases
getArtistDetails(artistId)              // Artist info + relationer
getReleaseDetails(releaseId)            // Album + tracks + credits
getWorkDetails(workId)                  // Klassisk musik (compositions)
getLabelDetails(labelId)                // Skivbolag
```

**Caching**:
- Automatisk cache för alla queries
- 1 timme TTL för att balansera aktualitet vs. performance
- Manuell cache-rensning via `clearCache()`

---

### ✅ Modul 2b: AcousticBrainz API Client
**Fil**: [services/acousticbrainz.ts](../services/acousticbrainz.ts)

**Funktionalitet**:
- Hämtar audio-analysdata från AcousticBrainz
- Konverterar confidence scores till 0-1 skala
- Caching (24 timmar TTL)

**Metoder och Data**:

**Low-level Features** (teknisk analys):
- `bpm` - Beats per minute
- `key` - Musikalisk tonart (C, D, F#, etc.)
- `key_confidence` - Hur säker tonarts-analys är

**High-level Features** (mood & energi, 0-1 skala):
- `energy` - Energisk vs. lugn
- `danceability` - Hur dansbar låten är
- `acousticness` - Akustisk vs. elektronisk
- `instrumentalness` - Instrumental vs. vokal
- `valence` - Glad/positiv vs. ledsen/negativ
- `liveness` - Studioinspelning vs. liveuppträdande
- `speechiness` - Tal vs. sång

**Användningsfall**:
- Smart Shuffle som spelar låtar med liknande energi
- Mood-baserade spellistor
- Musikanalys för användarprofiler

---

### ✅ Modul 2c: Database Query Handlers
**Fil**: [database/musicbrainz.ts](../database/musicbrainz.ts)

**CRUD-operationer**:

**Track Updates**:
```typescript
updateTrackWithMBID(trackId, mbid, mbidAlbumId?, isrc?, ...)
getTrackByMBID(mbid)
```

**Artist Management**:
```typescript
upsertArtistWithMBID(name, mbid, country?, type?, lifeSpan?, bio?, ...)
getArtistByMBID(mbid)
getTrackArtists(trackId)  // Alla artister med roller
```

**Album Management**:
```typescript
upsertAlbumWithMBID(name, artistId, mbid, type?, releaseDate?, ...)
getAlbumByMBID(mbid)
```

**Artist-relations**:
```typescript
addTrackArtist(trackId, artistId, role, instrument?, creditedAs?, ...)
addAlbumArtist(albumId, artistId, role, ...)
```

**External Data**:
```typescript
addExternalLink(entityType, entityId, linkType, url)
addExternalIdentifier(entityType, entityId, identifierType, value)
```

**Audio Analysis**:
```typescript
storeAcousticBrainzData(trackId, analysisData)
getTrackAcousticBrainzData(trackId)
```

**Analytics**:
```typescript
getMBIDCoverageStats()        // MBID adoption % i library
getTracksWithoutMBID(limit)   // För batch-processing
searchTracksByISRC(isrc)
```

---

### ✅ Modul 2d: Metadata Matching (Fuzzy Matching)
**Fil**: [services/matcher.ts](../services/matcher.ts)

**Matchning-algoritmer**:

**1. Levenshtein Distance**
- Beräknar redigeringsavstånd mellan två strängar
- Använder för att matcha låtnamn trots stavfel

**2. String Similarity**
- Konverterar Levenshtein-avstånd till 0-1 likhetsscore
- 1.0 = exakt match, 0.0 = helt olika

**3. Weighted Matching**
- `calculateMatchScore()` med vikt för artist/titel/album
- Standard: Artist 40%, Titel 50%, Album 10%
- Returnerar score 0-100

**Match-klassificering**:
| Score | Nivå | Rekommendation |
|-------|------|---|
| 95-100 | PERFECT | Automatisk matchning |
| 80-94 | HIGH | Automatisk eller snabb review |
| 60-79 | MEDIUM | Manuell review rekommenderad |
| 40-59 | LOW | Kräver verifiering |
| <40 | MISMATCH | Troligen inte samma låt |

**Avancerade funktioner**:
```typescript
findBestMatch()         // Hittar bästa match i lista
findPotentialDuplicates()  // Detekterar dubbletter i lokalt bibliotek
isSameTrack()          // Ja/nej för två låtar
advancedMatch()        // ISRC → Fuzzy text → Resultat
```

**Normaliseringsregler**:
- Konverterar till lowercase
- Tar bort interpunktion
- Normaliserar whitespace
- Handling av multi-artist tracks (`;` separator)

---

## Dataflöde

### Scenario 1: Automatisk MBID-matching
```
1. Scanner läser lokal track
2. Matcher.advancedMatch():
   a) Försök ISRC-sökning (högst prioritet)
   b) Försök fuzzy text-sökning (artist + titel + album)
   c) FindBestMatch() med 60+ score threshold
3. MusicBrainzService.getRecordingDetails() för full data
4. AcousticBrainzService.getRecordingAnalysis() för audio-analys
5. MusicBrainzDB.updateTrackWithMBID() sparar resultat
6. MusicBrainzDB.storeAcousticBrainzData() sparar analys
```

### Scenario 2: Batch MBID-enhancement
```
1. getMBIDCoverageStats() → visa coverage %, t.ex. 30%
2. getTracksWithoutMBID(1000) → hämta nästa batch
3. För varje track:
   a) advancedMatch() med threshold MED
   b) Om confidence HIGH eller PERFECT → lagra MBID
   c) Om MEDIUM → flagga för manual review
   d) Om LOW/MISMATCH → skippa
4. Spara batch-resultat
5. Repeat tills alla tracks har MBID eller reviews
```

---

## Integration Points

### Med Scanner (scanner.ts)
- Efter att metadata extraherats från fil
- Använd matcher för att få MBID
- Lagra MBID tillsammans med andra metadata

### Med Player (player.ts)
- Använd AcousticBrainz-data för smart shuffle
- Filter låtar med liknande `energy` eller `valence`

### Med UI/Settings
- Visa MBID-coverage stats
- Button för "Enhance Library with MusicBrainz"
- Progress indicator för batch-processer

---

## Rate Limiting & Caching Strategy

### MusicBrainz
- **Rate limit**: 1.1 sekunder mellan requests
- **Cache**: 1 timme TTL
- **Justification**: MB har strikt rate-limit policy

### AcousticBrainz
- **Rate limit**: 500ms mellan requests
- **Cache**: 24 timmar TTL
- **Justification**: AB data ändras sällan, kan vara höga

### Performance Impact
- ~1000 tracks @ 1.1s/request = ~18 minuter för första run
- Med caching: Nästa run~sekunder för redan-matchade tracks
- Rekommendation: Batch-process under användares lunch/break

---

## Error Handling

**Graceful degradation**:
- Om MB API är nere → Använd lokal data
- Om match misslyckas → Behåll original metadata
- Om ISRC-sökning misslyckas → Försök fuzzy matching

**Logging**:
- ✅ Lyckad match: `✅ Track X matched to MB ID: Y (score: 85)`
- ⚠️ Varning: `⚠️ MB: No results with album. Retrying without album...`
- ❌ Fel: `❌ MB API error: 503` med fallback-action

---

## Type Definitions

Alla typer är definierade i [types.musicbrainz.ts](../database/types.musicbrainz.ts):
- `MBRecordingResponse` - MusicBrainz Recording API response
- `MBReleaseResponse` - MusicBrainz Release API response
- `MBRecordingFull` - Full recording med artist-credit och releases
- `AcousticBrainzResponse` - AB API response
- `DbAcousticBrainzData` - DB schema för audio analysis

---

## Next Steps (Block 3)

**Block 3: Metadata Writer & UI**
1. Write MBID + extended tags back to FLAC/MP3
2. UI component: "Enhance Library" button
3. Progress display: X of Y tracks enhanced
4. Manual review interface för MEDIUM confidence matches
5. Integration med Scanner för automatic enhancement

---

## File Structure Summary

```
desktop/src/main/
├── services/
│   ├── musicbrainz.ts          ✅ Modul 2a - MB API Client (684 lines)
│   ├── acousticbrainz.ts       ✅ Modul 2b - AB API Client (460 lines)
│   └── matcher.ts              ✅ Modul 2d - Fuzzy Matching (455 lines)
│
├── database/
│   ├── schema.musicbrainz.sql   ✅ Modul 1 - DB Schema
│   ├── types.musicbrainz.ts     ✅ Modul 1 - Type Definitions
│   ├── musicbrainz.ts           ✅ Modul 2c - DB Handlers (475 lines)
│   └── index.ts                 ✅ Updated - MB Schema Integration
│
└── utils/
    └── MODULE_2_API_INTEGRATION.md   📄 This file
```

---

## Testing Checklist

- [ ] MB API rate limiting works (check logs for 1.1s delays)
- [ ] Cache works (check logs for "📦 MB Cache hit")
- [ ] ISRC search finds correct track
- [ ] Fuzzy matching works for slightly different titles
- [ ] advancedMatch() returns correct confidence levels
- [ ] Database stores MBID correctly
- [ ] AcousticBrainz data stored and retrieved
- [ ] Batch processing handles 1000+ tracks
- [ ] Coverage stats accurate
- [ ] Error handling graceful (no crashes on API errors)

---

## Performance Metrics

**Single track matching**:
- ISRC search: ~1.5s (1.1s rate limit + API)
- Fuzzy matching: ~2.5s (1.1s + 1.1s fallback + API)
- Audio analysis: ~1s (500ms rate limit + API)
- **Total per track**: ~1.5-2.5s

**Batch (1000 tracks)**:
- With cache: ~0.5-1 minute (cache hits)
- Without cache: ~30-45 minutes (all API calls)
- Network dependent; optimize during off-peak hours

---

## Dokumentation Ready ✅

Block 2 är nu komplett och dokumenterat. Vi är redo för **Block 3: Metadata Writer & UI Integration**.
