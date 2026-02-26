import { motion, AnimatePresence } from 'framer-motion'
import { SkipBack, SkipForward, Play, Pause, Heart, Monitor, ListMusic, X } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useUI } from '../store/ui'
import { client } from '../api/client'
import { RatingStars } from '../components/RatingStars'
import { cn } from '../lib/utils'
import { useState, useRef, useEffect } from 'react'

export default function MiniPlayerView() {
    const { currentTrack: playerTrack, isPlaying, togglePlay, next, prev, currentTime, duration, seek } = usePlayer()
    const { albums, tracks: allTracks, rateTrack, toggleLoved } = useLibrary()
    const { toggleMiniPlayer } = useUI()

    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    const [isQueueOpen, setIsQueueOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (isQueueOpen) {
            if (windowWidth >= 500) {
                window.api.window.setSize(600, 450)
            } else {
                window.api.window.setSize(400, 850)
            }
        } else {
            if (windowWidth >= 500) {
                window.api.window.setSize(600, 120)
            } else {
                window.api.window.setSize(400, 550)
            }
        }
    }, [isQueueOpen])

    const isBarMode = windowWidth >= 500

    const currentTrack = playerTrack
        ? allTracks.find(t => t.id === playerTrack.id) || playerTrack
        : null

    const album = currentTrack ? albums.find(a =>
        a.name === currentTrack.album &&
        a.artist === (currentTrack.albumArtist || currentTrack.artist)
    ) : null


    if (!currentTrack) {
        return (
            <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-4">
                <Monitor size={48} className="opacity-20" />
                <p className="text-sm font-medium">No track playing</p>
                <button
                    onClick={toggleMiniPlayer}
                    className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-xs hover:bg-zinc-800 transition-colors"
                >
                    Back to Full App
                </button>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="h-full w-full bg-zinc-950 flex flex-col overflow-hidden relative select-none"
        >
            {/* Background Image Blur */}
            <div className="absolute inset-0 z-0">
                <img
                    src={client.getCoverUrl(album?.id || '')}
                    className="w-full h-full object-cover blur-3xl opacity-20 scale-150"
                    alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-transparent to-zinc-950" />
            </div>

            {isBarMode ? (
                /* Ultra-Compact BAR MODE */
                <div className="flex-1 flex items-center px-4 gap-4 z-10 pt-8 mt-2">
                    {/* Cover Art - Mini */}
                    <div className="h-12 w-12 bg-zinc-900 rounded-lg shadow-lg overflow-hidden ring-1 ring-white/10 shrink-0 group relative cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    >
                        <img
                            src={client.getCoverUrl(album?.id || '')}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            alt={currentTrack.album}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {isPlaying ? <Pause size={16} className="text-white fill-current" /> : <Play size={16} className="text-white fill-current translate-x-0.5" />}
                        </div>
                    </div>

                    {/* Metadata - Compact */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="overflow-hidden whitespace-nowrap mask-fade">
                            <MarqueeText
                                text={currentTrack.title}
                                className="text-sm font-bold text-white px-2"
                            />
                        </div>
                        <div className="overflow-hidden whitespace-nowrap opacity-60">
                            <MarqueeText
                                text={currentTrack.artist}
                                className="text-[10px] font-medium text-zinc-300 px-2"
                            />
                        </div>
                    </div>

                    {/* Controls - Row */}
                    <div className="flex items-center gap-2">
                        <button onClick={prev} className="p-1.5 text-zinc-400 hover:text-white transition-all hover:scale-110">
                            <SkipBack size={18} fill="currentColor" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="p-2 bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button onClick={next} className="p-1.5 text-zinc-400 hover:text-white transition-all hover:scale-110">
                            <SkipForward size={18} fill="currentColor" />
                        </button>
                    </div>

                    {/* Right Extra Controls */}
                    <div className="flex items-center gap-1 border-l border-white/5 pl-2">
                        <button
                            onClick={() => toggleLoved(currentTrack.id)}
                            className={cn(
                                "p-1.5 transition-all hover:scale-110",
                                currentTrack.loved ? "text-red-500" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <Heart size={16} fill={currentTrack.loved ? "currentColor" : "none"} />
                        </button>
                        <div className="hidden @[500px]:block">
                            <RatingStars
                                rating={currentTrack.rating}
                                onChange={(r) => rateTrack(currentTrack.id, r)}
                                size={10}
                            />
                        </div>
                        <button
                            onClick={() => setIsQueueOpen(!isQueueOpen)}
                            className={cn("p-1.5 transition-all hover:scale-110", isQueueOpen ? "text-blue-500" : "text-zinc-500 hover:text-zinc-300")}
                        >
                            <ListMusic size={16} />
                        </button>
                    </div>

                    {/* Mini Seekbar - Moved slightly up to avoid resize handle collision */}
                    <div className="absolute bottom-1.5 left-0 right-0 h-1.5 bg-zinc-800/30 group/progress cursor-pointer overflow-hidden z-20"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            const pct = x / rect.width
                            seek(pct * duration)
                        }}>
                        <motion.div
                            className="h-full bg-blue-500 group-hover/progress:bg-blue-400 transition-colors"
                            animate={{ width: `${(currentTime / duration) * 100}%` }}
                            transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                        />
                    </div>
                </div>
            ) : (
                /* Standard MINI PLAYER Layout */
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4 pt-20 gap-4 z-10 min-h-0">
                        {/* Cover Art - Responsive size */}
                        <div className="w-full max-w-[280px] aspect-square bg-zinc-900 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 group relative shrink-0 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        >
                            <img
                                src={client.getCoverUrl(album?.id || '')}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                alt={currentTrack.album}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {isPlaying ? <Pause size={32} className="text-white fill-current" /> : <Play size={32} className="text-white fill-current translate-x-1" />}
                            </div>
                        </div>

                        {/* Metadata with Marquee */}
                        <div className="w-full space-y-0.5 text-center min-w-0">
                            <div className="overflow-hidden whitespace-nowrap mask-fade">
                                <MarqueeText
                                    text={currentTrack.title}
                                    className="text-base font-black text-white px-4"
                                />
                            </div>
                            <div className="overflow-hidden whitespace-nowrap opacity-60">
                                <MarqueeText
                                    text={`${currentTrack.artist} ${currentTrack.album ? `— ${currentTrack.album}` : ""}`}
                                    className="text-[11px] font-bold text-zinc-300 px-4"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls Section - Pushed to bottom */}
                    <div className="w-full p-4 space-y-4 bg-gradient-to-t from-zinc-950 to-transparent z-10 shrink-0">
                        {/* Seekbar */}
                        <div className="px-1">
                            <div
                                className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden cursor-pointer relative group/progress"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const x = e.clientX - rect.left
                                    const pct = x / rect.width
                                    seek(pct * duration)
                                }}
                            >
                                <motion.div
                                    className="absolute inset-y-0 left-0 bg-blue-500 group-hover/progress:bg-blue-400"
                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                />
                                <div className="absolute inset-0 z-10 opacity-0 group-hover/progress:opacity-100 flex items-center justify-end pr-2 pointer-events-none">
                                    <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
                                </div>
                            </div>
                            <div className="flex justify-between mt-1.5 px-0.5">
                                <span className="text-[9px] font-bold text-zinc-500 tabular-nums">{formatTime(currentTime)}</span>
                                <span className="text-[9px] font-bold text-zinc-500 tabular-nums">{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Main Controls Row */}
                        <div className="flex items-center justify-between">
                            {/* Loved/Heart */}
                            <button
                                onClick={() => toggleLoved(currentTrack.id)}
                                className={cn(
                                    "p-2 transition-all hover:scale-110 active:scale-90",
                                    currentTrack.loved ? "text-red-500" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Heart size={18} fill={currentTrack.loved ? "currentColor" : "none"} />
                            </button>

                            {/* Playback Controls */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={prev}
                                    className="p-2 text-zinc-400 hover:text-white transition-all hover:scale-110 active:scale-90"
                                >
                                    <SkipBack size={22} fill="currentColor" />
                                </button>
                                <button
                                    onClick={togglePlay}
                                    className="p-3 bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                >
                                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                                </button>
                                <button
                                    onClick={next}
                                    className="p-2 text-zinc-400 hover:text-white transition-all hover:scale-110 active:scale-90"
                                >
                                    <SkipForward size={22} fill="currentColor" />
                                </button>
                            </div>

                            {/* Playlist/Queue Toggle */}
                            <button
                                onClick={() => setIsQueueOpen(!isQueueOpen)}
                                className={cn(
                                    "p-2 transition-all hover:scale-110 active:scale-90",
                                    isQueueOpen ? "text-blue-500" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <ListMusic size={18} />
                            </button>
                        </div>

                        <div className="flex justify-center pt-1 border-t border-white/5">
                            <RatingStars
                                rating={currentTrack.rating}
                                onChange={(r) => rateTrack(currentTrack.id, r)}
                                size={12}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Queue Overlay - Drawer Mode */}
            <AnimatePresence>
                {isQueueOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: isBarMode ? 330 : 300, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-full bg-zinc-950/98 backdrop-blur-xl border-t border-white/5 flex flex-col overflow-hidden shrink-0 z-20"
                    >
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <ListMusic size={14} className="text-blue-500" />
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Kön</h3>
                            </div>
                            <button onClick={() => setIsQueueOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors">
                                <X size={14} className="text-zinc-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <p className="text-[10px] text-zinc-600 text-center py-12 italic uppercase tracking-widest opacity-50 font-black">
                                Mini-vyn visar aktuell kö här
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function MarqueeText({ text, className }: { text: string; className: string }) {
    const [shouldAnimate, setShouldAnimate] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (containerRef.current && textRef.current) {
            setShouldAnimate(textRef.current.offsetWidth > containerRef.current.offsetWidth)
        }
    }, [text])

    return (
        <div ref={containerRef} className={cn("w-full overflow-hidden whitespace-nowrap", className)}>
            <motion.span
                ref={textRef}
                animate={shouldAnimate ? { x: [0, -textRef.current!.offsetWidth / 2] } : {}}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="inline-block"
            >
                {text}
                {shouldAnimate && <span className="ml-12">{text}</span>}
            </motion.span>
        </div>
    )
}

function formatTime(seconds: number) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}
