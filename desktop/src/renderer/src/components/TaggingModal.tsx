import { useState, useEffect } from 'react'
import { Search, X, Check, Save, Info, Music2, User, Disc, Loader2 } from 'lucide-react'
import { Track, Album } from '../types'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'

interface TaggingModalProps {
    isOpen: boolean
    onClose: () => void
    item: Track | Album | null
    itemType: 'track' | 'album'
    onSave: (id: string, metadata: any, type: 'track' | 'album') => Promise<void>
}

export default function TaggingModal({ isOpen, onClose, item, itemType, onSave }: TaggingModalProps) {
    const [searchTitle, setSearchTitle] = useState('')
    const [searchArtist, setSearchArtist] = useState('')
    const [searchAlbum, setSearchAlbum] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedResult, setSelectedResult] = useState<any | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const { position, handleMouseDown } = useDraggable()

    useEffect(() => {
        if (item && isOpen) {
            if (itemType === 'track') {
                const track = item as Track
                setSearchTitle(track.title)
                setSearchArtist(track.artist)
                setSearchAlbum(track.album)
                handleSearch('track', track.artist, track.title, track.album)
            } else {
                const album = item as Album
                setSearchArtist(album.artist)
                setSearchAlbum(album.name)
                handleSearch('album', album.artist, '', album.name)
            }
        } else {
            setResults([])
            setSelectedResult(null)
        }
    }, [item, isOpen, itemType])

    const handleSearch = async (type: 'track' | 'album', artist: string, title: string, album?: string) => {
        setIsSearching(true)
        try {
            let mbidResults: any[] = []
            if (type === 'track') {
                mbidResults = await window.api.metadata.search(artist, title, album)
            } else {
                mbidResults = await window.api.metadata.searchAlbums(artist, album || '')
            }
            setResults(mbidResults)
        } catch (error) {
            console.error('MB Search failed:', error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSave = async () => {
        if (!item || !selectedResult) return
        setIsSaving(true)
        try {
            await onSave(item.id, selectedResult, itemType)
            onClose()
        } catch (error) {
            console.error('Failed to save metadata:', error)
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen || !item) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-in fade-in duration-200">
            <div
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div
                    className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50 cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Info className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Identify {itemType === 'track' ? 'Track' : 'Album'}</h2>
                            <p className="text-xs text-zinc-500">Match with MusicBrainz metadata</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Search & Original */}
                    <div className="w-1/3 border-r border-zinc-800 p-6 flex flex-col gap-6 bg-zinc-900/50">
                        <section>
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Current Metadata</h3>
                            <div className="space-y-2 text-sm">
                                {itemType === 'track' ? (
                                    <>
                                        <div className="flex items-center gap-2 text-white">
                                            <Music2 size={14} className="text-zinc-500" />
                                            <span className="truncate">{(item as Track).title}</span>
                                        </div>
                                    </>
                                ) : null}
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <User size={14} className="text-zinc-500" />
                                    <span className="truncate">{item.artist}</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Disc size={14} className="text-zinc-500" />
                                    <span className="truncate">{itemType === 'track' ? (item as Track).album : (item as Album).name}</span>
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-3">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Search MusicBrainz</h3>
                            <div className="space-y-3">
                                {itemType === 'track' && (
                                    <input
                                        type="text"
                                        value={searchTitle}
                                        onChange={(e) => setSearchTitle(e.target.value)}
                                        placeholder="Title"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                )}
                                <input
                                    type="text"
                                    value={searchArtist}
                                    onChange={(e) => setSearchArtist(e.target.value)}
                                    placeholder="Artist"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    value={searchAlbum}
                                    onChange={(e) => setSearchAlbum(e.target.value)}
                                    placeholder="Album"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    onClick={() => handleSearch(itemType, searchArtist, searchTitle, searchAlbum)}
                                    disabled={isSearching}
                                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Search size={16} />
                                    {isSearching ? 'Searching...' : 'Search'}
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Right: Results */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                {results.length} Suggestions Found
                            </h3>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-2">
                            {isSearching ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <p className="text-sm">Fetching MusicBrainz results...</p>
                                </div>
                            ) : results.length > 0 ? (
                                results.map((res) => (
                                    <button
                                        key={res.id}
                                        onClick={() => setSelectedResult(res)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-xl border transition-all group",
                                            selectedResult?.id === res.id
                                                ? "bg-blue-600/10 border-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.1)]"
                                                : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-white truncate text-base">{res.title || res.album}</span>
                                                    {selectedResult?.id === res.id && (
                                                        <Check size={14} className="text-blue-500 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-zinc-400">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <User size={12} className="text-zinc-500 shrink-0" />
                                                        <span className="truncate">{res.artist}</span>
                                                    </div>
                                                    {itemType === 'track' && (
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Disc size={12} className="text-zinc-500 shrink-0" />
                                                            <span className="truncate">{res.album}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                                                    {res.releaseDate && <span>📅 {res.releaseDate}</span>}
                                                    {itemType === 'track' && res.trackNum && <span># {res.trackNum}</span>}
                                                    {itemType === 'album' && res.trackCount && <span>🎵 {res.trackCount} Tracks</span>}
                                                    {res.label && <span className="truncate">🏢 {res.label}</span>}
                                                    <span className="truncate opacity-50">ID: {res.id.split('-')[0]}...</span>
                                                </div>
                                            </div>
                                            <div className="p-2 rounded-full border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Check size={16} className="text-zinc-400" />
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 opacity-50">
                                    <Search size={48} className="text-zinc-800" />
                                    <p className="text-sm">No results found. Try adjusting your search query.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <div className="text-xs text-zinc-500 max-w-md">
                        {selectedResult ? (
                            <span className="text-blue-400 font-medium">
                                Ready to update {itemType === 'track' ? 'tags' : 'album & tracks'} with selected MusicBrainz entry.
                            </span>
                        ) : (
                            "Select a suggestion from the list to apply metadata."
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!selectedResult || isSaving}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-95"
                        >
                            <Save size={18} />
                            {isSaving ? 'Syncing...' : 'Sync Metadata'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
