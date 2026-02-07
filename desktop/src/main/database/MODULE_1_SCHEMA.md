# Modul 1: MusicBrainz Database Schema

## Översikt

**Modul 1** sätter upp den kompletta databas-strukturen för MusicBrainz-taggning i MusicMaster. Detta är grunden för all kommande MusicBrainz-funktionalitet, inte bara för att lagra data utan för att kunna hantera komplexa musikaliska relationer.

## Arkitektur

### Kärnprinciper

1. **Normalisering**: En artist, album eller track kan ha många relationer och attribut
2. **Flexibilitet**: Stöd för klassisk musik (movements, works), compilations (various artists), producer credits
3. **Identifiering**: MusicBrainz IDs (MBID) som primär identifierare, med fallback till titel+artist
4. **Externa kopplingar**: Links till Discogs, Last.fm, Wikipedia, Wikidata, IMDB, etc.

## Tabelstrukturer

### 1. Core Entities (Huvudtabeller)

#### `artists`
Lagrar artistinformation med MusicBrainz-data:
- **Primär nyckel**: `id` (användargenerad UUID)
- **Unikt**: `mbid` (MusicBrainz Artist ID)
- **Attribut**:
  - `name` - Artistnamn (t.ex., "The Beatles")
  - `name_sort_order` - Sortordning (t.ex., "Beatles, The")
  - `artist_type` - Person, Group, Orchestra, Choir, etc.
  - `country` - ISO 3166-1 alpha-2 code
  - `life_span_begin/end` - Födelseår och dödsår
  - `gender` - Artistens kön
  - `bio`, `image_path`, `website` - Biografisk data

**Användningsfall**: Hantera att samma artistnamn kan existera i olika länder; lagra artist-typ för rätt formatering i UI.

#### `albums`
Lagrar albummetadata med full MusicBrainz-stöd:
- **Primär nyckel**: `id` (UUID)
- **Unikt**: `mbid` (MusicBrainz Release Group ID)
- **Attribut**:
  - `album_type` - Album, EP, Single, Compilation, Soundtrack, Live Album, etc.
  - `status` - Official, Promotion, Bootleg, Pseudorelease
  - `year` - Original release year
  - `release_date` - Full release date (YYYY-MM-DD)
  - `original_release_date` - Om remastered
  - `release_country` - Releases varies by country
  - `barcode` - EAN/UPC code
  - `packaging` - Jewel Case, Digipak, etc.
  - `disc_count` - För multi-disc albums
  - `label_ids` - Relaterade via `album_labels` junction table

**Användningsfall**: Skillnad mellan original och remaster; hantera regional varianter av samma album.

#### `tracks`
Utökad tracks-tabell med MusicBrainz-identifierare:
- **Primär nyckel**: `id` (UUID, hämtat från fil)
- **Unikt**: `file_path` (lokal fil)
- **MusicBrainz IDs**:
  - `mbid` - MusicBrainz Recording ID
  - `mbid_track_id` - MusicBrainz Track ID (kan skilja från Recording)
  - `mbid_album_id` - MusicBrainz Release ID
  - `mbid_work_id` - För klassisk musik (compositions)
- **Fingerprinting**:
  - `acoustid_fingerprint` - AcousticID fingerprint
  - `isrc` - International Standard Recording Code
- **Musikmetadata**:
  - `movement_num`, `movement_name` - För klassisk musik
  - `channels` - Mono (1), Stereo (2), etc.
  - `recording_date` - När låten spelades in

---

### 2. Artist Relationships (Artist-relationer)

Dessa tabeller håller relationer mellan artister och tracks/albums, för att hantera:
- Multiple artist per track (featuring, guest, remix)
- Extended credits (producer, conductor, arrangers)
- Role-based attribution

#### `track_artists`
Länkar tracks till flera artister med roller:
- **Columns**:
  - `track_id` - FK till `tracks`
  - `artist_id` - FK till `artists`
  - `role` - Main, Featured, Guest, Remixer, Arranger, Producer, Conductor, Performer, Composer, Lyricist
  - `instrument` - Specifikt instrument (Vocals, Guitar, Piano, etc.)
  - `credited_as` - Krediterad namn (kan skilja från `artist.name`)
  - `sort_position` - Ordning i kreditleringen

**Exempel**: 
```
Track: "Song Name"
  ├─ track_artists[0]: role='Main', artist='Artist A', instrument='Vocals'
  ├─ track_artists[1]: role='Featured', artist='Artist B', instrument='Rapping'
  └─ track_artists[2]: role='Producer', artist='Producer X'
```

#### `album_artists`
Liknar `track_artists`, men för albums:
- Hantera compilations (Various Artists)
- Features på album-nivå

#### `performers`
Detaljerad performer-information för tracks:
- Musikerinfo, instrumenter, krediteringar

#### `album_credits`
Albuminformation för production teams:
- Producenter, editörer, ingenjörer, dirigenter, orkestratörer, etc.

---

### 3. Release & Packaging Information

#### `release_info`
Olika pressningar av samma album:
- **Columns**:
  - `album_id` - FK till `albums`
  - `mbid` - MusicBrainz Release ID (specifik pressing)
  - `title` - Ofta samma som album, men kan innehålla "Remastered", "Deluxe Edition"
  - `release_date` - Specifik pressing release date
  - `release_country` - Land där denna pressing släpptes
  - `packaging`, `barcode`, `asin`

**Användningsfall**: Hantera att "The Beatles' White Album (Remastered 2009)" är annorlunda från original 1968-utgåvan.

#### `labels`
Skivbolagsregistret:
- `name` - Label name
- `mbid` - MusicBrainz Label ID
- `country` - Label's home country

#### `album_labels`
Länka album till labels med katalognummer:
- `album_id` - FK
- `label_id` - FK
- `catalog_number` - Label's catalog no. (t.ex., "EMI 1234-56")

---

### 4. External Links & Identifiers

#### `external_links`
Länka till andra musikdatabaser:
- **entity_type** - artist, album, track, release, label
- **link_type** - wikipedia, wikidata, discogs, lastfm, imdb, bandcamp, soundcloud, youtube, official, etc.
- **url** - Actual URL to external resource

**Exempel**:
```json
{
  "entity_type": "artist",
  "entity_id": "artist-uuid",
  "link_type": "wikipedia",
  "url": "https://en.wikipedia.org/wiki/The_Beatles"
}
```

#### `external_identifiers`
Externa ID:n från andra tjänster:
- **identifier_type** - isrc, ean, upc, spotify, apple_music, deezer, tidal, youtube_music, acoustid, etc.
- **value** - The ID value

**Användningsfall**: Länka en track till dess Spotify ID för enkel sökning mellan tjänster.

---

### 5. Music Metadata & Classification

#### `genres`
Normaliserade genrer med hierarki:
- **Columns**:
  - `name` - Genre name
  - `parent_genre_id` - FK till förälder-genre (t.ex., "Death Metal" → "Metal")
  - `mbid` - MusicBrainz Genre ID

**Två-vägsstruktur**:
```
Rock
├─ Hard Rock
│  ├─ Heavy Metal
│  │  └─ Death Metal
```

#### `genre_tags`
Länka genres till entities:
- **Columns**:
  - `entity_type` - artist, album, track
  - `entity_id` - FK
  - `genre_id` - FK
  - `confidence` - 0-1 confidence score (hur säker är denna genre-klassificering?)
  - `sort_position` - Primary genre: position 1, secondary: position 2

**Användningsfall**: "Metallica" kan vara "Heavy Metal" (1.0) och "Hard Rock" (0.7).

#### `works`
För klassisk musik:
- **Columns**:
  - `title` - Werk title (t.ex., "Symphony No. 5")
  - `artist_id` - Composer
  - `work_type` - Composition, Opera, Sonata, Symphony, Concerto, etc.
  - `mbid` - MusicBrainz Work ID

---

### 6. AcousticBrainz Audio Analysis

#### `acousticbrainz_data`
Lagra resultaten från AcousticBrainz API:
- **BPM & Timing**:
  - `bpm` - Beats per minute
  - `bpm_confidence` - 0-1 confidence
  - `tempo_confidence` - Tempo reliability

- **Tonal Features**:
  - `key` - Musical key (C, C#, D, etc.)
  - `key_confidence` - 0-1 confidence

- **Mood & Energy** (0-1 scale):
  - `energy` - Energetic vs. calm
  - `danceability` - How danceable the track is
  - `acousticness` - Acoustic vs. electric
  - `instrumentalness` - No vocals vs. instrumental
  - `liveness` - Studio vs. live recording
  - `speechiness` - Spoken words vs. singing
  - `valence` - Positive/happy vs. negative/sad mood

- **Loudness**:
  - `loudness_integrated` - Overall loudness (LUFS)
  - `loudness_short_term` - Short-term loudness

**Användningsfall**: "Smart Shuffle" som spelar låtar med liknande energi; mood-baserade spellistor.

---

### 7. Barcode & Disc Information

#### `barcodes`
Hantera barcodes för releases:
- `release_id` - FK to specific release pressing
- `barcode` - EAN/UPC code
- `barcode_type` - EAN, UPC, JAN

#### `discs`
Disc-information för multi-disc albums:
- `album_id` - FK
- `disc_num` - Disc number
- `title` - Disc-specific title (optional)
- `disc_id` - MusicBrainz Disc ID

---

### 8. Performance Tracking

#### `play_history` (Extended)
**Columns**:
- `track_id` - FK
- `played_at` - When played
- `play_count` - How many times played
- `fraction_played` - 0.5 if only 50% through (for scrobbling)

---

## Views for Common Queries

### `tracks_full`
Complete track information with artist and album data:
```sql
SELECT 
  t.title,
  t.album,
  GROUP_CONCAT(a.name, '; ') as artists,
  ab.name as album_name,
  a1.bpm,
  a1.key,
  a1.energy
FROM tracks t
LEFT JOIN track_artists ta ON t.id = ta.track_id
LEFT JOIN artists a ON ta.artist_id = a.id
...
```

### `albums_full`
Album info with artist and label data.

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| Separate `track_artists` | One track can have multiple artists (featuring, remix, etc.) |
| `mbid` as unique | MusicBrainz IDs are globally unique identifiers |
| `name_sort_order` | "The Beatles" sorts as "Beatles, The" but displays as "The Beatles" |
| `artist_type` field | Distinguish Person vs. Group for UI formatting |
| `confidence` in genres | Some genres are more reliable than others |
| `acousticbrainz_data` | Store audio analysis for mood/energy-based playlists |
| `faction_played` in play_history | Track scrobbling compliance (50% rule for Last.fm) |

---

## Migration Path

Existing databases will automatically:
1. Create all new MusicBrainz tables
2. Add missing MBID columns to existing `tracks`, `albums`, `artists`
3. Preserve existing data during schema expansion

---

## Next Steps (Module 2)

After database schema is confirmed, the next module will handle:
- **Data Ingestion**: Fetch MusicBrainz data for identified tracks
- **API Integration**: Query MusicBrainz, AcousticBrainz, and other services
- **Metadata Writer**: Write MBID and extended tags back to FLAC/MP3 files
- **UI Components**: Display extended metadata (performers, production credits, etc.)

---

## File Structure

```
desktop/src/main/database/
├── schema.musicbrainz.sql       # Full MusicBrainz schema definition (SQL file)
├── types.musicbrainz.ts         # TypeScript interfaces for all tables
├── index.ts                      # Database initialization & exported types
├── artists.ts                    # Artist query handlers (to be created)
├── albums.ts                     # Album query handlers (to be created)
├── tracks.ts                     # Track query handlers (to be created)
├── relationships.ts              # Artist/track relationship handlers (new)
└── acousticbrainz.ts            # AcousticBrainz data handlers (new)
```

---

## SQL Schema Statistics

- **New Tables**: 15 (artists, albums, track_artists, album_artists, performers, album_credits, release_info, labels, album_labels, external_links, external_identifiers, genres, genre_tags, works, acousticbrainz_data, barcodes, discs)
- **Index Counts**: 25+ indexes for performance
- **Total Columns**: 150+ (across all tables)
- **Foreign Keys**: Comprehensive referential integrity
- **Constraints**: Unique keys for all critical fields (MBID, name combinations)

---

## Questions & Validation Checklist

- [x] Can store multiple artists per track with roles?
- [x] Can handle different album versions (remaster, regional)?
- [x] Can link to external services (Discogs, Last.fm, etc.)?
- [x] Can store mood data from AcousticBrainz?
- [x] Can handle both classical (works, movements) and modern music?
- [x] Can track performer credits (producer, conductor, orchestrator)?
- [ ] Performance tested with 100k+ tracks?
- [ ] Migration tested on existing databases?
- [ ] Ready for next module (API integration)?
