
import { useState, useMemo } from 'react'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { ArtistCard } from '../components/ArtistCard'
import { AlbumCard } from '../components/AlbumCard'
import { Tags, X, Search } from 'lucide-react'
import { ArtistPlayModal } from '../components/ArtistPlayModal'
import { usePlayer } from '../store/player'
import { cn } from '../lib/utils'

export default function GenresView() {
    const { albums, tracks, artists } = useLibrary()
    const { navigateTo } = useNavigation()
    const { playAlbum, toggleShuffle, isShuffle } = usePlayer()

    const [selectedGenres, setSelectedGenres] = useState<string[]>([])
    const [playModalArtist, setPlayModalArtist] = useState<string | null>(null)
    const [showArtists, setShowArtists] = useState(true)
    const [showAlbums, setShowAlbums] = useState(true)
    const [genreSearchQuery, setGenreSearchQuery] = useState('')

    // Helper to split genres
    const splitGenres = (genreStr?: string): string[] => {
        if (!genreStr) return []
        return genreStr.split(/[;,\/|]/).map(g => g.trim()).filter(Boolean)
    }

    // Derive unique genres
    const allGenres = useMemo(() => {
        const genres = new Set<string>()
        tracks.forEach(t => {
            if (t.genre) {
                splitGenres(t.genre).forEach(g => genres.add(g))
            }
        })
        albums.forEach(a => {
            if (a.genre) {
                splitGenres(a.genre).forEach(g => genres.add(g))
            }
        })
        return Array.from(genres).sort()
    }, [tracks, albums])

    const toggleGenre = (genre: string) => {
        setSelectedGenres(prev =>
            prev.includes(genre)
                ? prev.filter(g => g !== genre)
                : [...prev, genre]
        )
    }

    // Filter content
    const filteredContent = useMemo(() => {
        if (selectedGenres.length === 0) {
            return { artists: [], albums: [] }
        }

        // Filter Albums
        const matchedAlbums = albums.filter(a => {
            if (!a.genre) return false
            const albumGenres = splitGenres(a.genre)
            return albumGenres.some(g => selectedGenres.includes(g))
        })

        // Filter Artists
        // Artist matching is trickier. Either they match if they have an album in that genre,
        // or if they have tracks in that genre.
        // Let's find all artists who have at least one track in the selected genres.
        const artistNames = new Set<string>()
        tracks.forEach(t => {
            if (t.genre) {
                const trackGenres = splitGenres(t.genre)
                if (trackGenres.some(g => selectedGenres.includes(g))) {
                    artistNames.add(t.artist)
                }
            }
        })

        const matchedArtists = artists.filter(a => artistNames.has(a.name))

        return {
            albums: matchedAlbums,
            artists: matchedArtists
        }

    }, [selectedGenres, albums, tracks, artists])

    // Playback Handlers (Reused)
    const handlePlayAll = () => {
        if (!playModalArtist) return

        const artistTracks = tracks
            .filter((t) => t.artist === playModalArtist || t.albumArtist === playModalArtist)
            .sort((a, b) => (b.year || 0) - (a.year || 0))

        if (artistTracks.length > 0) {
            playAlbum(artistTracks)
            setPlayModalArtist(null)
        }
    }

    const handleShuffleAll = () => {
        if (!playModalArtist) return

        const artistTracks = tracks.filter(
            (t) => t.artist === playModalArtist || t.albumArtist === playModalArtist
        )

        if (artistTracks.length > 0) {
            const shuffled = [...artistTracks]
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
            }
            playAlbum(shuffled)
            if (!isShuffle) toggleShuffle()
            setPlayModalArtist(null)
        }
    }

    const handlePlayRated = () => {
        if (!playModalArtist) return
        // ... implementation same as ArtistsView
        const artistTracks = tracks
            .filter(
                (t) =>
                    (t.artist === playModalArtist || t.albumArtist === playModalArtist) &&
                    (t.rating > 0 || t.loved)
            )
            .sort((a, b) => b.rating - a.rating)

        if (artistTracks.length > 0) {
            playAlbum(artistTracks)
            setPlayModalArtist(null)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background/95 relative">
            {/* Header & Filter Bar */}
            <div className="flex-shrink-0 bg-background border-b z-20 p-6 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-full">
                            <Tags className="w-8 h-8 text-indigo-500" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight">Genres</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {allGenres.length} genres available
                            </p>
                        </div>
                    </div>

                    {/* View Toggles */}
                    <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-lg">
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showArtists}
                                onChange={(e) => setShowArtists(e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                            Show Artists
                        </label>
                        <div className="w-px h-4 bg-zinc-700" />
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showAlbums}
                                onChange={(e) => setShowAlbums(e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                            Show Albums
                        </label>
                    </div>
                </div>

                {/* Genre Search */}
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        size={16}
                    />
                    <input
                        type="text"
                        placeholder="Search genres..."
                        value={genreSearchQuery}
                        onChange={(e) => setGenreSearchQuery(e.target.value)}
                        className="bg-muted pl-10 pr-4 py-1.5 rounded-md text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                </div>

                {/* Genre Pills */}
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                    {allGenres
                        .filter(g => selectedGenres.includes(g) || g.toLowerCase().includes(genreSearchQuery.toLowerCase()))
                        .map(genre => {
                            const isSelected = selectedGenres.includes(genre)
                            return (
                                <button
                                    key={genre}
                                    onClick={() => toggleGenre(genre)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                                        isSelected
                                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md hover:bg-indigo-700"
                                            : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                                    )}
                                >
                                    {genre}
                                </button>
                            )
                        })}
                    {selectedGenres.length > 0 && (
                        <button
                            onClick={() => setSelectedGenres([])}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40 flex items-center gap-1"
                        >
                            <X size={12} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {selectedGenres.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
                        <Tags className="w-16 h-16 opacity-20" />
                        <p>Select a genre above to view artists and albums.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Artists Section */}
                        {showArtists && filteredContent.artists.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                    Artists <span className="text-sm font-normal text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">{filteredContent.artists.length}</span>
                                </h2>
                                <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                                    {filteredContent.artists.map(artist => (
                                        <ArtistCard
                                            key={artist.id}
                                            artist={artist}
                                            onClick={() => navigateTo('artist-detail', { artistName: artist.name })}
                                            onPlayOptions={() => setPlayModalArtist(artist.name)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Albums Section */}
                        {showAlbums && filteredContent.albums.length > 0 && (
                            <section>
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                    Albums <span className="text-sm font-normal text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">{filteredContent.albums.length}</span>
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                                    {filteredContent.albums.map(album => (
                                        <AlbumCard
                                            key={album.id}
                                            album={album}
                                            onClick={() => navigateTo('album-detail', { albumId: album.id })}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {((showArtists && filteredContent.artists.length === 0) || !showArtists) && ((showAlbums && filteredContent.albums.length === 0) || !showAlbums) && (
                            <div className="text-center text-zinc-500 py-12">
                                {showArtists || showAlbums ? "No artists or albums found for selected genres." : "Select 'Show Artists' or 'Show Albums' to view results."}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Play Options Modal */}
            <ArtistPlayModal
                artistName={playModalArtist || ''}
                isOpen={!!playModalArtist}
                onClose={() => setPlayModalArtist(null)}
                onPlayAll={handlePlayAll}
                onShuffleAll={handleShuffleAll}
                onPlayRated={handlePlayRated}
            />
        </div>
    )
}
