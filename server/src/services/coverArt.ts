// @ts-ignore
import { parseFile } from 'music-metadata'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

// Use environment variable or local data directory
const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data')
const COVER_CACHE_DIR = path.join(DATA_PATH, 'covers')

// Common cover art filenames
const COVER_FILENAMES = [
    'cover.jpg',
    'cover.jpeg',
    'cover.png',
    'folder.jpg',
    'folder.jpeg',
    'folder.png',
    'album.jpg',
    'album.jpeg',
    'album.png',
    'front.jpg',
    'front.jpeg',
    'front.png',
    'Cover.jpg',
    'Folder.jpg',
    'Album.jpg'
]

/**
 * Initialize cover cache directory
 */
export async function initCoverCache(): Promise<void> {
    try {
        await fs.mkdir(COVER_CACHE_DIR, { recursive: true })
        console.log('✅ Cover cache directory initialized:', COVER_CACHE_DIR)
    } catch (error) {
        console.error('Failed to create cover cache directory:', error)
    }
}

/**
 * Extract cover art from audio file or folder
 * Returns path to cached cover image
 */
export async function extractCoverArt(
    filePath: string,
    albumId: string
): Promise<string | null> {
    try {
        // Check if cover already cached
        const cachedPath = path.join(COVER_CACHE_DIR, `${albumId}.jpg`)
        if (existsSync(cachedPath)) {
            return cachedPath
        }

        // Try to extract from embedded tags first
        const embeddedCover = await extractEmbeddedCover(filePath, albumId)
        if (embeddedCover) {
            return embeddedCover
        }

        // Try to find cover in folder
        const folderCover = await findFolderCover(filePath, albumId)
        if (folderCover) {
            return folderCover
        }

        return null
    } catch (error) {
        console.error('Error extracting cover art:', error)
        return null
    }
}

/**
 * Extract embedded cover art from audio file
 */
async function extractEmbeddedCover(
    filePath: string,
    albumId: string
): Promise<string | null> {
    try {
        const metadata = await parseFile(filePath)

        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0]
            const coverPath = path.join(COVER_CACHE_DIR, `${albumId}.jpg`)

            // Write cover to cache
            await fs.writeFile(coverPath, picture.data)

            console.log(`✅ Extracted embedded cover for album ${albumId}`)
            return coverPath
        }

        return null
    } catch (error) {
        console.error('Error extracting embedded cover:', error)
        return null
    }
}

/**
 * Find cover art in the same folder as the audio file
 */
async function findFolderCover(filePath: string, albumId: string): Promise<string | null> {
    try {
        const folderPath = path.dirname(filePath)

        // Check for common cover filenames
        for (const filename of COVER_FILENAMES) {
            const coverPath = path.join(folderPath, filename)

            if (existsSync(coverPath)) {
                // Copy to cache
                const cachedPath = path.join(COVER_CACHE_DIR, `${albumId}.jpg`)
                await fs.copyFile(coverPath, cachedPath)

                console.log(`✅ Found folder cover for album ${albumId}: ${filename}`)
                return cachedPath
            }
        }

        return null
    } catch (error) {
        console.error('Error finding folder cover:', error)
        return null
    }
}

/**
 * Get cover art path for album
 * Returns cached path if exists, null otherwise
 */
export function getCoverArtPath(albumId: string): string | null {
    const cachedPath = path.join(COVER_CACHE_DIR, `${albumId}.jpg`)
    return existsSync(cachedPath) ? cachedPath : null
}

/**
 * Delete cover art from cache
 */
export async function deleteCoverArt(albumId: string): Promise<void> {
    try {
        const cachedPath = path.join(COVER_CACHE_DIR, `${albumId}.jpg`)
        if (existsSync(cachedPath)) {
            await fs.unlink(cachedPath)
            console.log(`✅ Deleted cover art for album ${albumId}`)
        }
    } catch (error) {
        console.error('Error deleting cover art:', error)
    }
}
