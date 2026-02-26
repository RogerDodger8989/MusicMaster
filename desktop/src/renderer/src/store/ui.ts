import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UIState {
    isMiniPlayer: boolean
    isAlwaysOnTop: boolean

    toggleMiniPlayer: () => void
    setAlwaysOnTop: (flag: boolean) => void
}

export const useUI = create<UIState>()(
    devtools(
        persist(
            (set, get) => ({
                isMiniPlayer: false,
                isAlwaysOnTop: false,

                toggleMiniPlayer: async () => {
                    const current = get().isMiniPlayer
                    const next = !current

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
                }
            }),
            { name: 'music-master-ui' }
        )
    )
)
