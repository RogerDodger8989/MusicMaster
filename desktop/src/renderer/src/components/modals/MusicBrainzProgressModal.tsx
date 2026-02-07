import { X, Check, AlertCircle, Music } from 'lucide-react'

interface MusicBrainzProgressModalProps {
  isOpen: boolean
  onClose: () => void
  progress: {
    current: number
    total: number
    trackName?: string
    trackPath?: string
  }
  results?: {
    total: number
    enhanced?: number
    success?: number
    failed: number
    noMatch?: number
    alreadyHasMBID?: number
    skipped?: number
  }
  isComplete: boolean
  operation: 'enhance' | 'sync' | 'refresh'
}

export default function MusicBrainzProgressModal({
  isOpen,
  onClose,
  progress,
  results,
  isComplete,
  operation
}: MusicBrainzProgressModalProps) {
  if (!isOpen) return null

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const getOperationTitle = () => {
    switch (operation) {
      case 'enhance':
        return 'Enhancing Library with MusicBrainz'
      case 'sync':
        return 'Syncing Metadata to Files'
      case 'refresh':
        return 'Refreshing MusicBrainz Metadata'
      default:
        return 'Processing...'
    }
  }

  const getOperationIcon = () => {
    if (isComplete) {
      return <Check className="w-6 h-6 text-green-500" />
    }
    return <Music className="w-6 h-6 text-blue-500 animate-pulse" />
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {getOperationIcon()}
            <h2 className="text-xl font-bold text-white">{getOperationTitle()}</h2>
          </div>
          {isComplete && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Progress Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          {!isComplete && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Progress</span>
                <span className="text-white font-medium">
                  {progress.current} / {progress.total} ({percentage}%)
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Current Track Info */}
          {!isComplete && (progress.trackName || progress.trackPath) && (
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <p className="text-xs text-zinc-500 mb-1">Currently processing:</p>
              <p className="text-sm text-white font-medium truncate">
                {progress.trackName || progress.trackPath}
              </p>
            </div>
          )}

          {/* Results Summary */}
          {isComplete && results && (
            <div className="space-y-4">
              {/* Success Summary */}
              <div className="p-4 bg-green-900/20 border border-green-900/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-green-400">Operation Complete!</h3>
                </div>
                <p className="text-sm text-zinc-300">
                  Processed {results.total} {results.total === 1 ? 'track' : 'tracks'}
                </p>
              </div>

              {/* Detailed Results */}
              <div className="grid grid-cols-2 gap-3">
                {/* Enhanced/Success Count */}
                {(results.enhanced !== undefined || results.success !== undefined) && (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">
                        {operation === 'enhance'
                          ? 'Enhanced'
                          : operation === 'sync'
                            ? 'Written'
                            : 'Refreshed'}
                      </span>
                      <span className="text-lg font-bold text-green-400">
                        {results.enhanced ?? results.success ?? 0}
                      </span>
                    </div>
                  </div>
                )}

                {/* Already Has MBID */}
                {results.alreadyHasMBID !== undefined && results.alreadyHasMBID > 0 && (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Already tagged</span>
                      <span className="text-lg font-bold text-blue-400">
                        {results.alreadyHasMBID}
                      </span>
                    </div>
                  </div>
                )}

                {/* No Match */}
                {results.noMatch !== undefined && results.noMatch > 0 && (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">No match found</span>
                      <span className="text-lg font-bold text-yellow-400">{results.noMatch}</span>
                    </div>
                  </div>
                )}

                {/* Skipped */}
                {results.skipped !== undefined && results.skipped > 0 && (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Skipped</span>
                      <span className="text-lg font-bold text-yellow-400">{results.skipped}</span>
                    </div>
                  </div>
                )}

                {/* Failed */}
                {results.failed > 0 && (
                  <div className="p-3 bg-zinc-800 rounded-lg border border-red-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Failed</span>
                      <span className="text-lg font-bold text-red-400">{results.failed}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning for failures */}
              {results.failed > 0 && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">
                    <p className="font-medium">Some tracks could not be processed</p>
                    <p className="text-xs text-red-400 mt-1">Check the console for error details</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {isComplete && (
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          )}

          {/* Processing Note */}
          {!isComplete && (
            <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-300">
                Please wait while we process your library. This may take several minutes depending
                on library size.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
