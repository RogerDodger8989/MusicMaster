// @ts-ignore
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

/**
 * Write rating and loved status to audio file
 * 
 * FLAC: Uses FMPS_RATING (0.0-1.0) and custom LOVED tag
 * MP3: Uses POPM frame (Popularimeter) with rating 0-255
 * 
 * @param filePath - Path to audio file
 * @param rating - Rating from 0-5 (supports 0.5 increments)
 * @param loved - Whether track is loved/favorited
 */
export async function writeMetadata(
    filePath: string,
    rating: number,
    loved: boolean
): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()

    try {
        if (ext === '.flac') {
            await writeFLACMetadata(filePath, rating, loved)
        } else if (ext === '.mp3') {
            await writeMP3Metadata(filePath, rating, loved)
        } else {
            throw new Error(`Unsupported file format: ${ext}`)
        }

        console.log(`✅ Wrote metadata to ${filePath}: rating=${rating}, loved=${loved}`)
    } catch (error) {
        console.error(`❌ Failed to write metadata to ${filePath}:`, error)
        throw error
    }
}

/**
 * Write metadata to FLAC file using metaflac command-line tool
 * 
 * Uses FMPS_RATING tag (MusicBee/foobar2000 compatible)
 * Scale: 0.0 = 0 stars, 0.2 = 1 star, 0.4 = 2 stars, 0.6 = 3 stars, 0.8 = 4 stars, 1.0 = 5 stars
 */
async function writeFLACMetadata(filePath: string, rating: number, loved: boolean): Promise<void> {
    // Convert 0-5 rating to 0.0-1.0 scale
    const fmpsRating = (rating / 5).toFixed(2)

    // Remove existing tags
    await execAsync(`metaflac --remove-tag=FMPS_RATING "${filePath}"`)
    await execAsync(`metaflac --remove-tag=FMPS_RATING_USER "${filePath}"`)
    await execAsync(`metaflac --remove-tag=RATING "${filePath}"`)
    await execAsync(`metaflac --remove-tag=LOVED "${filePath}"`)

    // Set new tags
    await execAsync(`metaflac --set-tag=FMPS_RATING=${fmpsRating} "${filePath}"`)
    await execAsync(`metaflac --set-tag=RATING=${rating} "${filePath}"`)
    await execAsync(`metaflac --set-tag=FMPS_RATING_USER=MusicMaster "${filePath}"`)

    if (loved) {
        await execAsync(`metaflac --set-tag=LOVED=1 "${filePath}"`)
    }
}

async function writeMP3Metadata(filePath: string, rating: number, loved: boolean): Promise<void> {
    // Convert 0-5 rating to 0-255 scale
    const popmRating = Math.round((rating / 5) * 255)

    // Read existing tags
    const tags = NodeID3.read(filePath)

    // Update POPM frame and userDefinedText for LOVED (Mirroring MusicWest)
    const updatedTags: NodeID3.Tags = {
        ...tags,
        popularimeter: {
            email: 'MusicWest', // Align email too
            rating: popmRating,
            counter: 0
        },
        userDefinedText: [
            ...(tags.userDefinedText?.filter(t => t.description !== 'LOVED') || []),
            {
                description: 'LOVED',
                value: loved ? '1' : '0'
            }
        ]
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
