import { useState, useEffect } from 'react'
import { usePlayer } from '../store/player'
import { client } from '../api/client'
import { Track } from '../types'
import { cn } from '../lib/utils'
import { Tv } from 'lucide-react'
import Visualizer, { VisualizerMode } from '../components/Visualizer'
import TrackList from '../components/TrackList'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'up_next' | 'related' | 'visualizer'

export default function TheaterModeView() {
    const { currentTrack, queue, currentIndex, reorderQueue } = usePlayer()
    const [activeTab, setActiveTab] = useState<Tab>('up_next')
    const [relatedTracks, setRelatedTracks] = useState<Track[]>([])
    const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('spectrum')

    // Up next is everything after currentIndex
    const upNextTracks = queue.slice(Math.max(0, currentIndex) + 1)

    const handleReorder = (startIndex: number, endIndex: number) => {
        const absoluteStart = currentIndex + 1 + startIndex
        const absoluteEnd = currentIndex + 1 + endIndex
        reorderQueue(absoluteStart, absoluteEnd)
    }

    useEffect(() => {
        if (activeTab === 'related' && currentTrack) {
            // Fetch similar tracks
            client.getSimilarTracks(currentTrack.id).then((res: any) => {
                if (res && res.tracks) {
                    setRelatedTracks(res.tracks)
                } else if (Array.isArray(res)) {
                    setRelatedTracks(res)
                }
            }).catch(err => console.error("Failed to fetch similar tracks", err))
        }
    }, [activeTab, currentTrack?.id])

    if (!currentTrack) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
                <div className="flex flex-col items-center gap-4">
                    <Tv size={48} className="opacity-20" />
                    <p>Play a track to enter Theater Mode</p>
                </div>
            </div>
        )
    }

    const coverUrl = client.getCoverUrl(currentTrack.albumId || currentTrack.id)

    return (
        <div className="w-full h-full relative overflow-hidden flex font-sans">
            <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-950 pointer-events-none">
                <img
                    src={coverUrl}
                    alt="background blur"
                    className="w-[120%] h-[120%] absolute -top-[10%] -left-[10%] object-cover blur-[90px] opacity-100 saturate-[2.5] brightness-110 object-center"
                />
                {/* Gentle overlay to ensure white text is readable, but preserving color */}
                <div className="absolute inset-0 bg-black/40 mix-blend-overlay" />
                <div className="absolute inset-0 bg-black/20" />

                {/* Smooth blend into the bottom PlayerBar */}
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/30 to-transparent" />
                {/* Smooth blend away from the transparent TopBar */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
            </div>

            {/* Main Content */}
            <div className="z-10 w-full h-full flex pt-24 pb-40 px-12 gap-12 relative">
                {/* Left: Cover & Info */}
                <div className="flex-1 flex flex-col justify-center max-w-2xl">
                    <motion.div
                        className="w-full aspect-square rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 relative group"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                        key={`cover-${currentTrack.id}`}
                    >
                        <img
                            src={coverUrl}
                            alt={currentTrack.title}
                            className="w-full h-full object-cover"
                        />
                    </motion.div>

                    <motion.div
                        className="mt-10 space-y-2"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        key={`info-${currentTrack.id}`}
                    >
                        <h1 className="text-5xl font-black text-white leading-tight tracking-tight line-clamp-2">
                            {currentTrack.title}
                        </h1>
                        <h2 className="text-2xl text-zinc-300 font-medium tracking-wide">
                            {currentTrack.artist}
                        </h2>
                        <div className="flex items-center gap-3 pt-4 text-sm text-zinc-500 font-mono tracking-wider uppercase">
                            {currentTrack.album && <span>{currentTrack.album}</span>}
                        </div>
                    </motion.div>
                </div>

                {/* Right: Tabs & Lists */}
                <div className="flex-1 flex flex-col max-w-4xl self-center h-full max-h-[700px] bg-black/20 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                    {/* Tabs */}
                    <div className="flex border-b border-white/10 shrink-0">
                        {(['up_next', 'related', 'visualizer'] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-5 text-sm font-bold tracking-widest uppercase transition-colors relative",
                                    activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {tab.replace('_', ' ')}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="theater-tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            {activeTab === 'up_next' && (
                                <motion.div
                                    key="up_next"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="absolute inset-0 flex flex-col pt-2"
                                >
                                    {upNextTracks.length === 0 ? (
                                        <div className="flex items-center justify-center flex-1 text-zinc-500 font-mono">
                                            End of queue
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-hidden relative">
                                            <TrackList
                                                tracks={upNextTracks}
                                                visibleColumns={['index', 'title', 'time']}
                                                compactMode={true}
                                                hideHeader={true}
                                                isReorderable={true}
                                                onReorder={handleReorder}
                                                onArtistClick={(artistName) => {
                                                    window.dispatchEvent(
                                                        new CustomEvent('navigate-push', {
                                                            detail: { view: 'artist-detail', params: { artistName } }
                                                        })
                                                    )
                                                }}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'related' && (
                                <motion.div
                                    key="related"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="absolute inset-0 flex flex-col pt-2"
                                >
                                    {relatedTracks.length === 0 ? (
                                        <div className="flex items-center justify-center flex-1 text-zinc-500 font-mono">
                                            Loading similar tracks...
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-hidden relative">
                                            <TrackList
                                                tracks={relatedTracks}
                                                visibleColumns={['index', 'title', 'time']}
                                                compactMode={true}
                                                hideHeader={true}
                                                onArtistClick={(artistName) => {
                                                    window.dispatchEvent(
                                                        new CustomEvent('navigate-push', {
                                                            detail: { view: 'artist-detail', params: { artistName } }
                                                        })
                                                    )
                                                }}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'visualizer' && (
                                <motion.div
                                    key="visualizer"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="absolute inset-0 flex flex-col p-6"
                                >
                                    <div className="flex gap-2 mb-6 shrink-0 justify-center">
                                        {(['spectrum', 'waveform', 'particles', 'orbit'] as VisualizerMode[]).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setVisualizerMode(mode)}
                                                className={cn(
                                                    "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors",
                                                    visualizerMode === mode
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex-1 w-full relative drop-shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                        <Visualizer mode={visualizerMode} color="#60a5fa" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

        </div>
    )
}
