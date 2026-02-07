import { ipcMain, dialog } from 'electron'
import { randomUUID } from 'crypto'
import { musicScanner } from './scanner'
import { initDatabase, getDatabase, DbPlaybackState } from './database'
import {
    getAllMusicFolders,
    addMusicFolder,
    removeMusicFolder,
    updateFolderWatchStatus
} from './database/folders'
import {
    getAllTracks,
    getTrackById,
    updateTrackRating,
    updateTrackLoved,
    getTracksByAlbum,
    dbTrackToTrack,
    addScrobbleToQueue,
    getPendingScrobbles,
    markScrobbleSubmitted,
    recordPlayHistory,
    getTrackPlayCount
} from './database/tracks'
import {
    aggregateAlbums,
    getAllAlbums,
    getAlbumsByGenre,
    getAllGenres,
    getAlbumsSortedBy,
    getAlbumById,
    updateAlbumRating,
    updateAlbumLoved,
    updateAlbumBio
} from './database/albums'
import { getAllArtists, updateArtistLoved } from './database/artists'
import { lastFmService } from './services/lastfm'
import { listenBrainzService } from './services/listenbrainz'
import { writeMetadata } from './services/metadataWriter'
import { searchLibrary } from './database/search'
import path from 'path'

import fs from 'fs'

export function registerIpcHandlers(): void {
    const logPath = path.join(process.cwd(), 'debug-ipc.log')
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] Starting IPC handler registration...\n`)

    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Initializing database...\n`)
        initDatabase()
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Database initialized\n`)

        // Start watchers for folders that have watch enabled
        try {
            const folders = getAllMusicFolders()
            folders
                .filter((folder) => folder.watchEnabled)
                .forEach((folder) => {
                    musicScanner.startWatching(folder.id, folder.path)
                })
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Watchers restored on startup\n`)
        } catch (error) {
            console.error('Failed to restore watchers on startup:', error)
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Failed to restore watchers on startup\n`)
        }


        // Music Folders
        console.log('📁 Registering folder handlers...')

        ipcMain.handle('folders:getAll', async () => {
            console.log('📂 Getting all folders...')
            return getAllMusicFolders()
        })

        ipcMain.handle('folders:add', async (_, folderPath: string, watchEnabled: boolean) => {
            console.log('➕ Adding folder:', folderPath, 'Watch:', watchEnabled)
            const folder = addMusicFolder(folderPath, watchEnabled)

            // Start watching if enabled
            if (watchEnabled) {
                musicScanner.startWatching(folder.id, folder.path)
            }

            console.log('✅ Folder added:', folder.id)
            return folder
        })

        ipcMain.handle('folders:remove', async (_, folderId: string) => {
            console.log('🗑️ Removing folder:', folderId)
            // Stop watching if active
            await musicScanner.stopWatching(folderId)

            // Remove from database
            removeMusicFolder(folderId)

            // Re-aggregate albums to clear orphan cache entries
            console.log('🔄 Re-aggregating albums after folder removal...')
            await aggregateAlbums()

            console.log('✅ Folder removed')
        })

        ipcMain.handle('folders:updateWatch', async (_, folderId: string, watchEnabled: boolean) => {
            console.log('👁️ Updating watch status:', folderId, watchEnabled)
            updateFolderWatchStatus(folderId, watchEnabled)

            // Get folder path
            const folders = getAllMusicFolders()
            const folder = folders.find((f) => f.id === folderId)

            if (folder) {
                if (watchEnabled) {
                    musicScanner.startWatching(folderId, folder.path)
                } else {
                    await musicScanner.stopWatching(folderId)
                }
            }
            console.log('✅ Watch status updated')
        })

        ipcMain.handle('folders:browse', async () => {
            console.log('📂 Opening folder browser dialog...')
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            })

            if (result.canceled || result.filePaths.length === 0) {
                console.log('❌ Folder selection canceled')
                return null
            }

            console.log('✅ Folder selected:', result.filePaths[0])
            return result.filePaths[0]
        })

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Folder handlers registered\n`)

        // Scanner
        console.log('🔍 Registering scanner handlers...')

        ipcMain.handle('scanner:start', async (_, folderId: string, folderPath: string) => {
            console.log('🎵 Starting scan:', folderPath)
            try {
                await musicScanner.scanFolder(folderId, folderPath)
                console.log('✅ Scan complete')
            } catch (error) {
                console.error('❌ Scan error:', error)
                throw error
            }
        })

        ipcMain.handle('scanner:getProgress', async () => {
            return musicScanner.getScanProgress()
        })

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Scanner handlers registered\n`)

        // Tracks
        console.log('🎵 Registering track handlers...')

        ipcMain.handle('tracks:getAll', async () => {
            console.log('📋 Getting all tracks...')
            return getAllTracks()
        })

        ipcMain.handle('tracks:getTracksByAlbum', async (_, name: string, artist: string) => {
            console.log(`📋 GET TRACKS: "${name}" by "${artist}"`)
            const tracks = getTracksByAlbum(name, artist)
            console.log(`   Found ${tracks.length} tracks`)
            return tracks
        })

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Track handlers registered\n`)

        // Scanner events - forward to renderer
        console.log('📡 Setting up scanner event forwarding...')

        musicScanner.on('progress', (progress) => {
            // Send to all windows
            const windows = require('electron').BrowserWindow.getAllWindows()
            windows.forEach((win) => {
                win.webContents.send('scanner:progress', progress)
            })
        })

        musicScanner.on('complete', (progress) => {
            const windows = require('electron').BrowserWindow.getAllWindows()
            windows.forEach((win) => {
                win.webContents.send('scanner:complete', progress)
            })
        })

        musicScanner.on('fileAdded', (filePath) => {
            const windows = require('electron').BrowserWindow.getAllWindows()
            windows.forEach((win) => {
                win.webContents.send('scanner:fileAdded', filePath)
            })
        })

        musicScanner.on('fileChanged', (filePath) => {
            const windows = require('electron').BrowserWindow.getAllWindows()
            windows.forEach((win) => {
                win.webContents.send('scanner:fileChanged', filePath)
            })
        })

        musicScanner.on('fileRemoved', (filePath) => {
            const windows = require('electron').BrowserWindow.getAllWindows()
            windows.forEach((win) => {
                win.webContents.send('scanner:fileRemoved', filePath)
            })
        })

        // Albums
        console.log('💿 Registering album handlers...')

        ipcMain.handle('albums:aggregate', async () => {
            console.log('🔄 Aggregating albums...')
            await aggregateAlbums()
            return true
        })

        ipcMain.handle('albums:getAll', async () => {
            return getAllAlbums()
        })

        ipcMain.handle('albums:getByGenre', async (_, genre: string) => {
            return getAlbumsByGenre(genre)
        })

        ipcMain.handle('albums:getGenres', async () => {
            return getAllGenres()
        })

        ipcMain.handle('albums:getSorted', async (_, sortBy: any) => {
            return getAlbumsSortedBy(sortBy)
        })

        ipcMain.handle('albums:getById', async (_, id: string) => {
            const album = getAlbumById(id)

            // If album has no bio, try to fetch it from Last.fm
            if (album && !album.bio) {
                console.log(`📖 Bio missing for album ${album.name}, fetching from Last.fm...`)
                try {
                    const info = await lastFmService.getAlbumInfo(album.artist, album.name)
                    if (info && info.wiki && info.wiki.content) {
                        const bio = info.wiki.content
                        updateAlbumBio(id, bio)
                        album.bio = bio
                        console.log('✅ Bio fetched and cached')
                    }
                } catch (error) {
                    console.error('❌ Failed to fetch album bio:', error)
                }
            }

            return album
        })

        ipcMain.handle('albums:rate', async (_, id: string, rating: number) => {
            console.log(`⭐ Rating album ${id}: ${rating}`)
            try {
                // 1. Update album cache
                updateAlbumRating(id, rating)

                // 2. Propagate to ALL tracks in this album and write to tags
                const album = getAlbumById(id)
                if (album) {
                    const albumTracks = getTracksByAlbum(album.name, album.artist)
                    console.log(`   Propagating rating ${rating} to ${albumTracks.length} tracks...`)

                    for (const track of albumTracks) {
                        updateTrackRating(track.id, rating)
                        // Write to file tag
                        await writeMetadata(track.filePath, rating, track.loved)
                    }
                }
            } catch (error) {
                console.error('❌ Failed to rate album and propagate to tags:', error)
                throw error
            }
        })

        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Album handlers registered\n`)

        // Cover Art
        console.log('🖼️ Registering cover art handlers...')

        ipcMain.handle('tracks:getCoverBufferByAlbum', async (_, albumId: string) => {
            try {
                const db = getDatabase()
                const album = db.prepare('SELECT name, artist FROM albums_cache WHERE id = ?').get(albumId) as { name: string, artist: string } | undefined

                if (!album) return null

                // Using COALESCE logic to match how we group in aggregateAlbums
                const track = db.prepare(`
                    SELECT file_path FROM tracks 
                    WHERE COALESCE(NULLIF(album, ''), 'Unknown Album') = ? 
                    AND COALESCE(album_artist, artist, 'Unknown Artist') = ?
                    LIMIT 1
                `).get(album.name, album.artist) as { file_path: string } | undefined

                if (!track) return null

                const { parseFile } = require('music-metadata')
                const metadata = await parseFile(track.file_path)
                if (metadata.common.picture && metadata.common.picture.length > 0) {
                    const pic = metadata.common.picture[0]
                    return {
                        data: pic.data,
                        format: pic.format
                    }
                }
                return null
            } catch (error) {
                console.error('Failed to get cover buffer by album:', error)
                return null
            }
        })

        console.log('✅ Cover art handlers registered')

        // Ratings & Metadata
        console.log('⭐ Registering metadata handlers...')

        ipcMain.handle('tracks:rate', async (_, trackId: string, filePath: string, rating: number) => {
            console.log(`⭐ Rating track ${trackId} (${path.basename(filePath)}): ${rating}`)
            try {
                // 1. Get current track to retrieve 'loved' status
                const track = getTrackById(trackId)
                if (!track) throw new Error('Track not found')

                // 2. Update DB
                updateTrackRating(trackId, rating)

                // 3. Write to file (best effort)
                await writeMetadata(filePath, rating, track.loved, track.playCount)
                console.log('✅ Rating and metadata written to file')
                return true
            } catch (error) {
                console.error('❌ Failed to rate track:', error)
                throw error
            }
        })

        // Revised track rating handler that handles file writing correctly
        ipcMain.handle('tracks:updateMetadata', async (_, trackId: string, filePath: string, rating: number, loved: boolean) => {
            console.log(`📝 Updating metadata for ${path.basename(filePath)}: Rating=${rating}, Loved=${loved}`)
            try {
                // 1. Update Database
                updateTrackRating(trackId, rating)
                updateTrackLoved(trackId, loved)

                // 2. Write to file (Best effort)
                await writeMetadata(filePath, rating, loved)
                console.log('✅ Metadata written to file')
                return true
            } catch (error) {
                console.error('❌ Failed to write metadata to file:', error)
                // We still updated the DB, so maybe return success with warning?
                // Or throw to let UI know file write failed.
                throw error
            }
        })

        console.log('✅ Metadata handlers registered')

        ipcMain.handle('library:search', async (_, query: string) => {
            console.log(`🔍 Searching library for: ${query}`)
            return searchLibrary(query)
        })

        ipcMain.handle('library:reanalyze', async () => {
            console.log('🔄 Full Library Re-analysis requested...')
            const folders = getAllMusicFolders()
            if (folders.length === 0) {
                console.log('⚠️ No folders found to re-scan. Aggregating only.')
                await aggregateAlbums()
                return
            }

            for (const folder of folders) {
                console.log(`🚀 Starting re-scan of: ${folder.path}`)
                // Start scan (async)
                await musicScanner.scanFolder(folder.id, folder.path)
            }
            console.log('✅ Full re-analysis complete')
        })

        // REMOVED: library:reset function - was destroying all ratings and library data destructively!
        // Use library rebuilding instead to preserve user ratings and metadata

        ipcMain.handle('library:getArtists', async () => {
            console.log('👤 Getting all artists...')
            return getAllArtists()
        })

        ipcMain.handle('library:toggleAlbumLoved', async (_, albumId: string) => {
            console.log(`❤️ Toggling loved for album: ${albumId}`)
            try {
                const album = getAlbumById(albumId)
                if (album) {
                    const newLoved = !album.loved
                    updateAlbumLoved(albumId, newLoved)

                    // Propagate to all tracks
                    const albumTracks = getTracksByAlbum(album.name, album.artist)
                    console.log(`   Propagating loved=${newLoved} to ${albumTracks.length} tracks...`)

                    for (const track of albumTracks) {
                        updateTrackLoved(track.id, newLoved)
                        // Write to file tag
                        await writeMetadata(track.filePath, track.rating, newLoved)
                    }
                }
            } catch (error) {
                console.error('❌ Failed to toggle album loved and propagate to tags:', error)
                throw error
            }
        })

        ipcMain.handle('library:toggleArtistLoved', async (_, artistId: string, loved: boolean) => {
            console.log(`❤️ Toggling loved for artist ${artistId}: ${loved}`)
            try {
                updateArtistLoved(artistId, loved)
                return true
            } catch (error) {
                console.error('❌ Failed to toggle artist loved:', error)
                throw error
            }
        })

        ipcMain.handle('library:getSimilarArtists', async (_, artist: string) => {
            console.log(`👥 Fetching similar artists for: ${artist}`)
            try {
                return await lastFmService.getSimilarArtists(artist)
            } catch (error) {
                console.error('❌ Failed to get similar artists:', error)
                return []
            }
        })

        ipcMain.handle('util:openExternal', async (_, url: string) => {
            const { shell } = require('electron')
            await shell.openExternal(url)
        })

        ipcMain.handle('util:showItemInFolder', async (_, filePath: string) => {
            const { shell } = require('electron')
            shell.showItemInFolder(filePath)
        })

        // Settings Persistence
        ipcMain.handle('settings:getAll', async () => {
            console.log('⚙️ Getting all settings...')
            const db = getDatabase()
            const rows = db.prepare('SELECT setting_key, setting_value FROM user_settings').all() as { setting_key: string, setting_value: string }[]
            const settings: Record<string, any> = {}
            rows.forEach(row => {
                try {
                    settings[row.setting_key] = JSON.parse(row.setting_value)
                } catch {
                    settings[row.setting_key] = row.setting_value
                }
            })
            return settings
        })

        ipcMain.handle('settings:save', async (_, key: string, value: any) => {
            console.log(`⚙️ Saving setting: ${key}`)
            const db = getDatabase()
            const stringValue = JSON.stringify(value)
            db.prepare(`
                INSERT INTO user_settings (id, setting_key, setting_value)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
            `).run(randomUUID(), key, stringValue)
            return true
        })

        // Playback Session Persistence
        ipcMain.handle('player:loadSession', async () => {
            console.log('🎵 Loading playback session...')
            const db = getDatabase()
            const row = db.prepare('SELECT * FROM playback_state WHERE id = ?').get('default') as DbPlaybackState | undefined
            if (!row) return null

            // Get the actual tracks for the queue
            let queue: any[] = []
            if (row.queue_ids) {
                try {
                    const ids = JSON.parse(row.queue_ids) as string[]
                    if (ids.length > 0) {
                        const placeholders = ids.map(() => '?').join(',')
                        const tracks = db.prepare(`SELECT * FROM tracks WHERE id IN (${placeholders})`).all(...ids)
                        // Preserve order
                        queue = ids.map(id => tracks.find((t: any) => t.id === id)).filter(Boolean)
                        // Convert DB tracks to frontend Track type
                        queue = queue.map(dbTrackToTrack)
                    }
                } catch (e) {
                    console.error('Failed to parse queue IDs:', e)
                }
            }

            return {
                currentTrackId: row.current_track_id,
                currentIndex: row.current_index,
                queue,
                volume: row.volume,
                isShuffle: row.is_shuffle === 1,
                repeatMode: row.repeat_mode,
                currentTime: row.current_time
            }
        })

        ipcMain.handle('player:saveSession', async (_, session: any) => {
            console.log('🎵 Saving playback session...')
            const db = getDatabase()
            const queueIds = JSON.stringify(session.queueIds || [])
            db.prepare(`
                INSERT INTO playback_state (id, current_track_id, queue_ids, current_index, volume, is_shuffle, repeat_mode, current_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    current_track_id = excluded.current_track_id,
                    queue_ids = excluded.queue_ids,
                    current_index = excluded.current_index,
                    volume = excluded.volume,
                    is_shuffle = excluded.is_shuffle,
                    repeat_mode = excluded.repeat_mode,
                    current_time = excluded.current_time,
                    updated_at = CURRENT_TIMESTAMP
            `).run(
                'default',
                session.currentTrackId || null,
                queueIds,
                session.currentIndex || -1,
                session.volume ?? 1.0,
                session.isShuffle ? 1 : 0,
                session.repeatMode || 'normal',
                session.currentTime || 0
            )
            return true
        })

        // Playlist Management
        ipcMain.handle('playlists:getAll', async () => {
            console.log('📜 Getting all playlists...')
            const db = getDatabase()
            const playlists = db.prepare('SELECT * FROM playlists ORDER BY updated_at DESC').all() as any[]

            for (const pl of playlists) {
                const tracks = db.prepare(`
                    SELECT t.* FROM tracks t
                    JOIN playlist_tracks pt ON t.id = pt.track_id
                    WHERE pt.playlist_id = ?
                    ORDER BY pt.position ASC
                `).all(pl.id) as any[]

                pl.tracks = tracks.map(dbTrackToTrack)
            }

            return playlists
        })

        ipcMain.handle('playlists:create', async (_, name: string, trackIds: string[]) => {
            console.log(`📜 Creating playlist: ${name}`)
            const db = getDatabase()
            const plId = randomUUID()

            const transaction = db.transaction(() => {
                db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(plId, name)

                const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)')
                trackIds.forEach((trackId, index) => {
                    insertTrack.run(randomUUID(), plId, trackId, index)
                })
            })

            transaction()
            return plId
        })

        ipcMain.handle('playlists:delete', async (_, id: string) => {
            console.log(`📜 Deleting playlist: ${id}`)
            const db = getDatabase()
            db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
            return true
        })

        ipcMain.handle('playlists:addTrack', async (_, playlistId: string, trackId: string) => {
            console.log(`📜 Adding track ${trackId} to playlist ${playlistId}`)
            const db = getDatabase()
            const row = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as { maxPos: number | null }
            const nextPos = (row?.maxPos ?? -1) + 1

            db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)')
                .run(randomUUID(), playlistId, trackId, nextPos)

            db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
            return true
        })

        ipcMain.handle('playlists:removeTrack', async (_, playlistId: string, trackId: string, position: number) => {
            console.log(`📜 Removing track from playlist ${playlistId} at position ${position}`)
            const db = getDatabase()

            const transaction = db.transaction(() => {
                db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? AND position = ?')
                    .run(playlistId, trackId, position)

                // Close gaps
                db.prepare(`
                    UPDATE playlist_tracks 
                    SET position = position - 1 
                    WHERE playlist_id = ? AND position > ?
                `).run(playlistId, position)

                db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
            })

            transaction()
            return true
        })

        ipcMain.handle('playlists:rename', async (_, id: string, name: string) => {
            console.log(`📜 Renaming playlist ${id} to ${name}`)
            const db = getDatabase()
            db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id)
            return true
        })

        // Scrobbling
        console.log('🎵 Registering scrobbling handlers...')

        ipcMain.handle('scrobble:recordPlay', async (_, trackId: string) => {
            console.log('▶️ Recording play:', trackId)
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] ▶️ Recording play: ${trackId}\n`)
            try {
                recordPlayHistory(trackId)

                // Get track details
                const track = getTrackById(trackId)

                if (track) {
                    // Update file metadata with new play count (best effort)
                    const newCount = getTrackPlayCount(trackId)
                    console.log(`📊 Updating PLAY_COUNT in file: ${newCount}`)
                    try {
                        await writeMetadata(track.filePath, track.rating, track.loved, newCount)
                    } catch (err) {
                        console.error('❌ Failed to write playCount to file tags:', err)
                    }

                    // Add to scrobble queue
                    const timestamp = Math.floor(Date.now() / 1000)
                    addScrobbleToQueue(trackId, track.artist, track.title, track.album, timestamp)
                    console.log('✅ Play recorded and added to scrobble queue')
                    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ✅ Play recorded for ${track.artist} - ${track.title}\n`)
                }
                return true
            } catch (error) {
                console.error('Failed to record play:', error)
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] ❌ Failed to record play: ${error}\n`)
                return false
            }
        })

        ipcMain.handle('scrobble:getPending', async () => {
            console.log('📋 Getting pending scrobbles...')
            try {
                const pending = getPendingScrobbles()
                console.log(`Found ${pending.length} pending scrobbles`)
                return pending
            } catch (error) {
                console.error('Failed to get pending scrobbles:', error)
                return []
            }
        })

        ipcMain.handle('scrobble:submitToLastFM', async (_, scrobbleId: string, sessionKey: string) => {
            console.log('📤 Submitting scrobble to Last.fm:', scrobbleId)
            try {
                const pending = getPendingScrobbles()
                const scrobble = pending.find(s => s.id === scrobbleId)

                if (!scrobble) {
                    console.warn('Scrobble not found:', scrobbleId)
                    return false
                }

                const success = await lastFmService.scrobble(
                    sessionKey,
                    scrobble.artist,
                    scrobble.title,
                    scrobble.playedAt,
                    scrobble.album || undefined
                )

                if (success) {
                    markScrobbleSubmitted(scrobbleId, 'lastfm')
                    console.log('✅ Scrobble submitted to Last.fm')
                }
                return success
            } catch (error) {
                console.error('Failed to submit scrobble to Last.fm:', error)
                return false
            }
        })

        ipcMain.handle('scrobble:submitToListenBrainz', async (_, scrobbleId: string) => {
            console.log('📤 Submitting scrobble to ListenBrainz:', scrobbleId)
            try {
                const pending = getPendingScrobbles()
                const scrobble = pending.find(s => s.id === scrobbleId)

                if (!scrobble) {
                    console.warn('Scrobble not found:', scrobbleId)
                    return false
                }

                const success = await listenBrainzService.submitListen(
                    {
                        artist_name: scrobble.artist,
                        track_name: scrobble.title,
                        release_name: scrobble.album || undefined
                    },
                    scrobble.playedAt
                )

                if (success) {
                    markScrobbleSubmitted(scrobbleId, 'listenbrainz')
                    console.log('✅ Scrobble submitted to ListenBrainz')
                }
                return success
            } catch (error) {
                console.error('Failed to submit scrobble to ListenBrainz:', error)
                return false
            }
        })

        ipcMain.handle('scrobble:getPlayCount', async (_, trackId: string) => {
            console.log('📊 Getting play count for track:', trackId)
            try {
                const count = getTrackPlayCount(trackId)
                return count
            } catch (error) {
                console.error('Failed to get play count:', error)
                return 0
            }
        })

        ipcMain.handle('scrobble:updateLastFmKey', async (_, key: string) => {
            console.log('🔑 Updating Last.fm API key')
            try {
                lastFmService.setApiKey(key)
                // Optionally save to database if you want persistence
                return true
            } catch (error) {
                console.error('Failed to update Last.fm key:', error)
                return false
            }
        })

        ipcMain.handle('scrobble:updateLastFmSecret', async (_, secret: string) => {
            console.log('🔑 Updating Last.fm API secret')
            try {
                lastFmService.setApiSecret(secret)
                return true
            } catch (error) {
                console.error('Failed to update Last.fm secret:', error)
                return false
            }
        })

        ipcMain.handle('scrobble:updateListenBrainzToken', async (_, token: string) => {
            console.log('🔑 Updating ListenBrainz token')
            try {
                listenBrainzService.setToken(token)
                // Optionally save to database if you want persistence
                return true
            } catch (error) {
                console.error('Failed to update ListenBrainz token:', error)
                return false
            }
        })

        // Last.fm authentication endpoints
        ipcMain.handle('scrobble:getLastFmAuthToken', async () => {
            console.log('🔐 Getting Last.fm auth token...')
            try {
                const result = await lastFmService.getAuthToken()
                if (result) {
                    console.log('✅ Auth token obtained, user must authorize at:', result.authUrl)
                }
                return result
            } catch (error) {
                console.error('Failed to get Last.fm auth token:', error)
                return null
            }
        })

        ipcMain.handle('scrobble:getLastFmSession', async (_, token: string) => {
            console.log('🔑 Exchanging Last.fm auth token for session key...')
            try {
                const sessionKey = await lastFmService.getSession(token)
                if (sessionKey) {
                    console.log('✅ Last.fm session obtained')
                }
                return sessionKey || null
            } catch (error) {
                console.error('Failed to get Last.fm session:', error)
                return null
            }
        })

        // Helper function to sync a single track's play count
        async function syncTrackPlayCount(trackId: string, lastfmUsername?: string, listenbrainzUsername?: string, writeToFile: boolean = false) {
            const db = getDatabase()
            const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any

            if (!track) {
                throw new Error('Track not found')
            }

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
            console.log(`🔍 SYNCING: "${track.artist}" - "${track.title}"`)
            console.log(`   Track ID: ${trackId}`)
            console.log(`   File: ${track.file_path}`)

            // Get local play count
            const localPlayCount = getTrackPlayCount(trackId)
            console.log(`📍 Local DB play count: ${localPlayCount}`)
            console.log(`📍 Track table play_count: ${track.play_count || 0}`)

            let lastfmPlayCount = 0
            let listenbrainzPlayCount = 0

            // Get Last.fm play count (if username provided)
            if (lastfmUsername) {
                console.log(`⚠️  Last.fm: Skipped (unreliable API)`)
            }

            // Get ListenBrainz play count (if username provided)
            if (listenbrainzUsername) {
                console.log(`🎧 Fetching from ListenBrainz...`)
                console.log(`   Username: ${listenbrainzUsername}`)
                console.log(`   Artist: "${track.artist}"`)
                console.log(`   Title: "${track.title}"`)
                try {
                    listenbrainzPlayCount = await listenBrainzService.getTrackPlayCount(
                        listenbrainzUsername,
                        track.artist,
                        track.title
                    )
                    console.log(`📊 ListenBrainz returned: ${listenbrainzPlayCount}`)
                } catch (error) {
                    console.error('❌ Failed to get ListenBrainz play count:', error)
                }
            } else {
                console.log(`⚠️  ListenBrainz: No username provided`)
            }

            // Choose highest value
            // CRITICAL: Must include track.play_count to avoid resetting imported/synced counts
            const dbPlayCount = track.play_count || 0
            const maxPlayCount = Math.max(dbPlayCount, localPlayCount, lastfmPlayCount, listenbrainzPlayCount)

            console.log(`\n📊 FINAL RESULTS:`)
            console.log(`   DB (Master):  ${dbPlayCount}`)
            console.log(`   Local Hist:   ${localPlayCount}`)
            console.log(`   Last.fm:      ${lastfmPlayCount}`)
            console.log(`   ListenBrainz: ${listenbrainzPlayCount}`)
            console.log(`   → CHOSEN:     ${maxPlayCount}`)

            // Update database
            console.log(`💾 Writing to database: play_count = ${maxPlayCount}`)
            const result = db.prepare('UPDATE tracks SET play_count = ? WHERE id = ?').run(maxPlayCount, trackId)
            console.log(`   Changes made: ${result.changes}`)

            // Verify it was saved
            const verifyTrack = db.prepare('SELECT play_count FROM tracks WHERE id = ?').get(trackId) as any
            console.log(`✅ Verified in DB: play_count = ${verifyTrack?.play_count}`)

            // Write to file metadata (optional, slow for large collections)
            if (writeToFile) {
                console.log(`📝 Writing to file: rating=${track.rating}, loved=${track.loved === 1}, playCount=${maxPlayCount}`)
                try {
                    await writeMetadata(track.file_path, track.rating || 0, track.loved === 1, maxPlayCount)
                    console.log(`✅ File write successful`)
                } catch (error) {
                    console.error('❌ Failed to write metadata to file:', error)
                }
            } else {
                console.log(`⏭️  Skipping file write (writeToFile=false)`)
            }
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

            return {
                trackId,
                playCount: maxPlayCount,
                sources: { local: localPlayCount, lastfm: lastfmPlayCount, listenbrainz: listenbrainzPlayCount }
            }
        }

        // Play count sync handlers
        ipcMain.handle('scrobble:syncPlayCount', async (_event, trackId: string, lastfmUsername?: string, listenbrainzUsername?: string) => {
            console.log('🔄 Syncing play count for track:', trackId)
            try {
                const result = await syncTrackPlayCount(trackId, lastfmUsername, listenbrainzUsername)
                console.log('✅ Play count synced')
                return result
            } catch (error) {
                console.error('❌ Failed to sync play count:', error)
                throw error
            }
        })

        // Bulk sync all tracks with progress updates
        ipcMain.handle('scrobble:syncAllPlayCounts', async (event, lastfmUsername?: string, listenbrainzUsername?: string, writeToFile: boolean = false) => {
            console.log(`🔄 Syncing play counts for all tracks... (writeToFile: ${writeToFile})`)
            console.log(`📝 Last.fm username: "${lastfmUsername || 'NOT SET'}"`)
            console.log(`📝 ListenBrainz username: "${listenbrainzUsername || 'NOT SET'}"`)
            try {
                const tracks = getAllTracks()
                let syncedCount = 0
                const errors: string[] = []

                for (let i = 0; i < tracks.length; i++) {
                    const track = tracks[i]

                    // Send progress update
                    event.sender.send('scrobble:syncProgress', {
                        current: i + 1,
                        total: tracks.length,
                        trackName: `${track.artist} - ${track.title}`,
                        percentage: Math.round(((i + 1) / tracks.length) * 100)
                    })

                    try {
                        // Call the sync function directly (don't write to files by default for speed)
                        await syncTrackPlayCount(track.id, lastfmUsername, listenbrainzUsername, writeToFile)
                        syncedCount++
                    } catch (error) {
                        console.error(`Failed to sync track ${track.id}:`, error)
                        errors.push(`${track.artist} - ${track.title}`)
                    }

                    // Rate limit: delay between requests to avoid API rate limits
                    // 350ms = ~170 tracks/minute, safe for most APIs
                    await new Promise(resolve => setTimeout(resolve, 350))
                }

                console.log(`✅ Synced ${syncedCount}/${tracks.length} tracks`)
                return { total: tracks.length, synced: syncedCount, errors }
            } catch (error) {
                console.error('❌ Failed to sync all play counts:', error)
                throw error
            }
        })

        // Export play counts to CSV
        ipcMain.handle('scrobble:exportPlayCountsCSV', async () => {
            console.log('📊 Exporting play counts to CSV...')
            try {
                const tracks = getAllTracks()

                // CSV header
                let csv = 'Artist,Title,Album,Play Count,Rating,Loved\n'

                // Add tracks
                for (const track of tracks) {
                    const playCount = getTrackPlayCount(track.id)
                    const artist = (track.artist || '').replace(/"/g, '""')
                    const title = (track.title || '').replace(/"/g, '""')
                    const album = (track.album || '').replace(/"/g, '""')
                    const loved = track.loved ? 'Yes' : 'No'

                    csv += `"${artist}","${title}","${album}",${playCount},${track.rating || 0},"${loved}"\n`
                }

                // Save to user's downloads or documents folder
                const { dialog } = require('electron')
                const { app } = require('electron')
                const defaultPath = path.join(app.getPath('downloads'), `musicmaster-playcounts-${Date.now()}.csv`)

                const result = await dialog.showSaveDialog({
                    title: 'Export Play Counts',
                    defaultPath,
                    filters: [
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                })

                if (!result.canceled && result.filePath) {
                    const fs = require('fs')
                    fs.writeFileSync(result.filePath, csv, 'utf8')
                    console.log('✅ CSV exported to:', result.filePath)
                    return result.filePath
                }

                return null
            } catch (error) {
                console.error('❌ Failed to export CSV:', error)
                throw error
            }
        })

        // ListenBrainz Full History Sync (Batched)
        ipcMain.handle('scrobble:syncAllListenBrainz', async (event, username: string) => {
            console.log(`🚀 Starting full ListenBrainz sync for user: ${username}`)
            try {
                // 1. Fetch all listens (Phase: Fetching)
                const playCountsMap = await listenBrainzService.fetchAllListens(username, (stats) => {
                    event.sender.send('scrobble:listenBrainzSyncProgress', {
                        phase: 'fetching',
                        fetched: stats.fetched,
                        page: stats.page
                    })
                })

                console.log(`✅ Fetched all listens. Total unique tracks: ${playCountsMap.size}`)

                // 2. Match and update local tracks (Phase: Matching)
                const tracks = getAllTracks()
                const db = getDatabase()
                let updatedCount = 0

                console.log(`🔄 Matching against ${tracks.length} local tracks...`)

                // Use a transaction for bulk updates
                const updateStmt = db.prepare('UPDATE tracks SET play_count = ? WHERE id = ?')

                const transaction = db.transaction((trackList: any[]) => {
                    for (let i = 0; i < trackList.length; i++) {
                        const track = trackList[i]

                        // Normalized key for matching
                        const artist = (track.artist || '').toLowerCase().trim()
                        const title = (track.title || '').toLowerCase().trim()
                        const key = `${artist}|${title}`

                        const listenCount = playCountsMap.get(key)
                        if (listenCount !== undefined) {
                            // Protect existing count: Choose the highest between DB and ListenBrainz
                            const currentDbCount = track.play_count || 0
                            const finalCount = Math.max(currentDbCount, listenCount)
                            updateStmt.run(finalCount, track.id)
                            updatedCount++
                        }

                        // Progress update every 100 tracks to avoid IPC flooding
                        if (i % 100 === 0 || i === trackList.length - 1) {
                            event.sender.send('scrobble:listenBrainzSyncProgress', {
                                phase: 'matching',
                                current: i + 1,
                                total: trackList.length
                            })
                        }
                    }
                })

                transaction(tracks)

                console.log(`✅ Sync complete. Updated ${updatedCount} tracks.`)
                return { total: tracks.length, updated: updatedCount }
            } catch (error) {
                console.error('❌ Failed ListenBrainz full sync:', error)
                throw error
            }
        })


        console.log('✅ All IPC handlers registered successfully!')
    } catch (error) {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] FATAL ERROR registering IPC handlers: ${error}\n`)
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Stack trace: ${(error as Error).stack}\n`)
        throw error
    }
}
