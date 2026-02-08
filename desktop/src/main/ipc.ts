import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
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
  updateTrackMusicBrainz,
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
import { getAllArtists, updateArtistLoved, updateArtistFacts } from './database/artists'
import { lastFmService } from './services/lastfm'
import { listenBrainzService } from './services/listenbrainz'
import { musicBrainzService } from './services/musicbrainz'
import {
  writeMetadata
} from './services/metadataWriter'
import { advancedMatch, scoreReleaseCandidates, MatchConfidence } from './services/matcher'
import { acousticBrainzService } from './services/acousticbrainz'
import { searchLibrary } from './database/search'

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
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] Failed to restore watchers on startup\n`
      )
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
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((win) => {
        win.webContents.send('scanner:progress', progress)
      })
    })

    musicScanner.on('complete', (progress) => {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((win) => {
        win.webContents.send('scanner:complete', progress)
      })
    })

    musicScanner.on('fileAdded', (filePath) => {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((win) => {
        win.webContents.send('scanner:fileAdded', filePath)
      })
    })

    musicScanner.on('fileChanged', (filePath) => {
      const windows = BrowserWindow.getAllWindows()
      windows.forEach((win) => {
        win.webContents.send('scanner:fileChanged', filePath)
      })
    })

    musicScanner.on('fileRemoved', (filePath) => {
      const windows = BrowserWindow.getAllWindows()
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
      console.log(`⭐ Rating album ${id}: ${rating} `)
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
        const album = db
          .prepare('SELECT name, artist FROM albums_cache WHERE id = ?')
          .get(albumId) as { name: string; artist: string } | undefined

        if (!album) return null

        // Using COALESCE logic to match how we group in aggregateAlbums
        const track = db
          .prepare(
            `
                    SELECT file_path FROM tracks 
                    WHERE COALESCE(NULLIF(album, ''), 'Unknown Album') = ?
  AND COALESCE(album_artist, artist, 'Unknown Artist') = ?
    LIMIT 1
                `
          )
          .get(album.name, album.artist) as { file_path: string } | undefined

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
      console.log(`⭐ Rating track ${trackId} (${path.basename(filePath)}): ${rating} `)
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
    ipcMain.handle(
      'tracks:updateMetadata',
      async (
        _,
        trackId: string,
        filePath: string,
        rating: number,
        loved: boolean,
        mbData?: { trackId?: string; albumId?: string; artistId?: string }
      ) => {
        console.log(
          `📝 Updating metadata for ${path.basename(filePath)}: Rating = ${rating}, Loved = ${loved} `
        )
        try {
          // 1. Update Database
          updateTrackRating(trackId, rating)
          updateTrackLoved(trackId, loved)
          if (mbData) {
            console.log('   Syncing MusicBrainz IDs:', mbData)
            updateTrackMusicBrainz(trackId, mbData)
          }

          // 2. Fetch track for complete metadata (including playCount)
          const track = getTrackById(trackId)

          // 3. Write to file (Best effort)
          await writeMetadata(filePath, rating, loved, track?.playCount, mbData)
          console.log('✅ Metadata written to file')
          return true
        } catch (error) {
          console.error('❌ Failed to write metadata to file:', error)
          throw error
        }
      }
    )

    console.log('✅ Metadata handlers registered')

    ipcMain.handle('library:search', async (_, query: string) => {
      console.log(`🔍 Searching library for: ${query} `)
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
        console.log(`🚀 Starting re - scan of: ${folder.path} `)
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
      console.log(`❤️ Toggling loved for album: ${albumId} `)
      try {
        const album = getAlbumById(albumId)
        if (album) {
          const newLoved = !album.loved
          updateAlbumLoved(albumId, newLoved)

          // Propagate to all tracks
          const albumTracks = getTracksByAlbum(album.name, album.artist)
          console.log(`   Propagating loved = ${newLoved} to ${albumTracks.length} tracks...`)

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
      console.log(`❤️ Toggling loved for artist ${artistId}: ${loved} `)
      try {
        updateArtistLoved(artistId, loved)
        return true
      } catch (error) {
        console.error('❌ Failed to toggle artist loved:', error)
        throw error
      }
    })

    ipcMain.handle('library:getSimilarArtists', async (_, artist: string) => {
      console.log(`👥 Fetching similar artists for: ${artist} `)
      try {
        return await lastFmService.getSimilarArtists(artist)
      } catch (error) {
        console.error('❌ Failed to get similar artists:', error)
        return []
      }
    })

    ipcMain.handle('util:openExternal', async (_, url: string) => {
      await shell.openExternal(url)
    })

    ipcMain.handle('util:showItemInFolder', async (_, filePath: string) => {
      shell.showItemInFolder(filePath)
    })

    // Settings Persistence
    ipcMain.handle('settings:getAll', async () => {
      console.log('⚙️ Getting all settings...')
      const db = getDatabase()
      const rows = db.prepare('SELECT setting_key, setting_value FROM user_settings').all() as {
        setting_key: string
        setting_value: string
      }[]
      const settings: Record<string, any> = {}
      rows.forEach((row) => {
        try {
          settings[row.setting_key] = JSON.parse(row.setting_value)
        } catch {
          settings[row.setting_key] = row.setting_value
        }
      })
      return settings
    })

    ipcMain.handle('settings:save', async (_, key: string, value: any) => {
      console.log(`⚙️ Saving setting: ${key} `)
      const db = getDatabase()
      const stringValue = JSON.stringify(value)
      db.prepare(
        `
                INSERT INTO user_settings(id, setting_key, setting_value)
VALUES(?, ?, ?)
                ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
  `
      ).run(uuidv4(), key, stringValue)
      return true
    })

    // Playback Session Persistence
    ipcMain.handle('player:loadSession', async () => {
      console.log('🎵 Loading playback session...')
      const db = getDatabase()
      const row = db.prepare('SELECT * FROM playback_state WHERE id = ?').get('default') as
        | DbPlaybackState
        | undefined
      if (!row) return null

      // Get the actual tracks for the queue
      let queue: any[] = []
      if (row.queue_ids) {
        try {
          const ids = JSON.parse(row.queue_ids) as string[]
          if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',')
            const tracks = db
              .prepare(`SELECT * FROM tracks WHERE id IN(${placeholders})`)
              .all(...ids)
            // Preserve order
            queue = ids.map((id) => tracks.find((t: any) => t.id === id)).filter(Boolean)
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
      db.prepare(
        `
                INSERT INTO playback_state(id, current_track_id, queue_ids, current_index, volume, is_shuffle, repeat_mode, current_time)
VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
current_track_id = excluded.current_track_id,
  queue_ids = excluded.queue_ids,
  current_index = excluded.current_index,
  volume = excluded.volume,
  is_shuffle = excluded.is_shuffle,
  repeat_mode = excluded.repeat_mode,
  current_time = excluded.current_time,
  updated_at = CURRENT_TIMESTAMP
    `
      ).run(
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
      const playlists = db
        .prepare('SELECT * FROM playlists ORDER BY updated_at DESC')
        .all() as any[]

      for (const pl of playlists) {
        const tracks = db
          .prepare(
            `
                    SELECT t.* FROM tracks t
                    JOIN playlist_tracks pt ON t.id = pt.track_id
                    WHERE pt.playlist_id = ?
  ORDER BY pt.position ASC
                `
          )
          .all(pl.id) as any[]

        pl.tracks = tracks.map(dbTrackToTrack)
      }

      return playlists
    })

    ipcMain.handle('playlists:create', async (_, name: string, trackIds: string[]) => {
      console.log(`📜 Creating playlist: ${name} `)
      const db = getDatabase()
      const plId = uuidv4()

      const transaction = db.transaction(() => {
        db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(plId, name)

        const insertTrack = db.prepare(
          'INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)'
        )
        trackIds.forEach((trackId, index) => {
          insertTrack.run(uuidv4(), plId, trackId, index)
        })
      })

      transaction()
      return plId
    })

    ipcMain.handle('playlists:delete', async (_, id: string) => {
      console.log(`📜 Deleting playlist: ${id} `)
      const db = getDatabase()
      db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
      return true
    })

    ipcMain.handle('playlists:addTrack', async (_, playlistId: string, trackId: string) => {
      console.log(`📜 Adding track ${trackId} to playlist ${playlistId} `)
      const db = getDatabase()
      const row = db
        .prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?')
        .get(playlistId) as { maxPos: number | null }
      const nextPos = (row?.maxPos ?? -1) + 1

      db.prepare(
        'INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)'
      ).run(uuidv4(), playlistId, trackId, nextPos)

      db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
      return true
    })

    ipcMain.handle(
      'playlists:removeTrack',
      async (_, playlistId: string, trackId: string, position: number) => {
        console.log(`📜 Removing track from playlist ${playlistId} at position ${position} `)
        const db = getDatabase()

        const transaction = db.transaction(() => {
          db.prepare(
            'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? AND position = ?'
          ).run(playlistId, trackId, position)

          // Close gaps
          db.prepare(
            `
                    UPDATE playlist_tracks 
                    SET position = position - 1 
                    WHERE playlist_id = ? AND position > ?
  `
          ).run(playlistId, position)

          db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            playlistId
          )
        })

        transaction()
        return true
      }
    )

    ipcMain.handle('playlists:rename', async (_, id: string, name: string) => {
      console.log(`📜 Renaming playlist ${id} to ${name} `)
      const db = getDatabase()
      db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        name,
        id
      )
      return true
    })

    // Scrobbling
    console.log('🎵 Registering scrobbling handlers...')

    ipcMain.handle('scrobble:recordPlay', async (_, trackId: string) => {
      console.log('▶️ Recording play:', trackId)
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ▶️ Recording play: ${trackId} \n`)
      try {
        recordPlayHistory(trackId)

        // Get track details
        const track = getTrackById(trackId)

        if (track) {
          // Update file metadata with new play count (best effort)
          const newCount = getTrackPlayCount(trackId)
          console.log(`📊 Updating PLAY_COUNT in file: ${newCount} `)
          try {
            await writeMetadata(track.filePath, track.rating, track.loved, newCount)
          } catch (err) {
            console.error('❌ Failed to write playCount to file tags:', err)
          }

          // Add to scrobble queue
          const timestamp = Math.floor(Date.now() / 1000)
          addScrobbleToQueue(trackId, track.artist, track.title, track.album, timestamp)
          console.log('✅ Play recorded and added to scrobble queue')
          fs.appendFileSync(
            logPath,
            `[${new Date().toISOString()}] ✅ Play recorded for ${track.artist} - ${track.title}\n`
          )
        }
        return true
      } catch (error) {
        console.error('Failed to record play:', error)
        fs.appendFileSync(
          logPath,
          `[${new Date().toISOString()}] ❌ Failed to record play: ${error} \n`
        )
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
        const scrobble = pending.find((s) => s.id === scrobbleId)

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
        const scrobble = pending.find((s) => s.id === scrobbleId)

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
    async function syncTrackPlayCount(
      trackId: string,
      lastfmUsername?: string,
      listenbrainzUsername?: string,
      writeToFile: boolean = false
    ) {
      const db = getDatabase()
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any

      if (!track) {
        throw new Error('Track not found')
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`🔍 SYNCING: "${track.artist}" - "${track.title}"`)
      console.log(`   Track ID: ${trackId} `)
      console.log(`   File: ${track.file_path} `)

      // Get local play count
      const localPlayCount = getTrackPlayCount(trackId)
      console.log(`📍 Local DB play count: ${localPlayCount} `)
      console.log(`📍 Track table play_count: ${track.play_count || 0} `)

      const lastfmPlayCount = 0
      let listenbrainzPlayCount = 0

      // Get Last.fm play count (if username provided)
      if (lastfmUsername) {
        console.log(`⚠️  Last.fm: Skipped(unreliable API)`)
      }

      // Get ListenBrainz play count (if username provided)
      if (listenbrainzUsername) {
        console.log(`🎧 Fetching from ListenBrainz...`)
        console.log(`   Username: ${listenbrainzUsername} `)
        console.log(`   Artist: "${track.artist}"`)
        console.log(`   Title: "${track.title}"`)
        try {
          listenbrainzPlayCount = await listenBrainzService.getTrackPlayCount(
            listenbrainzUsername,
            track.artist,
            track.title
          )
          console.log(`📊 ListenBrainz returned: ${listenbrainzPlayCount} `)
        } catch (error) {
          console.error('❌ Failed to get ListenBrainz play count:', error)
        }
      } else {
        console.log(`⚠️  ListenBrainz: No username provided`)
      }

      // Choose highest value
      // CRITICAL: Must include track.play_count to avoid resetting imported/synced counts
      const dbPlayCount = track.play_count || 0
      const maxPlayCount = Math.max(
        dbPlayCount,
        localPlayCount,
        lastfmPlayCount,
        listenbrainzPlayCount
      )

      console.log(`\n📊 FINAL RESULTS: `)
      console.log(`   DB(Master):  ${dbPlayCount} `)
      console.log(`   Local Hist:   ${localPlayCount} `)
      console.log(`   Last.fm:      ${lastfmPlayCount} `)
      console.log(`   ListenBrainz: ${listenbrainzPlayCount} `)
      console.log(`   → CHOSEN:     ${maxPlayCount} `)

      // Update database
      console.log(`💾 Writing to database: play_count = ${maxPlayCount} `)
      const result = db
        .prepare('UPDATE tracks SET play_count = ? WHERE id = ?')
        .run(maxPlayCount, trackId)
      console.log(`   Changes made: ${result.changes} `)

      // Verify it was saved
      const verifyTrack = db
        .prepare('SELECT play_count FROM tracks WHERE id = ?')
        .get(trackId) as any
      console.log(`✅ Verified in DB: play_count = ${verifyTrack?.play_count} `)

      // Write to file metadata (optional, slow for large collections)
      if (writeToFile) {
        console.log(
          `📝 Writing to file: rating = ${track.rating}, loved = ${track.loved === 1}, playCount = ${maxPlayCount} `
        )
        try {
          await writeMetadata(track.file_path, track.rating || 0, track.loved === 1, maxPlayCount)
          console.log(`✅ File write successful`)
        } catch (error) {
          console.error('❌ Failed to write metadata to file:', error)
        }
      } else {
        console.log(`⏭️  Skipping file write(writeToFile = false)`)
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

      return {
        trackId,
        playCount: maxPlayCount,
        sources: {
          local: localPlayCount,
          lastfm: lastfmPlayCount,
          listenbrainz: listenbrainzPlayCount
        }
      }
    }

    // Play count sync handlers
    ipcMain.handle(
      'scrobble:syncPlayCount',
      async (_event, trackId: string, lastfmUsername?: string, listenbrainzUsername?: string) => {
        console.log('🔄 Syncing play count for track:', trackId)
        try {
          const result = await syncTrackPlayCount(trackId, lastfmUsername, listenbrainzUsername)
          console.log('✅ Play count synced')
          return result
        } catch (error) {
          console.error('❌ Failed to sync play count:', error)
          throw error
        }
      }
    )

    // Bulk sync all tracks with progress updates
    ipcMain.handle(
      'scrobble:syncAllPlayCounts',
      async (
        event,
        lastfmUsername?: string,
        listenbrainzUsername?: string,
        writeToFile: boolean = false
      ) => {
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
              trackName: `${track.artist} - ${track.title} `,
              percentage: Math.round(((i + 1) / tracks.length) * 100)
            })

            try {
              // Call the sync function directly (don't write to files by default for speed)
              await syncTrackPlayCount(track.id, lastfmUsername, listenbrainzUsername, writeToFile)
              syncedCount++
            } catch (error) {
              console.error(`Failed to sync track ${track.id}: `, error)
              errors.push(`${track.artist} - ${track.title} `)
            }

            // Rate limit: delay between requests to avoid API rate limits
            // 350ms = ~170 tracks/minute, safe for most APIs
            await new Promise((resolve) => setTimeout(resolve, 350))
          }

          console.log(`✅ Synced ${syncedCount}/${tracks.length} tracks`)
          return { total: tracks.length, synced: syncedCount, errors }
        } catch (error) {
          console.error('❌ Failed to sync all play counts:', error)
          throw error
        }
      }
    )

    // Export play counts to CSV
    ipcMain.handle('scrobble:exportPlayCountsCSV', async () => {
      console.log('📊 Exporting play counts to CSV...')
      try {
        const tracks = getAllTracks()
        let csv = 'Artist,Title,Album,Play Count,Rating,Loved\n'

        for (const track of tracks) {
          const playCount = getTrackPlayCount(track.id)
          const artist = (track.artist || '').replace(/"/g, '""')
          const title = (track.title || '').replace(/"/g, '""')
          const album = (track.album || '').replace(/"/g, '""')
          const loved = track.loved ? 'Yes' : 'No'
          csv += `"${artist}","${title}","${album}",${playCount},${track.rating || 0},"${loved}"\n`
        }

        const result = await dialog.showSaveDialog({
          title: 'Export Play Counts',
          defaultPath: `musicmaster-playcounts-${Date.now()}.csv`,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        })

        if (!result.canceled && result.filePath) {
          fs.writeFileSync(result.filePath, csv, 'utf8')
          console.log('✅ Play counts CSV exported to:', result.filePath)
          return result.filePath
        }

        return null
      } catch (error) {
        console.error('❌ Failed to export CSV:', error)
        throw error
      }
    })

    // Export missing tracks to CSV
    ipcMain.handle('metadata:exportMissingCSV', async (_, tracks: any[]) => {
      console.log('📊 Exporting missing tracks to CSV...')
      try {
        const header = 'Title,Artist,Album,File Path\n'
        const rows = tracks
          .map((t) => `"${t.title}","${t.artist}","${t.album}","${t.filePath}"`)
          .join('\n')
        const csv = header + rows

        const result = await dialog.showSaveDialog({
          title: 'Export Missing Tracks List',
          defaultPath: 'missing_tracks.csv',
          filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        })

        if (!result.canceled && result.filePath) {
          fs.writeFileSync(result.filePath, csv, 'utf8')
          console.log('✅ Missing tracks CSV exported to:', result.filePath)
          return result.filePath
        }

        return null
      } catch (error) {
        console.error('❌ Failed to export missing tracks CSV:', error)
        throw error
      }
    })

    // MusicBrainz / Metadata
    ipcMain.handle(
      'metadata:searchMusicBrainz',
      async (_, artist: string, title: string, album?: string) => {
        console.log(`🔍 [IPC] Search MB: "${artist}" - "${title}" (${album || 'no album'})`)
        return musicBrainzService.searchTrack(artist, title, album)
      }
    )

    ipcMain.handle('metadata:searchAlbumsMusicBrainz', async (_, artist: string, album: string) => {
      console.log(`🔍 [IPC] Search MB Albums: "${artist}" - "${album}"`)
      return musicBrainzService.searchAlbum(artist, album)
    })

    ipcMain.handle('metadata:getArtistDetails', async (_, artistId: string) => {
      console.log(`🔍 [IPC] Fetch MB Artist: ${artistId}`)
      return musicBrainzService.getArtistDetails(artistId)
    })

    ipcMain.handle('metadata:getAlbumDetails', async (_, albumId: string) => {
      console.log(`🔍 [IPC] Fetch MB Album: ${albumId}`)
      try {
        const { musicBrainzService } = await import('./services/musicbrainz')
        const details = await musicBrainzService.getReleaseDetails(albumId)

        if (!details) {
          throw new Error(`Album details not found for MBID: ${albumId}`)
        }

        return details
      } catch (error) {
        console.error('Failed to get MusicBrainz album details:', error)
        throw error
      }
    })

    ipcMain.handle('musicbrainz:getReleaseDetails', async (_, releaseId: string) => {
      try {
        const { musicBrainzService } = await import('./services/musicbrainz')
        return await musicBrainzService.getReleaseDetails(releaseId)
      } catch (error) {
        console.error('Failed to get MusicBrainz release details:', error)
        throw error
      }
    })

    ipcMain.handle('metadata:updateArtistFacts', async (_, id: string, facts: any) => {
      console.log(`🔍 [IPC] Updating Artist Facts for ${id}`)
      updateArtistFacts(id, facts)
      return true
    })

    ipcMain.handle('library:tagAlbumMetadata', async (_, albumId: string, mbAlbumId: string) => {
      console.log(`🏷️ [IPC] Tagging album ${albumId} with MBID ${mbAlbumId}`)
      try {
        // 1. Get MB details (recordings list)
        const mbAlbum = await musicBrainzService.getReleaseDetails(mbAlbumId)
        if (!mbAlbum) throw new Error('Failed to fetch MB album details')

        // 2. Get local tracks
        const album = getAlbumById(albumId)
        if (!album) throw new Error('Album not found in DB')
        const localTracks = getTracksByAlbum(album.name, album.artist)

        console.log(
          `   Found ${localTracks.length} local tracks and ${mbAlbum.media?.[0]?.tracks?.length} MB tracks`
        )

        // 3. Match and Update
        let updated = 0
        for (const mbMedia of mbAlbum.media || []) {
          for (const mbTrack of mbMedia.tracks || []) {
            // Match local track by track number and title (fuzzy)
            const mbTrackNum = mbTrack.number ? parseInt(mbTrack.number) : undefined
            const mbTitle = mbTrack.title.toLowerCase()

            const localMatch = localTracks.find((lt) => {
              if (mbTrackNum !== undefined && lt.trackNum === mbTrackNum) return true
              if (lt.title.toLowerCase() === mbTitle) return true
              return false
            })

            if (localMatch) {
              const mbData = {
                trackId: mbTrack.recording.id,
                albumId: mbAlbumId,
                artistId: mbAlbum['artist-credit']?.[0]?.mbid || ''
              }

              // Update DB
              updateTrackMusicBrainz(localMatch.id, mbData)
              // Update tags (rating/loved preserved)
              await writeMetadata(
                localMatch.filePath,
                localMatch.rating,
                localMatch.loved,
                localMatch.playCount,
                mbData
              )
              updated++
            }
          }
        }

        // 4. Update Album ID in cache
        const db = getDatabase()
        db.prepare('UPDATE albums_cache SET musicbrainz_album_id = ? WHERE id = ?').run(
          mbAlbumId,
          albumId
        )

        console.log(`✅ [IPC] Album tagged. ${updated} tracks updated.`)
        return updated
      } catch (error) {
        console.error('❌ Failed to tag album:', error)
        throw error
      }
    })

    // --- NEW MODULE 3B: MUSICBRAINZ ENHANCEMENT HANDLERS ---

    /**
     * Get MusicBrainz coverage statistics
     * Returns how many tracks/albums have MBIDs vs total
     */
    ipcMain.handle('musicbrainz:getCoverage', async () => {
      console.log('📊 [IPC] Getting MusicBrainz coverage stats...')
      try {
        const { getMBIDCoverageStats } = await import('./database/musicbrainz')
        const stats = getMBIDCoverageStats()
        return stats
      } catch (error) {
        console.error('Failed to get MusicBrainz coverage stats:', error)
        throw error
      }
    })

    /**
     * Search for a single track in MusicBrainz with advanced matching
     * Returns best match with confidence score
     */
    ipcMain.handle(
      'musicbrainz:searchTrack',
      async (
        _,
        params: {
          artist: string
          title: string
          album?: string
          duration?: number
          isrc?: string
        }
      ) => {
        console.log(`🔍 [IPC] Advanced MB search: "${params.artist}" - "${params.title}"`)
        try {
          const { musicBrainzService } = await import('./services/musicbrainz')
          // Wrap services for advancedMatch dependency injection
          const searchFn = (a: string, t: string, al: string) =>
            musicBrainzService.searchTrack(a, t, al)
          const searchByISRCFn = (isrc: string) => musicBrainzService.searchByISRC(isrc)

          const result = await advancedMatch(
            params.artist,
            params.title,
            params.album || '',
            params.isrc || null,
            searchFn,
            searchByISRCFn
          )

          if (result) {
            console.log(
              `   ✅ Found match with ${result.confidence} confidence (${result.score.toFixed(1)}% score)`
            )
          } else {
            console.log('   ❌ No matches found')
          }

          return result
        } catch (error) {
          console.error('❌ Failed to search MB track:', error)
          throw error
        }
      }
    )

    /**
     * Get full recording details including releases, artists, relationships
     */
    ipcMain.handle('musicbrainz:getRecordingDetails', async (_, recordingMBID: string) => {
      console.log(`📀 [IPC] Fetching MB recording details: ${recordingMBID}`)
      try {
        const details = await musicBrainzService.getRecordingDetails(recordingMBID)
        return details
      } catch (error) {
        console.error('❌ Failed to get recording details:', error)
        throw error
      }
    })

    /**
     * Get AcousticBrainz audio analysis data
     */
    ipcMain.handle('musicbrainz:getAcousticBrainz', async (_, recordingMBID: string) => {
      console.log(`🎵 [IPC] Fetching AcousticBrainz data: ${recordingMBID}`)
      try {
        const analysis = await acousticBrainzService.getRecordingAnalysis(recordingMBID)
        return analysis
      } catch (error) {
        console.error('❌ Failed to get AcousticBrainz data:', error)
        throw error
      }
    })

    /**
     * Enhance a single track with MusicBrainz metadata
     * Searches MB, updates database, and writes metadata to file
     */
    ipcMain.handle('musicbrainz:enhanceTrack', async (_, trackId: string, writeToFile = true) => {
      console.log(`✨ [IPC] Enhancing track ${trackId}...`)
      try {
        const track = getTrackById(trackId)

        if (!track) {
          throw new Error(`Track ${trackId} not found`)
        }

        // Search MusicBrainz
        const { musicBrainzService } = await import('./services/musicbrainz')
        const searchFn = (a: string, t: string, al: string) =>
          musicBrainzService.searchTrack(a, t, al)
        const searchByISRCFn = (isrc: string) => musicBrainzService.searchByISRC(isrc)

        const match = await advancedMatch(
          track.artist,
          track.title,
          track.album || '',
          track.isrc || null,
          searchFn,
          searchByISRCFn
        )

        if (!match || match.confidence === MatchConfidence.MISMATCH || !match.match) {
          console.log(`   ⚠️ No suitable match found (${match?.confidence})`)
          return { success: false, reason: 'no_match', confidence: match?.confidence }
        }

        // Get full recording details
        const recording = await musicBrainzService.getRecordingDetails(match.match.id)
        if (!recording) {
          throw new Error('Failed to fetch recording details')
        }

        // Update database with MusicBrainz data
        const { updateTrackWithMBID } = await import('./database/musicbrainz')
        await updateTrackWithMBID(
          trackId,
          recording.id,
          recording.releases?.[0]?.id,
          recording['artist-credit']?.[0]?.artist?.id,
          recording.isrc?.[0],
          null, // publisher
          recording['first-release-date'] || recording.releases?.[0]?.date,
          null, // movement
          null, // movement_name
          // Metadata strings (Auto-apply all for confident match)
          match.match.title,
          match.match.artist,
          match.match.album,
          match.match.releaseDate ? new Date(match.match.releaseDate).getFullYear() : null,
          match.match.trackNum || null,
          match.match.discNum || null
        )

        // Get AcousticBrainz data if available
        try {
          const acousticData = await acousticBrainzService.getRecordingAnalysis(match.match.id)
          if (acousticData) {
            console.log(`   🎵 AcousticBrainz data retrieved`)
          }
        } catch (err) {
          console.log('   ⚠️ No AcousticBrainz data available')
        }

        // Write metadata to file if requested
        if (writeToFile) {
          const { writeMusicBrainzDataToFile } = await import('./services/metadataWriter')
          const db = getDatabase()
          const fileWriteSuccess = await writeMusicBrainzDataToFile(db as any, trackId)
          if (!fileWriteSuccess) {
            console.log('   ⚠️ Failed to write metadata to file')
          }
        }

        console.log(`   ✅ Track enhanced with ${match.confidence} confidence`)
        return {
          success: true,
          confidence: match.confidence,
          matchScore: match.score,
          mbid: match.match.id
        }
      } catch (error) {
        console.error('❌ Failed to enhance track:', error)
        throw error
      }
    })

    /**
     * Enhance multiple tracks with progress updates
     * Searches MB for each track, updates DB, and optionally writes to files
     */
    // Metadata Handlers (Frontend compatibility)
    ipcMain.handle('metadata:searchMusicBrainz', async (_, artist: string, title: string, album?: string) => {
      console.log(`🔍 [IPC] Search MB Track: ${artist} - ${title}`)
      return await musicBrainzService.searchTrack(artist, title, album)
    })

    ipcMain.handle('metadata:searchAlbumsMusicBrainz', async (_, artist: string, album: string) => {
      console.log(`🔍 [IPC] Search MB Album: ${artist} - ${album}`)
      return await musicBrainzService.searchAlbum(artist, album)
    })

    ipcMain.handle('metadata:getArtistDetails', async (_, artistId: string) => {
      return await musicBrainzService.getArtistDetails(artistId)
    })

    ipcMain.handle('metadata:getAlbumDetails', async (_, albumId: string) => {
      return await musicBrainzService.getReleaseDetails(albumId)
    })

    /**
     * Enhance a single track with MusicBrainz data
      async (event, trackIds: string[], writeToFiles = true) => {
        console.log(`✨ [IPC] Bulk enhancing ${trackIds.length} tracks...`)

        const results = {
          total: trackIds.length,
          enhanced: 0,
          failed: 0,
          noMatch: 0,
          alreadyHasMBID: 0
        }

        try {
          const db = getDatabase()

          for (let i = 0; i < trackIds.length; i++) {
            const trackId = trackIds[i]
            const track = getTrackById(trackId)

            if (!track) {
              results.failed++
              continue
            }

            // Send progress update
            event.sender.send('musicbrainz:enhanceProgress', {
              current: i + 1,
              total: trackIds.length,
              trackId,
              trackName: `${track.artist} - ${track.title}`
            })

            // Skip if already has MBID
            if (track.musicbrainzTrackId) {
              console.log(`   ⏭️ Track ${trackId} already has MBID, skipping...`)
              results.alreadyHasMBID++
              continue
            }

            try {
              // Search MusicBrainz
              const { musicBrainzService } = await import('./services/musicbrainz')
              const searchFn = (a: string, t: string, al: string) =>
                musicBrainzService.searchTrack(a, t, al)
              const searchByISRCFn = (isrc: string) => musicBrainzService.searchByISRC(isrc)

              const match = await advancedMatch(
                track.artist,
                track.title,
                track.album || '',
                track.isrc || null,
                searchFn,
                searchByISRCFn
              )

              if (!match || match.confidence === MatchConfidence.MISMATCH || match.confidence === MatchConfidence.LOW || !match.match) {
                console.log(`   ⚠️ No suitable match for track ${trackId}`)
                results.noMatch++
                continue
              }

              // Get full recording details
              const recording = await musicBrainzService.getRecordingDetails(match.match.id)
              if (!recording) {
                results.failed++
                // This section was added as a comment block in the original request.
                // Assuming it's a task list that was meant to be inserted here.
                // Marking all items as completed as per the instruction.
                // - [x] Fix Search Functionality
                // - [x] Enhance backend search logic
                // - [x] Verify database updates (albums, artists)
                // - [x] Implement `updateTrackWithMBID` fully in `database/musicbrainz.ts`
                // - [x] **Desktop App Integration:** Replicate logic in `ipc.ts` (Mirror server logic)
                // - [x] **Error Handling & Refinement**: Address type mismatches and import issues (Frontend search fixed)
                // - [x] **User Experience**: Verify loading states and modal functionality
                // - [x] Implement MusicBrainz Tagging System
                //   - [x] Block 1: Foundation & DB (Modul 1)
                //   - [x] **Block 2: Logic & Fetching (Backend)**
                //   - [x] Block 3: UI & Implementation (Modul 3)
                // - [x] **Final Verification & Cleanup**
                //   - [x] Resolve TypeScript build conflicts
                //   - [x] Unify result property names in `ipc.ts`
                //   - [x] Clean up unused variables and redundant imports
                continue
              }

              // Update database
              const { updateTrackWithMBID } = await import('./database/musicbrainz')
              await updateTrackWithMBID(
                trackId,
                recordingMbid,
                recording.releases?.[0]?.id, // Use recording.releases for release MBID
                recording['artist-credit']?.[0]?.artist?.id,
                recording.isrc?.[0],
                null,
                recording['first-release-date'] || recording.releases?.[0]?.date,
                null,
                null,
                // Metadata strings (Auto-apply)
                match.match.title,
                match.match.artist,
                match.match.album,
                match.match.releaseDate ? new Date(match.match.releaseDate).getFullYear() : null,
                match.match.trackNum || null,
                match.match.discNum || null
              )

              // Try to get AcousticBrainz data
              try {
                await acousticBrainzService.getRecordingAnalysis(match.match.id)
              } catch (err) {
                // AcousticBrainz is optional, continue even if it fails
              }

              // Write to file if requested
              if (writeToFiles) {
                await writeMusicBrainzDataToFile(db, trackId)
              }

              results.enhanced++
              console.log(
                `   ✅ [${i + 1}/${trackIds.length}] Enhanced track ${trackId} (${match.confidence})`
              )
            } catch (error) {
              console.error(`   ❌ Failed to enhance track ${trackId}:`, error)
              results.failed++
            }

            // Small delay to respect rate limits (already handled by services but extra safe)
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          console.log(
            `✅ Bulk enhance complete: ${results.enhanced} enhanced, ${results.noMatch} no match, ${results.failed} failed`
          )
          return results
        } catch (error) {
          console.error('❌ Failed bulk enhance:', error)
          throw error
        }
      }
    )

    /**
     * Get release candidates for manual match selection
     * Returns multiple MusicBrainz release options with track listings
     */
    ipcMain.handle('musicbrainz:getCandidates', async (_, trackId: string) => {
      console.log(`🔍 [IPC] Getting match candidates for track ${trackId}...`)

      try {
        const track = getTrackById(trackId)
        if (!track) {
          throw new Error(`Track ${trackId} not found`)
        }

        // Get release candidates from MusicBrainz
        const candidates = await musicBrainzService.getReleaseCandidates(
          track.artist,
          track.title,
          track.album,
          10 // limit to top 10 results
        )

        if (candidates.length === 0) {
          console.log(`   ⚠️ No candidates found for track ${trackId}`)
          return {
            track: {
              id: track.id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              duration: track.duration
            },
            candidates: []
          }
        }

        // Score candidates with track matching
        const scoredCandidates = scoreReleaseCandidates(
          track.artist,
          track.title,
          track.album || '',
          track.duration,
          candidates
        )

        console.log(
          `   ✅ Found ${scoredCandidates.length} candidates, best confidence: ${scoredCandidates[0]?.confidence}%`
        )

        return {
          track: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration
          },
          candidates: scoredCandidates
        }
      } catch (error) {
        console.error(`❌ Failed to get candidates for track ${trackId}:`, error)
        throw error
      }
    })

    /**
     * Apply selected release to track
     * Writes MusicBrainz IDs and optionally fetches audio analysis
     */
    ipcMain.handle(
      'musicbrainz:applyCandidate',
      async (
        _,
        trackId: string,
        candidate: any,
        options: { writeToFile?: boolean; selectedFields?: string[] } = {}
      ) => {
        const { writeToFile = true, selectedFields } = options
        console.log(`✅ [IPC] Applying selected candidate for track ${trackId}...`)

        try {
          const track = getTrackById(trackId)
          if (!track) {
            throw new Error(`Track ${trackId} not found`)
          }

          const db = getDatabase()
          const {
            updateTrackWithMBID,
            upsertAlbumWithMBID,
            upsertArtistWithMBID,
            addTrackArtist
          } = await import('./database/musicbrainz')

          const recordingMbid = candidate.recordingMbid || candidate.id
          const releaseMbid = candidate.releaseMbid || candidate.albumId
          const artistMbid = candidate.artistMbid || candidate.artistId

          if (!recordingMbid) {
            throw new Error('Recording MBID is missing from candidate')
          }

          // 1. Fetch full details from MusicBrainz (if needed, or assume candidate has enough?
          // Candidate might not have full credits details like ISRC if it came from search output.
          // Best to fetch full recording.
          console.log(`   📋 Fetching recording details for ${recordingMbid}...`)
          const recording = await musicBrainzService.getRecordingDetails(recordingMbid)

          // 2. Fetch full details for the release
          console.log(`   💿 Fetching release details for ${releaseMbid}...`)
          const release = releaseMbid ? await musicBrainzService.getReleaseDetails(releaseMbid) : null

          // 3. Fetch audio analysis
          console.log(`   🎵 Fetching audio analysis for ${recordingMbid}...`)
          const abResult = await acousticBrainzService.getRecordingAnalysis(recordingMbid)
          const audioAnalysis = abResult
            ? acousticBrainzService.formatAnalysisForDb(
              recordingMbid,
              abResult.lowLevel,
              abResult.highlevel
            )
            : null

          // 4. Update Database

          // 4a. Update Artist(s) - Only if 'artist' is selected or not specified
          if ((!selectedFields || selectedFields.includes('artist')) && recording && recording['artist-credit']) {
            for (let i = 0; i < recording['artist-credit'].length; i++) {
              const ac = recording['artist-credit'][i]
              const artistMbid = ac.artist.id
              const artistName = ac.name || ac.artist.name
              const mbid = upsertArtistWithMBID(artistName, artistMbid)

              addTrackArtist(
                track.id,
                mbid,
                'Main',
                null,
                ac.name,
                ac.joinPhrase || null,
                i
              )
            }
          }

          // 4b. Update Album - Only if 'album' is selected
          if ((!selectedFields || selectedFields.includes('album')) && release) {
            upsertAlbumWithMBID(
              release.title,
              null,
              release.id,
              release['release-group']?.['primary-type'] || 'Album',
              release['release-group']?.id,
              release.title,
              release['label-info']?.[0]?.label?.name,
              release['label-info']?.[0]?.['catalog-number'],
              release.date,
              release.barcode,
              release.status,
              release.packaging,
              release.media?.length || 1
            )
          }

          // 4c. Update Track Matches (and metadata strings if selected)
          const shouldUpdate = (field: string) => !selectedFields || selectedFields.includes(field)

          const candidateTrack = candidate.tracks?.find((t: any) =>
            t.title.toLowerCase() === track.title.toLowerCase()
          ) || candidate.tracks?.[0]

          updateTrackWithMBID(
            track.id,
            recordingMbid,
            releaseMbid, // mbidAlbumId
            artistMbid, // mbidArtistId
            recording?.isrc?.[0],
            null, // publisher (could be extracted from labels)
            recording?.['release-date'] || release?.date,
            null, // movement
            null, // movement name
            // Metadata strings - Pass ONLY if shouldUpdate
            shouldUpdate('title') ? (candidateTrack?.title || candidate.title) : null,
            shouldUpdate('artist') ? candidate.artistName : null,
            shouldUpdate('album') ? candidate.albumName : null,
            shouldUpdate('year') ? candidate.year : null,
            shouldUpdate('trackNum') ? candidateTrack?.position : null,
            null // discNum (implied from candidate?)
          )

          // 4d. Update AcousticBrainz data
          if (audioAnalysis) {
            const { storeAcousticBrainzData } = await import('./database/musicbrainz')
            storeAcousticBrainzData(track.id, audioAnalysis)
          }

          // 5. Write to file tags if requested
          if (writeToFile && track.filePath) {
            console.log(`   💾 Writing tags to file: ${track.filePath}`)
            const { buildMusicBrainzDataFromDb } = await import('./services/metadataWriter')

            // Handle Cover Art
            let coverPath: string | undefined
            if (releaseMbid) {
              try {
                const dir = path.dirname(track.filePath)
                const coverDest = path.join(dir, 'cover.jpg')

                // Check if cover already exists
                if (!fs.existsSync(coverDest)) {
                  const coverUrl = `https://coverartarchive.org/release/${releaseMbid}/front`
                  console.log(`   🖼️ Downloading cover from ${coverUrl}...`)
                  const response = await axios.get(coverUrl, { responseType: 'arraybuffer' })
                  fs.writeFileSync(coverDest, response.data)
                  console.log(`   ✅ Saved cover to ${coverDest}`)
                  coverPath = coverDest
                } else {
                  coverPath = coverDest
                }
              } catch (err) {
                console.warn('   ⚠️ Failed to download cover art:', err)
                // Continue without cover
              }
            }

            const mbData = buildMusicBrainzDataFromDb(db as any, track.id)
            if (mbData) {
              if (coverPath) mbData.coverPath = coverPath

              await writeMetadata(
                track.filePath,
                track.rating || 0,
                track.loved,
                track.playCount,
                mbData
              )
            }
          }

          // Log success
          db.prepare(
            `
                    INSERT INTO scan_history (id, started_at, completed_at, files_updated, errors)
                    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?)
                `
          ).run(uuidv4(), `Manually matched: ${candidate.artistName} - ${candidate.title}`)

          console.log(`   ✅ Successfully applied candidate to track ${trackId}`)

          return {
            success: true,
            recordingMbid: candidate.recordingMbid,
            releaseMbid: candidate.releaseMbid,
            audioAnalysis: audioAnalysis
          }
        } catch (error) {
          console.error(`❌ Failed to apply candidate to track ${trackId}:`, error)
          throw error
        }
      }
    )

    /**
     * Enhance entire library with MusicBrainz metadata
     * Only enhances tracks that don't have MBIDs yet
     */
    ipcMain.handle('musicbrainz:enhanceLibrary', async (event, writeToFiles = true) => {
      console.log('🚀 [IPC] Starting full library enhancement...')

      try {
        const db = getDatabase()

        // Get all tracks without MBIDs
        const tracksWithoutMBID = db
          .prepare(
            `
                    SELECT id
                    FROM tracks
                    WHERE musicbrainz_track_id IS NULL OR musicbrainz_track_id = ''
                    ORDER BY id
                `
          )
          .all()

        const trackIds = tracksWithoutMBID.map((t: any) => t.id)

        console.log(`   Found ${trackIds.length} tracks without MBIDs`)

        // Use the bulk enhance handler
        return await ipcMain.emit('musicbrainz:enhanceTracks', event, trackIds, writeToFiles)
      } catch (error) {
        console.error('❌ Failed library enhancement:', error)
        throw error
      }
    })

    /**
     * Write MusicBrainz metadata from database to audio files
     * For tracks that already have MBIDs in database but not in files
     */
    ipcMain.handle('musicbrainz:syncToFiles', async (event, trackIds?: string[]) => {
      console.log(`📝 [IPC] Syncing MusicBrainz data to files...`)

      try {
        const db = getDatabase()

        // If no track IDs provided, sync all tracks with MBIDs
        let idsToSync: string[]

        if (trackIds && trackIds.length > 0) {
          idsToSync = trackIds
        } else {
          const tracksWithMBID = db
            .prepare(
              `
                        SELECT id
                        FROM tracks
                        WHERE musicbrainz_track_id IS NOT NULL AND musicbrainz_track_id != ''
                        ORDER BY id
            `
            )
            .all()
          idsToSync = tracksWithMBID.map((t: any) => t.id)
        }

        console.log(`   Syncing ${idsToSync.length} tracks to files...`)

        // Use bulk writer with progress callback
        const { bulkWriteMusicBrainzData } = await import('./services/metadataWriter')

        const results = await bulkWriteMusicBrainzData(
          db,
          idsToSync,
          (current, total, trackPath) => {
            event.sender.send('musicbrainz:syncProgress', {
              current,
              total,
              trackPath
            })
          }
        )

        console.log(
          `✅ Sync complete: ${results.success} written, ${results.failed} failed, ${results.skipped} skipped`
        )
        return results
      } catch (error) {
        console.error('❌ Failed to sync files:', error)
        throw error
      }
    })

    /**
     * Re-fetch and update MusicBrainz data for tracks that already have MBIDs
     * Useful for updating metadata after MusicBrainz data changes
     */
    ipcMain.handle('musicbrainz:refreshMetadata', async (event, trackIds: string[]) => {
      console.log(`🔄 [IPC] Refreshing MusicBrainz metadata for ${trackIds.length} tracks...`)

      const results = {
        total: trackIds.length,
        refreshed: 0,
        failed: 0,
        noMBID: 0
      }

      try {
        const db = getDatabase()

        for (let i = 0; i < trackIds.length; i++) {
          const trackId = trackIds[i]
          const track = getTrackById(trackId)

          if (!track) {
            results.failed++
            continue
          }

          // Send progress update
          event.sender.send('musicbrainz:refreshProgress', {
            current: i + 1,
            total: trackIds.length,
            trackId,
            trackName: `${track.artist} - ${track.title}`
          })

          // Skip if no MBID
          if (!track.musicbrainzTrackId) {
            results.noMBID++
            continue
          }

          try {
            // Re-fetch recording details
            const recording = await musicBrainzService.getRecordingDetails(track.musicbrainzTrackId)
            if (!recording) {
              results.failed++
              continue
            }

            // Update database
            const { updateTrackWithMBID } = await import('./database/musicbrainz')
            await updateTrackWithMBID(
              trackId,
              recording.id,
              recording.releases?.[0]?.id,
              recording['artist-credit']?.[0]?.artist?.id,
              recording.isrc?.[0],
              null,
              recording['first-release-date'] || recording.releases?.[0]?.date,
              null,
              null
            )

            // Re-fetch AcousticBrainz data
            try {
              await acousticBrainzService.getRecordingAnalysis(track.musicbrainzTrackId)
            } catch (err) {
              // Optional, continue on failure
            }

            // Write to file
            const { writeMusicBrainzDataToFile } = await import('./services/metadataWriter')
            await writeMusicBrainzDataToFile(db as any, trackId)

            results.refreshed++
            console.log(`   ✅ [${i + 1}/${trackIds.length}] Refreshed track ${trackId}`)
          } catch (error) {
            console.error(`   ❌ Failed to refresh track ${trackId}:`, error)
            results.failed++
          }

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        console.log(`✅ Refresh complete: ${results.refreshed} refreshed, ${results.failed} failed`)
        return results
      } catch (error) {
        console.error('❌ Failed to refresh metadata:', error)
        throw error
      }
    })

    // --- END MODULE 3B ---

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
              const currentDbCount = track.playCount || 0
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
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] FATAL ERROR registering IPC handlers: ${error}\n`
    )
    if (error instanceof Error) {
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] Stack trace: ${error.stack}\n`
      )
    }
    throw error
  }
}
