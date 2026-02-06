import fs from 'fs'
import path from 'path'
// @ts-ignore
import { parseFile } from 'music-metadata'
import { EventEmitter } from 'events'
import chokidar, { FSWatcher } from 'chokidar'
import { upsertTrack, deleteTrackByPath } from './database/tracks'
import { updateFolderLastScanned, updateFolderTrackCount } from './database/folders'
import { aggregateAlbums } from './database/albums'
import type { ScanProgress } from './types'

export class MusicScanner extends EventEmitter {
    private watchers: Map<string, FSWatcher> = new Map()
    private isScanning = false
    private scanProgress: ScanProgress = {
        isScanning: false,
        totalFiles: 0,
        scannedFiles: 0,
        currentFile: '',
        errors: []
    }

    /**
     * Scan a music folder
     */
    async scanFolder(folderId: string, folderPath: string): Promise<void> {
        if (this.isScanning) {
            throw new Error('A scan is already in progress')
        }

        this.isScanning = true
        this.scanProgress = {
            isScanning: true,
            totalFiles: 0,
            scannedFiles: 0,
            currentFile: '',
            errors: []
        }

        this.emit('progress', this.scanProgress)

        try {
            // Find all music files
            const musicFiles = await this.findMusicFiles(folderPath)
            this.scanProgress.totalFiles = musicFiles.length

            console.log(`Found ${musicFiles.length} music files in ${folderPath} `)

            // Process each file
            for (const filePath of musicFiles) {
                try {
                    await this.processFile(folderId, filePath)
                    this.scanProgress.scannedFiles++
                    this.scanProgress.currentFile = path.basename(filePath)
                    this.emit('progress', this.scanProgress)
                } catch (error) {
                    const errorMsg = `Error processing ${filePath}: ${error} `
                    console.error(errorMsg)
                    this.scanProgress.errors.push(errorMsg)
                }
            }

            // Update folder metadata
            updateFolderLastScanned(folderId)
            updateFolderTrackCount(folderId)

            console.log(`Scan complete: ${this.scanProgress.scannedFiles}/${this.scanProgress.totalFiles} files processed`)
        } finally {
            this.isScanning = false
            this.scanProgress.isScanning = false

            // Re-aggregate albums
            try {
                console.log('🔄 Triggering album aggregation...')
                await aggregateAlbums()
            } catch (error) {
                console.error('Error aggregating albums:', error)
            }

            this.emit('progress', this.scanProgress)
            this.emit('complete', this.scanProgress)
        }
    }

    /**
     * Start watching a folder for changes
     */
    startWatching(folderId: string, folderPath: string): void {
        if (this.watchers.has(folderId)) {
            console.log(`Already watching folder: ${folderPath}`)
            return
        }

        console.log(`Starting file watcher for: ${folderPath}`)

        const watcher = chokidar.watch(folderPath, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            depth: 99,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        })

        watcher
            .on('add', async (filePath) => {
                if (this.isMusicFile(filePath)) {
                    console.log(`File added: ${filePath}`)
                    try {
                        await this.processFile(folderId, filePath)
                        updateFolderTrackCount(folderId)
                        this.emit('fileAdded', filePath)
                    } catch (error) {
                        console.error(`Error processing added file: ${error}`)
                    }
                }
            })
            .on('change', async (filePath) => {
                if (this.isMusicFile(filePath)) {
                    console.log(`File changed: ${filePath}`)
                    try {
                        await this.processFile(folderId, filePath)
                        this.emit('fileChanged', filePath)
                    } catch (error) {
                        console.error(`Error processing changed file: ${error}`)
                    }
                }
            })
            .on('unlink', (filePath) => {
                if (this.isMusicFile(filePath)) {
                    console.log(`File removed: ${filePath}`)
                    deleteTrackByPath(filePath)
                    updateFolderTrackCount(folderId)
                    this.emit('fileRemoved', filePath)
                }
            })
            .on('error', (error) => {
                console.error(`Watcher error: ${error}`)
            })

        this.watchers.set(folderId, watcher)
    }

    /**
     * Stop watching a folder
     */
    async stopWatching(folderId: string): Promise<void> {
        const watcher = this.watchers.get(folderId)
        if (watcher) {
            await watcher.close()
            this.watchers.delete(folderId)
            console.log(`Stopped watching folder: ${folderId}`)
        }
    }

    /**
     * Stop all watchers
     */
    async stopAllWatchers(): Promise<void> {
        for (const [folderId, watcher] of this.watchers) {
            await watcher.close()
            console.log(`Stopped watching folder: ${folderId}`)
        }
        this.watchers.clear()
    }

    /**
     * Find all music files in a directory recursively
     */
    private async findMusicFiles(dirPath: string): Promise<string[]> {
        const musicFiles: string[] = []

        const scanDir = async (currentPath: string): Promise<void> => {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name)

                if (entry.isDirectory()) {
                    await scanDir(fullPath)
                } else if (entry.isFile() && this.isMusicFile(fullPath)) {
                    musicFiles.push(fullPath)
                }
            }
        }

        await scanDir(dirPath)
        return musicFiles
    }

    /**
     * Check if a file is a music file
     */
    private isMusicFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase()
        return ext === '.flac' || ext === '.mp3'
    }

    /**
     * Process a single music file
     */
    /**
     * Process a single music file
     */
    private async processFile(folderId: string, filePath: string): Promise<void> {
        try {
            // Parse metadata
            const metadata = await parseFile(filePath)

            // Extract rating and loved status from metadata
            let rating = 0
            let loved = false

            if (metadata.common.rating && metadata.common.rating.length > 0) {
                const ratingObj = metadata.common.rating[0]
                const rawRating = ratingObj.rating || 0

                if (rawRating > 1) {
                    const max = rawRating > 100 ? 255 : 100
                    rating = Math.round((rawRating / max) * 5)
                    console.log(`[Scanner] ${path.basename(filePath)} Raw rating ${rawRating} (scale ${max}) -> ${rating} stars`)
                } else {
                    rating = Math.round(rawRating * 5)
                    console.log(`[Scanner] ${path.basename(filePath)} Normalized rating ${rawRating} -> ${rating} stars`)
                }

                if (ratingObj.source?.toLowerCase().includes('loved') ||
                    ratingObj.source?.toLowerCase().includes('heart')) {
                    loved = true
                }
            } else {
                // console.log(`[Scanner] ${path.basename(filePath)} No common rating found`)
            }

            // Fallback: check custom tags like LOVED or HEART (mostly for FLAC)
            if (!loved) {
                const nativeLoved = metadata.native?.vorbis?.find(t => ['LOVED', 'HEART', 'FAVORITE'].includes(t.id.toUpperCase()))
                if (nativeLoved) {
                    const val = nativeLoved.value.toString().toLowerCase()
                    loved = (val === '1' || val === 'true' || val === 'yes')
                    console.log(`[Scanner] ${path.basename(filePath)} Loved from native tag: ${loved}`)
                }
            }

            // Extract release date (prefer ORIGINALDATE, fallback to DATE, then YEAR)
            let releaseDate: string | undefined
            if (metadata.common.originaldate) {
                releaseDate = metadata.common.originaldate
            } else if (metadata.common.date) {
                releaseDate = metadata.common.date
            }

            // Extract MusicBrainz IDs
            const musicbrainzTrackId = metadata.common.musicbrainz_trackid
            const musicbrainzAlbumId = metadata.common.musicbrainz_albumid

            // Upsert track to database
            const albumName = (metadata.common.album || 'Unknown Album').trim()
            const artistName = (metadata.common.artists?.join(', ') || metadata.common.artist || 'Unknown Artist').trim()
            const albumArtistName = metadata.common.albumartist?.trim()

            upsertTrack({
                folderId,
                filePath,
                fileHash: undefined,
                title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
                artist: artistName,
                album: albumName,
                albumArtist: albumArtistName,
                year: metadata.common.year,
                genre: metadata.common.genre?.join('; '),
                trackNum: metadata.common.track.no || undefined,
                discNum: metadata.common.disk.no || undefined,
                duration: Math.round(metadata.format.duration || 0),
                bitrate: Math.round(metadata.format.bitrate || 0),
                sampleRate: metadata.format.sampleRate,
                bitDepth: metadata.format.bitsPerSample,
                format: path.extname(filePath).toLowerCase() === '.flac' ? 'flac' : 'mp3',
                coverArtPath: undefined,
                rating,
                loved,
                releaseDate,
                musicbrainzTrackId,
                musicbrainzAlbumId
            })
        } catch (error) {
            console.error(`Failed to process file ${filePath}:`, error)
            // Don't throw, just log error so scan generates report
            this.scanProgress.errors.push(`${path.basename(filePath)}: ${(error as Error).message}`)
        }
    }

    /**
     * Get current scan progress
     */
    getScanProgress(): ScanProgress {
        return { ...this.scanProgress }
    }
}

// Export singleton instance
export const musicScanner = new MusicScanner()
