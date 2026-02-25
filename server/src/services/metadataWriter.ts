// @ts-ignore
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import os from 'os'
const Metaflac = require('metaflac-js')

const execAsync = promisify(exec)

export interface TrackMetadataWriteData {
    // Basic Metadata
    title?: string
    artist?: string
    album?: string
    albumArtist?: string
    year?: number
    genre?: string
    trackNum?: number
    trackTotal?: number
    discNum?: number
    discTotal?: number
    composer?: string
    lyrics?: string
    comment?: string
    conductor?: string
    grouping?: string
    albumRating?: number
    originalArtist?: string
    originalAlbum?: string
    originalYear?: number
    tempo?: string
    occasion?: string
    keywords?: string
    language?: string
    custom1?: string
    custom2?: string
    custom3?: string
    custom4?: string
    custom5?: string
    custom6?: string
    custom7?: string
    custom8?: string
    custom9?: string
    custom10?: string
    custom11?: string
    custom12?: string
    custom13?: string
    custom14?: string
    custom15?: string
    custom16?: string
    custom17?: string
    custom18?: string
    custom19?: string
    custom20?: string

    // MusicBrainz Recording (Track) MBIDs
    trackId?: string           // MUSICBRAINZ_TRACKID
    recordingMBID?: string     // MUSICBRAINZ_RELEASETRACKID
    isrc?: string              // ISRC

    // Album MBIDs
    albumId?: string           // MUSICBRAINZ_ALBUMID
    releaseGroupMBID?: string  // MUSICBRAINZ_RELEASEGROUPID

    // Artist MBIDs (supports multiple artists)
    artistId?: string          // MUSICBRAINZ_ARTISTID (primary)
    artistMBIDs?: string[]     // All track artist MBIDs
    albumArtistMBID?: string   // MUSICBRAINZ_ALBUMARTISTID
    albumArtistMBIDs?: string[] // All album artist MBIDs

    // Artist sort names
    artistSortOrder?: string    // ARTISTSORT
    albumArtistSortOrder?: string // ALBUMARTISTSORT

    // Release metadata
    releaseDate?: string       // DATE
    originalDate?: string      // ORIGINALDATE
    label?: string             // ORGANIZATION/LABEL
    catalogNumber?: string     // CATALOGNUMBER
    barcode?: string           // BARCODE
    country?: string           // RELEASECOUNTRY
    media?: string             // MEDIA
    script?: string            // SCRIPT
    totalDiscs?: number        // TOTALDISCS
    totalTracks?: number       // TOTALTRACKS
    albumType?: string         // MUSICBRAINZ_ALBUMTYPE
    releaseStatus?: string     // MUSICBRAINZ_ALBUMSTATUS

    // Credits
    producers?: string[]       // PRODUCER

    // Genre and tags (genre is in basic, but keeping genres for multiple)
    genres?: string[]          // GENRE

    // AcousticBrainz audio analysis
    bpm?: number               // BPM
    key?: string               // INITIALKEY
    keySignature?: string      // KEY_SIGNATURE
    energy?: number            // ENERGY (0-1)
    danceability?: number      // DANCEABILITY (0-1)
    acousticness?: number      // ACOUSTICNESS (0-1)
    valence?: number           // VALENCE (0-1, mood)
    instrumentalness?: number  // INSTRUMENTALNESS (0-1)

    // Movement/Work metadata
    workMBID?: string          // MUSICBRAINZ_WORKID
    movement?: string          // MOVEMENTNAME
    movementNumber?: number    // MOVEMENT
    movementTotal?: number     // MOVEMENTTOTAL

    // Cover Art & Artwork Options
    coverPath?: string         // Path to cover image to embed
    artworkOptions?: {
        embed?: boolean
        saveToFile?: boolean
        fileName?: string
        pending?: {
            front?: { data: string; type: string }
            back?: { data: string; type: string }
        }
    }
}

export async function writeMetadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: TrackMetadataWriteData
): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()
    let tempCoverReq: string | undefined

    try {
        if (musicBrainzData?.artworkOptions?.pending?.front?.data) {
            try {
                const b64Parts = musicBrainzData.artworkOptions.pending.front.data.split(',')
                const b64Data = b64Parts.length > 1 ? b64Parts[1] : b64Parts[0]
                tempCoverReq = path.join(os.tmpdir(), `musicmaster_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`)
                fs.writeFileSync(tempCoverReq, b64Data, 'base64')
                musicBrainzData.coverPath = tempCoverReq
                console.log(`🖼️ Parsed pending base64 artwork to temp file: ${tempCoverReq}`)
            } catch (err) {
                console.error('Failed to parse base64 pending artwork:', err)
            }
        }

        if (ext === '.flac') {
            await writeFLACMetadata(filePath, rating, loved, playCount, musicBrainzData)
        } else if (ext === '.mp3') {
            await writeMP3Metadata(filePath, rating, loved, playCount, musicBrainzData)
        } else {
            console.log(`⚠️ Unsupported file format: ${ext}, skipping file write`)
            return
        }

        console.log(`✅ Wrote metadata to ${filePath}: rating=${rating}, loved=${loved}, playCount=${playCount || 0}`)

        // Handle folder artwork saving if requested
        if (musicBrainzData?.coverPath && musicBrainzData.artworkOptions?.saveToFile) {
            const dir = path.dirname(filePath)
            const picExt = path.extname(musicBrainzData.coverPath) || '.jpg'
            const outName = (musicBrainzData.artworkOptions.fileName || 'cover') + picExt
            const outPath = path.join(dir, outName)

            try {
                if (!fs.existsSync(outPath) || outPath !== musicBrainzData.coverPath) {
                    fs.copyFileSync(musicBrainzData.coverPath, outPath)
                    console.log(`✅ Saved artwork to folder: ${outPath}`)
                }
            } catch (err) {
                console.error(`❌ Failed to save artwork to folder ${outPath}:`, err)
            }
        }
    } catch (error: any) {
        console.error(`❌ Failed to write metadata to ${filePath}:`, error.message || error)
        try {
            require('fs').appendFileSync('debug_write.txt', `[${new Date().toISOString()}] Write error on ${filePath}:\n${error.stack || error.toString()}\n\n`)
        } catch (e) { }
        // We log the error but don't rethrow it, so the DB update (which happened before) stays valid
        // and the API doesn't return a 500 error.
    } finally {
        if (tempCoverReq && fs.existsSync(tempCoverReq)) {
            try {
                fs.unlinkSync(tempCoverReq)
            } catch (e) { }
        }
    }
}

async function writeFLACMetadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: TrackMetadataWriteData
): Promise<void> {
    const fmpsRating = (rating / 5).toFixed(2)

    try {
        // Many FLAC files incorrectly have an ID3v2 tag at the start (usually from Windows tools).
        // metaflac-js crashes if the file doesn't strictly start with 'fLaC'.
        // We need to read the file, strip the ID3 tag if present, and operate on the clean buffer.
        let fileBuffer = fs.readFileSync(filePath)
        let id3HeaderSize = 0
        if (fileBuffer.length > 10 && fileBuffer.subarray(0, 3).toString('ascii') === 'ID3') {
            // ID3v2 size is stored as 4 bytes, using 7 bits per byte (sync-safe integer)
            const id3 = fileBuffer.subarray(0, 10)
            const size = (id3[6] << 21) | (id3[7] << 14) | (id3[8] << 7) | id3[9]
            id3HeaderSize = size + 10

            // Only strip if the next bytes are actually fLaC, otherwise something is wrong
            if (fileBuffer.length > id3HeaderSize + 4 && fileBuffer.subarray(id3HeaderSize, id3HeaderSize + 4).toString('ascii') === 'fLaC') {
                console.log(`⚠️ Removing ${id3HeaderSize} bytes of invalid ID3v2 tags from start of FLAC file: ${filePath}`)
                fileBuffer = fileBuffer.subarray(id3HeaderSize)
                fs.writeFileSync(filePath, fileBuffer) // Strip it permanently from the file
            } else {
                console.log(`⚠️ File starts with ID3 but valid fLaC marker not found immediately after. Writing might fail: ${filePath}`)
            }
        }

        const flac = new Metaflac(filePath)

        const setTag = (key: string, value: string | number) => {
            flac.removeTag(key)
            flac.setTag(`${key}=${value}`)
        }

        // Write alla taggar – kombinerar direkta formulärfält med MusicBrainz-metadata
        const d = musicBrainzData as any // Hjälper att läsa godtyckliga fält

        if (d) {
            // === GRUNDFÄLT (från formulärets Tags-flik) ===
            const basicTags: Array<[string, any]> = [
                ['TITLE', d.title],
                ['ARTIST', d.artist],
                ['ALBUM', d.album],
                ['ALBUMARTIST', d.albumArtist],
                ['DATE', d.year || d.releaseDate],
                ['GENRE', d.genre],
                ['TRACKNUMBER', d.trackNum],
                ['TRACKTOTAL', d.trackTotal],
                ['DISCNUMBER', d.discNum],
                ['DISCTOTAL', d.discTotal],
                ['COMPOSER', d.composer],
                ['LYRICS', d.lyrics],
                ['COMMENT', d.comment],
                ['CONDUCTOR', d.conductor],
                ['GROUPING', d.grouping],

                // === UTGIVNINGSFÄLT ===
                // "Publisher"/"Skivbolag" – frontend skickar som `publisher`
                // MusicBrainz-data skickar som `label`
                // Båda skrivs till ORGANIZATION-taggen (standard FLAC/Vorbis)
                ['ORGANIZATION', d.publisher || d.label],

                // Katalognummer
                ['CATALOGNUMBER', d.catalogNumber],

                // Streckkod
                ['BARCODE', d.barcode],

                // Media (Digital Media, CD, etc.)
                ['MEDIA', d.media],

                // Skript (Latin, Cyrillic, etc.)
                ['SCRIPT', d.script],

                // Utgivningsland
                ['RELEASECOUNTRY', d.country],

                // === ORIGINALTFÄLT ===
                ['ORIGINALARTIST', d.originalArtist],
                ['ORIGINALALBUM', d.originalAlbum],
                ['ORIGINALYEAR', d.originalYear],
                ['ORIGINALDATE', d.originalDate],

                // === KATEGORISERING ===
                ['LANGUAGE', d.language],
                ['TEMPO', d.tempo],
                ['MOOD', d.mood],
                ['OCCASION', d.occasion],
                ['KEYWORDS', d.keywords],

                // === SORTERINGSORDNING ===
                ['ARTISTSORT', d.artistSortOrder],
                ['ALBUMARTISTSORT', d.albumArtistSortOrder],

                // === MUSICBRAINZ IDs ===
                ['MUSICBRAINZ_TRACKID', d.musicbrainzTrackId || d.trackId || d.recordingMBID],
                ['MUSICBRAINZ_ALBUMID', d.musicbrainzAlbumId || d.albumId],
                ['MUSICBRAINZ_ARTISTID', d.musicbrainzArtistId || d.artistId],
                ['MUSICBRAINZ_RELEASEGROUPID', d.musicbrainzReleaseGroupId || d.releaseGroupMBID],
                ['MUSICBRAINZ_WORKID', d.musicbrainzWorkId || d.workMBID],
                ['MUSICBRAINZ_RECORDINGID', d.musicbrainzRecordingId || d.recordingMBID],
                ['MUSICBRAINZ_RELEASETRACKID', d.recordingMBID],
                ['ISRC', d.isrc],

                // === UTGIVNINGSSTATUS/TYP ===
                ['RELEASESTATUS', d.releaseStatus],
                ['RELEASETYPE', d.albumType],

                // === LJUD-ANALYS ===
                ['BPM', d.bpm != null ? String(d.bpm) : undefined],
                ['INITIALKEY', d.key],
                ['ENERGY', d.energy != null ? Number(d.energy).toFixed(3) : undefined],
                ['DANCEABILITY', d.danceability != null ? Number(d.danceability).toFixed(3) : undefined],
                ['ACOUSTICNESS', d.acousticness != null ? Number(d.acousticness).toFixed(3) : undefined],
                ['VALENCE', d.valence != null ? Number(d.valence).toFixed(3) : undefined],
                ['INSTRUMENTALNESS', d.instrumentalness != null ? Number(d.instrumentalness).toFixed(3) : undefined],

                // === MOVEMENT (klassisk musik) ===
                ['MOVEMENTNAME', d.movement],
                ['MOVEMENT', d.movementNumber != null ? String(d.movementNumber) : undefined],
                ['MOVEMENTTOTAL', d.movementTotal != null ? String(d.movementTotal) : undefined],
            ]

            for (const [key, value] of basicTags) {
                if (value != null && String(value).trim() !== '') {
                    setTag(key, String(value))
                }
            }

            // === CUSTOM-FÄLT (1–20) ===
            for (let i = 1; i <= 20; i++) {
                const val = d[`custom${i}`]
                if (val && String(val).trim() !== '') {
                    setTag(`CUSTOM${i}`, String(val))
                }
            }

            // === FLERVÄRDIGA FÄLT ===
            if (d.genres && d.genres.length > 0) {
                flac.removeTag('GENRE')
                for (const genre of d.genres) {
                    flac.setTag(`GENRE=${genre}`)
                }
            }

            if (d.producers && d.producers.length > 0) {
                flac.removeTag('PRODUCER')
                for (const producer of d.producers) {
                    flac.setTag(`PRODUCER=${producer}`)
                }
            }

            if (d.artistMBIDs && d.artistMBIDs.length > 0) {
                flac.removeTag('MUSICBRAINZ_ARTISTID')
                for (const mbid of d.artistMBIDs) {
                    flac.setTag(`MUSICBRAINZ_ARTISTID=${mbid}`)
                }
            }

            if (d.albumArtistMBIDs && d.albumArtistMBIDs.length > 0) {
                flac.removeTag('MUSICBRAINZ_ALBUMARTISTID')
                for (const mbid of d.albumArtistMBIDs) {
                    flac.setTag(`MUSICBRAINZ_ALBUMARTISTID=${mbid}`)
                }
            }

            // === INBÄDDAD OMSLAGSBILD ===
            if (d.coverPath && d.artworkOptions?.embed !== false) {
                try {
                    flac.importPictureFrom(d.coverPath)
                } catch (error) {
                    console.error(`Failed to embed cover art for ${filePath}:`, error)
                }
            }
        }

        // === BETYG & SPELADE ===
        flac.removeTag('FMPS_RATING')
        flac.removeTag('FMPS_RATING_USER')
        flac.removeTag('RATING')
        flac.removeTag('LOVED')
        flac.removeTag('PLAY_COUNT')

        setTag('FMPS_RATING', fmpsRating)
        setTag('RATING', rating)
        setTag('FMPS_RATING_USER', 'MusicMaster')
        if (loved) setTag('LOVED', 1)
        if (playCount !== undefined) setTag('PLAY_COUNT', playCount)

        flac.save()
    } catch (error) {
        console.error('Failed to write FLAC metadata:', error)
        throw error
    }
}


async function writeMP3Metadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: TrackMetadataWriteData
): Promise<void> {
    const popmRating = Math.round((rating / 5) * 255)
    const tags = NodeID3.read(filePath)

    const updatedTags: NodeID3.Tags = {
        ...tags,
        popularimeter: {
            email: 'MusicWest',
            rating: popmRating,
            counter: 0
        },
        userDefinedText: [
            ...(tags.userDefinedText?.filter(t => t.description !== 'LOVED' && t.description !== 'PLAY_COUNT') || []),
            {
                description: 'LOVED',
                value: loved ? '1' : '0'
            }
        ]
    }

    if (playCount !== undefined) {
        updatedTags.userDefinedText!.push({
            description: 'PLAY_COUNT',
            value: playCount.toString()
        })
    }

    if (musicBrainzData) {
        if (musicBrainzData.title) updatedTags.title = musicBrainzData.title
        if (musicBrainzData.artist) updatedTags.artist = musicBrainzData.artist
        if (musicBrainzData.album) updatedTags.album = musicBrainzData.album
        if (musicBrainzData.albumArtist) updatedTags.performerInfo = musicBrainzData.albumArtist
        if (musicBrainzData.year) updatedTags.year = musicBrainzData.year.toString()
        if (musicBrainzData.genre) updatedTags.genre = musicBrainzData.genre
        if (musicBrainzData.trackNum) updatedTags.trackNumber = musicBrainzData.trackNum.toString()
        if (musicBrainzData.discNum) updatedTags.partOfSet = musicBrainzData.discNum.toString()
        if (musicBrainzData.composer) updatedTags.composer = musicBrainzData.composer
        if (musicBrainzData.comment) updatedTags.comment = { language: 'eng', text: musicBrainzData.comment }
        if (musicBrainzData.lyrics) updatedTags.unsynchronisedLyrics = { language: 'eng', text: musicBrainzData.lyrics }
        if (musicBrainzData.conductor) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'CONDUCTOR')
            updatedTags.userDefinedText.push({ description: 'CONDUCTOR', value: musicBrainzData.conductor })
        }
        if (musicBrainzData.grouping) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'GROUPING')
            updatedTags.userDefinedText.push({ description: 'GROUPING', value: musicBrainzData.grouping })
        }
        if (musicBrainzData.originalArtist) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'ORIGINAL ARTIST')
            updatedTags.userDefinedText.push({ description: 'ORIGINAL ARTIST', value: musicBrainzData.originalArtist })
        }
        if (musicBrainzData.originalYear) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'ORIGINAL YEAR')
            updatedTags.userDefinedText.push({ description: 'ORIGINAL YEAR', value: musicBrainzData.originalYear.toString() })
        }
        if (musicBrainzData.tempo) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'TEMPO')
            updatedTags.userDefinedText.push({ description: 'TEMPO', value: musicBrainzData.tempo })
        }
        if (musicBrainzData.language) {
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== 'LANGUAGE')
            updatedTags.userDefinedText.push({ description: 'LANGUAGE', value: musicBrainzData.language })
        }
        // Custom Fields
        for (let i = 1; i <= 20; i++) {
            const key = `custom${i}` as keyof TrackMetadataWriteData
            const val = musicBrainzData[key]
            if (val && typeof val === 'string') {
                updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== `CUSTOM${i}`)
                updatedTags.userDefinedText.push({ description: `CUSTOM${i}`, value: val })
            }
        }

        if (musicBrainzData.releaseDate) updatedTags.date = musicBrainzData.releaseDate
        // @ts-ignore
        if (musicBrainzData.originalDate) updatedTags.originalDate = musicBrainzData.originalDate
        if (musicBrainzData.label) updatedTags.publisher = musicBrainzData.label
        if (musicBrainzData.genres) updatedTags.genre = musicBrainzData.genres.join(';')
        if (musicBrainzData.bpm) updatedTags.bpm = musicBrainzData.bpm.toString()
        if (musicBrainzData.key) updatedTags.initialKey = musicBrainzData.key
        if (musicBrainzData.artistSortOrder) updatedTags.performerInfo = musicBrainzData.artistSortOrder
        if (musicBrainzData.producers) updatedTags.involvedPeopleList = musicBrainzData.producers.map(p => `producer:${p}`).join(';')

        const mbMap = [
            { desc: 'MusicBrainz Release Track Id', val: musicBrainzData.trackId || musicBrainzData.recordingMBID },
            { desc: 'MUSICBRAINZ_TRACKID', val: musicBrainzData.trackId || musicBrainzData.recordingMBID },
            { desc: 'MUSICBRAINZ_RELEASETRACKID', val: musicBrainzData.recordingMBID },
            { desc: 'ISRC', val: musicBrainzData.isrc },
            { desc: 'MusicBrainz Album Id', val: musicBrainzData.albumId },
            { desc: 'MUSICBRAINZ_ALBUMID', val: musicBrainzData.albumId },
            { desc: 'MUSICBRAINZ_RELEASEGROUPID', val: musicBrainzData.releaseGroupMBID },
            { desc: 'MusicBrainz Artist Id', val: musicBrainzData.artistId },
            { desc: 'MUSICBRAINZ_ARTISTID', val: musicBrainzData.artistId },
            { desc: 'MUSICBRAINZ_ALBUMARTISTID', val: musicBrainzData.albumArtistMBID },
            { desc: 'ARTISTSORT', val: musicBrainzData.artistSortOrder },
            { desc: 'ALBUMARTISTSORT', val: musicBrainzData.albumArtistSortOrder },
            { desc: 'CATALOGNUMBER', val: musicBrainzData.catalogNumber },
            { desc: 'BARCODE', val: musicBrainzData.barcode },
            { desc: 'RELEASECOUNTRY', val: musicBrainzData.country },
            { desc: 'MEDIA', val: musicBrainzData.media },
            { desc: 'SCRIPT', val: musicBrainzData.script },
            { desc: 'TOTALDISCS', val: musicBrainzData.totalDiscs?.toString() },
            { desc: 'TOTALTRACKS', val: musicBrainzData.totalTracks?.toString() },
            { desc: 'RELEASETYPE', val: musicBrainzData.albumType },
            { desc: 'RELEASESTATUS', val: musicBrainzData.releaseStatus },
            { desc: 'ENERGY', val: musicBrainzData.energy?.toFixed(3) },
            { desc: 'DANCEABILITY', val: musicBrainzData.danceability?.toFixed(3) },
            { desc: 'ACOUSTICNESS', val: musicBrainzData.acousticness?.toFixed(3) },
            { desc: 'VALENCE', val: musicBrainzData.valence?.toFixed(3) },
            { desc: 'INSTRUMENTALNESS', val: musicBrainzData.instrumentalness?.toFixed(3) },
            { desc: 'MUSICBRAINZ_WORKID', val: musicBrainzData.workMBID },
            { desc: 'MOVEMENTNAME', val: musicBrainzData.movement },
            { desc: 'MOVEMENT', val: musicBrainzData.movementNumber?.toString() },
            { desc: 'MOVEMENTTOTAL', val: musicBrainzData.movementTotal?.toString() }
        ]

        for (const item of mbMap) {
            if (item.val) {
                updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== item.desc)
                updatedTags.userDefinedText.push({ description: item.desc, value: item.val })
            }
        }

        if (musicBrainzData.artistMBIDs && musicBrainzData.artistMBIDs.length > 0) {
            const mbids = musicBrainzData.artistMBIDs.join(';')
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(
                t => t.description !== 'MUSICBRAINZ_ARTISTID'
            )
            updatedTags.userDefinedText.push({ description: 'MUSICBRAINZ_ARTISTID', value: mbids })
        }

        if (musicBrainzData.albumArtistMBIDs && musicBrainzData.albumArtistMBIDs.length > 0) {
            const mbids = musicBrainzData.albumArtistMBIDs.join(';')
            updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(
                t => t.description !== 'MUSICBRAINZ_ALBUMARTISTID'
            )
            updatedTags.userDefinedText.push({ description: 'MUSICBRAINZ_ALBUMARTISTID', value: mbids })
        }

        if (musicBrainzData.coverPath && musicBrainzData.artworkOptions?.embed !== false) {
            try {
                const imageBuffer = fs.readFileSync(musicBrainzData.coverPath)
                updatedTags.image = {
                    mime: 'image/jpeg',
                    type: {
                        id: 3,
                        name: 'front cover'
                    },
                    description: 'Cover',
                    imageBuffer: imageBuffer
                }
            } catch (error) {
                console.error('Failed to read cover image for embedding:', error)
            }
        }
    }

    const success = NodeID3.write(updatedTags, filePath)

    if (!success) {
        console.error(`❌ NodeID3 failed to write tags to: ${filePath}`)
        throw new Error(`Failed to write ID3 tags to ${filePath}`)
    }
}

export async function readMetadata(
    filePath: string
): Promise<{ rating: number; loved: boolean }> {
    const ext = path.extname(filePath).toLowerCase()

    try {
        if (ext === '.flac') {
            return await readFLACMetadata(filePath)
        } else if (ext === '.mp3') {
            return await readMP3Metadata(filePath)
        } else {
            return { rating: 0, loved: false }
        }
    } catch (error) {
        console.error(`Error reading metadata from ${filePath}:`, error)
        return { rating: 0, loved: false }
    }
}

async function readFLACMetadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
    const metadata = await parseFile(filePath)
    const fmpsRating = metadata.native?.vorbis?.find((tag) => tag.id === 'FMPS_RATING')?.value as string | undefined
    const lovedTag = metadata.native?.vorbis?.find((tag) => tag.id === 'LOVED')?.value as string | undefined

    const rating = fmpsRating ? parseFloat(fmpsRating) * 5 : 0
    const loved = lovedTag === '1'

    return { rating, loved }
}

async function readMP3Metadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
    const tags = NodeID3.read(filePath)
    const popmRating = tags.popularimeter?.rating || 0
    const rating = (popmRating / 255) * 5
    const loved = tags.userDefinedText?.find(t => t.description === 'LOVED')?.value === '1'

    return { rating, loved }
}

export async function checkMetaflacAvailable(): Promise<boolean> {
    try {
        await execAsync('metaflac --version')
        return true
    } catch {
        return false
    }
}

export function buildMusicBrainzDataFromDb(
    db: any,
    trackId: string | number
): TrackMetadataWriteData | null {
    const track = db.prepare(`
        SELECT 
            t.musicbrainz_trackid as recording_mbid,
            t.musicbrainz_albumid as album_mbid,
            t.musicbrainz_artistid as artist_mbid,
            t.isrc,
            t.movement,
            t.movement_num as movement_number,
            t.movement_total,
            t.musicbrainz_workid as work_mbid,
            a.album_type,
            a.status as release_status,
            a.release_date,
            a.original_release_date,
            a.label,
            a.catalog_number,
            a.barcode,
            a.country,
            a.media,
            a.release_group_mbid,
            a.script,
            a.total_discs,
            a.total_tracks
        FROM tracks t
        LEFT JOIN albums_cache a ON t.album = a.name AND (t.album_artist = a.artist OR t.artist = a.artist)
        WHERE t.id = ?
    `).get(trackId)

    if (!track) {
        return null
    }

    const trackArtists = db.prepare(`
        SELECT art.musicbrainz_artistid as mbid, art.name_sort_order, ta.credited_as, ta.sort_position
        FROM track_artists ta
        JOIN artists art ON ta.artist_id = art.id
        WHERE ta.track_id = ?
        ORDER BY ta.sort_position
    `).all(trackId)

    const albumArtists = db.prepare(`
        SELECT art.musicbrainz_artistid as mbid, art.name_sort_order, aa.credited_as, aa.sort_position
        FROM album_artists aa
        JOIN artists art ON aa.artist_id = art.id
        JOIN albums_cache a ON aa.album_id = a.id
        WHERE a.musicbrainz_albumid = ?
        ORDER BY aa.sort_position
    `).all(track.album_mbid)

    const genres = db.prepare(`
        SELECT g.name
        FROM genre_tags tg
        JOIN genres g ON tg.genre_id = g.id
        WHERE tg.entity_id = ? AND tg.entity_type = 'track'
        ORDER BY tg.confidence DESC
        LIMIT 5
    `).all(trackId).map((row: any) => row.name)

    const acousticData = db.prepare(`
        SELECT 
            bpm,
            key,
            key_signature,
            energy,
            danceability,
            acousticness,
            valence,
            instrumentalness
        FROM acousticbrainz_data
        WHERE musicbrainz_recordingid = ?
    `).get(track.recording_mbid)

    const data: TrackMetadataWriteData = {
        recordingMBID: track.recording_mbid,
        trackId: track.recording_mbid,
        isrc: track.isrc,
        albumId: track.album_mbid,
        releaseGroupMBID: track.release_group_mbid,
        artistMBIDs: trackArtists.length > 0 ? trackArtists.map((a: any) => a.mbid).filter(Boolean) : [track.artist_mbid].filter(Boolean),
        artistId: trackArtists[0]?.mbid || track.artist_mbid,
        artistSortOrder: trackArtists[0]?.name_sort_order,
        albumArtistMBIDs: albumArtists.map((a: any) => a.mbid).filter(Boolean),
        albumArtistMBID: albumArtists[0]?.mbid,
        albumArtistSortOrder: albumArtists[0]?.name_sort_order,
        releaseDate: track.release_date,
        originalDate: track.original_release_date,
        label: track.label,
        catalogNumber: track.catalog_number,
        barcode: track.barcode,
        country: track.country,
        media: track.media,
        script: track.script,
        totalDiscs: track.total_discs,
        totalTracks: track.total_tracks,
        albumType: track.album_type,
        releaseStatus: track.release_status,
        genres: genres.length > 0 ? genres : undefined,
        workMBID: track.work_mbid,
        movement: track.movement,
        movementNumber: track.movement_number,
        movementTotal: track.movement_total
    }

    if (acousticData) {
        data.bpm = acousticData.bpm
        data.key = acousticData.key
        data.keySignature = acousticData.key_signature
        data.energy = acousticData.energy
        data.danceability = acousticData.danceability
        data.acousticness = acousticData.acousticness
        data.valence = acousticData.valence
        data.instrumentalness = acousticData.instrumentalness
    }

    return data
}

export async function writeMusicBrainzDataToFile(
    db: any,
    trackId: string | number,
    coverPath?: string
): Promise<boolean> {
    try {
        const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId)
        if (!track?.file_path) {
            console.error(`Track ${trackId} not found or has no path`)
            return false
        }

        const mbData = buildMusicBrainzDataFromDb(db, trackId)
        if (!mbData) {
            console.error(`No MusicBrainz data found for track ${trackId}`)
            return false
        }

        if (coverPath) {
            mbData.coverPath = coverPath
        }

        const trackMeta = db.prepare('SELECT rating, loved, play_count FROM tracks WHERE id = ?').get(trackId)

        await writeMetadata(
            track.file_path,
            trackMeta.rating || 0,
            trackMeta.loved === 1,
            trackMeta.play_count,
            mbData
        )

        console.log(`✅ Wrote MusicBrainz data to file: ${track.file_path}`)
        return true
    } catch (error) {
        console.error(`❌ Failed to write MusicBrainz data for track ${trackId}:`, error)
        return false
    }
}

export async function bulkWriteMusicBrainzData(
    db: any,
    trackIds: (string | number)[],
    onProgress?: (current: number, total: number, trackPath: string) => void
): Promise<{ success: number; failed: number; skipped: number }> {
    const results = { success: 0, failed: 0, skipped: 0 }

    for (let i = 0; i < trackIds.length; i++) {
        const trackId = trackIds[i]
        const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId)

        if (onProgress) {
            onProgress(i + 1, trackIds.length, track?.file_path || 'unknown')
        }

        try {
            const success = await writeMusicBrainzDataToFile(db, trackId)
            if (success) {
                results.success++
            } else {
                results.skipped++
            }
        } catch (error) {
            console.error(`Error writing MusicBrainz data for track ${trackId}:`, error)
            results.failed++
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }

    return results
}

export async function syncAllMusicBrainzData(
    db: any,
    onProgress?: (current: number, total: number, trackPath: string) => void
): Promise<{ success: number; failed: number; skipped: number }> {
    const tracks = db.prepare(`
        SELECT id
        FROM tracks
        WHERE musicbrainz_trackid IS NOT NULL
        ORDER BY id
    `).all()

    const trackIds = tracks.map((t: any) => t.id)
    return await bulkWriteMusicBrainzData(db, trackIds, onProgress)
}
