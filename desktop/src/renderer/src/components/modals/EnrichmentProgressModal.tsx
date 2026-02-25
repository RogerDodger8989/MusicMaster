import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useDraggable } from '../../hooks/useDraggable'

interface EnrichmentProgress {
  totalAlbums: number
  processedAlbums: number
  totalTracks: number
  enrichedTracks: number
  performersAdded: number
  acousticbrainzAdded: number
  errors: string[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  progress: EnrichmentProgress | null
  isComplete: boolean
  isPending: boolean
}

export default function EnrichmentProgressModal({ isOpen, onClose, progress, isComplete, isPending }: Props) {
  const { position, handleMouseDown } = useDraggable()
  if (!isOpen) return null

  const percentage = progress && progress.totalAlbums > 0
    ? Math.round((progress.processedAlbums / progress.totalAlbums) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
      <div
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`
        }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full shadow-2xl pointer-events-auto absolute"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b border-zinc-800 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-lg font-semibold text-white">Library Enrichment</h2>
          <button
            onClick={onClose}
            disabled={!isComplete && isPending}
            className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!isComplete && isPending ? (
            <>
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Progress</span>
                  <span className="text-sm font-semibold text-white">{percentage}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              {progress && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Albums (Smart Batched)</span>
                    <span className="text-white font-semibold">
                      {progress.processedAlbums} / {progress.totalAlbums}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Tracks Enriched</span>
                    <span className="text-white font-semibold">
                      {progress.enrichedTracks} / {progress.totalTracks}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Performers Fetched</span>
                    <span className="text-green-400 font-semibold">{progress.performersAdded}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Mood/BPM Data</span>
                    <span className="text-green-400 font-semibold">{progress.acousticbrainzAdded}</span>
                  </div>
                </div>
              )}

              {/* Errors */}
              {progress && progress.errors.length > 0 && (
                <div className="bg-red-900/10 border border-red-900/30 rounded p-3">
                  <p className="text-xs text-red-400 font-semibold mb-1">Errors ({progress.errors.length})</p>
                  <ul className="text-xs text-red-300/80 space-y-1 max-h-24 overflow-y-auto">
                    {progress.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {progress.errors.length > 5 && (
                      <li>• ... and {progress.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <p className="text-xs text-zinc-500 text-center pt-2">
                Rate limited: 1.1s per request to prevent API bans
              </p>
            </>
          ) : isComplete ? (
            <>
              <div className="flex items-center justify-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>

              {progress && (
                <div className="space-y-2 bg-green-900/10 border border-green-900/30 rounded p-4">
                  <p className="text-sm text-green-400 font-semibold">Enrichment Complete!</p>
                  <div className="space-y-1 text-xs text-green-300/90">
                    <div>✓ {progress.performersAdded} performers added</div>
                    <div>✓ {progress.acousticbrainzAdded} tracks with mood/BPM data</div>
                    <div>✓ {progress.enrichedTracks} total tracks enriched</div>
                  </div>
                </div>
              )}

              <p className="text-xs text-zinc-500 text-center">
                Your library metadata has been enhanced with performers, relationships, and audio analysis data.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center py-4">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
              </div>
              <p className="text-sm text-center text-zinc-300">
                Ready to enrich your library?
              </p>
              <p className="text-xs text-zinc-500 text-center">
                This will fetch performer data and mood/BPM info for all tracks with MusicBrainz IDs.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-6 border-t border-zinc-800">
          <button
            onClick={onClose}
            disabled={!isComplete && isPending}
            className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
