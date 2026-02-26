import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Shuffle,
    Repeat,
    Music,
    Heart,
    ListMusic,
    Wand2,
    Sparkles
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RatingStars } from './RatingStars'
import { cn } from '../lib/utils'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { formatDuration } from '../utils/format'
import { useSettings } from '../store/settings'
import { client } from '../api/client'
import { useDJ } from '../store/dj'

interface PlayerBarProps {
    onQueueToggle?: () => void
    onAlbumClick?: (id: string) => void
    onArtistClick?: (name: string) => void
}

export default function PlayerBar({ onQueueToggle, onAlbumClick, onArtistClick }: PlayerBarProps) {
    const {
        currentTrack: playerTrack,
        isPlaying,
        togglePlay,
        next,
        prev,
        isShuffle: shuffle,
        toggleShuffle,
        repeatMode: repeat,
        toggleRepeat,
        currentTime,
        duration,
        seek,
        volume,
        setVolume,
        isMuted,
        toggleMute
    } = usePlayer()

    const { albums, tracks: allTracks, rateTrack, toggleLoved } = useLibrary()

    const lastfmEnabled = useSettings((state) => state.lastfmEnabled)
    const listenbrainzEnabled = useSettings((state) => state.listenbrainzEnabled)
    const autoDjEnabled = useSettings((state) => state.autoDjEnabled)
    const setAutoDjEnabled = useSettings((state) => state.setAutoDjEnabled)
    const isCoverExpanded = useSettings((state) => state.isCoverExpanded)
    const toggleCoverExpanded = useSettings((state) => state.toggleCoverExpanded)
    const { isActive: djActive, isTalking: djTalking } = useDJ()

    const currentTrack = playerTrack
        ? allTracks.find((t) => t.id === playerTrack.id) || playerTrack
        : null

    const [isScrubbing, setIsScrubbing] = useState(false)
    const [scrubTime, setScrubTime] = useState<number | null>(null)
    const progressRef = useRef<HTMLDivElement>(null)

    const updateProgressFromEvent = (e: MouseEvent | React.MouseEvent) => {
        if (!progressRef.current || !duration) return
        const rect = progressRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / rect.width))
        const newTime = percentage * duration
        setScrubTime(newTime)
        return newTime
    }

    const handleProgressMouseDown = (e: React.MouseEvent) => {
        setIsScrubbing(true)
        const newTime = updateProgressFromEvent(e)
        if (newTime !== undefined) seek(newTime)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const time = updateProgressFromEvent(moveEvent)
            if (time !== undefined) seek(time)
        }

        const handleMouseUp = () => {
            setIsScrubbing(false)
            setScrubTime(null)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    const [showVolumeBadge, setShowVolumeBadge] = useState(false)
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const volumeRef = useRef<HTMLDivElement>(null)
    const [isDraggingVolume, setIsDraggingVolume] = useState(false)

    const updateVolumeFromEvent = (e: MouseEvent | React.MouseEvent) => {
        if (!volumeRef.current) return
        const rect = volumeRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / rect.width))
        setVolume(percentage)
    }

    const handleVolumeMouseDown = (e: React.MouseEvent) => {
        setIsDraggingVolume(true)
        setShowVolumeBadge(true)
        updateVolumeFromEvent(e)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            updateVolumeFromEvent(moveEvent)
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
        }

        const handleMouseUp = () => {
            setIsDraggingVolume(false)
            showBadgeTemporarily()
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    const showBadgeTemporarily = () => {
        setShowVolumeBadge(true)
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = setTimeout(() => setShowVolumeBadge(false), 1500)
    }

    const handleVolumeWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05
        setVolume(volume + delta)
        showBadgeTemporarily()
    }

    const handleTitleClick = () => {
        if (!currentTrack || !onAlbumClick) return
        const album = albums.find(
            (a) =>
                a.name === currentTrack.album &&
                a.artist === (currentTrack.albumArtist || currentTrack.artist)
        )
        if (album) {
            onAlbumClick(album.id)
        }
    }

    const handleArtistClick = () => {
        if (!currentTrack || !onArtistClick) return
        onArtistClick(currentTrack.artist)
    }

    const [waveformError, setWaveformError] = useState(false)
    const showWaveform = useSettings((state) => state.showWaveform)

    const handleCoverContextMenu = (e: React.MouseEvent) => {
        if (!currentTrack) return
        e.preventDefault()

        const album = albums.find(
            (a) =>
                a.name === currentTrack.album &&
                a.artist === (currentTrack.albumArtist || currentTrack.artist)
        )

        if (album) {
            window.dispatchEvent(
                new CustomEvent('show-album-context-menu', {
                    detail: {
                        album,
                        x: e.clientX,
                        y: e.clientY
                    }
                })
            )
        } else {
            // Fallback to track menu if album not found in cache
            window.dispatchEvent(
                new CustomEvent('show-track-context-menu', {
                    detail: {
                        track: currentTrack,
                        x: e.clientX,
                        y: e.clientY
                    }
                })
            )
        }
    }

    useEffect(() => {
        setWaveformError(false)
    }, [currentTrack?.id])

    return (
        <div className="h-32 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-xl flex flex-col justify-center px-6 z-50 relative">
            <div className="flex items-center justify-between w-full">

                {/* Left: Currently Playing Info */}
                <div className="flex items-center gap-5 min-w-0 w-[30%] max-w-[450px]">
                    <AnimatePresence>
                        {!isCoverExpanded && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, width: 0, marginRight: -20 }}
                                animate={{ opacity: 1, scale: 1, width: 80, marginRight: 0 }}
                                exit={{ opacity: 0, scale: 0.8, width: 0, marginRight: -20 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className="h-20 bg-zinc-900 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group/cover cursor-pointer hover:scale-105 transition-transform origin-left"
                                onContextMenu={handleCoverContextMenu}
                                onClick={toggleCoverExpanded}
                                title="Expand cover"
                            >
                                {currentTrack ? (
                                    <img
                                        src={client.getCoverUrl(
                                            albums.find(
                                                (a) =>
                                                    a.name === currentTrack.album &&
                                                    a.artist === (currentTrack.albumArtist || currentTrack.artist)
                                            )?.id || ''
                                        )}
                                        alt={currentTrack?.album || 'Album Art'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            ; (e.target as HTMLImageElement).style.display = 'none'
                                        }}
                                    />
                                ) : (
                                    <Music className="w-6 h-6 text-zinc-700" />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex flex-col min-w-0">
                        <span
                            className={cn(
                                'font-bold text-base text-white truncate leading-tight',
                                onAlbumClick && currentTrack && 'cursor-pointer hover:underline decoration-white/30'
                            )}
                            onClick={handleTitleClick}
                            title={currentTrack?.title}
                        >
                            {currentTrack?.title || 'No track playing'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span
                                className={cn(
                                    'text-xs text-zinc-500 truncate',
                                    onArtistClick &&
                                    currentTrack &&
                                    'cursor-pointer hover:underline hover:text-zinc-300 decoration-zinc-500/30'
                                )}
                                onClick={handleArtistClick}
                            >
                                {currentTrack?.artist || 'Select a track to play'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center: Playback Controls & Progress */}
                <div className="flex-1 flex flex-col items-center justify-between min-w-0 px-4 md:px-12 py-3">
                    <div className="flex items-center gap-6 h-11 translate-y-2">
                        <button
                            onClick={toggleShuffle}
                            className={cn(
                                'p-2 rounded-full hover:bg-zinc-800/50 transition-all active:scale-90',
                                shuffle
                                    ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                    : 'text-zinc-500',
                                'focus:outline-none'
                            )}
                            title="Shuffle"
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>
                        <button
                            onClick={prev}
                            className="p-2 rounded-full hover:bg-zinc-800/50 transition-all text-zinc-400 hover:text-white active:scale-90 focus:outline-none"
                        >
                            <SkipBack className="w-5 h-5 fill-current" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className={cn(
                                'p-3.5 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all',
                                'focus:outline-none shadow-[0_0_20px_rgba(255,255,255,0.1)] active:bg-blue-600 active:text-white'
                            )}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6 fill-current" />
                            ) : (
                                <Play className="w-6 h-6 fill-current ml-0.5" />
                            )}
                        </button>
                        <button
                            onClick={next}
                            className="p-2 rounded-full hover:bg-zinc-800/50 transition-all text-zinc-400 hover:text-white active:scale-90 focus:outline-none"
                        >
                            <SkipForward className="w-5 h-5 fill-current" />
                        </button>
                        <button
                            onClick={toggleRepeat}
                            className={cn(
                                'p-2 rounded-full hover:bg-zinc-800/50 transition-all focus:outline-none relative active:scale-90',
                                repeat !== 'normal'
                                    ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                    : 'text-zinc-500'
                            )}
                            title={`Repeat: ${repeat}`}
                        >
                            <Repeat className="w-4 h-4" />
                            {repeat === 'repeat-one' && (
                                <span className="absolute text-[7px] font-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[0.5px]">
                                    1
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Progress Bar Container - Always reserved space */}
                    <div className="w-full flex flex-col items-center">
                        {currentTrack ? (
                            <div className="w-full max-w-[800px] flex items-center gap-4 group">
                                <span className="text-xs font-bold text-zinc-400 tabular-nums w-12 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                                    {formatDuration(isScrubbing && scrubTime !== null ? scrubTime : currentTime)}
                                </span>
                                <div
                                    ref={progressRef}
                                    className={cn(
                                        'flex-1 cursor-pointer relative group/bar overflow-hidden transition-all duration-300 mx-2',
                                        showWaveform && !waveformError ? 'h-16' : 'h-1.5 bg-zinc-800/50 rounded-full'
                                    )}
                                    onMouseDown={handleProgressMouseDown}
                                >
                                    {/* Hit Area */}
                                    <div className="absolute -inset-y-3 left-0 right-0 z-10" />

                                    {!showWaveform || waveformError ? (
                                        <>
                                            <div className="absolute inset-0 bg-zinc-800/50 rounded-full" />
                                            <div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] group-hover/bar:from-white group-hover/bar:to-white transition-all duration-300"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, (currentTime / (duration || 1) || 0) * 100))}%`
                                                }}
                                            />
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 group-hover/bar:scale-125 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
                                                style={{
                                                    left: `${Math.min(100, Math.max(0, (currentTime / (duration || 1) || 0) * 100))}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center">
                                            {/* Unplayed Waveform */}
                                            <div
                                                className="absolute inset-0 opacity-20 pointer-events-none grayscale"
                                                style={{
                                                    backgroundImage: `url(${client.getWaveformUrl(currentTrack.id)})`,
                                                    backgroundSize: '100% 100%',
                                                    backgroundPosition: 'center'
                                                }}
                                            />
                                            {/* Played portion */}
                                            <div
                                                className={cn(
                                                    "absolute inset-0 bg-blue-500 pointer-events-none transition-[clip-path]",
                                                    isScrubbing ? "duration-0" : "duration-100"
                                                )}
                                                style={{
                                                    clipPath: `inset(0 ${100 - Math.min(100, Math.max(0, ((isScrubbing && scrubTime !== null ? scrubTime : currentTime) / (duration || 1) || 0) * 100))}% 0 0)`,
                                                    WebkitMaskImage: `url(${client.getWaveformUrl(currentTrack.id)})`,
                                                    WebkitMaskSize: '100% 100%',
                                                    WebkitMaskPosition: 'center',
                                                    maskImage: `url(${client.getWaveformUrl(currentTrack.id)})`,
                                                    maskSize: '100% 100%',
                                                    maskPosition: 'center'
                                                }}
                                            />
                                            {/* Progress line - 50% height, centered */}
                                            <div
                                                className="absolute top-1/4 bottom-1/4 bg-white w-[1.5px] shadow-[0_0_15px_rgba(255,255,255,0.9)] z-20"
                                                style={{ left: `${Math.min(100, Math.max(0, ((isScrubbing && scrubTime !== null ? scrubTime : currentTime) / (duration || 1) || 0) * 100))}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-zinc-400 tabular-nums w-12 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {formatDuration(duration)}
                                </span>
                            </div>
                        ) : (
                            <div className="h-16 w-full" />
                        )}
                    </div>
                </div>

                {/* Right: Rating, Tech Info, Volume, Scrobble, Queue */}
                <div className="flex items-center gap-4 justify-end w-[30%] max-w-[400px]">

                    {/* Rating & Loved */}
                    {currentTrack && (
                        <div className="flex items-center gap-3 px-3 py-1 bg-zinc-900/50 rounded-full border border-white/5">
                            <RatingStars
                                rating={currentTrack.rating}
                                onChange={(r) => rateTrack(currentTrack.id, r)}
                                size={10}
                                className="hover:scale-110 transition-transform"
                            />
                            <div className="w-px h-3 bg-white/10" />
                            <button
                                onClick={() => toggleLoved(currentTrack.id)}
                                className={cn(
                                    'transition-all hover:scale-110 active:scale-95',
                                    currentTrack.loved ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'
                                )}
                            >
                                <Heart size={12} fill={currentTrack.loved ? 'currentColor' : 'none'} />
                            </button>
                        </div>
                    )}

                    {/* Auto-DJ + Tech Info + Volume (stacked vertically) */}
                    {currentTrack ? (
                        <div className="flex flex-col items-end gap-1.5">
                            {/* Tech Info Badge above volume */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/40 rounded-md border border-white/10 text-[10px] font-bold whitespace-nowrap">
                                {currentTrack.sampleRate && (
                                    <span className="text-blue-400">
                                        {(currentTrack.sampleRate / 1000).toFixed(1)}kHz
                                    </span>
                                )}
                                {currentTrack.sampleRate && currentTrack.bitDepth && (
                                    <span className="text-zinc-600 px-0.5">/</span>
                                )}
                                {currentTrack.bitDepth && (
                                    <span className="text-zinc-400">{currentTrack.bitDepth}-bit</span>
                                )}
                                {(currentTrack.sampleRate || currentTrack.bitDepth) && (
                                    <span className="text-zinc-600 mr-1">,</span>
                                )}
                                <span className="text-zinc-500 uppercase">{currentTrack.format}</span>
                                {currentTrack.bitrate && (
                                    <span className="text-zinc-600 ml-1">
                                        {Math.round(currentTrack.bitrate / 1000)}k
                                    </span>
                                )}
                                {useSettings.getState().gaplessEnabled && (
                                    <span className="ml-2 text-[8px] font-black text-emerald-500/80 tracking-tighter border border-emerald-500/20 px-1 rounded-sm">
                                        GAPLESS
                                    </span>
                                )}
                            </div>

                            {/* Volume Controls */}
                            <div
                                className="flex items-center gap-3 relative"
                                onMouseEnter={() => setShowVolumeBadge(true)}
                                onMouseLeave={() => setShowVolumeBadge(false)}
                                onWheel={handleVolumeWheel}
                            >
                                {/* Numeric Volume Badge */}
                                <div
                                    className={cn(
                                        'absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded shadow-lg transition-all duration-200 pointer-events-none z-50',
                                        showVolumeBadge
                                            ? 'opacity-100 translate-y-0 scale-100'
                                            : 'opacity-0 translate-y-2 scale-90'
                                    )}
                                >
                                    {Math.round(volume * 100)}
                                </div>

                                {/* Auto-DJ Button */}
                                <button
                                    onClick={() => setAutoDjEnabled(!autoDjEnabled)}
                                    className={cn(
                                        'p-1 rounded-md transition-all hover:scale-110 active:scale-95',
                                        autoDjEnabled
                                            ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]'
                                            : 'text-zinc-600 hover:text-zinc-400'
                                    )}
                                    title={autoDjEnabled ? 'Auto-DJ: On' : 'Auto-DJ: Off'}
                                >
                                    <Wand2 className="w-4 h-4" />
                                </button>

                                {djActive && (
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-tighter transition-all duration-500",
                                        djTalking
                                            ? "bg-white text-purple-700 border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                            : "bg-purple-600/20 text-purple-400 border-purple-500/30"
                                    )}>
                                        <Sparkles size={10} className={djTalking ? "animate-spin" : ""} />
                                        <span>DJ</span>
                                    </div>
                                )}

                                <button
                                    onClick={toggleMute}
                                    className="text-zinc-500 hover:text-white transition-colors p-1"
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="w-4 h-4" />
                                    ) : (
                                        <Volume2 className="w-4 h-4" />
                                    )}
                                </button>

                                <div
                                    ref={volumeRef}
                                    className="w-20 h-1.5 bg-zinc-800/50 rounded-full cursor-pointer relative group/volume"
                                    onMouseDown={handleVolumeMouseDown}
                                >
                                    <div className="absolute -inset-y-3 left-0 right-0 z-10" />
                                    <div
                                        className={cn(
                                            "absolute inset-y-0 left-0 rounded-full transition-colors",
                                            isDraggingVolume ? "bg-blue-500" : "bg-zinc-400 group-hover/volume:bg-blue-500"
                                        )}
                                        style={{ width: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%` }}
                                    />
                                    <div
                                        className={cn(
                                            "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full transition-opacity shadow-[0_0_8px_rgba(0,0,0,0.5)]",
                                            isDraggingVolume ? "opacity-100 scale-125" : "opacity-0 group-hover/volume:opacity-100"
                                        )}
                                        style={{
                                            left: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%`,
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* No track: just show volume controls */
                        <div
                            className="flex items-center gap-3 relative"
                            onMouseEnter={() => setShowVolumeBadge(true)}
                            onMouseLeave={() => setShowVolumeBadge(false)}
                            onWheel={handleVolumeWheel}
                        >
                            <div
                                className={cn(
                                    'absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded shadow-lg transition-all duration-200 pointer-events-none z-50',
                                    showVolumeBadge
                                        ? 'opacity-100 translate-y-0 scale-100'
                                        : 'opacity-0 translate-y-2 scale-90'
                                )}
                            >
                                {Math.round(volume * 100)}
                            </div>

                            <button
                                onClick={toggleMute}
                                className="text-zinc-500 hover:text-white transition-colors p-1"
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX className="w-4 h-4" />
                                ) : (
                                    <Volume2 className="w-4 h-4" />
                                )}
                            </button>

                            <div
                                ref={volumeRef}
                                className="w-20 h-1.5 bg-zinc-800/50 rounded-full cursor-pointer relative group/volume"
                                onMouseDown={handleVolumeMouseDown}
                            >
                                <div className="absolute -inset-y-3 left-0 right-0 z-10" />
                                <div
                                    className={cn(
                                        "absolute inset-y-0 left-0 rounded-full transition-colors",
                                        isDraggingVolume ? "bg-blue-500" : "bg-zinc-400 group-hover/volume:bg-blue-500"
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%` }}
                                />
                                <div
                                    className={cn(
                                        "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full transition-opacity shadow-[0_0_8px_rgba(0,0,0,0.5)]",
                                        isDraggingVolume ? "opacity-100 scale-125" : "opacity-0 group-hover/volume:opacity-100"
                                    )}
                                    style={{
                                        left: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Scrobble Indicators + Queue */}
                    <div className="flex items-center gap-2">
                        {(lastfmEnabled || listenbrainzEnabled) && (
                            <div className="flex gap-1 items-center bg-zinc-900 px-2 py-1 rounded border border-white/5">
                                {lastfmEnabled && (
                                    <span className="text-[7px] font-black text-red-500 leading-none">LFM</span>
                                )}
                                {listenbrainzEnabled && (
                                    <span className="text-[7px] font-black text-violet-500 leading-none">LB</span>
                                )}
                            </div>
                        )}
                        <button
                            onClick={onQueueToggle}
                            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all active:scale-90"
                            title="Toggle Queue"
                        >
                            <ListMusic className="w-4 h-4" />
                        </button>
                    </div>

                </div>

            </div>
        </div>
    )
}
