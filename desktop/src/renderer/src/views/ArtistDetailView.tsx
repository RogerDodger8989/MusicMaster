import { useMemo, useState, useEffect, useCallback } from 'react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { ArrowLeft, Users, Heart, Play, Shuffle, Hash, ChevronUp, ChevronDown, Globe, MapPin, Calendar, UserCircle2, RefreshCw } from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { RatingStars } from '../components/RatingStars'
import { formatDuration } from '../utils/format'
import { cn } from '../utils'
import { QueueConfirmationModal } from '../components/QueueConfirmationModal'
import { useTrackSelection } from '../hooks/useTrackSelection'
import TrackContextMenu from '../components/TrackContextMenu'
import type { Track } from '../types'

interface ArtistDetailViewProps {
    artistName: string
    onBack: () => void
    onAlbumClick: (albumId: string) => void
}

export default function ArtistDetailView({ artistName, onBack, onAlbumClick }: ArtistDetailViewProps) {
    const { albums, artists, tracks, rateTrack, toggleLoved, toggleArtistLoved } = useLibrary()
    const {
        playTrack,
        playAlbum,
        toggleShuffle,
        currentTrack,
        isPlaying,
        isShuffle,
        queue,
        insertToQueue
    } = usePlayer()

    const [sortBy, setSortBy] = useState<'year' | 'popularity'>('year')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [isBioExpanded, setIsBioExpanded] = useState(false)
    const [contextMenu, setContextMenu] = useState<{ track: Track, x: number, y: number } | null>(null)

    // Find artist info
    const artist = useMemo(() => artists.find(a => a.name === artistName), [artists, artistName])

    const [isSyncing, setIsSyncing] = useState(false)

    // State for queue confirmation
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingTracks, setPendingTracks] = useState<any[]>([])
    const [isPendingShuffle, setIsPendingShuffle] = useState(false)

    // Sync artist facts from MusicBrainz
    const syncArtistFacts = useCallback(async () => {
        if (!artistName || isSyncing) return

        setIsSyncing(true)
        try {
            // 1. Search for artist on MusicBrainz if we don't have an ID
            let mbArtistId = artist?.musicbrainzArtistId

            if (!mbArtistId) {
                console.log(`🔍 [UI] Searching MusicBrainz for artist: ${artistName}`)
                const results = await window.api.metadata.search(artistName, '') // Search for artist name
                if (results && results.length > 0) {
                    // Try to find an exact name match
                    const match = results.find(r => r.artist.toLowerCase() === artistName.toLowerCase()) || results[0]
                    mbArtistId = match.artistId
                }
            }

            if (mbArtistId) {
                console.log(`🔍 [UI] Fetching detailed facts for MBID: ${mbArtistId}`)
                const details = await window.api.metadata.getArtistDetails(mbArtistId)
                if (details) {
                    const facts = {
                        musicbrainzArtistId: details.id,
                        country: details.country,
                        lifeSpanBegin: details.lifeSpan?.begin,
                        lifeSpanEnd: details.lifeSpan?.end,
                        type: details.type,
                        gender: details.gender,
                        website: details.website
                    }

                    await window.api.metadata.updateArtistFacts(artist!.id, facts)
                    console.log('✅ [UI] Artist facts synced successfully')
                    // The library store should ideally be refreshed here
                    // For now, we rely on the next visit or manual refresh
                }
            }
        } catch (error) {
            console.error('❌ [UI] Failed to sync artist facts:', error)
        } finally {
            setIsSyncing(false)
        }
    }, [artistName, artist, isSyncing])

    // Auto-sync if missing facts (optional, maybe better as manual button)
    // useEffect(() => {
    //     if (artist && !artist.country && !artist.musicbrainzArtistId) {
    //         syncArtistFacts()
    //     }
    // }, [artist])

    const handlePlayAll = useCallback(() => {
        // Collect all tracks for this artist
        const allArtistTracks = tracks
            .filter(t => t.artist === artistName || t.albumArtist === artistName)
            .sort((a, b) => {
                // Sort by year desc, then album, then track number
                return (b.year || 0) - (a.year || 0) || a.album.localeCompare(b.album) || (a.trackNum || 0) - (b.trackNum || 0)
            })

        if (allArtistTracks.length === 0) return

        if (queue.length > 0) {
            setPendingTracks(allArtistTracks)
            setIsPendingShuffle(false)
            setIsConfirmModalOpen(true)
        } else {
            playAlbum(allArtistTracks)
        }
    }, [tracks, artistName, queue.length, playAlbum])

    const handleShuffleAll = useCallback(() => {
        const allArtistTracks = tracks
            .filter(t => t.artist === artistName || t.albumArtist === artistName)

        if (allArtistTracks.length === 0) return

        if (queue.length > 0) {
            setPendingTracks(allArtistTracks)
            setIsPendingShuffle(true)
            setIsConfirmModalOpen(true)
        } else {
            executeShuffle(allArtistTracks)
        }
    }, [tracks, artistName, queue.length, toggleShuffle, isShuffle, playAlbum])

    const executeShuffle = (tracksToShuffle: any[]) => {
        const shuffled = [...tracksToShuffle]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        playAlbum(shuffled)
        if (!isShuffle) {
            toggleShuffle()
        }
    }

    const handleConfirmReplace = () => {
        if (isPendingShuffle) {
            executeShuffle(pendingTracks)
        } else {
            playAlbum(pendingTracks)
        }
        setIsConfirmModalOpen(false)
    }

    const handleConfirmAppend = () => {
        let tracksToAppend = [...pendingTracks]
        if (isPendingShuffle) {
            for (let i = tracksToAppend.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracksToAppend[i], tracksToAppend[j]] = [tracksToAppend[j], tracksToAppend[i]]
            }
        }
        insertToQueue(tracksToAppend, queue.length)
        setIsConfirmModalOpen(false)
    }

    // Filter and sort albums by this artist
    const artistAlbums = useMemo(() => {
        return albums
            .filter(a => a.artist === artistName)
            .sort((a, b) => {
                let comparison = 0
                if (sortBy === 'year') {
                    comparison = (b.year || 0) - (a.year || 0)
                } else {
                    comparison = (b.playCount || 0) - (a.playCount || 0)
                }
                return sortOrder === 'desc' ? comparison : -comparison
            })
    }, [albums, artistName, sortBy, sortOrder])

    // Get top tracks for the artist
    const topTracks = useMemo(() => {
        return tracks
            .filter(t => t.artist === artistName || t.albumArtist === artistName)
            .sort((a, b) => {
                // 1. Rating
                if (b.rating !== a.rating) return b.rating - a.rating
                // 2. Fallback to title
                return a.title.localeCompare(b.title)
            })
            .slice(0, 5)
    }, [tracks, artistName])

    const totalTracks = useMemo(() =>
        artistAlbums.reduce((acc, alb) => acc + (alb.trackCount || 0), 0)
        , [artistAlbums])

    // Derive top genres for the artist
    const artistGenres = useMemo(() => {
        const genreMap = new Map<string, number>()
        artistAlbums.forEach(album => {
            if (album.genre) {
                album.genre.split(' / ').forEach(g => {
                    const clean = g.trim()
                    if (clean && clean.toLowerCase() !== 'unknown') {
                        genreMap.set(clean, (genreMap.get(clean) || 0) + 1)
                    }
                })
            }
        })
        return Array.from(genreMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre]) => genre)
    }, [artistAlbums])

    const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } = useTrackSelection(topTracks)

    if (!artistAlbums.length && !artist) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-background">
                <p className="text-xl font-medium">Artist not found</p>
                <button
                    onClick={onBack}
                    className="mt-6 px-6 py-2.5 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-all font-semibold"
                >
                    Back to Library
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-background relative" onClick={clearSelection}>
            {/* Immersive Hero Section - Now hosting most content */}
            <div className="relative h-full w-full overflow-y-auto custom-scrollbar">
                {/* Fixed Background Image Overlay */}
                <div className="absolute inset-0 h-[65vh] min-h-[500px] pointer-events-none">
                    {artist?.imagePath ? (
                        <div className="relative w-full h-full">
                            <img
                                src={artist.imagePath.startsWith('asset:') ? artist.imagePath : `asset:///${artist.imagePath.replace(/\\/g, '/')}`}
                                alt={artistName}
                                className="w-full h-full object-cover object-top grayscale-[0.1] contrast-[1.1]"
                            />
                            {/* Sophisticated fading layers */}
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
                            <div className="absolute inset-0 bg-background/20" />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800/50 to-background">
                            <Users className="w-48 h-48 text-zinc-700/20" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                        </div>
                    )}
                </div>

                {/* Hero Navigation & Content */}
                <div className="relative z-10 max-w-[1600px] mx-auto w-full px-12 pb-12 pointer-events-auto">
                    {/* Back Button */}
                    <div className="pt-4 pb-0">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest transition-colors"
                        >
                            <ArrowLeft size={10} /> Back
                        </button>
                    </div>

                    {/* Artist Header Info */}
                    <div className="mt-4 space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-4">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">
                                    {artistName}
                                </h1>
                                {artist && (
                                    <button
                                        onClick={() => toggleArtistLoved(artist.id)}
                                        className={cn(
                                            "p-3 rounded-full transition-all hover:scale-110 active:scale-95 backdrop-blur-md border",
                                            artist.loved
                                                ? "bg-red-500/20 border-red-500/30 text-red-500"
                                                : "bg-white/5 border-white/10 text-white/40 hover:text-red-400"
                                        )}
                                        title={artist.loved ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Heart size={24} fill={artist.loved ? "currentColor" : "none"} strokeWidth={2} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Action Bar & Stats Pills */}
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Primary Actions */}
                            <div className="flex items-center gap-2 mr-4">
                                <button
                                    onClick={handlePlayAll}
                                    className="px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 shadow-xl shadow-primary/20 flex items-center gap-2 transition-all active:scale-95 group"
                                >
                                    <Play size={16} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                                    PLAY
                                </button>
                                <button
                                    onClick={handleShuffleAll}
                                    className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 border border-white/5 backdrop-blur-md"
                                    title="Shuffle Artist"
                                >
                                    <Shuffle size={18} />
                                </button>
                            </div>

                            {/* Stats & Genres Pills */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-3 bg-black/40 p-1.5 pl-4 rounded-full border border-white/5 backdrop-blur-md">
                                    <div className="flex items-center gap-4 text-xs font-bold text-white/70 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white">{artistAlbums.length}</span>
                                            <span className="opacity-40 uppercase tracking-widest text-[9px]">Albums</span>
                                        </div>
                                        <div className="w-[1px] h-3 bg-white/10" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-white">{totalTracks}</span>
                                            <span className="opacity-40 uppercase tracking-widest text-[9px]">Tracks</span>
                                        </div>
                                        {artist?.listeners && (
                                            <>
                                                <div className="w-[1px] h-3 bg-white/10" />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white">{Number(artist.listeners).toLocaleString()}</span>
                                                    <span className="opacity-40 uppercase tracking-widest text-[9px]">Listeners</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {artistGenres.map((genre, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 rounded-full bg-white/5 text-white/50 text-[9px] font-black uppercase tracking-widest border border-white/5 hover:text-primary transition-colors cursor-default"
                                        >
                                            <Hash size={8} className="inline mr-1 opacity-50" />
                                            {genre}
                                        </span>
                                    ))}
                                </div>

                                {/* Quick Facts Section */}
                                <div className="flex items-center gap-2">
                                    {artist?.country && (
                                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-white/60">
                                            <MapPin size={10} className="text-primary" />
                                            {artist.country}
                                        </div>
                                    )}
                                    {artist?.lifeSpanBegin && (
                                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-white/60">
                                            <Calendar size={10} className="text-primary" />
                                            {artist.lifeSpanBegin.split('-')[0]}
                                            {artist.lifeSpanEnd ? ` – ${artist.lifeSpanEnd.split('-')[0]}` : artist.lifeSpanBegin ? ' – Present' : ''}
                                        </div>
                                    )}
                                    <button
                                        onClick={syncArtistFacts}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all",
                                            isSyncing && "animate-pulse brightness-125"
                                        )}
                                        title="Sync Artist Facts from MusicBrainz"
                                        disabled={isSyncing}
                                    >
                                        <RefreshCw size={10} className={cn(isSyncing && "animate-spin")} />
                                        {isSyncing ? 'Syncing...' : 'Sync Facts'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Tracks & Biography Grid */}
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-20">
                        {/* Top Tracks */}
                        {topTracks.length > 0 && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-[1px] bg-primary/50" />
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Popular Tracks</h3>
                                </div>

                                <div className="space-y-0.5">
                                    {topTracks.map((track, i) => {
                                        const isCurrentTrack = currentTrack?.id === track.id
                                        const isCurrentPlaying = isCurrentTrack && isPlaying
                                        const isSelected = selectedTracks.includes(track.id)

                                        return (
                                            <div
                                                key={track.id}
                                                onClick={(e) => handleTrackClick(e, track.id, i)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault()
                                                    if (!isSelected) {
                                                        selectSingleTrack(track.id)
                                                    }
                                                    setContextMenu({ track, x: e.clientX, y: e.clientY })
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation()
                                                    window.dispatchEvent(new CustomEvent('request-track-play', { detail: { track } }))
                                                }}
                                                className={cn(
                                                    "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all cursor-pointer border border-transparent select-none",
                                                    isSelected
                                                        ? "bg-white/10"
                                                        : isCurrentTrack
                                                            ? "bg-primary/20 hover:bg-primary/30 text-primary border-primary/20"
                                                            : "hover:bg-white/5 hover:border-white/5"
                                                )}
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
                                            >
                                                <div className="w-6 h-6 flex items-center justify-center relative">
                                                    <span className={cn(
                                                        "text-xs font-bold transition-opacity tabular-nums",
                                                        isCurrentTrack ? "text-primary opacity-100" : "text-white/20 group-hover:opacity-0"
                                                    )}>
                                                        {isCurrentPlaying ? <Shuffle size={12} className="animate-spin" /> : (i + 1)}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            playTrack(track)
                                                        }}
                                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                                                    >
                                                        <Play size={12} fill="currentColor" />
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn(
                                                        "text-sm font-bold truncate transition-colors",
                                                        isCurrentTrack ? "text-primary" : "text-white/90 group-hover:text-white"
                                                    )}>
                                                        {track.title}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "text-[10px] font-medium truncate uppercase tracking-wider mt-0.5 transition-colors",
                                                            isCurrentTrack ? "text-primary/70" : "text-white/30 hover:text-primary"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            // Find the album ID to navigate
                                                            const album = albums.find(a => a.name === track.album && a.artist === track.artist)
                                                            if (album) onAlbumClick(album.id)
                                                        }}
                                                    >
                                                        {track.album}
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "transition-opacity duration-300",
                                                    track.rating > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}>
                                                    <RatingStars
                                                        rating={track.rating}
                                                        size={10}
                                                        onChange={(r) => rateTrack(track.id, r)}
                                                    />
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleLoved(track.id)
                                                    }}
                                                    className={cn(
                                                        "p-2 hover:scale-110 transition-all",
                                                        track.loved ? "text-red-500 opacity-100" : "text-white/20 opacity-0 group-hover:opacity-100"
                                                    )}
                                                >
                                                    <Heart size={14} fill={track.loved ? "currentColor" : "none"} />
                                                </button>
                                                <div className={cn(
                                                    "text-[10px] font-black tabular-nums w-10 text-right transition-colors",
                                                    isCurrentTrack ? "text-primary/70" : "text-white/40"
                                                )}>
                                                    {formatDuration(track.duration)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Biography & Facts */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-4 opacity-40">
                                <div className="w-12 h-[1px] bg-white" />
                                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">About {artistName}</h3>
                            </div>

                            {/* Facts Panel */}
                            {(artist?.country || artist?.type || artist?.gender || artist?.website) && (
                                <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                                    {artist.country && (
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Origin</div>
                                            <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                                                <MapPin size={12} className="text-primary" /> {artist.country}
                                            </div>
                                        </div>
                                    )}
                                    {(artist.lifeSpanBegin) && (
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Activity</div>
                                            <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                                                <Calendar size={12} className="text-primary" />
                                                {artist.lifeSpanBegin.split('-')[0]}
                                                {artist.lifeSpanEnd ? ` – ${artist.lifeSpanEnd.split('-')[0]}` : ' – Present'}
                                            </div>
                                        </div>
                                    )}
                                    {artist.type && (
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Type</div>
                                            <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                                                <UserCircle2 size={12} className="text-primary" /> {artist.type}
                                            </div>
                                        </div>
                                    )}
                                    {artist.website && (
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Website</div>
                                            <a
                                                href={artist.website}
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    window.api.util.openExternal(artist.website!)
                                                }}
                                                className="text-sm font-bold text-primary hover:underline flex items-center gap-2 group"
                                            >
                                                <Globe size={12} className="group-hover:scale-110 transition-transform" />
                                                Official Site
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative group/bio">
                                <div
                                    className={cn(
                                        "text-zinc-300 leading-[1.6] text-base font-medium transition-all duration-500 ease-in-out",
                                        !isBioExpanded ? "max-h-[350px] overflow-hidden" : "max-h-[2000px]"
                                    )}
                                    onClick={(e) => {
                                        const target = e.target as HTMLElement
                                        const anchor = target.closest('a')
                                        if (anchor) {
                                            e.preventDefault()
                                            const url = anchor.href
                                            if (window.api?.util?.openExternal) {
                                                window.api.util.openExternal(url)
                                            } else {
                                                window.open(url, '_blank')
                                            }
                                        }
                                    }}
                                >
                                    {artist?.bio ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: artist.bio }}
                                            className="prose prose-invert prose-p:mb-4 prose-a:text-white/60 prose-a:underline hover:prose-a:text-white prose-p:text-sm prose-p:font-normal prose-p:leading-relaxed"
                                        />
                                    ) : (
                                        <p className="italic opacity-50 text-sm font-normal">
                                            No biography available for this artist yet.
                                        </p>
                                    )}
                                </div>

                                {artist?.bio && (
                                    <div className="mt-2 flex justify-start">
                                        <button
                                            onClick={() => setIsBioExpanded(!isBioExpanded)}
                                            className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/50 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                                        >
                                            {isBioExpanded ? (
                                                <>Show Less <ChevronUp size={12} /></>
                                            ) : (
                                                <>Read More <ChevronDown size={12} /></>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Bottom Fade for Truncated Bio */}
                                {!isBioExpanded && artist?.bio && (
                                    <div className="absolute bottom-[40px] left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Discography - Organized Grid */}
                    <section className="mt-8 space-y-6">
                        <div className="flex items-end justify-between border-b border-white/5 pb-4">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Discography</h3>
                                <p className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">
                                    {sortBy === 'year' ? 'Chronological Order' : 'Most Popular'}
                                </p>
                            </div>
                            <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/5 backdrop-blur-sm">
                                <button
                                    onClick={() => {
                                        if (sortBy === 'year') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                                        else { setSortBy('year'); setSortOrder('desc'); }
                                    }}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                        sortBy === 'year'
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "text-white/40 hover:text-white/60"
                                    )}
                                >
                                    BY YEAR
                                    {sortBy === 'year' && (
                                        sortOrder === 'desc' ? <ChevronDown size={10} strokeWidth={3} /> : <ChevronUp size={10} strokeWidth={3} />
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        if (sortBy === 'popularity') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                                        else { setSortBy('popularity'); setSortOrder('desc'); }
                                    }}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                        sortBy === 'popularity'
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "text-white/40 hover:text-white/60"
                                    )}
                                >
                                    BY POPULARITY
                                    {sortBy === 'popularity' && (
                                        sortOrder === 'desc' ? <ChevronDown size={10} strokeWidth={3} /> : <ChevronUp size={10} strokeWidth={3} />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-8 gap-y-10">
                            {artistAlbums.map((album) => (
                                <AlbumCard
                                    key={album.id}
                                    album={album}
                                    onClick={() => onAlbumClick(album.id)}
                                    className="bg-transparent p-0 hover:bg-transparent"
                                />
                            ))}
                        </div>
                    </section>

                    {/* Related Artists */}
                    {/* Related Artists (Last.fm) */}
                    {(() => {
                        const [similarArtists, setSimilarArtists] = useState<{ name: string; image: string; match: string }[]>([])

                        // Fetch similar artists when artistName changes
                        useEffect(() => {
                            let mounted = true
                            const fetchSimilar = async () => {
                                try {
                                    if (window.api?.library?.getSimilarArtists) {
                                        const similar = await window.api.library.getSimilarArtists(artistName)
                                        if (mounted && similar && similar.length > 0) {
                                            setSimilarArtists(similar.slice(0, 6))
                                        }
                                    }
                                } catch (error) {
                                    console.error("Failed to load similar artists:", error)
                                }
                            }
                            fetchSimilar()
                            return () => { mounted = false }
                        }, [artistName])

                        if (similarArtists.length === 0) return null

                        return (
                            <section className="mt-16 space-y-6 pb-12">
                                <div className="flex items-center gap-4 opacity-40">
                                    <div className="w-12 h-[1px] bg-white" />
                                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                                        Similarity
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                                    {similarArtists.map((similar) => {
                                        // Check if this artist exists locally
                                        const localArtist = artists.find(a => a.name === similar.name)
                                        const albumCount = localArtist
                                            ? albums.filter(album => album.artist === similar.name).length
                                            : 0

                                        return (
                                            <button
                                                key={similar.name}
                                                onClick={() => {
                                                    // Navigate to this artist standardly
                                                    // The view will handle if tracks/albums are empty (as per user request)
                                                    const event = new CustomEvent('navigate', { detail: { view: 'artist', artistName: similar.name } })
                                                    window.dispatchEvent(event)
                                                }}
                                                className="group flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                                            >
                                                <div className="w-full aspect-square rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-all overflow-hidden">
                                                    {similar.image ? (
                                                        <img
                                                            src={similar.image}
                                                            alt={similar.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                // If online image fails, try local if available
                                                                if (localArtist?.imagePath) {
                                                                    const src = localArtist.imagePath.startsWith('asset:')
                                                                        ? localArtist.imagePath
                                                                        : `asset:///${localArtist.imagePath.replace(/\\/g, '/')}`
                                                                    e.currentTarget.src = src
                                                                } else {
                                                                    e.currentTarget.style.display = 'none'
                                                                }
                                                            }}
                                                        />
                                                    ) : localArtist?.imagePath ? (
                                                        <img
                                                            src={localArtist.imagePath.startsWith('asset:') ? localArtist.imagePath : `asset:///${localArtist.imagePath.replace(/\\/g, '/')}`}
                                                            alt={similar.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Users size={32} className="text-white/40 group-hover:text-primary/60 transition-colors" />
                                                    )}
                                                </div>
                                                <div className="w-full text-center">
                                                    <div className="text-xs font-bold text-white/90 group-hover:text-white leading-tight transition-colors min-h-[2.5rem] flex items-center justify-center px-1">
                                                        {similar.name}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mt-0.5">
                                                        {localArtist ? `${albumCount} ${albumCount === 1 ? 'Album' : 'Albums'}` : 'Discovery'}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )
                    })()}
                </div>
            </div>
            <QueueConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                title="Clear Playlist?"
                message={`Your playlist is not empty. Would you like to clear it and play top tracks by "${artistName}", or just add them to the end?`}
            />

            {contextMenu && (
                <TrackContextMenu
                    track={contextMenu.track}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div >
    )
}
