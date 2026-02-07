import { X, Music } from 'lucide-react'
import { useSyncStore } from '../store/sync'

export default function SyncProgressToast() {
    const { progress, cancelSync } = useSyncStore()

    if (!progress || !progress.isRunning) return null

    return (
        <div className="fixed top-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-4 w-80 z-50 animate-slide-in">
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-blue-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-white">Syncing Play Counts</h3>
                </div>
                <button
                    onClick={cancelSync}
                    className="text-zinc-400 hover:text-white transition-colors"
                    title="Hide (sync continues in background)"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-2">
                <p className="text-xs text-zinc-400 truncate" title={progress.trackName}>
                    {progress.trackName}
                </p>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{progress.current} / {progress.total}</span>
                    <span className="font-semibold text-blue-400">{progress.percentage}%</span>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div 
                        className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                        style={{ width: `${progress.percentage}%` }}
                    />
                </div>

                {progress.errors.length > 0 && (
                    <p className="text-xs text-yellow-400">
                        ⚠️ {progress.errors.length} error(s)
                    </p>
                )}
            </div>
        </div>
    )
}
