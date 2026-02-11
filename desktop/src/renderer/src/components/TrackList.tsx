import { Hash, Clock, Star, Heart, Play, ChevronUp, ChevronDown } from 'lucide-react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { cn } from '../lib/utils'
import { useTrackSelection } from '../hooks/useTrackSelection'
import { Track, SortField, SortOrder } from '../types'
import { TrackViewMode } from '../store/settings'

interface TrackListProps {
    tracks: Track[]
    viewMode?: TrackViewMode
    visibleColumns?: string[]
    sortField?: SortField
    sortOrder?: SortOrder
    onSort?: (field: SortField) => void
}

export default function TrackList({
    tracks: inputTracks,
    viewMode = 'list',
    visibleColumns = ['index', 'title', 'artist', 'album', 'vibe', 'played', 'rating', 'time'],
    sortField,
    sortOrder,
    onSort
}: TrackListProps) {
    const { toggleLoved, rateTrack, tracks: allTracks } = useLibrary()
    const { currentTrack, playTrack, isPlaying } = usePlayer()

    const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } =
        useTrackSelection(inputTracks)

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const isColVisible = (id: string) => visibleColumns.includes(id)

    // Render Grid View (Album Cards style but for Tracks)
    if (viewMode === 'grid') {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6" onClick={clearSelection}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
                    {inputTracks.map((track, idx) => {
                        const isCurrentTrack = currentTrack?.id === track.id
                        const isSelected = selectedTracks.includes(track.id)

                        return (
                            <div
                                key={track.id}
                                onClick={(e) => handleTrackClick(e, track.id, idx)}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    if (!isSelected) selectSingleTrack(track.id)
                                    window.dispatchEvent(new CustomEvent('show-track-context-menu', { detail: { track, x: e.clientX, y: e.clientY } }))
                                }}
                                className={cn(
                                    "group relative aspect-square rounded-xl overflow-hidden bg-zinc-900 shadow-lg transition-all duration-300",
                                    isSelected ? "ring-2 ring-indigo-500" : "hover:ring-2 hover:ring-white/20"
                                )}
                            >
                                {/* Image Background */}
                                {track.coverArtPath ? (
                                    <img src={`file://${track.coverArtPath}`} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                        <span className="text-4xl text-zinc-700 font-bold">{track.title[0]}</span>
                                    </div>
                                )}

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            playTrack(track)
                                        }}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 shadow-xl hover:scale-105"
                                    >
                                        <Play className="w-5 h-5 text-black ml-1" fill="currentColor" />
                                    </button>

                                    <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                        <h3 className="font-bold text-white truncate text-lg leading-tight">{track.title}</h3>
                                        <p className="text-sm text-zinc-300 truncate mt-0.5">{track.artist}</p>
                                        {track.rating > 0 && (
                                            <div className="flex gap-0.5 mt-2">
                                                {[...Array(track.rating)].map((_, i) => (
                                                    <Star key={i} className="w-3 h-3 text-yellow-500" fill="currentColor" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Play Activity Indicator */}
                                {isCurrentTrack && isPlaying && (
                                    <div className="absolute top-3 right-3 flex gap-0.5 h-3">
                                        <div className="w-1 bg-green-500 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                        <div className="w-1 bg-green-500 animate-[music-bar_0.8s_ease-in-out_infinite]" />
                                        <div className="w-1 bg-green-500 animate-[music-bar_0.5s_ease-in-out_infinite]" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <style>{`
                    @keyframes music-bar {
                        0%, 100% { height: 40%; opacity: 0.5; }
                        50% { height: 100%; opacity: 1; }
                    }
                `}</style>
            </div>
        )
    }

    // List View Layout Construction
    // Default: 3rem 2fr 1.5fr 1.5fr 4rem 3rem 1fr 4rem
    // We need to build this string dynamically based on visibleColumns

    const getGridTemplate = () => {
        let template = ""
        // Index alway fixed approx size
        // Title gets largest share, others distributed
        if (isColVisible('index')) template += "3rem " // Index
        if (isColVisible('title')) template += "minmax(200px, 3fr) " // Title
        if (isColVisible('artist')) template += "minmax(150px, 2fr) " // Artist
        if (isColVisible('album')) template += "minmax(150px, 2fr) " // Album
        if (isColVisible('vibe')) template += "5rem " // Vibe
        if (isColVisible('played')) template += "4rem " // Played
        if (isColVisible('rating')) template += "6rem " // Rating
        if (isColVisible('time')) template += "4rem" // Time
        return template.trim()
    }

    const gridTemplate = getGridTemplate()

    const renderHeader = (id: string, label: string | React.ReactNode, field?: SortField, align: 'left' | 'center' | 'right' = 'left') => {
        if (!isColVisible(id)) return null

        const isSorted = sortField === field

        return (
            <div
                className={cn(
                    "flex items-center gap-1 cursor-pointer hover:text-zinc-300 transition-colors select-none",
                    align === 'center' && "justify-center",
                    align === 'right' && "justify-end",
                    isSorted && "text-white"
                )}
                onClick={() => field && onSort?.(field)}
            >
                {label}
                {isSorted && (
                    sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                )}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col" onClick={clearSelection}>
            {/* List Header */}
            <div
                className="grid gap-4 px-6 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50 sticky top-0 z-10"
                style={{ gridTemplateColumns: gridTemplate }}
            >
                {/* Dynamically render headers */}
                {renderHeader('index', <Hash className="w-3 h-3" />, undefined, 'center')}
                {renderHeader('title', 'Title', 'title')}
                {renderHeader('artist', 'Artist', 'artist')}
                {renderHeader('album', 'Album', 'album')}
                {renderHeader('vibe', 'Vibe', undefined, 'center')}
                {renderHeader('played', 'Played', 'playCount', 'right')}
                {renderHeader('rating', 'Rating', 'rating', 'center')}
                {renderHeader('time', <Clock className="w-3 h-3" />, 'duration', 'right')}
            </div>

            <div className="flex-1 divide-y divide-zinc-900 overflow-y-auto custom-scrollbar">
                {inputTracks.map((track, idx) => {
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
                                if (!isSelected) {
                                    selectSingleTrack(track.id)
                                }
                                window.dispatchEvent(
                                    new CustomEvent('show-track-context-menu', {
                                        detail: { track, x: e.clientX, y: e.clientY }
                                    })
                                )
                            }}
                            draggable
                            onDragStart={(e) => {
                                const dragIds = isSelected ? selectedTracks : [track.id]
                                const dragTracks = allTracks.filter((t) => dragIds.includes(t.id))

                                e.dataTransfer.setData(
                                    'application/json',
                                    JSON.stringify({
                                        type: 'tracks',
                                        data: dragTracks
                                    })
                                )
                                e.dataTransfer.effectAllowed = 'copy'
                            }}
                            className={cn(
                                'group grid gap-4 px-6 py-3 items-center transition-all cursor-default select-none',
                                isSelected
                                    ? 'bg-white/10 hover:bg-white/10'
                                    : isCurrentTrack
                                        ? 'bg-blue-600/10 hover:bg-blue-600/20'
                                        : 'hover:bg-white/5'
                            )}
                            style={{ gridTemplateColumns: gridTemplate }}
                        >
                            {/* Index / Playing Icon */}
                            {isColVisible('index') && (
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
                                        <span className={cn(isCurrentTrack ? 'text-blue-500' : 'text-zinc-600')}>
                                            {idx + 1}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Title */}
                            {isColVisible('title') && (
                                <div className="min-w-0">
                                    <div
                                        className={cn(
                                            'text-sm font-semibold truncate transition-colors',
                                            isCurrentTrack ? 'text-blue-500' : 'text-zinc-200 group-hover:text-white'
                                        )}
                                    >
                                        {track.title}
                                    </div>
                                </div>
                            )}

                            {/* Artist */}
                            {isColVisible('artist') && (
                                <div className="min-w-0">
                                    <div className="text-sm text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">
                                        {track.artist}
                                    </div>
                                </div>
                            )}

                            {/* Album */}
                            {isColVisible('album') && (
                                <div className="min-w-0">
                                    <div className="text-sm text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">
                                        {track.album}
                                    </div>
                                </div>
                            )}

                            {/* Vibe (BPM/Key) */}
                            {isColVisible('vibe') && (
                                <div className="min-w-0 flex items-center justify-center">
                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 group-hover:text-zinc-400">
                                        {track.bpm && <span>{Math.round(track.bpm)}</span>}
                                        {track.bpm && track.key && <span className="text-zinc-700">•</span>}
                                        {track.key && <span className="text-zinc-400">{track.key}</span>}
                                        {!track.bpm && !track.key && <span className="text-zinc-800">-</span>}
                                    </div>
                                </div>
                            )}

                            {/* Play Count */}
                            {isColVisible('played') && (
                                <div className="text-right text-xs text-zinc-500 font-medium tabular-nums px-2">
                                    {track.playCount > 0 ? track.playCount : '-'}
                                </div>
                            )}

                            {/* Rating & Love */}
                            {isColVisible('rating') && (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex items-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    rateTrack(track.id, star === track.rating ? 0 : star)
                                                }}
                                                className={cn(
                                                    'transition-all duration-200',
                                                    star <= track.rating
                                                        ? 'text-yellow-500 scale-110'
                                                        : 'text-zinc-800 hover:text-zinc-600 scale-90'
                                                )}
                                            >
                                                <Star
                                                    className="w-3 h-3"
                                                    fill={star <= track.rating ? 'currentColor' : 'none'}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleLoved(track.id)
                                        }}
                                        className={cn(
                                            'transition-colors',
                                            track.loved ? 'text-red-500' : 'text-zinc-800 hover:text-red-500/50'
                                        )}
                                    >
                                        <Heart className="w-3 h-3" fill={track.loved ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                            )}

                            {/* Duration */}
                            {isColVisible('time') && (
                                <div className="text-right text-xs font-medium tabular-nums text-zinc-500 group-hover:text-zinc-300">
                                    {formatDuration(track.duration)}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <style>{`
          @keyframes music-bar {
              0%, 100% { height: 4px; }
              50% { height: 12px; }
          }
      `}</style>
        </div>
    )
}
