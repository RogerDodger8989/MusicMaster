import { create } from 'zustand'
import type { Track } from '../types'
import { calculateReplayGain } from '../utils/replayGain'
import { useSettings } from './settings'
import { useLibrary } from './library'
import { client } from '../api/client'
import { useCastStore } from './cast'

type PlayMode = 'normal' | 'repeat-all' | 'repeat-one'

interface PlayerState {
  queue: Track[]
  currentIndex: number
  isPlaying: boolean
  volume: number // 0 to 1 (user volume)
  progress: number // 0 to 100 (percentage for simplified UI)
  currentTime: number // current seconds
  duration: number // total seconds
  isShuffle: boolean
  repeatMode: PlayMode
  currentTrack: Track | null
  history: Track[]
  historyTrackIds: Set<string>
  replayGainApplied: number // 0 to 1+ (calculated from ReplayGain metadata)
  trackPlayCount: number // Play count for current track
  isMuted: boolean
  prevVolume: number

  // Actions
  playTrack: (track: Track) => void
  playAlbum: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void // Adds to end
  playNext: (track: Track) => void // Adds after current
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (val: number) => void
  toggleMute: () => void
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
  handOffToCast: () => void
  handOffToLocal: () => void
}

// Global Audio Elements (active + preloaded)
let activeAudio = new Audio()
let preloadAudio = new Audio()
preloadAudio.preload = 'auto'
let preloadedTrackIndex: number | null = null
let preloadedTrack: Track | null = null

// Audio Analysis Setup
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null

export const getAnalyser = () => {
  if (!analyser) {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source = audioCtx.createMediaElementSource(activeAudio)
    source.connect(analyser)
    analyser.connect(audioCtx.destination)
  }
  return analyser
}

// DEBUG ALERT - REMOVE AFTER FIXING
if (typeof window !== 'undefined') {
  // console.error to be visible
  console.error('PLAYER SCRIPT LOADED')
    // window.alert("PLAYER LOADED - IF YOU SEE THIS, UPDATE WORKED")

    // Expose Debug Helper
    ; (window as any).DEBUG_PLAY_TRACK = (path: string) => {
      console.error('DEBUG: Manual Play Triggered for', path)
      const audio = new Audio()
      const src = `asset:///${encodeURI(path.replace(/\\/g, '/'))}`
      console.error('DEBUG: Manual Source of Audio:', src)
      audio.src = src
      audio
        .play()
        .then(() => console.error('DEBUG: Manual Play SUCCESS'))
        .catch((e) => console.error('DEBUG: Manual Play FAILED', e))
    }
}

export const usePlayer = create<PlayerState>((set, get) => {
  const getTrackSrc = (track: Track) => {
    if (!track.id) return ''
    return client.getAudioUrl(track.id)
  }

  const applyEffectiveVolume = (volume: number, replayGain: number) => {
    const finalVolume = Math.min(1, Math.max(0, volume * replayGain))
    activeAudio.volume = finalVolume
  }

  // --- Persistence Helper ---
  let saveTimeout: any = null
  const persistSession = () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      const state = get()
      try {
        // Ensure no circular references or huge objects
        await client.saveSession({
          currentTrackId: state.currentTrack?.id,
          queueIds: state.queue.map((t) => t.id),
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

  const attachAudioListeners = () => {
    activeAudio.ontimeupdate = () => {
      const { currentTrack, duration } = get()
      const currentTime = activeAudio.currentTime
      const progress = (currentTime / (duration || 1)) * 100

      // Add to history if 50% played
      if (currentTrack && duration > 0 && progress >= 50) {
        const { historyTrackIds } = get()
        const alreadyInHistory = historyTrackIds.has(currentTrack.id)
        if (!alreadyInHistory) {
          // Record play for scrobbling
          console.log(
            '🎵 50% played, recording play:',
            currentTrack.title,
            'by',
            currentTrack.artist
          )

          // Use client to scrobble
          client
            .scrobble(
              currentTrack.artist,
              currentTrack.title,
              currentTrack.album,
              currentTrack.duration,
              Math.floor(Date.now() / 1000)
            )
            .then(() => {
              console.log('✅ Play recorded to scrobble queue via API')
              // Increment local count for immediate feedback
              const currentCount = currentTrack.playCount || 0
              const newCount = currentCount + 1
              useLibrary.getState().updateTrack(currentTrack.id, { playCount: newCount })
              set({ trackPlayCount: newCount })
            })
            .catch((err) => {
              console.error('❌ Failed to record play:', err)
            })

          historyTrackIds.add(currentTrack.id)
          set((state) => ({
            history: [currentTrack, ...state.history.filter((t) => t.id !== currentTrack.id)].slice(
              0,
              50
            )
          }))
        }
      }

      set({
        currentTime,
        progress,
        duration: activeAudio.duration || 0
      })
    }

    activeAudio.onended = () => {
      get().next()
    }

    activeAudio.onerror = (e) => {
      console.error('Audio Error Event:', e)
      set({ isPlaying: false })
    }
  }

  const setActiveAudio = (audioEl: HTMLAudioElement) => {
    activeAudio.ontimeupdate = null
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio = audioEl
    activeAudio.loop = get().repeatMode === 'repeat-one'
    attachAudioListeners()
  }

  const computeNextIndex = (
    queue: Track[],
    currentIndex: number,
    repeatMode: PlayMode,
    ignoreRepeatOne = false
  ) => {
    if (!queue.length) return null
    if (repeatMode === 'repeat-one' && !ignoreRepeatOne) return null

    const nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      if (repeatMode === 'repeat-all') return 0
      return null
    }
    return nextIndex
  }

  const preloadNextTrack = () => {
    const gaplessEnabled = useSettings.getState().gaplessEnabled
    const castStore = useCastStore.getState()
    if (!gaplessEnabled || castStore.activeDevice) {
      preloadedTrackIndex = null
      preloadedTrack = null
      preloadAudio.src = ''
      return
    }

    const { queue, currentIndex, repeatMode } = get()
    const nextIndex = computeNextIndex(queue, currentIndex, repeatMode)
    if (nextIndex === null) {
      preloadedTrackIndex = null
      preloadedTrack = null
      preloadAudio.src = ''
      return
    }

    const nextTrack = queue[nextIndex]
    const src = getTrackSrc(nextTrack)
    if (!src) {
      preloadedTrackIndex = null
      preloadedTrack = null
      preloadAudio.src = ''
      return
    }

    preloadedTrackIndex = nextIndex
    preloadedTrack = nextTrack
    preloadAudio.src = src
    preloadAudio.load()
  }

  // --- Audio Event Listeners ---
  attachAudioListeners()

  // --- Helper to start playback ---
  const loadAndPlay = (track: Track) => {
    const src = getTrackSrc(track)
    if (!src) return

    const { volume, replayGainApplied } = get()
    applyEffectiveVolume(volume, replayGainApplied)

    const castStore = useCastStore.getState()
    if (castStore.activeDevice) {
      activeAudio.pause()
      activeAudio.src = ''
      window.api.cast.play(track, castStore.activeDevice.type)
      set({ isPlaying: true, duration: track.duration || 0 })
      return
    }

    if (activeAudio.src === src) {
      activeAudio
        .play()
        .then(() => {
          set({ isPlaying: true })
        })
        .catch((err) => {
          console.error('[Player] Resume failed:', err)
          set({ isPlaying: false })
        })
      return
    }

    activeAudio.pause()
    activeAudio.src = src
    activeAudio.load()

    const playPromise = activeAudio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          set({ isPlaying: true, duration: activeAudio.duration || 0 })
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error(`[Player] Failed to play ${track.title}:`, err)
            set({ isPlaying: false })
          }
        })
    }

    // Preload next track for gapless playback
    preloadNextTrack()
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
    trackPlayCount: 0,
    isMuted: false,
    prevVolume: 1,

    handOffToCast: () => {
      const { currentTrack, currentTime, isPlaying } = get()
      const castStore = useCastStore.getState()

      if (!currentTrack || !castStore.activeDevice) return

      if (activeAudio.src) {
        activeAudio.pause()
        activeAudio.src = ''
      }
      preloadAudio.pause()
      preloadAudio.src = ''
      preloadedTrackIndex = null
      preloadedTrack = null

      window.api.cast.play(currentTrack, castStore.activeDevice.type)
        .then(() => {
          if (currentTime > 0) {
            setTimeout(() => {
              const activeDev = useCastStore.getState().activeDevice
              if (activeDev) window.api.cast.seek(currentTime, activeDev.type)
            }, 1000)
          }
          if (!isPlaying) {
            setTimeout(() => {
              const activeDev = useCastStore.getState().activeDevice
              if (activeDev) window.api.cast.pause(activeDev.type)
            }, 1500)
          }
        })
    },

    handOffToLocal: () => {
      const { currentTrack, currentTime, isPlaying, volume, replayGainApplied } = get()
      if (!currentTrack) return

      const src = getTrackSrc(currentTrack)
      if (src) {
        activeAudio.src = src
        activeAudio.load()
        activeAudio.currentTime = currentTime
        applyEffectiveVolume(volume, replayGainApplied)

        if (isPlaying) {
          activeAudio.play().catch(e => console.error('[Player] Local handoff resume failed:', e))
        }
      }
    },

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
        replayGainApplied: replayGain,
        trackPlayCount: 0
      })
      loadAndPlay(track)
      persistSession()

      // Fetch play count
      client
        .getTrack(track.id)
        .then((t) => {
          if (t) set({ trackPlayCount: t.playCount || 0 })
        })
        .catch((err) => {
          console.error('Failed to fetch play count:', err)
        })
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
        replayGainApplied: replayGain,
        trackPlayCount: 0
      })
      loadAndPlay(targetTrack)
      persistSession()

      // Fetch play count
      client
        .getTrack(targetTrack.id)
        .then((t) => {
          if (t) set({ trackPlayCount: t.playCount || 0 })
        })
        .catch((err) => {
          console.error('Failed to fetch play count:', err)
        })
    },

    addToQueue: (track) => {
      set((state) => ({ queue: [...state.queue, track] }))
      preloadNextTrack()
      persistSession()
    },

    playNext: (track) => {
      set((state) => {
        const newQueue = [...state.queue]
        newQueue.splice(state.currentIndex + 1, 0, track)
        return { queue: newQueue }
      })
      preloadNextTrack()
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

      const castStore = useCastStore.getState()
      if (castStore.activeDevice) {
        if (isPlaying) {
          window.api.cast.pause(castStore.activeDevice.type)
          set({ isPlaying: false })
        } else {
          window.api.cast.resume(castStore.activeDevice.type)
          set({ isPlaying: true })
        }
        persistSession()
        return
      }

      if (isPlaying) {
        activeAudio.pause()
        set({ isPlaying: false })
      } else {
        const playPromise = activeAudio.play()
        if (playPromise) {
          playPromise.catch((e) => console.error('togglePlay failed:', e))
        }
        set({ isPlaying: true })
      }
      persistSession()
    },

    next: () => {
      const { queue, currentIndex, repeatMode } = get()
      if (queue.length === 0) return
      const nextIndex = computeNextIndex(queue, currentIndex, repeatMode, true)
      if (nextIndex === null) {
        activeAudio.pause()
        activeAudio.currentTime = 0
        set({ isPlaying: false, progress: 0, currentTime: 0 })
        return
      }

      const nextTrack = queue[nextIndex]
      const mode = useSettings.getState().replayGainMode
      const replayGain = calculateReplayGain(nextTrack, mode)

      const gaplessEnabled = useSettings.getState().gaplessEnabled
      const castStore = useCastStore.getState()
      if (
        gaplessEnabled &&
        !castStore.activeDevice &&
        preloadedTrackIndex === nextIndex &&
        preloadedTrack &&
        preloadAudio.src
      ) {
        set({
          currentIndex: nextIndex,
          currentTrack: nextTrack,
          currentTime: 0,
          progress: 0,
          replayGainApplied: replayGain,
          trackPlayCount: 0
        })

        const oldAudio = activeAudio
        oldAudio.pause()
        oldAudio.currentTime = 0
        oldAudio.src = ''
        oldAudio.load()
        setActiveAudio(preloadAudio)
        preloadAudio = oldAudio
        preloadAudio.src = ''
        preloadAudio.load()

        applyEffectiveVolume(get().volume, replayGain)
        const playPromise = activeAudio.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              set({ isPlaying: true, duration: activeAudio.duration || 0 })
            })
            .catch((err) => {
              if (err.name !== 'AbortError') {
                console.error(`[Player] Failed to play ${nextTrack.title}:`, err)
                set({ isPlaying: false })
              }
            })
        }

        preloadNextTrack()
        persistSession()

        // Fetch play count
        client
          .getTrack(nextTrack.id)
          .then((t) => {
            if (t) set({ trackPlayCount: t.playCount || 0 })
          })
          .catch((err) => {
            console.error('Failed to fetch play count:', err)
          })
        return
      }

      set({
        currentIndex: nextIndex,
        currentTrack: nextTrack,
        currentTime: 0,
        progress: 0,
        replayGainApplied: replayGain,
        trackPlayCount: 0
      })
      loadAndPlay(nextTrack)
      persistSession()

      // Fetch play count
      client
        .getTrack(nextTrack.id)
        .then((t) => {
          if (t) set({ trackPlayCount: t.playCount || 0 })
        })
        .catch((err) => {
          console.error('Failed to fetch play count:', err)
        })
    },

    prev: () => {
      const { queue, currentIndex, currentTime } = get()
      const castStore = useCastStore.getState()

      if (currentTime > 3) {
        if (castStore.activeDevice) {
          window.api.cast.seek(0, castStore.activeDevice.type)
          set({ currentTime: 0 })
        } else {
          activeAudio.currentTime = 0
          set({ currentTime: 0 })
        }
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

    seek: (time: number) => {
      const castStore = useCastStore.getState()
      if (castStore.activeDevice) {
        window.api.cast.seek(time, castStore.activeDevice.type)
        set({ currentTime: time })
        return
      }

      if (!isFinite(time)) return
      activeAudio.currentTime = time
      set({ currentTime: time })
      persistSession() // Added back persistSession for non-cast path
    },

    setVolume: (val: number) => {
      const clamped = Math.min(1, Math.max(0, val))

      const castStore = useCastStore.getState()
      if (castStore.activeDevice) {
        window.api.cast.setVolume(clamped, castStore.activeDevice.type)
      } else {
        const replayGain = get().replayGainApplied
        applyEffectiveVolume(clamped, replayGain)
      }

      set({ volume: clamped, isMuted: clamped === 0 })
      persistSession()
    },

    toggleMute: () => {
      const { isMuted, volume, prevVolume, replayGainApplied } = get()
      if (isMuted) {
        // Unmute
        const restoreVol = prevVolume || 0.5
        applyEffectiveVolume(restoreVol, replayGainApplied)
        set({ isMuted: false, volume: restoreVol })
      } else {
        // Mute
        applyEffectiveVolume(0, replayGainApplied)
        set({ isMuted: true, volume: 0, prevVolume: volume })
      }
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
        newIndex = newQueue.findIndex((t) => t.id === currentTrack.id)
      }
      set({ queue: newQueue, currentIndex: newIndex })
      preloadNextTrack()
      persistSession()
    },

    clearQueue: () => {
      set({ queue: [], currentIndex: -1, currentTrack: null, isPlaying: false })
      activeAudio.pause()
      activeAudio.src = ''
      preloadedTrackIndex = null
      preloadedTrack = null
      preloadAudio.src = ''
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
      remaining.forEach((t) => {
        const artist = t.artist || 'Unknown'
        if (!artistMap.has(artist)) artistMap.set(artist, [])
        artistMap.get(artist)!.push(t)
      })

      // Shuffle each artist's bucket internally
      artistMap.forEach((tracks) => {
        for (let i = tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
            ;[tracks[i], tracks[j]] = [tracks[j], tracks[i]]
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
        let candidates = artists.filter((a) => a !== lastArtist)
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
      preloadNextTrack()
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
      preloadNextTrack()
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
      preloadNextTrack()
      persistSession()
    },

    toggleRepeat: () => {
      set((state) => {
        const next: PlayMode =
          state.repeatMode === 'normal'
            ? 'repeat-all'
            : state.repeatMode === 'repeat-all'
              ? 'repeat-one'
              : 'normal'
        activeAudio.loop = next === 'repeat-one'
        return { repeatMode: next }
      })
      preloadNextTrack()
      persistSession()
    },

    loadSession: async () => {
      try {
        const session = await client.getSession()
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
          applyEffectiveVolume(volume ?? 1, replayGain)
          if (track) {
            const src = getTrackSrc(track)
            if (src) {
              activeAudio.src = src
              activeAudio.load()
              activeAudio.currentTime = currentTime || 0
            }
            // Fetch play count for the restored track to sync UI
            client
              .getTrack(track.id)
              .then((t) => {
                if (t) set({ trackPlayCount: t.playCount || 0 })
              })
              .catch((err) => console.error('Failed to fetch play count on session load:', err))
          }
          preloadNextTrack()
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      }
    },

    updateTrack: (trackId: string, updates: Partial<Track>) => {
      const { currentTrack, queue } = get()
      if (currentTrack && currentTrack.id === trackId) {
        set({
          currentTrack: { ...currentTrack, ...updates }
        })
      }

      // Also update in queue
      const updatedQueue = queue.map((t) => (t.id === trackId ? { ...t, ...updates } : t))
      set({ queue: updatedQueue })
    }
  }
})
