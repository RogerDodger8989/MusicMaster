import { useState, useMemo } from 'react'
import { Hash, Clock, Star, Heart, Search } from 'lucide-react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { cn } from '../lib/utils'
import TrackContextMenu from '../components/TrackContextMenu'
import { Track } from '../types'
import { useTrackSelection } from '../hooks/useTrackSelection'

export default function TracksView() {
    const { tracks, toggleLoved, rateTrack } = useLibrary()
    const { currentTrack, isPlaying } = usePlayer()
    const [searchQuery, setSearchQuery] = useState('')
    const [contextMenu, setContextMenu] = useState<{ track: Track, x: number, y: number } | null>(null)

    const filteredTracks = useMemo(() => {
        if (!searchQuery.trim()) return tracks
        const q = searchQuery.toLowerCase()
        return tracks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        )
    }, [tracks, searchQuery])

    const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } = useTrackSelection(filteredTracks)

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto" onClick={clearSelection}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">Tracks</h2>
                    <p className="text-zinc-500 text-sm mt-1">{filteredTracks.length} tracks in your library</p>
                </div>

                <div className="relative w-full md:w-80" onClick={e => e.stopPropagation()}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search tracks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-[3rem_2fr_1.5fr_1.5fr_3rem_1fr_4rem] gap-4 px-6 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50">
                    <div className="text-center flex justify-center"><Hash className="w-3 h-3" /></div>
                    <div>Title</div>
                    <div>Artist</div>
                    <div>Album</div>
                    <div className="text-right">Played</div>
                    <div className="text-center">Rating</div>
                    <div className="text-right flex justify-end"><Clock className="w-3 h-3" /></div>
                </div>

                <div className="divide-y divide-zinc-900 overflow-y-auto max-h-[calc(100vh-280px)] custom-scrollbar">
                    {filteredTracks.map((track, idx) => {
                        const isCurrentTrack = currentTrack?.id === track.id
                        const isCurrentPlaying = isCurrentTrack && isPlaying
                        const isSelected = selectedTracks.includes(track.id)

                        return (
                            <div
                                key={track.id}
                                onClick={(e) => handleTrackClick(e, track.id, idx)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    window.dispatchEvent(new CustomEvent('request-track-play', { detail: { track } }))
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    // If right-clicking outside selection, select this one
                                    if (!isSelected) {
                                        selectSingleTrack(track.id)
                                    }
                                    setContextMenu({ track, x: e.clientX, y: e.clientY })
                                }}
                                draggable
                                onDragStart={(e) => {
                                    const dragIds = isSelected ? selectedTracks : [track.id]
                                    const dragTracks = tracks.filter(t => dragIds.includes(t.id))

                                    e.dataTransfer.setData('application/json', JSON.stringify({
                                        type: 'tracks',
                                        data: dragTracks
                                    }))
                                    e.dataTransfer.effectAllowed = 'copy'
                                }}
                                className={cn(
                                    "group grid grid-cols-[3rem_2fr_1.5fr_1.5fr_3rem_1fr_4rem] gap-4 px-6 py-3 items-center transition-all cursor-default select-none",
                                    isSelected
                                        ? "bg-white/10 hover:bg-white/10"
                                        : isCurrentTrack
                                            ? "bg-blue-600/10 hover:bg-blue-600/20"
                                            : "hover:bg-white/5"
                                )}
                            >
                                {/* Index / Playing Icon */}
                                <div className="text-center text-xs font-medium">
                                    {isCurrentPlaying ? (
                                        <div className="flex justify-center">
                                            <div className="flex items-end gap-0.5 h-3">
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.8s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.5s_ease-in-out_infinite]" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={cn(isCurrentTrack ? "text-blue-500" : "text-zinc-600")}>{idx + 1}</span>
                                    )}
                                </div>

                                {/* Title */}
                                <div className="min-w-0">
                                    <div className={cn(
                                        "text-sm font-semibold truncate transition-colors",
                                        isCurrentTrack ? "text-blue-500" : "text-zinc-200 group-hover:text-white"
                                    )}>
                                        {track.title}
                                    </div>
                                </div>

                                {/* Artist */}
                                <div className="min-w-0">
                                    <div className="text-sm text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">
                                        {track.artist}
                                    </div>
                                </div>

                                {/* Album */}
                                <div className="min-w-0">
                                    <div className="text-sm text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">
                                        {track.album}
                                    </div>
                                </div>

                                {/* Play Count */}
                                <div className="text-right text-xs text-zinc-500 font-medium tabular-nums px-2">
                                    {track.playCount > 0 ? track.playCount : '-'}
                                </div>

                                {/* Rating & Love */}
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex items-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    rateTrack(track.id, star === track.rating ? 0 : star);
                                                }}
                                                className={cn(
                                                    "transition-all duration-200",
                                                    star <= track.rating
                                                        ? "text-yellow-500 scale-110"
                                                        : "text-zinc-800 hover:text-zinc-600 scale-90"
                                                )}
                                            >
                                                <Star className="w-3 h-3" fill={star <= track.rating ? "currentColor" : "none"} />
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleLoved(track.id)
                                        }}
                                        className={cn(
                                            "transition-colors",
                                            track.loved ? "text-red-500" : "text-zinc-800 hover:text-red-500/50"
                                        )}
                                    >
                                        <Heart className="w-3 h-3" fill={track.loved ? "currentColor" : "none"} />
                                    </button>
                                </div>

                                {/* Duration */}
                                <div className="text-right text-xs font-medium tabular-nums text-zinc-500 group-hover:text-zinc-300">
                                    {formatDuration(track.duration)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <style>{`
                @keyframes music-bar {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
            `}</style>

            {contextMenu && (
                <TrackContextMenu
                    track={contextMenu.track}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    )
}
