import { app, shell, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { closeDatabase } from './database'
import { musicScanner } from './scanner'
import { initCoverCache } from './services/coverArt'

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
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Initial taskbar buttons
    updateThumbarButtons(mainWindow, false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.musicmaster')

  // Initialize cache directories
  initCoverCache()

  // Register IPC handlers
  console.log('Registering IPC handlers...')
  registerIpcHandlers()
  console.log('IPC handlers registered')

  // Register custom protocol for local assets (covers & audio)
  protocol.registerFileProtocol('asset', (request, callback) => {
    // Robustly handle different URL formats:
    // asset:///C:/Users... -> C:/Users... (3 slashes)
    // asset://C:/Users...  -> C:/Users... (2 slashes)
    // asset://c/Users/     -> c/Users... (normalized by browser)
    const url = request.url.replace(/^asset:\/{2,3}/, '')

    try {
      // Decode URL (handles spaces e.g. %20 -> space)
      let decodedPath = decodeURIComponent(url)

      // FIX: Handle "c/Users" -> "c:/Users"
      // If path starts with drive letter followed by slash (but NO colon)
      // e.g. "c/Users" or "D/Music"
      if (process.platform === 'win32') {
        // Case 1: "c/Users..."
        if (/^[a-zA-Z]\//.test(decodedPath)) {
          decodedPath = decodedPath[0] + ':' + decodedPath.substring(1)
        }
        // Case 2: "/c/Users..."
        else if (/^\/[a-zA-Z]\//.test(decodedPath)) {
          decodedPath = decodedPath[1] + ':' + decodedPath.substring(2)
        }

        // Standardize slashes
        // decodedPath = decodedPath.replace(/\//g, '\\') // Actually Electron prefers / often, but let's see.
        // Node's `fs` handles forward slashes fine on Windows usually.
      }

      // Log for debugging (expensive but necessary now)
      console.log(`[AssetProtocol] ${request.url} -> ${decodedPath}`)

      return callback({ path: decodedPath })
    } catch (error) {
      console.error('Failed to resolve asset protocol path', error)
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
