import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { usePlayer } from '../store/player'
import { ArrowLeft, Play, Clock, Heart, Calendar, Disc, Hash, Music as MusicIcon, X } from 'lucide-react'
import { RatingStars } from '../components/RatingStars'
import { formatDuration } from '../utils/format'
import { cn } from '../utils'
import { useDraggable } from '../hooks/useDraggable'
import { QueueConfirmationModal } from '../components/QueueConfirmationModal'
import type { Track, Album } from '../types'

interface AlbumDetailViewProps {
    albumId: string
    onBack: () => void
}

export default function AlbumDetailView({ albumId, onBack }: AlbumDetailViewProps) {
    const { albums, tracks, loadTracks, rateTrack, toggleLoved, rateAlbum, toggleAlbumLoved } = useLibrary()
    const { navigateTo } = useNavigation()
    const { playAlbum, playTrack: playTrackAction, currentTrack, isPlaying, queue, insertToQueue } = usePlayer()
    const [isZoomed, setIsZoomed] = useState(false)
    const [isBioExpanded, setIsBioExpanded] = useState(false)
    const [enrichedAlbum, setEnrichedAlbum] = useState<Album | null>(null)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const { position, handleMouseDown } = useDraggable()

    // Find album
    const storeAlbum = useMemo(() => albums.find(a => a.id === albumId), [albums, albumId])
    const album = enrichedAlbum || storeAlbum

    // Fetch full album details (including bio) on mount
    useEffect(() => {
        const fetchFullAlbum = async () => {
            try {
                const data = await window.api.albums.getById(albumId)
                if (data) setEnrichedAlbum(data)
            } catch (err) {
                console.error('Failed to fetch enriched album:', err)
            }
        }
        fetchFullAlbum()
    }, [albumId])

    // Find tracks for this album
    const albumTracks = useMemo(() => {
        if (!album) return []
        return tracks
            .filter(t => t.album === album.name && (t.albumArtist === album.artist || t.artist === album.artist))
            .sort((a, b) => {
                const discA = a.discNum || 1
                const discB = b.discNum || 1
                if (discA !== discB) return discA - discB
                const trackA = a.trackNum || 0
                const trackB = b.trackNum || 0
                return trackA - trackB
            })
    }, [tracks, album])

    // Group by disc
    const discs = useMemo(() => {
        const d = new Map<number, Track[]>()
        albumTracks.forEach(track => {
            const discNum = track.discNum || 1
            if (!d.has(discNum)) d.set(discNum, [])
            d.get(discNum)?.push(track)
        })
        return Array.from(d.entries()).sort((a, b) => a[0] - b[0])
    }, [albumTracks])

    // Load tracks if empty
    useEffect(() => {
        if (tracks.length === 0) loadTracks()
    }, [tracks.length, loadTracks])

    // Close zoom on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsZoomed(false)
        }
        if (isZoomed) {
            window.addEventListener('keydown', handleEsc)
        }
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isZoomed])

    if (!album) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <p>Album not found</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-4 py-2 bg-secondary rounded-md"
                >
                    Back to Library
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-background/95 overflow-hidden">
            {/* Header / Hero - Fixed and Compact */}
            <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6 bg-gradient-to-b from-primary/5 to-transparent relative flex-shrink-0">
                {/* Cover Art - Smaller */}
                <div className="flex-shrink-0 group relative cursor-zoom-in" onClick={() => setIsZoomed(true)}>
                    <div className="w-32 h-32 md:w-36 md:h-36 rounded-lg shadow-xl overflow-hidden bg-zinc-900 border border-border/10 transition-transform hover:scale-[1.02]">
                        {album.coverArtPath ? (
                            <img
                                src={album.coverArtPath?.startsWith('asset:') ? album.coverArtPath : `asset:///${album.coverArtPath?.replace(/\\/g, '/')}`}
                                alt={album.name}
                                className="w-full h-full object-cover"
                                onError={async (e) => {
                                    if (album.id) {
                                        const img = e.target as HTMLImageElement
                                        if (img.src.includes('blob:')) return
                                        try {
                                            const result = await window.api.tracks.getCoverBufferByAlbum(album.id)
                                            if (result && result.data) {
                                                const blob = new Blob([new Uint8Array(result.data)], { type: `image/${result.format || 'jpeg'}` })
                                                img.src = URL.createObjectURL(blob)
                                            }
                                        } catch (err) {
                                            console.error('Failed to load fallback cover:', err)
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                <span className="text-4xl text-muted-foreground/30">♪</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Album Info */}
                <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 min-w-0">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 hover:text-foreground uppercase tracking-widest mb-1 transition-colors"
                            >
                                <ArrowLeft size={10} /> Back
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate leading-tight">{album.name}</h1>
                            <button
                                onClick={() => navigateTo('artist-detail', { artistName: album.artist })}
                                className="text-lg md:text-xl font-medium text-muted-foreground hover:text-primary transition-colors text-left"
                            >
                                {album.artist}
                            </button>
                        </div>

                        {/* Top Right Actions */}
                        <div className="flex items-center gap-4 bg-secondary/10 p-2.5 rounded-xl border border-border/5 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40">Rating</span>
                                <RatingStars
                                    rating={album.rating}
                                    onChange={(r) => rateAlbum(albumId, r)}
                                    size={16}
                                    className="hover:scale-105 transition-transform"
                                />
                            </div>

                            <div className="w-[1px] h-6 bg-border/20" />

                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40">Love</span>
                                <button
                                    onClick={() => toggleAlbumLoved(albumId)}
                                    className={cn(
                                        "transition-all hover:scale-110 active:scale-95",
                                        album.loved ? "text-red-500" : "text-muted-foreground/30 hover:text-red-400"
                                    )}
                                >
                                    <Heart size={20} fill={album.loved ? "currentColor" : "none"} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-3">
                        <button
                            onClick={() => {
                                if (albumTracks.length > 0) {
                                    if (queue.length > 0) {
                                        setIsConfirmModalOpen(true)
                                    } else {
                                        playAlbum(albumTracks)
                                    }
                                }
                            }}
                            className="px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Play size={14} fill="currentColor" /> Play All
                        </button>

                        <div className="flex items-center gap-3 bg-white/5 py-1 px-3 rounded-full border border-white/5">
                            <span className="flex items-center gap-1">
                                <Calendar size={11} className="opacity-50" /> {album.year}
                            </span>
                            <span className="w-[1px] h-3 bg-white/10" />
                            <span className="flex items-center gap-1">
                                <Clock size={11} className="opacity-50" /> {formatDuration(album.totalDuration)}
                            </span>
                            <span className="w-[1px] h-3 bg-white/10" />
                            <span className="flex items-center gap-1">
                                <MusicIcon size={11} className="opacity-50" /> {album.trackCount} Tracks
                            </span>
                        </div>

                        {album.genre && album.genre.split(' / ').slice(0, 5).map((g, i) => (
                            <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary/80 border border-primary/20 font-medium whitespace-nowrap">
                                <Hash size={10} className="opacity-50" /> {g.trim()}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content (Bio + Tracks) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto p-4 md:pt-4 md:pb-8 md:px-8">
                    {/* Album Bio - Inside scroll area */}
                    {album.bio && (
                        <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-1000">
                            <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">About the Album</h3>
                            <div className={cn(
                                "text-[14px] text-zinc-400/90 leading-relaxed font-light",
                                !isBioExpanded && "line-clamp-2"
                            )}>
                                {album.bio.split('\n').map((line, i) => {
                                    const cleanLine = line.replace(/<a href=".*">Read more on Last.fm<\/a>.*$/, '').trim()
                                    if (!cleanLine) return null
                                    return <p key={i} className={i > 0 ? "mt-3" : ""}>{cleanLine}</p>
                                })}
                            </div>
                            {album.bio.length > 150 && (
                                <button
                                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                                    className="text-[11px] text-primary/70 hover:text-primary font-bold transition-colors flex items-center gap-1 group"
                                >
                                    {isBioExpanded ? "Show less" : "Read more"}
                                    <span className={cn("transition-transform duration-300", isBioExpanded ? "rotate-180" : "")}>↓</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Track List */}
                    {discs.map(([discNum, discTracks]) => (
                        <div key={discNum} className="mb-10 last:mb-0">
                            {discs.length > 1 && (
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/20 text-muted-foreground text-sm font-bold tracking-tight">
                                    <Disc size={16} /> Disc {discNum}
                                </div>
                            )}

                            <div className="space-y-0.5">
                                {/* Header */}
                                <div className="grid grid-cols-[3rem_1fr_3rem_6rem_4rem_4rem] gap-4 px-4 py-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] border-b border-border/5 mb-2">
                                    <div className="text-center">#</div>
                                    <div>Title</div>
                                    <div className="text-right">Played</div>
                                    <div className="text-right">Rating</div>
                                    <div className="text-center">Love</div>
                                    <div className="text-right">Time</div>
                                </div>

                                {discTracks.map((track) => {
                                    const isCurrentTrack = currentTrack?.id === track.id
                                    const isCurrentPlaying = isCurrentTrack && isPlaying

                                    return (
                                        <div
                                            key={track.id}
                                            onDoubleClick={(e) => {
                                                e.stopPropagation()
                                                window.dispatchEvent(new CustomEvent('request-track-play', { detail: { track } }))
                                            }}
                                            className={cn(
                                                "group grid grid-cols-[3rem_1fr_3rem_6rem_4rem_4rem] gap-4 px-4 py-2 rounded-md transition-all items-center border border-transparent select-none",
                                                isCurrentTrack
                                                    ? "bg-primary/20 hover:bg-primary/30 text-primary border-primary/20"
                                                    : "hover:bg-white/5 hover:border-white/5"
                                            )}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({
                                                    type: 'tracks',
                                                    data: [track]
                                                }))
                                                e.dataTransfer.effectAllowed = 'copy'
                                            }}
                                        >
                                            {/* Track Number / Play Icon */}
                                            <div className={cn(
                                                "text-center text-xs relative transition-colors",
                                                isCurrentTrack ? "text-primary font-bold" : "text-muted-foreground/60 group-hover:text-primary"
                                            )}>
                                                <span className="group-hover:hidden transition-opacity">
                                                    {isCurrentPlaying ? <MusicIcon className="w-3 h-3 mx-auto animate-pulse" /> : track.trackNum}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        playTrackAction(track)
                                                    }}
                                                    className="hidden group-hover:flex items-center justify-center absolute inset-0 w-full h-full text-primary">
                                                    <Play size={12} fill="currentColor" />
                                                </button>
                                            </div>

                                            {/* Title */}
                                            <div className="min-w-0">
                                                <div className={cn(
                                                    "text-[13px] font-medium truncate transition-colors",
                                                    isCurrentTrack ? "text-primary" : "text-foreground/90 group-hover:text-foreground"
                                                )}>{track.title}</div>
                                                {track.artist && (
                                                    <div className="text-[11px] text-muted-foreground/60 truncate hover:text-primary/80 cursor-pointer inline-block transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            navigateTo('artist-detail', { artistName: track.artist })
                                                        }}
                                                    >
                                                        {track.artist}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Play Count */}
                                            <div className="text-right text-xs text-muted-foreground/60 font-medium tabular-nums">
                                                {track.playCount > 0 && track.playCount}
                                            </div>

                                            {/* Rating */}
                                            <div className={cn(
                                                "flex justify-end transition-opacity duration-300",
                                                track.rating > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}>
                                                <RatingStars
                                                    rating={track.rating}
                                                    size={12}
                                                    onChange={(r) => rateTrack(track.id, r)}
                                                />
                                            </div>

                                            {/* Loved Heart */}
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => toggleLoved(track.id)}
                                                    className={cn(
                                                        "transition-all hover:scale-110 active:scale-95 duration-200",
                                                        track.loved
                                                            ? "text-red-500 opacity-100"
                                                            : "text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:text-red-400"
                                                    )}
                                                >
                                                    <Heart size={14} fill={track.loved ? "currentColor" : "none"} />
                                                </button>
                                            </div>

                                            {/* Duration */}
                                            <div className={cn(
                                                "text-right text-[11px] font-medium tabular-nums transition-colors",
                                                isCurrentTrack ? "text-primary/70 font-bold" : "text-muted-foreground/60 group-hover:text-foreground"
                                            )}>
                                                {formatDuration(track.duration)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Image Zoom Modal */}
            {isZoomed && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-12 animate-in fade-in duration-300"
                    onClick={() => setIsZoomed(false)}
                >
                    <button
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]"
                        onClick={() => setIsZoomed(false)}
                    >
                        <X size={32} />
                    </button>

                    <div
                        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                        className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300 cursor-move"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={handleMouseDown}
                    >
                        <img
                            src={album.coverArtPath?.startsWith('asset:') ? album.coverArtPath : `asset:///${album.coverArtPath?.replace(/\\/g, '/')}`}
                            alt={album.name}
                            className="max-w-full max-h-full h-auto w-auto object-contain shadow-2xl rounded-lg border border-white/10"
                            onError={(e) => {
                                const img = e.target as HTMLImageElement
                                if (img.src.includes('blob:')) return
                                window.api.tracks.getCoverBufferByAlbum(album.id).then(result => {
                                    if (result && result.data) {
                                        const blob = new Blob([new Uint8Array(result.data)], { type: `image/${result.format || 'jpeg'}` })
                                        img.src = URL.createObjectURL(blob)
                                    }
                                })
                            }}
                        />
                    </div>

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-white/80 space-y-1">
                        <p className="text-xl font-bold">{album.name}</p>
                        <p className="text-lg opacity-70">{album.artist}</p>
                    </div>
                </div>
            )}

            <QueueConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onReplace={() => {
                    playAlbum(albumTracks)
                    setIsConfirmModalOpen(false)
                }}
                onAppend={() => {
                    insertToQueue(albumTracks, queue.length)
                    setIsConfirmModalOpen(false)
                }}
                title="Clear Playlist?"
                message={`Your playlist is not empty. Would you like to clear it and play "${album.name}", or just add it to the end?`}
            />
        </div>
    )
}
