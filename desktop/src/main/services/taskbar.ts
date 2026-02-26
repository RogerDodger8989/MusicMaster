import { BrowserWindow, nativeImage, app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

let playIcon: Electron.NativeImage
let pauseIcon: Electron.NativeImage
let nextIcon: Electron.NativeImage
let prevIcon: Electron.NativeImage

function loadThumbarIcons(): void {
    try {
        const resourcePath = is.dev
            ? join(app.getAppPath(), 'resources')
            : join(process.resourcesPath)

        const playPath = join(resourcePath, 'play.png')
        const pausePath = join(resourcePath, 'pause.png')
        const nextPath = join(resourcePath, 'next.png')
        const prevPath = join(resourcePath, 'prev.png')

        playIcon = nativeImage.createFromPath(playPath)
        pauseIcon = nativeImage.createFromPath(pausePath)
        nextIcon = nativeImage.createFromPath(nextPath)
        prevIcon = nativeImage.createFromPath(prevPath)

        if (playIcon.isEmpty() || pauseIcon.isEmpty() || nextIcon.isEmpty() || prevIcon.isEmpty()) {
            console.error('[Taskbar] One or more icons failed to load from resources')
            return
        }
    } catch (error) {
        console.error('Error loading thumbar icons:', error)
    }
}

export function updateThumbarButtons(window: BrowserWindow, isPlaying: boolean): void {
    if (!playIcon || !pauseIcon || !nextIcon || !prevIcon) {
        loadThumbarIcons()
    }

    if (!playIcon || playIcon.isEmpty()) return

    const buttons: Electron.ThumbarButton[] = [
        {
            tooltip: 'Previous',
            icon: prevIcon,
            click: () => {
                window.webContents.send('player:command', 'prev')
            }
        },
        {
            tooltip: isPlaying ? 'Pause' : 'Play',
            icon: isPlaying ? pauseIcon : playIcon,
            click: () => {
                window.webContents.send('player:command', 'togglePlay')
            }
        },
        {
            tooltip: 'Next',
            icon: nextIcon,
            click: () => {
                window.webContents.send('player:command', 'next')
            }
        }
    ]

    window.setThumbarButtons(buttons)
}
