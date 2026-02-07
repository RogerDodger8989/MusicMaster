import { useEffect, useRef, useState } from 'react'
import { Search, X, User, Disc, Music } from 'lucide-react'
import { useDraggable } from '../hooks/useDraggable'
import { useSearch } from '../store/search'
import { useNavigation } from '../store/navigation'
import { cn } from '../utils'
import { client } from '../api/client'

export default function SearchModal() {
    const { query, setQuery, results, isSearching, isOpen, setIsOpen } = useSearch()
    const { navigateTo } = useNavigation()
    const [selectedIndex, setSelectedIndex] = useState(0)
    const modalRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const { position, handleMouseDown } = useDraggable()

    const flatResults = [
        ...results.artists.map(a => ({ type: 'artist', ...a })),
        ...results.albums.map(a => ({ type: 'album', ...a })),
        ...results.tracks.map(t => ({ type: 'track', ...t }))
    ]

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
            setSelectedIndex(0)
        }
    }, [isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false)
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % Math.max(1, flatResults.length))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + flatResults.length) % Math.max(1, flatResults.length))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (flatResults[selectedIndex]) {
                    handleSelect(flatResults[selectedIndex].type, flatResults[selectedIndex])
                }
            }
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, setIsOpen, selectedIndex, flatResults])

    if (!isOpen) return null

    const handleSelect = (type: string, item: any) => {
        setIsOpen(false)
        if (type === 'artist') {
            navigateTo('artist-detail', { artistName: item.name })
        } else if (type === 'album') {
            navigateTo('album-detail', { albumId: item.id })
        } else if (type === 'track') {
            // Track selection now uses albumId from the backend join
            const targetAlbumId = item.albumId || item.id
            navigateTo('album-detail', { albumId: targetAlbumId })
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60">
            <div
                ref={modalRef}
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            >
                {/* Search Input */}
                <div
                    className="p-4 border-b border-zinc-800 flex items-center gap-4 cursor-move"
                    onMouseDown={handleMouseDown}
                >
                    <Search className="w-5 h-5 text-zinc-500" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search artists, albums, tracks..."
                        className="flex-1 bg-transparent text-white border-none focus:outline-none text-lg placeholder-zinc-600"
                    />
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results Section */}
                <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {query.trim().length < 2 ? (
                        <div className="p-8 text-center text-zinc-500">
                            Type at least 2 characters to search...
                        </div>
                    ) : isSearching ? (
                        <div className="p-8 text-center text-zinc-500 animate-pulse">
                            Searching library...
                        </div>
                    ) : (
                        <div className="space-y-4 p-2">
                            {/* Artists */}
                            {results.artists.length > 0 && (
                                <section>
                                    <h3 className="px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <User className="w-3 h-3" /> Artists
                                    </h3>
                                    <div className="space-y-1">
                                        {results.artists.map((artist, idx) => {
                                            const isSelected = selectedIndex === idx
                                            return (
                                                <button
                                                    key={artist.id}
                                                    onClick={() => handleSelect('artist', artist)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group",
                                                        isSelected ? "bg-zinc-800 ring-1 ring-zinc-700" : "hover:bg-zinc-800/50"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-700 transition-colors">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium">{artist.name}</div>
                                                        <div className="text-xs text-zinc-500">Artist • {artist.albumCount} Albums</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Albums */}
                            {results.albums.length > 0 && (
                                <section>
                                    <h3 className="px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <Disc className="w-3 h-3" /> Albums
                                    </h3>
                                    <div className="space-y-1">
                                        {results.albums.map((album, idx) => {
                                            const isSelected = selectedIndex === results.artists.length + idx
                                            return (
                                                <button
                                                    key={album.id}
                                                    onClick={() => handleSelect('album', album)}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group",
                                                        isSelected ? "bg-zinc-800 ring-1 ring-zinc-700" : "hover:bg-zinc-800/50"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 rounded bg-zinc-800 overflow-hidden flex items-center justify-center text-zinc-500 group-hover:bg-zinc-700 transition-colors">
                                                        {album.coverArtPath ? (
                                                            <img
                                                                src={client.getCoverUrl(album.id)}
                                                                alt={album.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    const img = e.target as HTMLImageElement
                                                                    img.src = '/placeholder-album.png'
                                                                    img.onerror = null
                                                                }}
                                                            />
                                                        ) : (
                                                            <Disc className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium">{album.name}</div>
                                                        <div className="text-xs text-zinc-500">{album.artist} • {album.year || 'Unknown Year'}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Tracks */}
                            {results.tracks.length > 0 && (
                                <section>
                                    <h3 className="px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <Music className="w-3 h-3" /> Tracks
                                    </h3>
                                    <div className="space-y-1">
                                        {results.tracks.map((track, idx) => {
                                            const isSelected = selectedIndex === results.artists.length + results.albums.length + idx
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => handleSelect('track', track)}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation()
                                                        window.dispatchEvent(new CustomEvent('request-track-play', { detail: { track } }))
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group",
                                                        isSelected ? "bg-zinc-800 ring-1 ring-zinc-700" : "hover:bg-zinc-800/50"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-700 transition-colors">
                                                        <Music className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-white font-medium truncate">{track.title}</div>
                                                        <div className="text-xs text-zinc-500 truncate">{track.artist} — {track.album}</div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Empty Results */}
                            {results.artists.length === 0 && results.albums.length === 0 && results.tracks.length === 0 && (
                                <div className="p-8 text-center text-zinc-500">
                                    No results found for "{query}"
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                    <span>Search Results for "{query}"</span>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><kbd className="px-1 bg-zinc-800 rounded">ESC</kbd> Close</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 bg-zinc-800 rounded">↵</kbd> Select</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
