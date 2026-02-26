import { DeviceDiscovery, Sonos } from 'sonos'
import { getCastStreamUrl } from './server'
import { BrowserWindow } from 'electron'

let devices: any[] = []
let activeDevice: Sonos | null = null
let mainWindow: BrowserWindow | null = null
let discoveryInstance: any = null
let statusTimer: NodeJS.Timeout | null = null

export function setMainWindowForSonos(win: BrowserWindow) {
    mainWindow = win
}
export function startSonosDiscovery() {
    if (discoveryInstance) return // Already running
    devices = []
    console.log('[Sonos] Starting discovery...')

    // Use DeviceDiscovery for continuous listening
    discoveryInstance = DeviceDiscovery((device: Sonos) => {
        console.log(`[Sonos] Found potential device at ${device.host}`)
        device.deviceDescription().then(info => {
            console.log(`[Sonos] Device ${device.host} identified as: ${info.roomName || info.friendlyName}`)
            const exists = devices.find(d => d.host === device.host)
            if (!exists) {
                devices.push({
                    host: device.host,
                    name: info.roomName || info.friendlyName || `Sonos (${device.host})`,
                    deviceStr: device
                })
                notifyDevicesUpdated()
            }
        }).catch(err => {
            console.error('[Sonos] discovery error for device:', device.host, err)
        })
    })

    // Search timeout if nothing found
    setTimeout(() => {
        if (devices.length === 0) {
            console.log('[Sonos] No devices found after 10s of discovery. You might need to check your firewall.')
        }
    }, 10000)
}

export function stopSonosDiscovery() {
    if (discoveryInstance) {
        // The sonos pkg DeviceDiscovery wrapper doesn't have a simple stop/destroy usually,
        // but in modern versions we might be able to close the socket. For now, it's safe to leave.
    }
}

export function getDiscoveredSonosDevices() {
    return devices.map(d => ({
        id: d.host,
        name: d.name,
        type: 'sonos'
    }))
}

export function connectToSonos(host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const d = devices.find(x => x.host === host)
        if (!d) return resolve(false)

        activeDevice = new Sonos(host)

        // Listen for state changes
        activeDevice.on('PlayState', (state: string) => {
            // playing, paused, stopped
            const s = state.toLowerCase()
            if (mainWindow) {
                mainWindow.webContents.send('cast:status', {
                    device: d.name,
                    state: s
                })
            }

            if (s === 'playing') {
                startPolling()
            } else {
                stopPolling()
            }
        })

        // To get exact current time we would need to poll position
        // activeDevice.currentTrack()...

        resolve(true)
    })
}

export function disconnectSonos() {
    stopPolling()
    if (activeDevice) {
        activeDevice.stop().catch(() => { })
        activeDevice = null
    }
}

export async function sonosPlayTrack(track: any): Promise<boolean> {
    if (!activeDevice) return false

    try {
        const url = getCastStreamUrl(track)
        await activeDevice.play(url)
        startPolling()
        return true
    } catch (err) {
        console.error('Sonos play track error:', err)
        return false
    }
}

function startPolling() {
    if (statusTimer) return
    console.log('[Sonos] Starting status polling')
    statusTimer = setInterval(async () => {
        if (activeDevice) {
            try {
                const track = await activeDevice.currentTrack()
                if (track && track.position !== undefined && mainWindow) {
                    // console.log('[Sonos] Polling position:', track.position)
                    mainWindow.webContents.send('cast:status', {
                        device: 'Sonos',
                        currentTime: track.position,
                        duration: track.duration
                    })
                }
            } catch (err) {
                // Ignore errors during polling
            }
        }
    }, 1000)
}

function stopPolling() {
    if (statusTimer) {
        clearInterval(statusTimer)
        statusTimer = null
    }
}

export async function sonosPause() {
    if (activeDevice) await activeDevice.pause().catch(() => { })
}

export async function sonosResume() {
    if (activeDevice) await activeDevice.play().catch(() => { })
}

export async function sonosStop() {
    stopPolling()
    if (activeDevice) await activeDevice.stop().catch(() => { })
}

export async function sonosSeek(timeInSeconds: number) {
    if (activeDevice) {
        // Sonos takes time strings like '00:01:23' or seconds usually
        // Using string approach:
        const hrs = Math.floor(timeInSeconds / 3600)
        const mins = Math.floor((timeInSeconds % 3600) / 60)
        const secs = Math.floor(timeInSeconds % 60)
        const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        await activeDevice.seek(timeStr).catch(() => { })
    }
}

export async function sonosSetVolume(volume: number) {
    // Volume usually 0-100 for sonos
    if (activeDevice) await activeDevice.setVolume(Math.round(volume * 100)).catch(() => { })
}

function notifyDevicesUpdated() {
    if (mainWindow) {
        mainWindow.webContents.send('cast:devices', getDiscoveredSonosDevices())
    }
}
