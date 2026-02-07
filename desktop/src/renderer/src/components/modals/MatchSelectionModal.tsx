import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface TrackMatch {
  title: string
  duration: number
  expectedDuration: number
  position: number
}

interface MusicBrainzCandidate {
  recordingMbid: string
  releaseMbid: string
  releaseGroupMbid?: string
  artistMbid?: string
  artistName: string
  albumName: string
  year?: number
  country?: string
  format?: string
  label?: string
  confidence: number
  tracks: TrackMatch[]
}

interface MatchSelectionModalProps {
  trackInfo: {
    id: string
    title: string
    artist: string
    album: string
    duration: number
  }
  candidates: MusicBrainzCandidate[]
  onSelect: (candidate: MusicBrainzCandidate) => void
  onSkip: () => void
  onClose: () => void
}

export function MatchSelectionModal({
  trackInfo,
  candidates,
  onSelect,
  onSkip,
  onClose
}: MatchSelectionModalProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Center modal on mount
    const modalWidth = 900
    const modalHeight = 700
    setPosition({
      x: (window.innerWidth - modalWidth) / 2,
      y: (window.innerHeight - modalHeight) / 2
    })
  }, [])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: MouseEvent): void => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const selectedCandidate = candidates[selectedIndex]

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getDurationDiff = (expected: number, actual: number): number => {
    return Math.abs(expected - actual)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-[#1a1a1a] rounded-lg shadow-2xl border border-gray-700"
        style={{
          width: '900px',
          height: '700px',
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div className="modal-header flex items-center justify-between p-4 border-b border-gray-700 cursor-grab active:cursor-grabbing">
          <div>
            <h2 className="text-lg font-semibold text-white">Select Release</h2>
            <p className="text-sm text-gray-400 mt-1">
              {trackInfo.artist} - {trackInfo.album}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex" style={{ height: 'calc(100% - 130px)' }}>
          {/* Left: Release List */}
          <div className="w-1/2 border-r border-gray-700 overflow-y-auto p-4">
            <div className="space-y-2">
              {candidates.map((candidate, index) => (
                <div
                  key={`${candidate.releaseMbid}-${index}`}
                  onClick={() => setSelectedIndex(index)}
                  className={`p-3 rounded cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{candidate.albumName}</div>
                      <div className="text-sm opacity-80 mt-1">{candidate.artistName}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                        {candidate.year && <span>{candidate.year}</span>}
                        {candidate.country && <span>{candidate.country}</span>}
                        {candidate.format && <span>[{candidate.format}]</span>}
                      </div>
                      {candidate.label && (
                        <div className="text-xs opacity-60 mt-1">{candidate.label}</div>
                      )}
                    </div>
                    <div className="ml-3">
                      <span
                        className={`text-xs font-semibold ${getConfidenceColor(candidate.confidence)}`}
                      >
                        {candidate.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Track List & Metadata Preview */}
          <div className="w-1/2 overflow-y-auto">
            {/* Metadata Preview */}
            <div className="p-4 bg-gray-900 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Metadata to be written:</h3>
              <div className="space-y-2 text-xs">
                <div className="flex">
                  <span className="text-gray-500 w-32">Artist:</span>
                  <span className="text-gray-300">{selectedCandidate.artistName}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-32">Album:</span>
                  <span className="text-gray-300">{selectedCandidate.albumName}</span>
                </div>
                {selectedCandidate.year && (
                  <div className="flex">
                    <span className="text-gray-500 w-32">Year:</span>
                    <span className="text-gray-300">{selectedCandidate.year}</span>
                  </div>
                )}
                {selectedCandidate.label && (
                  <div className="flex">
                    <span className="text-gray-500 w-32">Label:</span>
                    <span className="text-gray-300">{selectedCandidate.label}</span>
                  </div>
                )}
                <div className="flex">
                  <span className="text-gray-500 w-32">MBID:</span>
                  <span className="text-gray-300 font-mono text-[10px]">
                    {selectedCandidate.recordingMbid.substring(0, 20)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Track List */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Tracks ({selectedCandidate.tracks.length}):
              </h3>
              <div className="space-y-1">
                {selectedCandidate.tracks.map((track, idx) => {
                  const diff = getDurationDiff(track.expectedDuration, track.duration)
                  const isDifferent = diff > 2
                  const isCurrentTrack = track.title.toLowerCase() === trackInfo.title.toLowerCase()

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded text-xs ${
                        isCurrentTrack ? 'bg-blue-900/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-gray-500 w-6">{track.position}</span>
                        <span
                          className={`truncate ${isDifferent ? 'text-gray-300' : 'text-gray-400'}`}
                        >
                          {track.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={isDifferent ? 'text-red-400 font-semibold' : 'text-gray-500'}
                        >
                          {formatDuration(track.duration)}
                        </span>
                        {isDifferent && (
                          <span className="text-gray-600 text-[10px]">
                            (expected: {formatDuration(track.expectedDuration)})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-[#1a1a1a] flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Confidence:{' '}
            <span className={`font-semibold ${getConfidenceColor(selectedCandidate.confidence)}`}>
              {selectedCandidate.confidence}%
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Skip
            </button>
            <button
              onClick={() => onSelect(selectedCandidate)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
