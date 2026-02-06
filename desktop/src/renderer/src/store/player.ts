import { create } from 'zustand'
import type { Track } from '../types'
import { calculateReplayGain } from '../utils/replayGain'
import { useSettings } from './settings'

type PlayMode = 'normal' | 'repeat-all' | 'repeat-one'

interface PlayerState {
    queue: Track[]
    currentIndex: number
    isPlaying: boolean
    volume: number          // 0 to 1 (user volume)
    progress: number        // 0 to 100 (percentage for simplified UI)
    currentTime: number     // current seconds
    duration: number        // total seconds
    isShuffle: boolean
    repeatMode: PlayMode
    currentTrack: Track | null
    history: Track[]
    historyTrackIds: Set<string>
    replayGainApplied: number  // 0 to 1+ (calculated from ReplayGain metadata)

    // Actions
    playTrack: (track: Track) => void
    playAlbum: (tracks: Track[], startIndex?: number) => void
    addToQueue: (track: Track) => void // Adds to end
    playNext: (track: Track) => void   // Adds after current
    togglePlay: () => void
    next: () => void
    prev: () => void
    seek: (time: number) => void
    setVolume: (val: number) => void
    toggleShuffle: () => void
    toggleRepeat: () => void
    setQueue: (newQueue: Track[]) => void
    clearQueue: () => void
    shuffleSubsequent: () => void
    playFromQueueAndCleanup: (index: number) => void
    reorderQueue: (fromIndex: number, toIndex: number) => void
    insertToQueue: (tracks: Track[], index: number) => void
    updateTrack: (trackId: string, updates: Partial<Track>) => void
    loadSession: () => Promise<void>
}

// Global Audio Element
const audio = new Audio()

// DEBUG ALERT - REMOVE AFTER FIXING
if (typeof window !== 'undefined') {
    // console.error to be visible
    console.error("PLAYER SCRIPT LOADED")
        // window.alert("PLAYER LOADED - IF YOU SEE THIS, UPDATE WORKED") 

        // Expose Debug Helper
        ; (window as any).DEBUG_PLAY_TRACK = (path: string) => {
            console.error("DEBUG: Manual Play Triggered for", path)
            const audio = new Audio()
            const src = `asset:///${encodeURI(path.replace(/\\/g, '/'))}`
            console.error("DEBUG: Manual Source of Audio:", src)
            audio.src = src
            audio.play().then(() => console.error("DEBUG: Manual Play SUCCESS"))
                .catch(e => console.error("DEBUG: Manual Play FAILED", e))
        }
}

export const usePlayer = create<PlayerState>((set, get) => {

    // --- Audio Event Listeners ---
    audio.ontimeupdate = () => {
        const { currentTrack, duration } = get()
        const currentTime = audio.currentTime
        const progress = (currentTime / (duration || 1)) * 100

        // Add to history if 50% played
        if (currentTrack && duration > 0 && progress >= 50) {
            const { history } = get()
            const alreadyInHistory = history.length > 0 && history[0].id === currentTrack.id
            if (!alreadyInHistory) {
                set(state => ({
                    history: [currentTrack, ...state.history.filter(t => t.id !== currentTrack.id)].slice(0, 50)
                }))
            }
        }

        set({
            currentTime,
            progress,
            duration: audio.duration || 0
        })
    }

    audio.onended = () => {
        get().next()
    }

    audio.onerror = (e) => {
        console.error("Audio Error Event:", e)
        set({ isPlaying: false })
    }

    // --- Persistence Helper ---
    let saveTimeout: any = null
    const persistSession = () => {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(async () => {
            const state = get()
            try {
                await window.api.player.saveSession({
                    currentTrackId: state.currentTrack?.id,
                    queueIds: state.queue.map(t => t.id),
                    currentIndex: state.currentIndex,
                    volume: state.volume,
                    isShuffle: state.isShuffle,
                    repeatMode: state.repeatMode,
                    currentTime: state.currentTime
                })
            } catch (error) {
                console.error('Failed to save session:', error)
            }
        }, 1000) // Debounce 1s
    }

    // --- Helper to start playback ---
    const loadAndPlay = (track: Track) => {
        let src = ''
        if (track.filePath) {
            const normalized = track.filePath.replace(/\\/g, '/')
            src = `asset:///${encodeURI(normalized)}`
        }

        if (src) {
            if (audio.src === src) {
                audio.play().then(() => {
                    set({ isPlaying: true })
                }).catch(err => {
                    console.error("[Player] Resume failed:", err)
                    set({ isPlaying: false })
                })
                return
            }

            audio.pause()
            audio.src = src
            audio.load()

            const playPromise = audio.play()
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    set({ isPlaying: true, duration: audio.duration || 0 })
                }).catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error(`[Player] Failed to play ${track.title}:`, err)
                        set({ isPlaying: false })
                    }
                })
            }
        }
    }

    return {
        queue: [],
        currentIndex: -1,
        isPlaying: false,
        volume: 1,
        progress: 0,
        currentTime: 0,
        duration: 0,
        isShuffle: false,
        repeatMode: 'normal',
        currentTrack: null,
        history: [],
        historyTrackIds: new Set(),
        replayGainApplied: 1,

        playTrack: (track) => {
            // Calculate ReplayGain based on current settings
            const mode = useSettings.getState().replayGainMode
            const replayGain = calculateReplayGain(track, mode)
            
            set({
                queue: [track],
                currentIndex: 0,
                currentTrack: track,
                currentTime: 0,
                progress: 0,
                replayGainApplied: replayGain
            })
            loadAndPlay(track)
            persistSession()
        },

        playAlbum: (tracks, startIndex = 0) => {
            if (!tracks.length) return
            const targetTrack = tracks[startIndex] || tracks[0]
            
            // Calculate ReplayGain based on current settings
            const mode = useSettings.getState().replayGainMode
            const replayGain = calculateReplayGain(targetTrack, mode)

            set({
                queue: tracks,
                currentIndex: startIndex,
                currentTrack: targetTrack,
                currentTime: 0,
                progress: 0,
                replayGainApplied: replayGain
            })
            loadAndPlay(targetTrack)
            persistSession()
        },

        addToQueue: (track) => {
            set(state => ({ queue: [...state.queue, track] }))
            persistSession()
        },

        playNext: (track) => {
            set(state => {
                const newQueue = [...state.queue]
                newQueue.splice(state.currentIndex + 1, 0, track)
                return { queue: newQueue }
            })
            persistSession()
        },

        togglePlay: () => {
            const { isPlaying, currentTrack, queue, currentIndex } = get()
            if (!currentTrack && queue.length > 0) {
                const first = queue[Math.max(0, currentIndex)]
                set({ currentTrack: first, currentIndex: Math.max(0, currentIndex) })
                loadAndPlay(first)
                return
            }

            if (!currentTrack && queue.length === 0) return

            if (isPlaying) {
                audio.pause()
                set({ isPlaying: false })
            } else {
                const playPromise = audio.play()
                if (playPromise) {
                    playPromise.catch(e => console.error("togglePlay failed:", e))
                }
                set({ isPlaying: true })
            }
            persistSession()
        },

        next: () => {
            const { queue, currentIndex, repeatMode } = get()
            if (queue.length === 0) return

            let nextIndex = currentIndex + 1

            if (nextIndex >= queue.length) {
                if (repeatMode === 'repeat-all') {
                    nextIndex = 0
                } else {
                    audio.pause()
                    audio.currentTime = 0
                    set({ isPlaying: false, progress: 0, currentTime: 0 })
                    return
                }
            }

            const nextTrack = queue[nextIndex]
            const mode = useSettings.getState().replayGainMode
            const replayGain = calculateReplayGain(nextTrack, mode)
            
            set({ 
                currentIndex: nextIndex, 
                currentTrack: nextTrack, 
                currentTime: 0, 
                progress: 0,
                replayGainApplied: replayGain
            })
            loadAndPlay(nextTrack)
            persistSession()
        },

        prev: () => {
            const { queue, currentIndex, currentTime } = get()
            if (currentTime > 3) {
                audio.currentTime = 0
                return
            }

            let prevIndex = currentIndex - 1
            if (prevIndex < 0) prevIndex = 0

            const prevTrack = queue[prevIndex]
            if (prevTrack) {
                const mode = useSettings.getState().replayGainMode
                const replayGain = calculateReplayGain(prevTrack, mode)
                
                set({ 
                    currentIndex: prevIndex, 
                    currentTrack: prevTrack, 
                    currentTime: 0, 
                    progress: 0,
                    replayGainApplied: replayGain
                })
                loadAndPlay(prevTrack)
            }
            persistSession()
        },

        seek: (time) => {
            if (!isFinite(time)) return
            audio.currentTime = time
            set({ currentTime: time })
            persistSession()
        },

        setVolume: (val) => {
            const clamped = Math.max(0, Math.min(1, val))
            const { replayGainApplied } = get()
            // Combine user volume with ReplayGain
            // Clamp final volume to prevent clipping
            const finalVolume = Math.min(1, clamped * replayGainApplied)
            audio.volume = finalVolume
            set({ volume: clamped })
            persistSession()
        },

        toggleShuffle: () => {
            const { isShuffle } = get()
            const newState = !isShuffle
            set({ isShuffle: newState })

            if (newState) {
                get().shuffleSubsequent()
            }
            // Optional: If turning shuffle OFF, we might want to restore original order? 
            // For now, let's keep it simple (destructive shuffle) as requested by most "Smart Shuffle" needs.

            persistSession()
        },

        setQueue: (newQueue) => {
            const { currentTrack } = get()
            let newIndex = -1
            if (currentTrack) {
                newIndex = newQueue.findIndex(t => t.id === currentTrack.id)
            }
            set({ queue: newQueue, currentIndex: newIndex })
            persistSession()
        },

        clearQueue: () => {
            set({ queue: [], currentIndex: -1, currentTrack: null, isPlaying: false })
            audio.pause()
            audio.src = ''
            persistSession()
        },

        shuffleSubsequent: () => {
            const { queue, currentIndex } = get()
            if (currentIndex >= queue.length - 1) return

            const played = queue.slice(0, currentIndex + 1)
            const remaining = queue.slice(currentIndex + 1)

            if (remaining.length <= 1) return

            // Group by Artist
            const artistMap = new Map<string, Track[]>()
            remaining.forEach(t => {
                const artist = t.artist || 'Unknown'
                if (!artistMap.has(artist)) artistMap.set(artist, [])
                artistMap.get(artist)!.push(t)
            })

            // Shuffle each artist's bucket internally
            artistMap.forEach(tracks => {
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]]
                }
            })

            // Reconstruct queue - Weighted Round Robinish
            // We pick a random artist, take one track, then pick another artist (that isn't the same as previous if possible)
            const shuffled: Track[] = []
            let lastArtist = ''

            while (artistMap.size > 0) {
                // Get available artists
                const artists = Array.from(artistMap.keys())

                // Try to pick an artist different from last one
                let candidates = artists.filter(a => a !== lastArtist)
                if (candidates.length === 0) candidates = artists // No choice, must repeat (or only 1 artist left)

                // Pick random artist
                const artistIndex = Math.floor(Math.random() * candidates.length)
                const pickedArtist = candidates[artistIndex]

                // Get track
                const tracks = artistMap.get(pickedArtist)!
                const track = tracks.pop()
                if (track) shuffled.push(track)

                // Cleanup
                if (tracks.length === 0) {
                    artistMap.delete(pickedArtist)
                }

                lastArtist = pickedArtist
            }

            set({ queue: [...played, ...shuffled] })
            persistSession()
        },

        playFromQueueAndCleanup: (index) => {
            const { queue } = get()
            const targetTrack = queue[index]
            if (!targetTrack) return

            const mode = useSettings.getState().replayGainMode
            const replayGain = calculateReplayGain(targetTrack, mode)

            const newQueue = queue.slice(index)
            set({
                queue: newQueue,
                currentIndex: 0,
                currentTrack: targetTrack,
                currentTime: 0,
                progress: 0,
                replayGainApplied: replayGain
            })
            loadAndPlay(targetTrack)
            persistSession()
        },

        reorderQueue: (fromIndex, toIndex) => {
            const { queue, currentIndex } = get()
            const newQueue = [...queue]
            const [movedTrack] = newQueue.splice(fromIndex, 1)
            newQueue.splice(toIndex, 0, movedTrack)

            // Adjust currentIndex if necessary
            let newCurrentIndex = currentIndex
            if (currentIndex === fromIndex) {
                newCurrentIndex = toIndex
            } else if (currentIndex > fromIndex && currentIndex <= toIndex) {
                newCurrentIndex--
            } else if (currentIndex < fromIndex && currentIndex >= toIndex) {
                newCurrentIndex++
            }

            set({ queue: newQueue, currentIndex: newCurrentIndex })
            persistSession()
        },

        insertToQueue: (tracks, index) => {
            const { queue, currentIndex } = get()
            const newQueue = [...queue]
            newQueue.splice(index, 0, ...tracks)

            // Adjust currentIndex if insertion point is before current track
            let newCurrentIndex = currentIndex
            if (index <= currentIndex) {
                newCurrentIndex += tracks.length
            }

            set({ queue: newQueue, currentIndex: newCurrentIndex })
            persistSession()
        },

        toggleRepeat: () => {
            set(state => {
                const next: PlayMode =
                    state.repeatMode === 'normal' ? 'repeat-all' :
                        state.repeatMode === 'repeat-all' ? 'repeat-one' : 'normal'
                audio.loop = next === 'repeat-one'
                return { repeatMode: next }
            })
            persistSession()
        },

        loadSession: async () => {
            try {
                const session = await window.api.player.loadSession()
                if (session) {
                    const { queue, currentIndex, volume, isShuffle, repeatMode, currentTime } = session
                    const track = queue && currentIndex >= 0 ? queue[currentIndex] : null

                    // Calculate ReplayGain for current track
                    const mode = useSettings.getState().replayGainMode
                    const replayGain = track ? calculateReplayGain(track, mode) : 1

                    set({
                        queue: queue || [],
                        currentIndex: currentIndex ?? -1,
                        volume: volume ?? 1,
                        isShuffle: !!isShuffle,
                        repeatMode: repeatMode || 'normal',
                        currentTime: currentTime || 0,
                        currentTrack: track,
                        replayGainApplied: replayGain
                    })

                    // Apply final volume with ReplayGain
                    const finalVolume = Math.min(1, (volume ?? 1) * replayGain)
                    audio.volume = finalVolume
                    if (track) {
                        let src = ''
                        if (track.filePath) {
                            const normalized = track.filePath.replace(/\\/g, '/')
                            src = `asset:///${encodeURI(normalized)}`
                        }
                        if (src) {
                            audio.src = src
                            audio.load()
                            audio.currentTime = currentTime || 0
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load session:', error)
            }
        }
    }
})
