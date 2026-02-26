import { create } from 'zustand'
import { usePlayer } from './player'

export interface CastDevice {
    id: string
    name: string
    type: 'chromecast' | 'sonos'
}

interface CastState {
    devices: CastDevice[]
    activeDevice: CastDevice | null
    castState: 'disconnected' | 'connecting' | 'connected' | 'playing' | 'paused'
    currentTime: number
    volume: number

    startDiscovery: () => void
    connectToDevice: (device: CastDevice) => Promise<void>
    disconnect: () => Promise<void>
    updateDevices: (devices: CastDevice[]) => void
    updateStatus: (status: any) => void
}

export const useCastStore = create<CastState>((set, get) => ({
    devices: [],
    activeDevice: null,
    castState: 'disconnected',
    currentTime: 0,
    volume: 1,

    startDiscovery: async () => {
        await window.api.cast.startDiscovery()
    },

    connectToDevice: async (device) => {
        set({ castState: 'connecting', activeDevice: device })
        const success = await window.api.cast.connect(device.id, device.type)
        if (success) {
            set({ castState: 'connected' })
            usePlayer.getState().handOffToCast()
        } else {
            set({ castState: 'disconnected', activeDevice: null })
        }
    },

    disconnect: async () => {
        const { activeDevice } = get()
        if (activeDevice) {
            await window.api.cast.disconnect(activeDevice.type)
            set({ activeDevice: null, castState: 'disconnected', currentTime: 0 })
            usePlayer.getState().handOffToLocal()
        }
    },

    updateDevices: (newDevices) => {
        set({ devices: newDevices })
    },

    updateStatus: (status) => {
        // console.log('[Cast Store] Status update received:', status)

        // Determine state purely based on playerState string (e.g. PLAYING, PAUSED, IDLE)
        let newState = get().castState
        if (status.state) {
            const s = status.state.toUpperCase()
            if (s === 'PLAYING') newState = 'playing'
            else if (s === 'PAUSED') newState = 'paused'
            else if (s === 'IDLE' || s === 'STOPPED') newState = 'connected'
        }

        const currentTime = status.currentTime !== undefined ? status.currentTime : get().currentTime

        set({
            castState: newState,
            currentTime: currentTime,
            volume: status.volume !== undefined ? status.volume : get().volume
        })

        // Sync back to usePlayer for UI updates
        const playerStore = usePlayer.getState()
        const updates: any = {}

        if (newState === 'playing') updates.isPlaying = true
        if (newState === 'paused') updates.isPlaying = false

        // Ensure we have a duration to calculate progress
        let duration = playerStore.duration
        if ((!duration || duration <= 0) && status.duration > 0) {
            duration = status.duration
            updates.duration = duration
        }

        if (status.currentTime !== undefined) {
            updates.currentTime = status.currentTime
            if (duration > 0) {
                updates.progress = (status.currentTime / duration) * 100
            }
        }

        if (Object.keys(updates).length > 0) {
            usePlayer.setState(updates)
        }
    }
}))

// Setup listeners
if (typeof window !== 'undefined' && window.api) {
    window.api.cast.onDevices((devices) => {
        useCastStore.getState().updateDevices(devices)
    })
    window.api.cast.onStatus((status) => {
        useCastStore.getState().updateStatus(status)
    })
}
