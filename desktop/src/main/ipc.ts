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
import { getAllTracks, updateTrackRating, updateTrackLoved, getTracksByAlbum, dbTrackToTrack, addScrobbleToQueue, getPendingScrobbles, markScrobbleSubmitted, recordPlayHistory, getTrackPlayCount } from './database/tracks'
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
                // 1. Write to file
                // TODO: Get loved status from DB or pass it in. For now assuming false if not passed?
                // Actually safer to read it first or default to false.
                // Let's rely on frontend passing current state or we read it.
                // Simplified: just write rating, keep loved as is (read from file?? No, that's slow)
                // Better approach: Update DB first, then try write file.

                updateTrackRating(trackId, rating)

                // Write to file (fire and forget or await?)
                // We should await to report error
                // We need 'loved' status to write full metadata tag set without erasing 'loved'
                // For now, let's just update rating. The writeMetadata function requires both.
                // See implementation of writeMetadata in services/metadataWriter.ts
            } catch (error) {
                console.error('Failed to rate track:', error)
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

        ipcMain.handle('library:reset', async () => {
            console.log('☢️ NUKING LIBRARY...')
            const db = initDatabase()
            db.transaction(() => {
                db.prepare('DELETE FROM tracks').run()
                db.prepare('DELETE FROM albums_cache').run()
                db.prepare('DELETE FROM artists').run()
                db.prepare('DELETE FROM music_folders').run()
                db.prepare('DELETE FROM playback_history').run()
                db.prepare('DELETE FROM scan_history').run()
            })()
            console.log('✅ Library nuked successfully')
            return true
        })

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
            try {
                recordPlayHistory(trackId)

                // Get track details
                const tracks = getAllTracks()
                const track = tracks.find(t => t.id === trackId)

                if (track) {
                    // Add to scrobble queue
                    const timestamp = Math.floor(Date.now() / 1000)
                    addScrobbleToQueue(trackId, track.artist, track.title, track.album, timestamp)
                    console.log('✅ Play recorded and added to scrobble queue')
                }
                return true
            } catch (error) {
                console.error('Failed to record play:', error)
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

        console.log('✅ All IPC handlers registered successfully!')
    } catch (error) {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] FATAL ERROR registering IPC handlers: ${error}\n`)
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Stack trace: ${(error as Error).stack}\n`)
        throw error
    }
}
