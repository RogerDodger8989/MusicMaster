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

                    // If moving to mini player, exit theater mode
                    if (next) {
                        set({ isTheaterMode: false })
                    }

                    set({ isMiniPlayer: next })

                    if (next) {
                        // Switch to MiniPlayer size
                        await window.api.window.setSize(400, 500)
                    } else {
                        // Restore to main size
                        await window.api.window.setSize(1400, 900)
                    }
                },

                setAlwaysOnTop: async (flag: boolean) => {
                    set({ isAlwaysOnTop: flag })
                    await window.api.window.setAlwaysOnTop(flag)
                },

                toggleTheaterMode: () => {
                    const current = get().isTheaterMode
                    const next = !current

                    // If entering theater mode, exit mini player
                    if (next) {
                        set({ isMiniPlayer: false })
                    }

                    set({ isTheaterMode: next })
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
