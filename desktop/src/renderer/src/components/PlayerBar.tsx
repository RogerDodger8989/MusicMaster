import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Music, Heart, ListMusic } from 'lucide-react'
import { RatingStars } from './RatingStars'
import { cn } from '../lib/utils'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { formatDuration } from '../utils/format'
import { useSettings } from '../store/settings'

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
        trackPlayCount
    } = usePlayer()

    const { albums, tracks: allTracks, rateTrack, toggleLoved } = useLibrary()
    const replayGainMode = useSettings(state => state.replayGainMode)
    const gaplessEnabled = useSettings(state => state.gaplessEnabled)
    const lastfmEnabled = useSettings(state => state.lastfmEnabled)
    const listenbrainzEnabled = useSettings(state => state.listenbrainzEnabled)

    // Sync live track data to get reactive updates (like Loved status)
    const currentTrack = playerTrack ? (allTracks.find(t => t.id === playerTrack.id) || playerTrack) : null

    // Find cover art if missing on track
    const displayCover = currentTrack?.coverArtPath ||
        (currentTrack ? albums.find(a => a.name === currentTrack.album && a.artist === (currentTrack.albumArtist || currentTrack.artist))?.coverArtPath : null)

    const replayGainValueDb = (() => {
        if (!currentTrack || replayGainMode === 'off') return null
        if (replayGainMode === 'album') {
            return currentTrack.replayGainAlbum ?? currentTrack.replayGainTrack ?? null
        }
        return currentTrack.replayGainTrack ?? null
    })()

    const replayGainLabel = replayGainMode === 'album' ? 'RG ALBUM' : 'RG TRACK'

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / rect.width))
        seek(percentage * duration)
    }

    const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / rect.width))
        setVolume(percentage)
    }

    const handleTitleClick = () => {
        if (!currentTrack || !onAlbumClick) return
        // Find album ID
        const album = albums.find(a => a.name === currentTrack.album && a.artist === (currentTrack.albumArtist || currentTrack.artist))
        if (album) {
            onAlbumClick(album.id)
        }
    }

    const handleArtistClick = () => {
        if (!currentTrack || !onArtistClick) return
        onArtistClick(currentTrack.artist)
    }

    // Determine Repeat Icon style/state
    const getRepeatColor = () => {
        if (repeat === 'normal') return 'text-zinc-400'
        return 'text-blue-500'
    }

    return (
        <div className="h-24 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 z-50 relative">
            {/* Currently Playing Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {displayCover ? (
                        <img
                            src={displayCover.startsWith('asset:') ? displayCover : `asset:///${displayCover.replace(/\\/g, '/')}`}
                            alt={currentTrack?.album || 'Album Art'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Music className="w-8 h-8 text-zinc-600" />
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span
                        className={cn("font-medium text-white truncate pr-4", onAlbumClick && currentTrack && "cursor-pointer hover:underline")}
                        onClick={handleTitleClick}
                        title={currentTrack?.title}
                    >
                        {currentTrack?.title || 'No track playing'}
                    </span>
                    <span
                        className={cn("text-sm text-zinc-500 truncate pr-4", onArtistClick && currentTrack && "cursor-pointer hover:underline hover:text-zinc-300")}
                        onClick={handleArtistClick}
                    >
                        {currentTrack?.artist || 'Select a track to play'}
                    </span>
                </div>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col items-center gap-2 flex-1">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center mr-2 transition-opacity duration-500 whitespace-nowrap">
                        {currentTrack && (
                            <>
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                                    {currentTrack.format?.toUpperCase() || 'FLAC'}
                                </span>
                                <span className="text-[9px] font-bold text-zinc-600">
                                    {currentTrack.format === 'flac' && currentTrack.sampleRate
                                        ? `${(currentTrack.sampleRate / 1000).toFixed(1)}kHz/${currentTrack.bitDepth || 16}-bit`
                                        : `${Math.round((currentTrack.bitrate || 0) / 1000)}kbps`
                                    }
                                </span>
                                {replayGainMode !== 'off' && replayGainValueDb !== null && (
                                    <span
                                        className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider"
                                        title={`${replayGainLabel}: ${replayGainValueDb.toFixed(2)} dB`}
                                    >
                                        {replayGainLabel} {replayGainValueDb.toFixed(2)} dB
                                    </span>
                                )}
                                {gaplessEnabled && (
                                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider">
                                        GAPLESS
                                    </span>
                                )}
                                {trackPlayCount > 0 && (
                                    <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">
                                        {trackPlayCount}x PLAYED
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                    <button
                        onClick={toggleShuffle}
                        className={cn(
                            'p-2 rounded-full hover:bg-zinc-800 transition-colors',
                            shuffle ? 'text-blue-500' : 'text-zinc-400',
                            'focus:outline-none'
                        )}
                        title="Shuffle"
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={prev}
                        className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 focus:outline-none"
                    >
                        <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                        onClick={togglePlay}
                        className={cn(
                            'p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors',
                            'focus:outline-none shadow-lg shadow-blue-900/20 active:scale-95 transform duration-100'
                        )}
                    >
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                    </button>
                    <button
                        onClick={next}
                        className="p-2 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 focus:outline-none"
                    >
                        <SkipForward className="w-5 h-5" />
                    </button>
                    <button
                        onClick={toggleRepeat}
                        className={cn(
                            'p-2 rounded-full hover:bg-zinc-800 transition-colors focus:outline-none relative',
                            getRepeatColor()
                        )}
                        title={`Repeat: ${repeat}`}
                    >
                        <Repeat className="w-4 h-4" />
                        {repeat === 'repeat-one' && (
                            <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">1</span>
                        )}
                    </button>
                    {currentTrack && (
                        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/5">
                            <RatingStars
                                rating={currentTrack.rating}
                                onChange={(r) => rateTrack(currentTrack.id, r)}
                                size={12}
                                className="hover:scale-110 transition-transform"
                            />
                            <button
                                onClick={() => toggleLoved(currentTrack.id)}
                                className={cn(
                                    "transition-all hover:scale-110 active:scale-95",
                                    currentTrack.loved ? "text-red-500" : "text-zinc-600 hover:text-red-400"
                                )}
                            >
                                <Heart size={14} fill={currentTrack.loved ? "currentColor" : "none"} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-xl flex items-center gap-2 group">
                    <span className="text-xs text-zinc-500 tabular-nums w-10 text-right">
                        {formatDuration(currentTime)}
                    </span>
                    <div
                        className="flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer relative py-2" // py-2 to increase hit area
                        onClick={handleProgressClick}
                    >
                        {/* Background track */}
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-zinc-800 rounded-full" />

                        {/* Played portion */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-blue-600 rounded-full group-hover:bg-blue-500 transition-colors"
                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        />

                        {/* Thumb (visible on group hover) */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none"
                            style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                        />
                    </div>
                    <span className="text-xs text-zinc-500 tabular-nums w-10">
                        {formatDuration(duration)}
                    </span>
                </div>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 flex-1 justify-end group">
                <div className="flex gap-1 items-center">
                    <span
                        className={cn(
                            "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            lastfmEnabled
                                ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                                : "bg-zinc-800 text-zinc-600"
                        )}
                        title="Last.fm Scrobbling"
                    >
                        L.FM
                    </span>
                    <span
                        className={cn(
                            "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            listenbrainzEnabled
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                                : "bg-zinc-800 text-zinc-600"
                        )}
                        title="ListenBrainz Scrobbling"
                    >
                        LB
                    </span>
                </div>
                <Volume2 className="w-5 h-5 text-zinc-500" />
                <div
                    className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative py-2"
                    onClick={handleVolumeClick}
                >
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-zinc-800 rounded-full" />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-blue-600 rounded-full group-hover:bg-blue-500 transition-colors"
                        style={{ width: `${volume * 100}%` }}
                    />
                </div>
                <button
                    onClick={onQueueToggle}
                    className="p-2 ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    title="Toggle Queue"
                >
                    <ListMusic className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}
