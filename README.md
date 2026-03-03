# 🎵 MusicMaster

> En premiummusikspelare för skrivbordet byggd med Electron, React och TypeScript. Designad för musikälskare som vill ha full kontroll över sitt musikbibliotek – med automatisk taggning, audiofingertrycksanalys, djupgående metadata och stöd för alla moderna tjänster.

---

## 📑 Innehållsförteckning

1. [Arkitektur](#-arkitektur)
2. [Funktioner i detalj](#-funktioner-i-detalj)
   - [Musikbibliotek & filskanning](#musikbibliotek--filskanning)
   - [Uppspelning](#uppspelning)
   - [Tag Editor – redigera metadata](#tag-editor--redigera-metadata)
   - [Auto-Tag – hämta metadata från MusicBrainz](#auto-tag--hämta-metadata-från-musicbrainz)
   - [Stödda metadata-fält](#stödda-metadata-fält)
   - [Playlister](#playlister)
   - [Smarta Playlister](#smarta-playlister)
   - [Stämningar / Vibes](#stämningar--vibes)
   - [Scrobbling](#scrobbling)
   - [Artistberikning](#artistberikning)
   - [Audiofingertrycksanalys (AcousticID)](#audiofingertrycksanalys-acoustid)
   - [Ljudanalys (AcousticBrainz)](#ljudanalys-acousticbrainz)
   - [ReplayGain](#replaygain)
   - [Vågformsvisualiserare](#vågformsvisualiserare)
   - [Omslag / Cover Art](#omslag--cover-art)
   - [Sök](#sök)
   - [Dashboard](#dashboard)
   - [Spelkö (Queue)](#spelkö-queue)
   - [Miniplayer – Kompakt vy](#miniplayer--kompakt-vy)
   - [AI DJ & Radio](#ai-dj--radio)
   - [Theater Mode](#theater-mode)
   - [Casting – Chromecast & Sonos](#casting--chromecast--sonos)
   - [Taskbar Media Controls](#taskbar-media-controls)
   - [Inställningar](#inställningar)
3. [Kom igång](#-kom-igång)
4. [Projektstruktur](#-projektstruktur)
5. [Miljövariabler](#-miljövariabler)
6. [Databas-schema](#-databas-schema)
7. [REST API-översikt](#-rest-api-översikt)
8. [Licens](#-licens)

---

## 🏗 Arkitektur

MusicMaster är uppdelad i två separata appar som kommunicerar via REST:

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  KLIENT (Electron/React)    │◄──────►│  SERVER (Node.js/Express)    │
│  • Gränssnitt               │  HTTP  │  • Databas (SQLite)          │
│  • Uppspelning (Web Audio)  │        │  • Filskanning               │
│  • Tag Editor               │        │  • MusicBrainz integration   │
│  • Visualiseringar          │        │  • Last.fm / ListenBrainz    │
└─────────────────────────────┘        │  • Metadata-skrivning        │
                                       │  • Bakgrundsberikning        │
                                       └───────────────────────┬──────┘
                                                               │
                                                               │
                                                               ▼
                                                      ┌───────────────────┐
                                                      │  AI DJ / Radio    │
                                                      │  • Rekommendationer│
                                                      │  • Dynamiska köer │
                                                      └───────────────────┘
```

- **Server**: Headless Node.js/Express-app. Hanterar all databas, skanning, metadata och tjänsteintegrationer. Körs på `http://localhost:3000`.
- **Klient**: Electron + React + Vite-app. Hanterar UI och ljud via Web Audio API.

---

## 🎛 Funktioner i detalj

### Musikbibliotek & filskanning

- **Lägg till mappar** – Välj en eller flera mappar och MusicMaster skannar rekursivt alla musikfiler
- **Stödda format**: FLAC, MP3, M4A (AAC), WAV, OGG
- **Snabb skanning** – Icke-blockerande parallel skanning med realtidsframsteg
- **Automatisk dupedetektering** – Via filhash (MD5) för att undvika dubbletter
- **Levande bibliotek** – Bibliotekets ändringar synkroniseras i realtid
- **Vyer**: Grid-vy och listvy, sortering efter titel/artist/album/år/betyg/spelantal/längd
- **Sidnavigering**: Spår, Album, Genrer, Albumartister, Artister, Favoriter

---

### Uppspelning

- **Gapless playback** – Sömlösa övergångar via dubbel förhandsladning (lookahead)
- **ReplayGain** – Track- och albumnormering utan volymändringar i filen
- **Uppspelningslägen**:
  - Shuffle (slumpmässig ordning)
  - Repeat One (repetera ett spår)
  - Repeat All (repetera hela kön)
- **Spelkö** – Bygg en anpassad kö, dra-och-släpp för omordning
- **Snabbtangenter** – Spela/pausa, nästa, föregående via knappar eller tangentbord
- **Crossfade** – Konfigurerbart överlappande fade mellan spår
- **Volymkontroll** – Inkl. mjuk dämpa-funktion
- **Progressbar med klicksspola** – Klicka var som helst för att hoppa
- **Waveform-visualiserare** – Röd staplar som visar RMS-ljudform i realtid under uppspelning
- **Taskbar Media Controls** – Fullt stöd för Windows Taskbar (Thumbar Buttons) och OS-media-overlay (Media Session API). Styr musiken via tangentbordets mediaknappar eller direkt från aktivitetsfältet.

---

---

### AI DJ & Radio

MusicMaster inkluderar en avancerad AI-driven lyssningsupplevelse:

- **AI DJ** – En personlig musikvärd som curerar ditt bibliotek i realtid:
  - **Tematiska block** – Musiken grupperas i teman som "Favoriter", "Nyligen tillagt", "Discovery", "Vibes" och "Artistfokus".
  - **Röstintroduktioner** – DJ:n presenterar varje nytt block med en svensk röst via Web Speech API.
  - **Smart köhantering** – DJ:n fyller på kön automatiskt när den börjar ta slut utan att avbryta pågående låt.
  - **Premium UI** – Ett dedikerat DJ-kort på Dashboarden med LIVE-indikator och animationer.
- **Artist Radio** – Starta en omedelbar radiostation baserad på valfri artist:
  - **Seed-logik** – Väljer ut de bästa låtarna som startpunkt och låter AutoDJ fylla på med liknande musik.
  - **Snabbåtkomst** – "RADIO"-knapp finns tillgänglig direkt i Artist- och Albumvyer samt i kontextmenyer.
- **AutoDJ** – Förbättrad algoritmen för liknande musik som tar hänsyn till genre, artist och stämning för en mer sammanhängande upplevelse.

---

### Theater Mode

Ett minimalistiskt och elegant läge fokuserat på det visuella, tillgängligt via Tv-ikonen uppe i titellisten:

- **Dynamisk Ambient Bakgrund**: Bakgrunden plockar upp färgerna från albumomslaget och skapar en mjuk "glow".
- **Visualizers**: Se musiken formas live!
  - `Spectrum`: Klassiska frekvensstaplar.
  - `Waveform`: En glödande reaktiv vågform.
  - `Particles`: Bas-känsliga partiklar som rör sig pulserande.
- **Relaterad Musik**: Upptäck liknande låtar dynamiskt medan du lyssnar. Dubbelklicka för att lägga dem näst i kön ("Play Next").

---

### Casting – Chromecast & Sonos

Ta med din musik till hemmets alla högtalare direkt från MusicMaster:

- **Unified Discovery**: Appen skannar ditt nätverk automatiskt efter både **Chromecast**-enheter och **Sonos**-högtalare och visar dem i en gemensam lista.
- **Sömlös Handoff**: Vid anslutning pausas musiken lokalt och fortsätter exakt där den var på din externa enhet.
- **Fjärrstyrning**: Styr volym, sökning (seek) och låtbyten direkt från MusicMasters gränssnitt.
- **Realtidssynk**: Seekbaren i appen rör sig i takt med musiken på högtalaren tack vare aktiv positions-polling.

---

### Tag Editor – redigera metadata

Öppna taggeditorn för valfritt spår eller albummarkering. Alla ändringar skrivs direkt till filen (FLAC Vorbis Comments / ID3v2 för MP3).

**Flikar i Tag Editor:**
- **Tags** – Alla grundläggande och utökade textfält
- **Extended** – Katalognummer, ISRC, Media, Streckkod, Skript, Språk, Utgivningsinfo
- **Artwork** – Visa, byt ut eller ladda ned omslagsbilder
- **File Info** – Teknisk filinformation (codec, bitrate, storlek, filsökväg, tidslängd m.m.)

**Masskedigering** – Välj flera spår → högerklicka → "Redigera taggar" för att ändra samma fält på alla spår samtidigt. En kryssruta per fält avgör vilka fält som skrivs.

**Ångra** – En ångra-knapp återställer alla fält till senast sparade värdena.

**Kopiera/Klistra** – Kopieringsikoner vid varje fält för att kopiera wartje värde.

---

### Auto-Tag – hämta metadata från MusicBrainz

Klicka på **Auto-Tag** knappen i Tag Editorn för att automatiskt söka och hämta metadata:

**Vad som hämtas:**

| Kategori | Fält |
|---|---|
| Grundläggande | Titel, Artist, Album, Albumartist, År, Spårnummer, Totalt antal spår, Skivnummer |
| Upphovspersoner | **Kompositör** (via Work-relations), **Textförfattare** (Lyricist), **Arrangör** (Arranger), **Dirigent** (Conductor) |
| Utgivning | **Skivbolag/Publisher**, **Katalognummer**, **Streckkod**, **Media**, **Skript**, **Språk**, **Utgivningsland**, **Utgivningsstatus**, **Utgivningstyp** |
| Identifierare | **ISRC**, MusicBrainz Track-ID, Album-ID, Artist-ID, Release Group-ID, Recording-ID |
| Omslagsbild | Hämtar automatiskt omslagsbilder från CoverArtArchive |

**Hur det fungerar:**
1. MusicBrainz-sökning efter spåret
2. Inspelnings-lookup med `work-rels`, `artist-rels` och `isrcs` [separate requests]
3. Verks-lookup med `artist-rels` för kompositör, textförfattare, arrangör
4. Resultaten visas i en sökdialog – välj rätt match
5. Alla fält fylls i formuläret – granska och klicka **Save Changes**
6. Data skrivs till FLAC/MP3-filen

> **OBS:** MusicBrainz har inte alltid data för alla fält. Filmmusik kan sakna skivbolag, och populärmusik kan sakna dirigent. Det är inte en bugg utan en brist i källdatabasen.

**Separator:** Flera artister/kompositörer separeras med `;` (t.ex. `David Bowie;Brian Eno`)

**Album-Auto-Tag:** Tagga hela album på en gång via albumets kontextmeny.

---

### Stödda metadata-fält

Alla fält kan redigeras manuellt i Tag Editor och/eller hämtas via Auto-Tag:

| Kategori | Fält | FLAC-tagg | MP3-tagg |
|---|---|---|---|
| **Grundfält** | Titel | `TITLE` | `TIT2` |
| | Artist | `ARTIST` | `TPE1` |
| | Album | `ALBUM` | `TALB` |
| | Albumartist | `ALBUMARTIST` | `TPE2` |
| | Genre | `GENRE` | `TCON` |
| | År | `DATE` | `TDRC` |
| **Spårinfo** | Spårnummer | `TRACKNUMBER` | `TRCK` |
| | Totalt spår | `TRACKTOTAL` | `TRCK` |
| | Skivnummer | `DISCNUMBER` | `TPOS` |
| | Totalt skivor | `DISCTOTAL` | `TPOS` |
| **Upphovspersoner** | Kompositör | `COMPOSER` | `TCOM` |
| | Dirigent | `CONDUCTOR` | `TPE3` |
| | Textförfattare | `LYRICIST` | `TEXT` |
| | Arrangör | `ARRANGER` | `TIPL:arranger` |
| | Mixer | `MIXER` | — |
| **Utgivning** | Skivbolag/Publisher | `ORGANIZATION` | `TPUB` |
| | Katalognummer | `CATALOGNUMBER` | `TXXX:CATALOGNUMBER` |
| | ISRC | `ISRC` | `TSRC` |
| | Streckkod | `BARCODE` | `TXXX:BARCODE` |
| | Media | `MEDIA` | `TMED` |
| | Skript | `SCRIPT` | `TXXX:SCRIPT` |
| | Utgivningsland | `RELEASECOUNTRY` | `TXXX:MusicBrainz Album Release Country` |
| | Utgivningsstatus | `RELEASESTATUS` | `TXXX:MusicBrainz Album Status` |
| | Utgivningstyp | `RELEASETYPE` | `TXXX:MusicBrainz Album Type` |
| **Kategorisering** | Språk | `LANGUAGE` | `TLAN` |
| | Humör/Mood | `MOOD` | `TMOO` |
| | Tempo | `TEMPO` | `TXXX:TEMPO` |
| | Nyckelord | `KEYWORDS` | `TXXX:KEYWORDS` |
| | Tillfälle | `OCCASION` | `TXXX:OCCASION` |
| | Grupp/Grouping | `GROUPING` | `TIT1` |
| | Kommentar | `COMMENT` | `COMM` |
| | Sångtext | `LYRICS` | `USLT` |
| **Sortering** | Artist sorteringsordning | `ARTISTSORT` | `TSOP` |
| | Albumartist sorteringsordning | `ALBUMARTISTSORT` | `TSO2` |
| **Original** | Ursprunglig artist | `ORIGINALARTIST` | `TOPE` |
| | Ursprungligt album | `ORIGINALALBUM` | `TOAL` |
| | Ursprungligt år | `ORIGINALYEAR` | `TDOR` |
| **Analys** | BPM | `BPM` | `TBPM` |
| | Energi | — (DB) | — |
| | Dansbarhet | — (DB) | — |
| | Valens | — (DB) | — |
| | Instrumentalitet | — (DB) | — |
| **Betyg** | Betyg (1–5 stjärnor) | `RATING` | `POPM` |
| | Spelantal | `PLAY_COUNTER` | — |
| **MusicBrainz** | Track ID | `MUSICBRAINZ_TRACKID` | `TXXX:MusicBrainz Track Id` |
| | Recording ID | `MUSICBRAINZ_RECORDINGID` | `UFID` |
| | Album ID | `MUSICBRAINZ_ALBUMID` | `TXXX:MusicBrainz Album Id` |
| | Artist ID | `MUSICBRAINZ_ARTISTID` | `TXXX:MusicBrainz Artist Id` |
| | Release Group ID | `MUSICBRAINZ_RELEASEGROUPID` | `TXXX:MusicBrainz Release Group Id` |
| | Work ID | `MUSICBRAINZ_WORKID` | `TXXX:MusicBrainz Work Id` |
| **Anpassat** | Custom 1–20 | `CUSTOM1`–`CUSTOM20` | `TXXX:CUSTOM1`–`TXXX:CUSTOM20` |

---

### Playlister

- **Manuella playlister** – Skapa, byt namn, radera, omordna
- **Lägg till spår** – Via högerklick-meny på spår/album, eller dra-och-släpp
- **Ta bort från playlist** – Högerklicka på spår i spellistan
- **Uppspelning** – Spela hela listan eller från valfritt spår
- **Omslagsvisning** – Automatisk mosaikbild från de 4 första albumomslagen
- **Omordning** – Dra-och-släpp spår i önskad ordning

---

### Smarta Playlister

Bygg dynamiska playlister med filterregler som automatiskt uppdateras:

**Tillgängliga filter-fält:**
- Artist, Album, Genre, Titel, År, Betyg, Spelantal, Datum lagt till
- BPM, Energi, Dansbarhet, Valens, Humör
- Filformat, Bitrate, Samplingsfrekvens

**Operatorer:** Är, Är inte, Innehåller, Börjar med, Slutar med, Större/Mindre än, Mellan

**Logik:** AND (alla villkor) eller OR (något villkor)

**Sortering:** Välj sorteringsfält och ordning (stigande/fallande)

**Begränsning:** Välj max antal spår i resultatet

---

### Stämningar / Vibes

Baserat på AcousticBrainz-analys genereras automatiska stämningskategorier:

| Stämning | Beskrivning |
|---|---|
| Energetic | Hög energi och BPM |
| Chill | Lugn och avslappnad |
| Happy | Positiv valens |
| Melancholic | Låg energi, mörk valens |
| Party | Hög dansbarhet |
| Focus | Instrumentalt och jämnt |
| Acoustic | Akustisk karaktär |
| Dark | Aggressiv eller mörk stämning |

Klicka på en stämning för att spela upp en automatisk spellista med matchande spår.

**Egna Vibes:** Skapa anpassade stämningar med egna filterregler och namn.

---

### Scrobbling

Automatisk synkronisering av spelhistorik till externa tjänster:

- **Last.fm**
  - Scrobbling efter varje spår (>30 sek och >50% av låten)
  - Now Playing-uppdatering i realtid
  - Synkronisering av betyg (stjärnor → Last.fm-betyg)
  - OAuth-inloggning direkt från inställningar
- **ListenBrainz**
  - Scrobbling med usertoken
  - Now Playing-uppdatering
- **Offline-kö** – Om nätverk saknas sparas scrobbles och skickas senare

---

### Artistberikning

Bakgrundstjänst som automatiskt fyller på artistinformation:

- **Artistbiografi** – Hämtas från Last.fm och/eller Spotify
- **Artistbild** – Från Spotify API
- **Genre-taggar** – Från MusicBrainz och Last.fm
- **Land** – Från MusicBrainz
- **Startår / Slutår** – Från MusicBrainz
- **Bandmedlemmar** – Från MusicBrainz artist-relations
- **Liknande artister** – Beräknas utifrån delade genrer och lyssnardata

Berikning sker automatiskt i bakgrunden och respekterar API-hastighetsbegränsningar.

---

### Audiofingertrycksanalys (AcousticID)

MusicMaster kan identifiera spår via audiofingertryck:

1. Analyserar ljud-fingeravtryck med **Chromaprint**
2. Söker mot **AcousticBrainz** / **AcoustID**-databas
3. Returnerar möjliga MusicBrainz-matchningar
4. Parsar metadata från den bästa matchningen

Används när spår saknar artist/titel-information.

---

### Ljudanalys (AcousticBrainz)

Varje spår kan analyseras för musikegenskaper:

| Egenskap | Beskrivning |
|---|---|
| BPM | Slag per minut |
| Tonart (Key) | Grundtonart (C, D, E…) och läge (dur/moll) |
| Energi | 0–1, hur kraftfullt/intensivt spåret är |
| Dansbarhet | 0–1, hur dansvänligt spåret är |
| Instrumentalitet | 0–1, om spåret saknar sångstämma |
| Valens | 0–1, positiv (glad) vs negativ (sorgsen) känsla |
| Humörkategori | Acoustic, Aggressive, Electronic, Happy, Sad, Relaxed, Party |
| Arousal | Upprymdhetsnivå (lång/låg aktivering) |

Dessa värden används av Vibes-systemet och Smarta playlister.

---

### ReplayGain

- Stöd för inspelad ReplayGain-data i filen (Track Gain och Album Gain)
- Automatisk applicering vid uppspelning
- Peak-klippskydd

---

### Vågformsvisualiserare

- Genereras automatiskt vid uppspelning
- Visar RMS-energi per segment
- Klicka i vågen för att hoppa till den positionen i spåret
- Dynamisk röd färg

---

### Omslag / Cover Art

- **Automatisk inbäddad omslags-extraktion** vid skanning
- **CoverArtArchive** – Ladda ned album-omslag automatiskt via MusicBrainz Release ID
- **Manuell uppladdning** – Välj bild från disk i Tag Editor
- **Klistra in** – Klistra in bild från klippbordet
- **Förhandsvisning** – Visa aktuellt inbäddat omslag i Tag Editor
- **Albumvy** – Omslagsbilder visas i grid-vy med stilren ikon om omslaget saknas

---

### Sök

Tryck `Ctrl+K` eller klicka i sökfältet:

- **Global sökning** – Söker i spår, album och artister simultant
- **Realtidssökning** – Resultat visas direkt medan du skriver
- **Navigering** – Klicka ett resultat för att gå till albumsidan eller öppna spåret
- **Tangentbordsnavigering** – Piltangenter och Enter

---

### Dashboard

En översiktssida som visar:

- Senast spelade spår
- Mest spelade spår
- Senast tillagda i biblioteket
- Favoritspår och -album

---

### Spelkö (Queue)

- **Visa/dölja** – Klicka på köikonen i spelaren
- **Lägg till i kö** – Högerklicka på spår → "Lägg till i kön"
- **Spela härnäst** – Högerklicka → "Spela härnäst" (lägger till överst i kön)
- **Omordning** – Dra spår i kön till önskad plats
- **Rensa kö** – Tömmer hela kön med ett klick
- **Nu spelar** – Aktuellt spår markeras i kön
- **Spara som playlist** – Konvertera kön till en namngiven spellista

---

### Miniplayer – Kompakt vy
MusicMaster erbjuder en kraftfull och minimalistisk Miniplayer för de tillfällen då du vill fokusera på annat men ändå ha kontroll:
- **Två layouter**:
  - **Standard**: En elegant kvadratisk vy med stort omslag och fullständiga kontroller.
  - **Bar Mode**: Ett ultra-kompakt horisontellt läge som tar minimal plats på skärmen (perfekt att ha i ett hörn).
- **Always on Top**: Håll spelaren synlig över alla andra fönster.
- **Smart Queue Drawer**: När du öppnar kön expanderar fönstret nedåt som en "låda" (drawer) för att visa listan utan att störa den kompakta vyn.
- **Snabba kontroller**:
  - Klicka på albumomslaget för att direkt pausa eller spela (Play/Pause).
  - Tydlig seekbar och volymkontroll.
  - Dedikerad knapp för att direkt växla mellan de två mini-layouterna.
- **Transparent TopBar**: En sömlös och premium-känsla med innehåll som sträcker sig hela vägen upp till fönsterkanten.

---



---

### Inställningar

**Tjänster:**
- Last.fm API-nyckel + inloggning
- Spotify Client ID + Secret (för artistbilder)
- ListenBrainz API-token
- MusicBrainz Mirror-URL (för lokalt MusicBrainz-spegel)

**Uppspelning:**
- Standard ReplayGain-läge (Track/Album/None)
- Crossfade-tid (sekunder)

**Bibliotek:**
- Lägg till/ta bort musikmappar
- Starta omskanning manuellt
- Starta bakgrundsberikning manuellt

---

## 🚀 Kom igång

### Förutsättningar
- **Node.js 18+**
- **npm 9+**

### Installation och start

```bash
# 1. Klona projektet
git clone https://github.com/RogerDodger8989/MusicMaster.git
cd MusicMaster

# 2. Starta servern
cd server
npm install
npm run dev
# Servern körs på http://localhost:3000

# 3. Starta klienten (nytt terminalfönster)
cd ../desktop
npm install
npm run dev:web
# Öppnas i webbläsaren: http://localhost:5173
```

### Docker
```bash
docker-compose up -d
```

### Lägg till musik
1. Öppna appen → **Inställningar** → **Musikmappar**
2. Klicka **Lägg till mapp** och välj katalogen med din musik
3. Klicka **Skanna** – biblioteket byggs upp automatiskt

---

## 📁 Projektstruktur

```
MusicMaster/
├── server/                         # Backend Node.js/Express
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes.ts           # Alla API-rutter
│   │   │   └── controllers/        # En controller per domän
│   │   │       ├── tracks.*        # CRUD + betyg + loved + bulk
│   │   │       ├── albums.*        # Album-operationer
│   │   │       ├── artists.*       # Artistinfo + berikning
│   │   │       ├── playlists.*     # Playlister + ordning
│   │   │       ├── smartPlaylists.*# Dynamiska playlister
│   │   │       ├── metadata.*      # MusicBrainz + AcoustID
│   │   │       ├── scan.*          # Filskanning
│   │   │       ├── scrobble.*      # Last.fm + ListenBrainz
│   │   │       ├── media.*         # Omslag + stream
│   │   │       ├── vibes.*         # Stämningsbaserade playlister
│   │   │       ├── system.*        # Systeminformation
│   │   │       └── settings.*      # Appinställningar
│   │   ├── database/
│   │   │   ├── index.ts            # Databas-schema + migrering
│   │   │   ├── tracks.ts           # Spår-queries
│   │   │   ├── albums.ts           # Album-queries
│   │   │   ├── artists.ts          # Artist-queries
│   │   │   └── musicbrainz.ts      # MB-specifika queries
│   │   └── services/
│   │       ├── metadataWriter.ts   # Skriver FLAC/MP3-taggar
│   │       ├── musicbrainz.ts      # MB API-klient
│   │       ├── lastfm.ts           # Last.fm API
│   │       ├── spotify.ts          # Spotify API
│   │       ├── listenbrainz.ts     # ListenBrainz API
│   │       ├── acoustid.ts         # Fingeravtrycksidentifiering
│   │       ├── enricher.ts         # Bakgrundsberikning
│   │       ├── coverArt.ts         # Omslads-hämtning
│   │       ├── vibesService.ts     # Stämningsanalys
│   │       └── waveformGenerator.ts# Vågformsdata
│   └── package.json
│
├── desktop/                        # Frontend Electron/Vite/React
│   └── src/renderer/src/
│       ├── components/
│       │   ├── PlayerBar.tsx       # Spelarkontroller + vågform
│       │   ├── QueuePanel.tsx      # Spelkö
│       │   ├── TrackList.tsx       # Spårlista med sortering
│       │   ├── TaggingModal.tsx    # MusicBrainz-sökning
│       │   ├── SmartPlaylistBuilder# Filter-byggare
│       │   ├── SearchModal.tsx     # Global sökning
│       │   └── modals/
│       │       ├── TagEditorModal* # Tag Editor
│       │       └── SettingsModal*  # Inställningar
│       ├── store/
│       │   ├── library.ts          # Biblioteks-state (Zustand)
│       │   └── player.ts           # Uppspelnings-state
│       ├── api/client.ts           # REST-klient
│       └── types/index.ts          # Alla TypeScript-typer
│
└── docker-compose.yml
```

---

## 🔧 Miljövariabler

Skapa filen `server/.env`:

```env
# Server
PORT=3000                          # API-port (standard: 3000)
DB_PATH=./data/musicmaster.db      # Databassökväg

# Last.fm (valfritt – för scrobbling)
LASTFM_API_KEY=din_nyckel
LASTFM_API_SECRET=din_hemlighet

# Spotify (valfritt – för artistbilder)
SPOTIFY_CLIENT_ID=din_client_id
SPOTIFY_CLIENT_SECRET=din_hemlighet

# ListenBrainz (valfritt)
LISTENBRAINZ_TOKEN=din_token

# MusicBrainz Mirror (valfritt – för snabbare sökningar)
MUSICBRAINZ_MIRROR_URL=http://din-mirror:5000
```

---

## 🗄 Databas-schema

SQLite-databasen `musicmaster.db` innehåller:

| Tabell | Beskrivning |
|---|---|
| `tracks` | Alla spår med ~80 metadata-kolumner |
| `albums` | Albumcache med omslagsväg, betyg, MB-IDs |
| `artists` | Artistinfo med biografi, bild, land, typ |
| `genres` | Genrer med spårantals-count |
| `music_folders` | Registrerade musikmappar |
| `playlists` | Spellistor med metadata |
| `playlist_tracks` | Kopplingstabell spår⟷spellista |
| `smart_playlists` | Dynamiska spellistor med filterregler (JSON) |
| `playback_state` | Senaste spelarsession (persistens) |
| `user_settings` | Appinställningar (nyckel-värde) |
| `scrobble_queue` | Köade scrobbles för offline-läge |
| `play_history` | Komplett spelhistorik per spår |
| `performers` | Kompositörer, producenter, textförfattare m.fl. per spår |

---

## 🌐 REST API-översikt

Alla endpoints är relativa till `http://localhost:3000/api`.

### Spår
| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/tracks` | Lista alla spår (stöder filtrering, sortering, paginering) |
| GET | `/tracks/:id` | Hämta ett spår |
| PUT | `/tracks/:id` | Uppdatera metadata + skriv till fil |
| DELETE | `/tracks/:id` | Ta bort spår från biblioteket |
| POST | `/tracks/bulk` | Massuppdatering av flera spår |
| POST | `/tracks/:id/rate` | Sätt betyg |
| POST | `/tracks/:id/loved` | Toggla "Älskad" |
| GET | `/tracks/:id/info` | Utökad info (filstats, waveform) |
| GET | `/tracks/:id/similar` | Liknande spår (baserat på genre/features) |

### Album
| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/albums` | Lista alla album |
| GET | `/albums/:id` | Albumdetaljer + spårlista |
| PUT | `/albums/:id` | Uppdatera albuminformation |
| DELETE | `/albums/:id` | Ta bort album |
| POST | `/albums/:id/rate` | Sätt albumbetyg |
| POST | `/albums/:id/loved` | Toggla "Älskad" |

### Artister
| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/artists` | Lista alla artister |
| GET | `/artists/:id` | Artistdetaljer + diskografi |
| PUT | `/artists/:id` | Uppdatera artistinfo |
| GET | `/artists/:id/members` | Bandmedlemmar |
| GET | `/artists/similar` | Liknande artister |

### Playlister
| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/playlists` | Lista alla playlister |
| POST | `/playlists` | Skapa ny |
| GET | `/playlists/:id` | Hämta med spårlista |
| PUT | `/playlists/:id` | Byt namn / uppdatera |
| DELETE | `/playlists/:id` | Radera |
| POST | `/playlists/:id/tracks` | Lägg till spår |
| DELETE | `/playlists/:id/tracks/:trackId` | Ta bort spår |
| POST | `/playlists/:id/reorder` | Ändra ordning |

### Metadata & MusicBrainz
| Metod | Endpoint | Beskrivning |
|---|---|---|
| GET | `/metadata/search` | Sök inspelning/release i MusicBrainz |
| GET | `/metadata/search-albums` | Sök release i MusicBrainz |
| POST | `/metadata/apply/:trackId` | Applicera MusicBrainz-data på spår |
| POST | `/metadata/apply-album/:albumId` | Applicera MB-data på hela album |
| GET | `/metadata/identify/:trackId` | Identifiera via audiofingertryck |

### Skanning & System
| Metod | Endpoint | Beskrivning |
|---|---|---|
| POST | `/scan/start` | Starta skanning av en mapp |
| GET | `/scan/status` | Skanningsstatus i realtid |
| POST | `/scan/stop` | Stoppa pågående skanning |
| GET | `/system/info` | Systeminformation |
| POST | `/enrichment/start` | Starta bakgrundsberikning manuellt |

### Scrobbling
| Metod | Endpoint | Beskrivning |
|---|---|---|
| POST | `/scrobble` | Scrobble ett spår |
| POST | `/scrobble/nowplaying` | Uppdatera "Nu spelar" |
| POST | `/scrobble/sync` | Synkronisera spelantal |
| GET | `/auth/lastfm/token` | Hämta Last.fm-autentiseringstoken |

---

## 📄 Licens

MIT – Fri att använda, modifiera och distribuera.

---

*MusicMaster är byggt med ❤️ för musikälskare av musikälskare.*
