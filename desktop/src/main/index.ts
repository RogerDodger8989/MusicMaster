import * as dotenv from 'dotenv'
import path from 'path'
const envPath = path.resolve(process.cwd(), '.env')
const envRes = dotenv.config({ path: envPath })
console.log('Environment loading:', { envPath, status: envRes.error ? 'failed' : 'ok', dataPath: process.env.DATA_PATH })

import { app, shell, BrowserWindow, protocol } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { closeDatabase } from './database'
import { musicScanner } from './scanner'
import { initCoverCache } from './services/coverArt'
import { startCastServer } from './services/cast/server'
import { getTrackById } from './database/tracks'
import fs from 'fs'
import { execSync } from 'child_process'

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// Register custom protocol privileges
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'musicmaster',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

import { updateThumbarButtons } from './services/taskbar'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('[Window] ready-to-show event fired, showing window')
    mainWindow.show()
    // Initial taskbar buttons
    updateThumbarButtons(mainWindow, false)
  })

  mainWindow.on('closed', () => {
    console.log('[Window] Window closed')
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Window] did-fail-load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('render-process-gone', () => {
    console.error('[Window] Renderer process crashed')
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Window] Renderer process unresponsive')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  console.log('[Window] Creating window with is.dev:', is.dev, 'ELECTRON_RENDERER_URL:', rendererUrl)

  if (is.dev && rendererUrl) {
    console.log('[Window] Loading dev URL:', rendererUrl)
    mainWindow.loadURL(rendererUrl).catch(err => {
      console.error('[Window] Failed to load URL:', err)
    })
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html')
    console.log('[Window] Loading HTML file:', htmlPath)
    mainWindow.loadFile(htmlPath).catch(err => {
      console.error('[Window] Failed to load file:', err)
    })
  }
}

// Deep link handling setup
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('musicmaster', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('musicmaster')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      const url = commandLine.pop()
      if (url && url.startsWith('musicmaster://')) {
        handleDeepLink(url)
      }
    }
  })

  // macOS deep link
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.musicmaster')

  // Initialize cache directories
  initCoverCache()

  // Start Cast Streaming Server
  startCastServer().catch(err => console.error('Failed to start Cast Streaming Server:', err))

  // Register IPC handlers
  console.log('Registering IPC handlers...')
  registerIpcHandlers()
  console.log('IPC handlers registered')

  // Register custom protocol for local assets (covers & audio)
  protocol.registerFileProtocol('asset', (request, callback) => {
    // Robustly handle different URL formats:
    // asset:///C:/Users... -> C:/Users... (3 slashes)
    // asset://C:/Users...  -> C:/Users... (2 slashes)
    // asset://stream/ID -> lookup track by ID
    // asset://album-cover/ID -> lookup album cover
    // asset://artist-image/ID -> lookup artist image
    const url = request.url.replace(/^asset:\/{2,3}/, '')

    try {
      // Decode URL (handles spaces e.g. %20 -> space)
      let decodedPath = decodeURIComponent(url)

      console.log(`[AssetProtocol] ${request.url} -> ${decodedPath}`)

      // Handle ID-based resources
      if (decodedPath.startsWith('stream/')) {
        // Get track by ID and return its file path
        const trackId = decodedPath.substring(7) // Remove 'stream/'
        const track = getTrackById(trackId)
        if (track && track.filePath) {
          console.log(`[AssetProtocol] Stream resolved: ${track.filePath}`)
          return callback({ path: track.filePath })
        }
        console.error(`[AssetProtocol] Track not found: ${trackId}`)
        return callback({ path: '' })
      }

      if (decodedPath.startsWith('album-cover/')) {
        // Get album cover from cache
        const albumId = decodedPath.substring(12) // Remove 'album-cover/'
        const coversCacheDir = path.join(app.getPath('userData'), 'covers')
        const coverPath = path.join(coversCacheDir, `${albumId}.jpg`)
        if (fs.existsSync(coverPath)) {
          return callback({ path: coverPath })
        }
        // Try PNG
        const coverPathPng = path.join(coversCacheDir, `${albumId}.png`)
        if (fs.existsSync(coverPathPng)) {
          return callback({ path: coverPathPng })
        }
        console.error(`[AssetProtocol] Album cover not found: ${albumId}`)
        return callback({ path: '' })
      }

      if (decodedPath.startsWith('artist-image/')) {
        // Get artist image from cache
        const artistId = decodedPath.substring(13) // Remove 'artist-image/'
        const coversCacheDir = path.join(app.getPath('userData'), 'covers')
        const artistPath = path.join(coversCacheDir, `artist-${artistId}.jpg`)
        if (fs.existsSync(artistPath)) {
          return callback({ path: artistPath })
        }
        // Try PNG
        const artistPathPng = path.join(coversCacheDir, `artist-${artistId}.png`)
        if (fs.existsSync(artistPathPng)) {
          return callback({ path: artistPathPng })
        }
        console.error(`[AssetProtocol] Artist image not found: ${artistId}`)
        return callback({ path: '' })
      }

      if (decodedPath.startsWith('waveform/')) {
        const trackId = decodedPath.substring(9) // Remove 'waveform/'
        const waveformDir = path.join(app.getPath('userData'), 'waveforms')
        const waveformPath = path.join(waveformDir, `${trackId}.png`)

        if (fs.existsSync(waveformPath)) {
          return callback({ path: waveformPath })
        }

        const track = getTrackById(trackId)
        if (!track?.filePath || !fs.existsSync(track.filePath)) {
          console.error(`[AssetProtocol] Waveform track not found: ${trackId}`)
          return callback({ path: '' })
        }

        if (!fs.existsSync(waveformDir)) {
          fs.mkdirSync(waveformDir, { recursive: true })
        }

        try {
          const cmd = `ffmpeg -i "${track.filePath}" -filter_complex "aformat=channel_layouts=mono,showwavespic=s=1200x64:colors=#3b82f6" -frames:v 1 -y "${waveformPath}"`
          execSync(cmd, { stdio: 'ignore' })
          if (fs.existsSync(waveformPath)) {
            return callback({ path: waveformPath })
          }
        } catch (error) {
          console.error(`[AssetProtocol] Failed to generate waveform for ${trackId}:`, error)
        }

        return callback({ path: '' })
      }

      // Handle absolute file paths
      // FIX: Handle "c/Users" -> "c:/Users"
      if (process.platform === 'win32') {
        // Case 1: "c/Users..."
        if (/^[a-zA-Z]\//.test(decodedPath)) {
          decodedPath = decodedPath[0] + ':' + decodedPath.substring(1)
        }
        // Case 2: "/c/Users..."
        else if (/^\/[a-zA-Z]\//.test(decodedPath)) {
          decodedPath = decodedPath[1] + ':' + decodedPath.substring(2)
        }
      }

      return callback({ path: decodedPath })
    } catch (error) {
      console.error('[AssetProtocol] Error:', error)
      return callback({ path: '' })
    }
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('before-quit', async () => {
  await musicScanner.stopAllWatchers()
  closeDatabase()
})

function handleDeepLink(url: string) {
  console.log('Received deep link:', url)
  try {
    const logPath = require('path').join(process.cwd(), 'debug-tidal.log')
    require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] handleDeepLink REACHED with URL: ${url}\n`)
  } catch (e) { }

  const parsedUrl = new URL(url)
  if (parsedUrl.host === 'auth') {
    const code = parsedUrl.searchParams.get('code')
    if (code) {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        try {
          const logPath = require('path').join(process.cwd(), 'debug-tidal.log')
          require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] handleDeepLink SENDING CODE to renderer via IPC\n`)
        } catch (e) { }
        mainWindow.webContents.send('tidal:auth-callback', code)
      } else {
        try {
          const logPath = require('path').join(process.cwd(), 'debug-tidal.log')
          require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] handleDeepLink NO mainWindow found!\n`)
        } catch (e) { }
      }
    } else {
      try {
        const logPath = require('path').join(process.cwd(), 'debug-tidal.log')
        require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] handleDeepLink NO CODE IN URL!\n`)
      } catch (e) { }
    }
  }
}
