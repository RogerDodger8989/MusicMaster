import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UIState {
    isMiniPlayer: boolean
    isAlwaysOnTop: boolean
    isTheaterMode: boolean
    isFullScreen: boolean

    toggleMiniPlayer: () => void
    setAlwaysOnTop: (flag: boolean) => void
    toggleTheaterMode: () => void
    setFullScreen: (flag: boolean) => void
}

export const useUI = create<UIState>()(
    devtools(
        persist(
            (set, get) => ({
                isMiniPlayer: false,
                isAlwaysOnTop: false,
                isTheaterMode: false,
                isFullScreen: false,

                toggleMiniPlayer: async () => {
                    const current = get().isMiniPlayer
                    const next = !current
                    const isTheater = get().isTheaterMode

                    // If moving to mini player, exit theater mode
                    if (next) {
                        set({ isTheaterMode: false, isMiniPlayer: true })
                        
                        // Switch to MiniPlayer size
                        await window.api.window.setSize(400, 500)
                    } else {
                        set({ isMiniPlayer: false })
                        
                        // Restore to appropriate size based on theater mode
                        if (isTheater) {
                            await window.api.window.setSize(1920, 1080)
                        } else {
                            await window.api.window.setSize(1400, 900)
                        }
                    }
                },

                setAlwaysOnTop: async (flag: boolean) => {
                    set({ isAlwaysOnTop: flag })
                    await window.api.window.setAlwaysOnTop(flag)
                },

                toggleTheaterMode: async () => {
                    const current = get().isTheaterMode
                    const next = !current
                    const wasMiniPlayer = get().isMiniPlayer

                    // If entering theater mode, exit mini player
                    if (next) {
                        set({ isMiniPlayer: false, isTheaterMode: true })
                        
                        // Set to fullscreen/large size for theater mode
                        if (wasMiniPlayer) {
                            // Coming from mini player - maximize or use large size
                            await window.api.window.setSize(1920, 1080)
                        } else {
                            // Already in main window - just maximize
                            await window.api.window.setSize(1920, 1080)
                        }
                    } else {
                        set({ isTheaterMode: false })
                        
                        // Restore to normal main window size
                        await window.api.window.setSize(1400, 900)
                    }
                },

                setFullScreen: async (flag: boolean) => {
                    set({ isFullScreen: flag })
                    if (window.api?.window?.setFullScreen) {
                        await window.api.window.setFullScreen(flag)
                    }
                }
            }),
            { name: 'music-master-ui' }
        )
    )
)
