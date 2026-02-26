import ChromecastAPI from 'chromecast-api'
import { getCastStreamUrl } from './server'
import { BrowserWindow } from 'electron'

let client: typeof ChromecastAPI | null = null
let devices: any[] = []
let activeDevice: any = null
let mainWindow: BrowserWindow | null = null
let statusTimer: NodeJS.Timeout | null = null

export function setMainWindowForCasting(win: BrowserWindow) {
    mainWindow = win
}

export function startChromecastDiscovery() {
    if (client) {
        client.update() // trigger a re-scan if already running
        return
    }

    client = new ChromecastAPI()

    client.on('device', (device: any) => {
        // Check if device already exists
        const exists = devices.find(d => d.host === device.host)
        if (!exists) {
            devices.push(device)
            notifyDevicesUpdated()
        }
    })
}

export function stopChromecastDiscovery() {
    if (client) {
        // There isn't an explicit "stop" in chromecast-api but we can clear devices
        // and let it GC if we really wanted to, but usually it's fine running.
    }
}

export function getDiscoveredDevices() {
    return devices.map(d => ({
        id: d.host, // host IP usually unique enough for local network
        name: d.friendlyName,
        type: 'chromecast'
    }))
}

export function connectToChromecast(host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const device = devices.find(d => d.host === host)
        if (!device) {
            return resolve(false)
        }

        activeDevice = device

        // Listen for status updates to sync back to renderer
        activeDevice.on('status', (status: any) => {
            if (!status) return
            if (mainWindow) {
                mainWindow.webContents.send('cast:status', {
                    device: activeDevice.friendlyName,
                    state: status.playerState,
                    currentTime: status.currentTime,
                    duration: status.media?.duration,
                    volume: status.volume?.level
                })
            }

            // Start polling if playing
            if (status.playerState === 'PLAYING') {
                startPolling()
            } else if (status.playerState === 'PAUSED' || status.playerState === 'IDLE') {
                stopPolling()
            }
        })

        resolve(true)
    })
}

export function disconnectChromecast() {
    stopPolling()
    if (activeDevice) {
        activeDevice.stop()
        activeDevice = null
    }
}

export function chromecastPlayTrack(track: any): Promise<boolean> {
    return new Promise((resolve) => {
        if (!activeDevice) return resolve(false)

        const url = getCastStreamUrl(track)
        const contentType = `audio/${url.split('.').pop() === 'flac' ? 'flac' : url.split('.').pop() === 'wav' ? 'wav' : url.split('.').pop() === 'ogg' ? 'ogg' : url.split('.').pop() === 'm4a' ? 'mp4' : 'mpeg'}`

        const media = {
            url,
            contentType,
            cover: {
                title: track?.title || 'Unknown Title',
                url: 'https://raw.githubusercontent.com/RogerDodger8989/MusicMaster/main/build/icon.png'
            }
        }

        activeDevice.play(media, (playErr: any) => {
            if (playErr) {
                console.error('Error casting to device:', playErr)
                resolve(false)
            } else {
                console.log(`[Chromecast] Play initiated for ${track.title}`)
                startPolling()
                resolve(true)
            }
        })
    })
}

function startPolling() {
    if (statusTimer) return
    console.log('[Chromecast] Starting status polling')
    statusTimer = setInterval(() => {
        if (activeDevice && activeDevice.getStatus) {
            activeDevice.getStatus((err: any, status: any) => {
                if (err) {
                    // console.error('[Chromecast] Polling error:', err)
                    return
                }
                if (status && mainWindow) {
                    // console.log('[Chromecast] Status update:', status.currentTime)
                    mainWindow.webContents.send('cast:status', {
                        device: activeDevice.friendlyName || 'Chromecast',
                        state: status.playerState,
                        currentTime: status.currentTime,
                        duration: status.media?.duration,
                        volume: status.volume?.level
                    })
                }
            })
        }
    }, 1000)
}

function stopPolling() {
    if (statusTimer) {
        clearInterval(statusTimer)
        statusTimer = null
    }
}

export function chromecastPause() {
    if (activeDevice) activeDevice.pause()
}

export function chromecastResume() {
    if (activeDevice) activeDevice.resume()
}

export function chromecastStop() {
    stopPolling()
    if (activeDevice) activeDevice.stop()
}

export function chromecastSeek(time: number) {
    if (activeDevice) activeDevice.seekTo(time)
}

export function chromecastSetVolume(volume: number) {
    if (activeDevice) activeDevice.setVolume(volume) // 0.0 to 1.0
}

function notifyDevicesUpdated() {
    if (mainWindow) {
        mainWindow.webContents.send('cast:devices', getDiscoveredDevices())
    }
}
