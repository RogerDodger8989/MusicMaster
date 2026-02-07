import { useState } from 'react'
import { useLibrary } from '../store/library'
import { Track } from '../types'

export function useTrackSelection(tracks: Track[]) {
  const { selectedTracks, setSelectedTracks, toggleTrackSelection } = useLibrary()
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const handleTrackClick = (e: React.MouseEvent, trackId: string, index: number) => {
    e.stopPropagation()

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      toggleTrackSelection(trackId)
      setLastSelectedId(trackId)
    } else if (e.shiftKey && lastSelectedId) {
      // Range selection
      // Find index of last selected track in the CURRENT list
      const lastIndex = tracks.findIndex((t) => t.id === lastSelectedId)
      if (lastIndex !== -1) {
        const start = Math.min(lastIndex, index)
        const end = Math.max(lastIndex, index)
        const rangeIds = tracks.slice(start, end + 1).map((t) => t.id)
        setSelectedTracks(rangeIds)
      }
    } else {
      // Single selection
      setSelectedTracks([trackId])
      setLastSelectedId(trackId)
    }
  }

  const clearSelection = () => {
    setSelectedTracks([])
    setLastSelectedId(null)
  }

  const selectSingleTrack = (trackId: string) => {
    setSelectedTracks([trackId])
    setLastSelectedId(trackId)
  }

  return {
    selectedTracks,
    handleTrackClick,
    clearSelection,
    selectSingleTrack,
    setSelectedTracks
  }
}
