import { useState } from 'react'
import { Hash, Clock, Heart, Play, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { cn } from '../lib/utils'
import { useTrackSelection } from '../hooks/useTrackSelection'
import { Track, SortField, SortOrder } from '../types'
import { TrackViewMode } from '../store/settings'
import { client } from '../api/client'
import { RatingStars } from './RatingStars'

interface TrackListProps {
    tracks: Track[]
    viewMode?: TrackViewMode
    visibleColumns?: string[]
    sortField?: SortField
    sortOrder?: SortOrder
    onSort?: (field: SortField) => void
    isReorderable?: boolean
    onReorder?: (startIndex: number, endIndex: number) => void
    onRemove?: (trackId: string, position: number) => void
    hideHeader?: boolean
    onArtistClick?: (artist: string) => void
    onAlbumClick?: (albumId: string) => void
}

export default function TrackList({
    tracks: inputTracks,
    viewMode = 'list',
    visibleColumns = ['index', 'title', 'artist', 'album', 'vibe', 'played', 'rating', 'time'],
    sortField,
    sortOrder,
    onSort,
    isReorderable,
    onReorder,
    onRemove,
    hideHeader = false,
    onArtistClick,
    onAlbumClick
}: TrackListProps) {
    const { toggleLoved, rateTrack, tracks: allTracks } = useLibrary()
    const { currentTrack, playTrack, isPlaying } = usePlayer()

    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

    const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } =
        useTrackSelection(inputTracks)

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const isColVisible = (id: string) => visibleColumns.includes(id)

    // Render Grid / Cover View
    if (viewMode === 'grid' || viewMode === 'cover') {
        const isCover = viewMode === 'cover'
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-8" onClick={clearSelection}>
                <div className={cn(
                    "grid gap-8 justify-center",
                    isCover
                        ? "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
                        : "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
                )}>
                    {inputTracks.map((track, idx) => {
                        const isCurrentTrack = currentTrack?.id === track.id
                        const isSelected = selectedTracks.includes(track.id)

                        return (
                            <div
                                key={track.id}
                                onClick={(e) => handleTrackClick(e, track.id, idx)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    playTrack(track)
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    if (!isSelected) selectSingleTrack(track.id)
                                    window.dispatchEvent(new CustomEvent('show-track-context-menu', { detail: { track, x: e.clientX, y: e.clientY } }))
                                }}
                                className={cn(
                                    "group relative flex flex-col gap-4 transform transition-all duration-500",
                                    isSelected ? "scale-[0.98]" : "hover:scale-[1.02]"
                                )}
                            >
                                {/* Art Container */}
                                <div className={cn(
                                    "relative aspect-square w-full rounded-md bg-zinc-800 shadow-sm transition-all",
                                    isSelected ? "ring-2 ring-primary" : "group-hover:shadow-md"
                                )}>
                                    {/* Cover Art (Now with its own overflow-hidden) */}
                                    <div className="absolute inset-0 overflow-hidden rounded-md">
                                        {track.albumId || track.id ? (
                                            <img
                                                src={client.getCoverUrl(track.albumId || track.id)}
                                                alt={track.title}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                                <span className="text-4xl text-zinc-700 font-bold italic">{track.title[0]}</span>
                                            </div>
                                        )}
                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute inset-0 bg-black/20" />
                                            <div className="absolute bottom-2 left-2 z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        playTrack(track)
                                                    }}
                                                    className="p-1.5 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg transform transition-all duration-200 hover:scale-110 active:scale-95"
                                                >
                                                    <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Triangle Badges logic matched to AlbumCard aesthetic */}
                                    {track.loved && (
                                        <div
                                            className="absolute top-0 left-0 z-30 w-10 h-10 cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); toggleLoved(track.id); }}
                                        >
                                            <div
                                                className="absolute inset-0 bg-primary shadow-lg"
                                                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                            />
                                            <Heart className="absolute top-1 left-1 w-3 h-3 text-red-500 z-40" fill="currentColor" />
                                        </div>
                                    )}

                                    {/* Rating Badge (Interactive Selector) */}
                                    <div className="absolute top-0 right-0 z-50 group/rating flex flex-row-reverse items-center p-1.5">
                                        {/* The Triangle Badge (Trigger) */}
                                        <div
                                            className={cn(
                                                "w-10 h-10 cursor-pointer transition-opacity relative",
                                                track.rating > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                                            )}
                                        >
                                            <div
                                                className="absolute inset-0 bg-primary shadow-lg"
                                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                                            />
                                            <span className="absolute top-1 right-1 text-sm font-black text-white rotate-[15deg] select-none">
                                                {track.rating || '?'}
                                            </span>
                                        </div>

                                        {/* Hover Selector Popover (Contiguous with Bridge) */}
                                        <div className="flex items-center opacity-0 group-hover/rating:opacity-100 pointer-events-none group-hover/rating:pointer-events-auto transition-all duration-300 translate-x-2 group-hover/rating:translate-x-0 whitespace-nowrap">
                                            {/* Invisible bridge to catch mouse events between triangle and bar */}
                                            <div className="w-4 h-10 -mr-2 cursor-default" />

                                            <div className="flex items-center gap-0.5 bg-black/90 backdrop-blur-3xl border border-white/10 p-1 rounded-full shadow-2xl scale-90 group-hover/rating:scale-100">
                                                <RatingStars
                                                    rating={track.rating}
                                                    onChange={(r) => rateTrack(track.id, r)}
                                                    size={14}
                                                    className="px-1"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Playing Indicator */}
                                    {isCurrentTrack && isPlaying && (
                                        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-1 rounded border border-white/10">
                                            <div className="flex gap-0.5 h-2.5 items-end">
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.6s_infinite]" />
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.8s_infinite]" />
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.5s_infinite]" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Metadata matched to AlbumCard */}
                                <div className={cn(
                                    "space-y-1",
                                    isCover ? "text-center px-2" : ""
                                )}>
                                    <h3 className={cn(
                                        "font-medium leading-none truncate w-full transition-colors",
                                        isCurrentTrack ? "text-primary" : "text-foreground",
                                        isCover ? "text-base" : "text-sm"
                                    )}>
                                        {track.title}
                                    </h3>
                                    <p className={cn(
                                        "text-sm text-muted-foreground truncate w-full",
                                        isCover ? "mt-1" : "mt-0.5"
                                    )}>
                                        {track.artist}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
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
        if (isColVisible('time')) template += "4rem " // Time
        if (onRemove) template += "3rem" // Remove
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
            {/* List Header - Sticky Header matched to AlbumsView style */}
            {!hideHeader && (
                <div
                    className="grid gap-4 px-6 py-4 border-b border-white/5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] bg-zinc-900/90 sticky top-0 z-10"
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
                    {onRemove && <div />}
                </div>
            )}

            <div className="flex-1 divide-y divide-zinc-900 overflow-y-auto custom-scrollbar">
                {inputTracks.map((track, idx) => {
                    const isCurrentTrack = currentTrack?.id === track.id
                    const isCurrentPlaying = isCurrentTrack && isPlaying
                    const isSelected = selectedTracks.includes(track.id)

                    return (
                        <div
                            key={track.id}
                            draggable={true}
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
                                        detail: {
                                            track,
                                            selectedTrackIds: isSelected ? selectedTracks : [track.id],
                                            x: e.clientX,
                                            y: e.clientY
                                        }
                                    })
                                )
                            }}
                            onDragStart={(e) => {
                                if (isReorderable) {
                                    e.dataTransfer.setData('application/reorder-index', idx.toString())
                                }

                                const dragIds = isSelected ? selectedTracks : [track.id]
                                const dragTracks = allTracks.filter((t) => dragIds.includes(t.id))

                                e.dataTransfer.setData(
                                    'application/json',
                                    JSON.stringify({
                                        type: 'tracks',
                                        data: dragTracks
                                    })
                                )
                                e.dataTransfer.effectAllowed = isReorderable ? 'move' : 'copy'
                            }}
                            onDragOver={(e) => {
                                if (isReorderable) {
                                    e.preventDefault()
                                    // Highlight only if not dragging same item
                                    setDragOverIndex(idx)
                                }
                            }}
                            onDragLeave={() => {
                                if (isReorderable) setDragOverIndex(null)
                            }}
                            onDrop={(e) => {
                                if (isReorderable) {
                                    const fromIndexStr = e.dataTransfer.getData('application/reorder-index')
                                    if (fromIndexStr) {
                                        e.preventDefault()
                                        const fromIndex = parseInt(fromIndexStr)
                                        setDragOverIndex(null)
                                        if (fromIndex !== idx) {
                                            onReorder?.(fromIndex, idx)
                                        }
                                        return
                                    }
                                }
                            }}
                            className={cn(
                                'group grid gap-4 px-6 py-3 items-center transition-all cursor-default select-none mx-2 my-1 rounded-xl border-l-[3px] border-transparent',
                                isSelected
                                    ? 'bg-white/10 !border-l-zinc-700'
                                    : isCurrentTrack
                                        ? 'bg-primary/20 text-primary !border-l-primary'
                                        : 'hover:bg-white/5 hover:!border-l-white/20',
                                dragOverIndex === idx && "border-t-2 border-t-primary !rounded-t-none"
                            )}
                            style={{ gridTemplateColumns: gridTemplate }}
                        >
                            {/* Index / Playing Icon */}
                            {isColVisible('index') && (
                                <div className="text-center text-xs font-bold tabular-nums">
                                    {isCurrentPlaying ? (
                                        <div className="flex justify-center">
                                            <div className="flex items-end gap-0.5 h-3">
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-primary animate-[music-bar_0.5s_ease-in-out_infinite]" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={cn(isCurrentTrack ? 'text-primary' : 'text-white/20 group-hover:text-white/40')}>
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
                                            'text-sm font-bold truncate transition-colors',
                                            isCurrentTrack ? 'text-primary' : 'text-white/90 group-hover:text-white'
                                        )}
                                    >
                                        {track.title}
                                    </div>
                                </div>
                            )}

                            {/* Artist */}
                            {isColVisible('artist') && (
                                <div className="min-w-0">
                                    <div
                                        className={cn(
                                            "text-sm text-white/40 truncate group-hover:text-white/60 transition-colors",
                                            onArtistClick && "cursor-pointer hover:text-white hover:underline"
                                        )}
                                        onClick={(e) => {
                                            if (onArtistClick) {
                                                e.stopPropagation();
                                                onArtistClick(track.artist);
                                            }
                                        }}
                                    >
                                        {track.artist}
                                    </div>
                                </div>
                            )}

                            {/* Album */}
                            {isColVisible('album') && (
                                <div className="min-w-0">
                                    <div
                                        className={cn(
                                            "text-sm text-white/40 truncate group-hover:text-white/60 transition-colors",
                                            onAlbumClick && track.albumId && "cursor-pointer hover:text-white hover:underline"
                                        )}
                                        onClick={(e) => {
                                            if (onAlbumClick && track.albumId) {
                                                e.stopPropagation();
                                                onAlbumClick(track.albumId);
                                            }
                                        }}
                                    >
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
                                <div className="text-right text-[10px] text-white/20 font-black tabular-nums px-2 uppercase tracking-tighter">
                                    {track.playCount > 0 ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="text-white/40">{track.playCount}</span>
                                            <span className="text-[8px] opacity-50">PLYS</span>
                                        </div>
                                    ) : '-'}
                                </div>
                            )}

                            {/* Rating & Love */}
                            {isColVisible('rating') && (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex items-center">
                                        <RatingStars
                                            rating={track.rating}
                                            onChange={(r) => rateTrack(track.id, r)}
                                            size={12}
                                            className="px-1"
                                        />
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleLoved(track.id)
                                        }}
                                        className={cn(
                                            'transition-colors p-1',
                                            track.loved ? 'text-red-500' : 'text-zinc-800 hover:text-red-500/50'
                                        )}
                                    >
                                        <Heart className="w-3 h-3" fill={track.loved ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                            )}

                            {/* Duration */}
                            {isColVisible('time') && (
                                <div className="text-right text-[10px] font-bold tabular-nums text-white/20 group-hover:text-white/40 uppercase tracking-widest">
                                    {formatDuration(track.duration)}
                                </div>
                            )}

                            {/* Removal */}
                            {onRemove && (
                                <div className="flex justify-end pr-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onRemove(track.id, idx)
                                        }}
                                        className="p-1.5 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10"
                                        title="Remove from playlist"
                                    >
                                        <Trash2 size={14} />
                                    </button>
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
        </div >
    )
}
