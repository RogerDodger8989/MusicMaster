import { create } from 'zustand'

interface TaggingProgress {
  isTagging: boolean
  current: number
  total: number
  currentTrack: string
}

interface TaggingStore {
  progress: TaggingProgress | null
  startTagging: (total: number, trackName: string) => void
  updateProgress: (current: number, trackName: string) => void
  finishTagging: () => void
}

export const useTagging = create<TaggingStore>((set) => ({
  progress: null,

  startTagging: (total, trackName) =>
    set({
      progress: {
        isTagging: true,
        current: 0,
        total,
        currentTrack: trackName
      }
    }),

  updateProgress: (current, trackName) =>
    set((state) =>
      state.progress
        ? {
            progress: {
              ...state.progress,
              current,
              currentTrack: trackName
            }
          }
        : state
    ),

  finishTagging: () =>
    set({
      progress: null
    })
}))
