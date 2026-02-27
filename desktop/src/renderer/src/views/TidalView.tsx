import { useState } from 'react'
import { Search, Waves, Play, Plus, Heart, Loader2, Disc, User, Music } from 'lucide-react'
import { useTidal } from '../store/tidal'
import { usePlayer } from '../store/player'
import { motion, AnimatePresence } from 'framer-motion'

export default function TidalView() {
    const {
        isAuthenticated,
        isSearching,
        searchResults,
        search,
        login,
        logout
    } = useTidal()

    const { playTrack, addToQueue } = usePlayer()
    const [query, setQuery] = useState('')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            search(query)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 animate-pulse">
                    <Waves className="w-10 h-10 text-blue-500" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Connect to Tidal</h1>
                <p className="text-zinc-400 max-w-md mb-8">
                    Stream over 100 million tracks in high fidelity directly within MusicMaster. Connect your Tidal account to get started.
                </p>
                <button
                    onClick={login}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                >
                    Connect Account
                </button>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
            {/* Header / Search */}
            <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                            <Waves className="w-8 h-8 text-blue-500" />
                            Tidal
                        </h1>
                        <p className="text-zinc-500 mt-1">Explore High-Fidelity Music</p>
                    </div>
                    <button
                        onClick={logout}
                        className="text-xs text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-bold transition-colors"
                    >
                        Disconnect Account
                    </button>
                </div>

                <form onSubmit={handleSearch} className="relative max-w-2xl group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search Tidal for tracks, albums, or artists..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-lg"
                    />
                    {isSearching && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        </div>
                    )}
                </form>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4">
                <AnimatePresence mode="wait">
                    {searchResults.length > 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            {/* Tracks Section */}
                            <section>
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-blue-500" /> Tracks
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {searchResults.map((track) => (
                                        <div
                                            key={track.id}
                                            className="group flex items-center gap-4 p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl transition-all border border-zinc-800/30 hover:border-blue-500/30"
                                        >
                                            <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-lg">
                                                <img
                                                    src={track.coverArtPath || ''}
                                                    alt={track.album}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                                <button
                                                    onClick={() => playTrack(track)}
                                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                >
                                                    <Play className="w-6 h-6 fill-current" />
                                                </button>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white font-semibold truncate group-hover:text-blue-400 transition-colors">{track.title}</div>
                                                <div className="text-zinc-500 text-sm truncate">{track.artist}</div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                                <button
                                                    onClick={() => addToQueue(track)}
                                                    className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
                                                    title="Add to queue"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-red-500 transition-colors"
                                                    title="Heart on Tidal"
                                                >
                                                    <Heart className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Add Albums/Artists sections here if implementing them in store/service */}
                        </motion.div>
                    ) : query && !isSearching ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center justify-center text-zinc-500"
                        >
                            <Music className="w-12 h-12 mb-4 opacity-20" />
                            <p>No results found for "{query}"</p>
                        </motion.div>
                    ) : !query ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-12">
                            <div className="p-6 bg-gradient-to-br from-blue-900/20 to-zinc-900 rounded-3xl border border-blue-500/10">
                                <Music className="w-8 h-8 text-blue-400 mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">High Fidelity</h3>
                                <p className="text-sm text-zinc-400">Experience music exactly as the artist intended with lossless audio quality.</p>
                            </div>
                            <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-900 rounded-3xl border border-zinc-800">
                                <Disc className="w-8 h-8 text-zinc-400 mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">Huge Library</h3>
                                <p className="text-sm text-zinc-400">Search through millions of tracks and add them to your MusicMaster collection.</p>
                            </div>
                            <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-900 rounded-3xl border border-zinc-800">
                                <User className="w-8 h-8 text-zinc-400 mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">My Library</h3>
                                <p className="text-sm text-zinc-400">Access your Tidal favorites and playlists directly in your main library view.</p>
                            </div>
                        </div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    )
}
