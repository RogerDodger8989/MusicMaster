import { useEffect, useState, useMemo } from 'react'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import { AlbumCard } from '../components/AlbumCard'
import { AlbumListItem } from '../components/AlbumListItem'
import { ViewSettings } from '../components/ViewSettings'
import { AlbumPlayModal } from '../components/AlbumPlayModal'
import { usePlayer } from '../store/player'
import { Settings2 } from 'lucide-react'
import { cn } from '../utils'
import { QueueConfirmationModal } from '../components/QueueConfirmationModal'

interface AlbumsViewProps {
    onAlbumClick: (albumId: string) => void
}

export default function AlbumsView({ onAlbumClick }: AlbumsViewProps) {
    const { albums, tracks: allTracks, loadAlbums, loadGenres, reanalyzeLibrary } = useLibrary()
    const { viewMode, sortField, sortOrder, setViewMode, setSortField, setSortOrder } = useSettings()
    const { playAlbum, insertToQueue, queue } = usePlayer()

    const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [playModalAlbumId, setPlayModalAlbumId] = useState<string | null>(null)

    // State for queue confirmation
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingTracks, setPendingTracks] = useState<any[]>([])
    const [isPendingShuffle, setIsPendingShuffle] = useState(false)

    // Load data on mount
    useEffect(() => {
        loadAlbums()
        loadGenres()
    }, [loadAlbums, loadGenres])

    // Filter and Sort Albums
    const filteredAlbums = useMemo(() => {
        let result = [...albums]

        // Filter by Genre
        if (selectedGenre) {
            result = result.filter(album =>
                album.genre?.split(' / ').includes(selectedGenre)
            )
        }

        // Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(album =>
                album.name.toLowerCase().includes(query) ||
                album.artist.toLowerCase().includes(query)
            )
        }

        // Sort
        result.sort((a, b) => {
            let valA: any = a[sortField as keyof typeof a]
            let valB: any = b[sortField as keyof typeof b]

            // Handle strings
            if (typeof valA === 'string') {
                valA = valA.toLowerCase()
                valB = valB.toLowerCase()
            }

            // Handle dates
            if (valA instanceof Date) valA = valA.getTime()
            if (valB instanceof Date) valB = valB.getTime()

            // Handle null/undefined (always last)
            if (valA === undefined || valA === null) return 1
            if (valB === undefined || valB === null) return -1

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1
            return 0
        })

        return result
    }, [albums, selectedGenre, searchQuery, sortField, sortOrder])

    const genres = useMemo(() => {
        const map = new Map<string, number>()
        albums.forEach(album => {
            if (!album.genre) return
            // Split by " / " and clean up
            const parts = album.genre.split(' / ').map(g => g.trim()).filter(g => g && g.toLowerCase() !== 'unknown')
            parts.forEach(p => {
                map.set(p, (map.get(p) || 0) + 1)
            })
        })
        return Array.from(map.entries())
            .map(([genre, count]) => ({ genre, count }))
            .sort((a, b) => a.genre.localeCompare(b.genre))
            .sort((a, b) => a.genre.localeCompare(b.genre))
    }, [albums])

    const selectedAlbumForModal = useMemo(() =>
        playModalAlbumId ? albums.find(a => a.id === playModalAlbumId) : null,
        [albums, playModalAlbumId]
    )

    const getAlbumTracks = async (album: any) => {
        let tracks = allTracks.filter(t => t.album === album.name && (t.albumArtist === album.artist || t.artist === album.artist))
        if (tracks.length === 0) {
            tracks = await (window as any).api.tracks.getTracksByAlbum(album.name, album.artist)
        }
        return tracks
    }

    const handlePlayAll = async () => {
        if (!selectedAlbumForModal) return
        const albumTracks = await getAlbumTracks(selectedAlbumForModal)
        if (albumTracks && albumTracks.length) {
            albumTracks.sort((a, b) => (a.discNum || 1) - (b.discNum || 1) || (a.trackNum || 0) - (b.trackNum || 0))

            if (queue.length > 0) {
                setPendingTracks(albumTracks)
                setIsPendingShuffle(false)
                setIsConfirmModalOpen(true)
            } else {
                playAlbum(albumTracks, 0)
            }
        }
        setPlayModalAlbumId(null)
    }

    const handleShuffleAll = async () => {
        if (!selectedAlbumForModal) return
        const albumTracks = await getAlbumTracks(selectedAlbumForModal)
        if (albumTracks && albumTracks.length) {
            if (queue.length > 0) {
                setPendingTracks(albumTracks)
                setIsPendingShuffle(true)
                setIsConfirmModalOpen(true)
            } else {
                executeShuffle(albumTracks)
            }
        }
        setPlayModalAlbumId(null)
    }

    const executeShuffle = (tracksToShuffle: any[]) => {
        const shuffled = [...tracksToShuffle]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        playAlbum(shuffled, 0)
    }

    const handleConfirmReplace = () => {
        if (isPendingShuffle) {
            executeShuffle(pendingTracks)
        } else {
            playAlbum(pendingTracks, 0)
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

    const handleAddToQueue = async () => {
        if (!selectedAlbumForModal) return
        const tracks = await getAlbumTracks(selectedAlbumForModal)
        if (tracks && tracks.length) {
            tracks.sort((a, b) => (a.discNum || 1) - (b.discNum || 1) || (a.trackNum || 0) - (b.trackNum || 0))
            insertToQueue(tracks, queue.length)
        }
        setPlayModalAlbumId(null)
    }

    return (
        <div className="flex flex-col h-full bg-background/95">
            {/* Toolbar & Genres (Sticky Header) */}
            <div className="flex-shrink-0 bg-background border-b z-20">
                {/* Top Toolbar */}
                <div className="flex items-center justify-between p-4 pb-2">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">Albums</h1>
                        <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
                            {filteredAlbums.length}
                        </span>

                        {/* Search  */}
                        <input
                            type="text"
                            placeholder="Filter albums..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-muted px-3 py-1.5 rounded-md text-sm w-48 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Re-analyze Button */}
                        <button
                            onClick={() => reanalyzeLibrary()}
                            className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Refresh album aggregation"
                        >
                            <Settings2 size={16} /> Re-analyze
                        </button>

                        {/* Settings Toggle */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 hover:bg-accent rounded-md transition-colors"
                            title="View Settings"
                        >
                            <Settings2 size={20} />
                        </button>
                    </div>
                </div>

                {/* Genre Pills (Horizontal Scroll) */}
                <div className="flex items-center gap-2 px-4 pb-4 overflow-x-auto custom-scrollbar mask-linear-fade">
                    <button
                        onClick={() => setSelectedGenre(null)}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border",
                            !selectedGenre
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        All
                    </button>
                    {genres.map(g => (
                        <button
                            key={g.genre}
                            onClick={() => setSelectedGenre(g.genre)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border flex items-center gap-2",
                                selectedGenre === g.genre
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            {g.genre}
                            <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded-full",
                                selectedGenre === g.genre ? "bg-primary-foreground/20" : "bg-muted"
                            )}>
                                {g.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:px-8 custom-scrollbar">
                {filteredAlbums.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
                        <span className="text-4xl opacity-50">💿</span>
                        <div className="text-center">
                            <p className="text-lg font-medium">No albums found</p>
                            <p className="text-sm text-muted-foreground">Try adjusting your filters or scan for music in Settings.</p>
                        </div>
                        {selectedGenre && (
                            <button
                                onClick={() => setSelectedGenre(null)}
                                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {viewMode === 'list' ? (
                            <div className="space-y-1">
                                {/* List Header */}
                                <div className="flex items-center gap-4 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b mb-2">
                                    <div className="w-12">Cov</div>
                                    <div className="flex-1">Album</div>
                                    <div className="hidden sm:block w-16">Year</div>
                                    <div className="hidden md:block w-16">Tracks</div>
                                    <div className="hidden lg:block w-20">Time</div>
                                    <div className="hidden sm:block w-24 text-right">Rating</div>
                                </div>
                                {/* List Items */}
                                {filteredAlbums.map(album => (
                                    <AlbumListItem
                                        key={album.id}
                                        album={album}
                                        onClick={() => onAlbumClick(album.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className={cn(
                                "grid gap-6 pb-8",
                                "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
                            )}>
                                {filteredAlbums.map(album => (
                                    <AlbumCard
                                        key={album.id}
                                        album={album}
                                        onClick={() => onAlbumClick(album.id)}
                                        onPlayOptions={() => setPlayModalAlbumId(album.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <AlbumPlayModal
                albumName={selectedAlbumForModal?.name || ''}
                artistName={selectedAlbumForModal?.artist}
                isOpen={!!selectedAlbumForModal}
                onClose={() => setPlayModalAlbumId(null)}
                onPlayAll={handlePlayAll}
                onShuffleAll={handleShuffleAll}
                onAddToQueue={handleAddToQueue}
            />

            <QueueConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onReplace={handleConfirmReplace}
                onAppend={handleConfirmAppend}
                title="Clear Playlist?"
                message={`Your playlist is not empty. Would you like to clear it and play "${selectedAlbumForModal?.name}", or just add it to the end?`}
            />

            {/* Settings Modal */}
            <ViewSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                viewMode={viewMode}
                sortBy={sortField}
                sortOrder={sortOrder}
                onViewModeChange={setViewMode}
                onSortChange={(field, order) => {
                    setSortField(field)
                    setSortOrder(order)
                }}
            />
        </div>
    )
}
