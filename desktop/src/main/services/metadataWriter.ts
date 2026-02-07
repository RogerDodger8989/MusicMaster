// @ts-ignore
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export interface MusicBrainzWriteData {
    trackId?: string
    albumId?: string
    artistId?: string
    releaseDate?: string
    label?: string
    catalogNumber?: string
    barcode?: string
    country?: string
    media?: string
    genres?: string[]
}

/**
 * Write rating, loved status, and play count to audio file
 * 
 * FLAC: Uses FMPS_RATING (0.0-1.0), LOVED tag, and PLAY_COUNT tag (requires metaflac)
 * MP3: Uses POPM frame (Popularimeter) with rating 0-255, LOVED, and PLAY_COUNT
 * 
 * @param filePath - Path to audio file
 * @param rating - Rating from 0-5 (supports 0.5 increments)
 * @param loved - Whether track is loved/favorited
 * @param playCount - Total play count (optional)
 */
export async function writeMetadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()

    try {
        if (ext === '.flac') {
            await writeFLACMetadata(filePath, rating, loved, playCount, musicBrainzData)
        } else if (ext === '.mp3') {
            await writeMP3Metadata(filePath, rating, loved, playCount, musicBrainzData)
        } else {
            console.log(`⚠️ Unsupported file format: ${ext}, skipping file write`)
            return
        }

        console.log(`✅ Wrote metadata to ${filePath}: rating=${rating}, loved=${loved}, playCount=${playCount || 0}`)
    } catch (error) {
        console.error(`❌ Failed to write metadata to ${filePath}:`, error)
        // Don't throw - just log and continue
    }
}

/**
 * Write metadata to FLAC file using metaflac command-line tool
 */
async function writeFLACMetadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
    // Convert 0-5 rating to 0.0-1.0 scale
    const fmpsRating = (rating / 5).toFixed(2)

    try {
        // Check if metaflac is available
        await execAsync('where metaflac')
    } catch (error) {
        console.warn('⚠️ metaflac not found - install FLAC tools (part of flac.exe/metaflac.exe) to write FLAC metadata. Skipping FLAC file write.')
        throw new Error('metaflac not installed on system path')
    }

    // Remove existing tags
    await execAsync(`metaflac --remove-tag=FMPS_RATING "${filePath}"`)
    await execAsync(`metaflac --remove-tag=FMPS_RATING_USER "${filePath}"`)
    await execAsync(`metaflac --remove-tag=RATING "${filePath}"`)
    await execAsync(`metaflac --remove-tag=LOVED "${filePath}"`)
    await execAsync(`metaflac --remove-tag=PLAY_COUNT "${filePath}"`)

    // Set new tags
    await execAsync(`metaflac --set-tag=FMPS_RATING=${fmpsRating} "${filePath}"`)
    await execAsync(`metaflac --set-tag=RATING=${rating} "${filePath}"`)
    await execAsync(`metaflac --set-tag=FMPS_RATING_USER=MusicMaster "${filePath}"`)

    if (loved) {
        await execAsync(`metaflac --set-tag=LOVED=1 "${filePath}"`)
    }

    if (playCount !== undefined) {
        await execAsync(`metaflac --set-tag=PLAY_COUNT=${playCount} "${filePath}"`)
    }

    if (musicBrainzData) {
        const mbTags = [
            { key: 'MUSICBRAINZ_TRACKID', value: musicBrainzData.trackId },
            { key: 'MUSICBRAINZ_ALBUMID', value: musicBrainzData.albumId },
            { key: 'MUSICBRAINZ_ARTISTID', value: musicBrainzData.artistId },
            { key: 'DATE', value: musicBrainzData.releaseDate },
            { key: 'ORGANIZATION', value: musicBrainzData.label }, // Label often maps to ORGANIZATION
            { key: 'CATALOGNUMBER', value: musicBrainzData.catalogNumber },
            { key: 'BARCODE', value: musicBrainzData.barcode },
            { key: 'RELEASECOUNTRY', value: musicBrainzData.country },
            { key: 'MEDIA', value: musicBrainzData.media }
        ]

        if (musicBrainzData.genres && musicBrainzData.genres.length > 0) {
            await execAsync(`metaflac --remove-tag=GENRE "${filePath}"`) // Clean existing genres if updating? Or append? usually replace for clean sync
            for (const genre of musicBrainzData.genres) {
                await execAsync(`metaflac --set-tag=GENRE="${genre}" "${filePath}"`)
            }
        }

        for (const tag of mbTags) {
            if (tag.value) {
                await execAsync(`metaflac --remove-tag=${tag.key} "${filePath}"`)
                await execAsync(`metaflac --set-tag=${tag.key}="${tag.value}" "${filePath}"`)
            }
        }
    }
}

async function writeMP3Metadata(
    filePath: string,
    rating: number,
    loved: boolean,
    playCount?: number,
    musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
    // Convert 0-5 rating to 0-255 scale
    const popmRating = Math.round((rating / 5) * 255)

    // Read existing tags
    const tags = NodeID3.read(filePath)

    // Update POPM frame and userDefinedText for LOVED and PLAY_COUNT
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
        // Map standard ID3 frames
        if (musicBrainzData.releaseDate) updatedTags.date = musicBrainzData.releaseDate
        if (musicBrainzData.label) updatedTags.publisher = musicBrainzData.label // TPUB
        if (musicBrainzData.genres) updatedTags.genre = musicBrainzData.genres.join(';') // TCON

        // Map TXXX (User Defined) frames
        const mbMap = [
            { desc: 'MusicBrainz Release Track Id', val: musicBrainzData.trackId },
            { desc: 'MusicBrainz Album Id', val: musicBrainzData.albumId },
            { desc: 'MusicBrainz Artist Id', val: musicBrainzData.artistId },
            { desc: 'CATALOGNUMBER', val: musicBrainzData.catalogNumber },
            { desc: 'BARCODE', val: musicBrainzData.barcode },
            { desc: 'MusicBrainz Album Type', val: musicBrainzData.media }, // Not exact but close
            { desc: 'RELEASECOUNTRY', val: musicBrainzData.country }
        ]

        for (const item of mbMap) {
            if (item.val) {
                updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(t => t.description !== item.desc)
                updatedTags.userDefinedText.push({ description: item.desc, value: item.val })
            }
        }
    }

    // Write tags back to file
    const success = NodeID3.write(updatedTags, filePath)

    if (!success) {
        throw new Error('Failed to write ID3 tags')
    }
}

/**
 * Read rating and loved status from audio file
 * 
 * @param filePath - Path to audio file
 * @returns Object with rating (0-5) and loved (boolean)
 */
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

/**
 * Read metadata from FLAC file
 */
async function readFLACMetadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
    const metadata = await parseFile(filePath)

    // Try to read FMPS_RATING tag
    const fmpsRating = metadata.native?.vorbis?.find((tag) => tag.id === 'FMPS_RATING')?.value as
        | string
        | undefined
    const lovedTag = metadata.native?.vorbis?.find((tag) => tag.id === 'LOVED')?.value as
        | string
        | undefined

    const rating = fmpsRating ? parseFloat(fmpsRating) * 5 : 0
    const loved = lovedTag === '1'

    return { rating, loved }
}

/**
 * Read metadata from MP3 file
 */
async function readMP3Metadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
    const tags = NodeID3.read(filePath)

    const popmRating = tags.popularimeter?.rating || 0
    const rating = (popmRating / 255) * 5

    const loved = tags.userDefinedText?.find(t => t.description === 'LOVED')?.value === '1'

    return { rating, loved }
}

/**
 * Check if metaflac is available (required for FLAC support)
 */
export async function checkMetaflacAvailable(): Promise<boolean> {
    try {
        await execAsync('metaflac --version')
        return true
    } catch {
        return false
    }
}
