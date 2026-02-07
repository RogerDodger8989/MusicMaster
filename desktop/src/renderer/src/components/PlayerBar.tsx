import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Music, Heart, ListMusic } from 'lucide-react'
import { RatingStars } from './RatingStars'
import { cn } from '../lib/utils'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { formatDuration } from '../utils/format'
import { useSettings } from '../store/settings'
import { client } from '../api/client'

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
        setVolume
    } = usePlayer()

    const { albums, tracks: allTracks, rateTrack, toggleLoved } = useLibrary()

    // Scrobble settings for indicators
    const lastfmEnabled = useSettings(state => state.lastfmEnabled)
    const listenbrainzEnabled = useSettings(state => state.listenbrainzEnabled)

    // Sync live track data to get reactive updates (like Loved status)
    const currentTrack = playerTrack ? (allTracks.find(t => t.id === playerTrack.id) || playerTrack) : null

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


    return (
        <div className="h-24 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-xl grid grid-cols-[1.2fr_2fr_1.2fr] items-center px-6 z-50 relative">
            {/* Currently Playing Info */}
            <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-14 h-14 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow-inner ring-1 ring-white/5">
                    {currentTrack ? (
                        <img
                            src={client.getCoverUrl(albums.find(a => a.name === currentTrack.album && a.artist === (currentTrack.albumArtist || currentTrack.artist))?.id || '')}
                            alt={currentTrack?.album || 'Album Art'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    ) : (
                        <Music className="w-6 h-6 text-zinc-700" />
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span
                        className={cn("font-semibold text-sm text-white truncate", onAlbumClick && currentTrack && "cursor-pointer hover:underline decoration-white/30")}
                        onClick={handleTitleClick}
                        title={currentTrack?.title}
                    >
                        {currentTrack?.title || 'No track playing'}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span
                            className={cn("text-xs text-zinc-500 truncate", onArtistClick && currentTrack && "cursor-pointer hover:underline hover:text-zinc-300 decoration-zinc-500/30")}
                            onClick={handleArtistClick}
                        >
                            {currentTrack?.artist || 'Select a track to play'}
                        </span>
                        {currentTrack && (
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-zinc-900 rounded border border-white/5">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">
                                    {currentTrack.format?.toUpperCase() || 'FLAC'}
                                </span>
                                <span className="text-[8px] font-black text-blue-500/80">
                                    {currentTrack.format === 'flac' && currentTrack.sampleRate
                                        ? `${(currentTrack.sampleRate / 1000).toFixed(1)}kHz`
                                        : `${Math.round((currentTrack.bitrate || 0) / 1000)}k`
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Playback Controls & Progress */}
            <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4">
                <div className="flex items-center gap-5 mb-3">
                    <button
                        onClick={toggleShuffle}
                        className={cn(
                            'p-2 rounded-full hover:bg-zinc-800/50 transition-all active:scale-90',
                            shuffle ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-zinc-500',
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
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
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
                            repeat !== 'normal' ? 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-zinc-500'
                        )}
                        title={`Repeat: ${repeat}`}
                    >
                        <Repeat className="w-4 h-4" />
                        {repeat === 'repeat-one' && (
                            <span className="absolute text-[7px] font-black top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[0.5px]">1</span>
                        )}
                    </button>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full flex items-center gap-3 group px-4">
                    <span className="text-[10px] font-bold text-zinc-500 tabular-nums w-10 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                        {formatDuration(currentTime)}
                    </span>
                    <div
                        className="flex-1 h-[3px] bg-zinc-800/50 rounded-full cursor-pointer relative group/bar"
                        onClick={handleProgressClick}
                    >
                        {/* Hit Area (invisible) */}
                        <div className="absolute -inset-y-3 left-0 right-0 z-10" />

                        {/* Background track */}
                        <div className="absolute inset-0 bg-zinc-800/50 rounded-full" />

                        {/* Played portion */}
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] group-hover/bar:from-white group-hover/bar:to-white transition-all duration-300"
                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        />

                        {/* Thumb */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 group-hover/bar:scale-125 transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
                            style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 tabular-nums w-10 opacity-60 group-hover:opacity-100 transition-opacity">
                        {formatDuration(duration)}
                    </span>
                </div>
            </div>

            {/* Right Controls: Rating, Volume, Scrobble, Queue */}
            <div className="flex items-center gap-6 justify-end">
                {currentTrack && (
                    <div className="flex items-center gap-3 px-3 py-1 bg-zinc-900/50 rounded-full border border-white/5">
                        <RatingStars
                            rating={currentTrack.rating}
                            onChange={(r) => rateTrack(currentTrack.id, r)}
                            size={10}
                            className="hover:scale-110 transition-transform opacity-70 hover:opacity-100"
                        />
                        <div className="w-px h-3 bg-white/10" />
                        <button
                            onClick={() => toggleLoved(currentTrack.id)}
                            className={cn(
                                "transition-all hover:scale-110 active:scale-95",
                                currentTrack.loved ? "text-red-500" : "text-zinc-600 hover:text-red-400"
                            )}
                        >
                            <Heart size={12} fill={currentTrack.loved ? "currentColor" : "none"} />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-zinc-500" />
                    <div
                        className="w-20 h-[3px] bg-zinc-800/50 rounded-full cursor-pointer relative group/volume"
                        onClick={handleVolumeClick}
                    >
                        <div className="absolute -inset-y-3 left-0 right-0 z-10" />
                        <div
                            className="absolute inset-y-0 left-0 bg-zinc-400 group-hover/volume:bg-blue-500 rounded-full transition-colors"
                            style={{ width: `${volume * 100}%` }}
                        />
                    </div>
                </div>

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
    )
}
