
import { useEffect, useState, useMemo } from 'react'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { ArtistCard } from '../components/ArtistCard'
import { Mic2, Search, Users } from 'lucide-react'
import { ArtistPlayModal } from '../components/ArtistPlayModal'
import { usePlayer } from '../store/player'

type Props = {
    onArtistClick?: (name: string) => void
}

export default function AlbumArtistsView({ onArtistClick }: Props) {
    const { artists, loadArtists, tracks } = useLibrary()
    const { navigateTo } = useNavigation()
    const { playAlbum, toggleShuffle, isShuffle } = usePlayer()
    const [searchQuery, setSearchQuery] = useState('')
    const [playModalArtist, setPlayModalArtist] = useState<string | null>(null)

    useEffect(() => {
        loadArtists()
    }, [loadArtists])

    // Filter for Album Artists (albumCount > 0)
    const filteredArtists = useMemo(() => {
        const libraryArtists = artists.filter((artist) => (artist.albumCount || 0) > 0)

        if (!searchQuery) return libraryArtists

        const query = searchQuery.toLowerCase()
        return libraryArtists.filter((artist) => artist.name.toLowerCase().includes(query))
    }, [artists, searchQuery])

    const handleArtistClick = (name: string) => {
        if (onArtistClick) {
            onArtistClick(name)
        } else {
            navigateTo('artist-detail', { artistName: name })
        }
    }

    // Playback Handlers (Reused from ArtistsView for consistency)
    const handlePlayAll = () => {
        if (!playModalArtist) return

        const artistTracks = tracks
            .filter((t) => t.artist === playModalArtist || t.albumArtist === playModalArtist)
            .sort(
                (a, b) =>
                    (b.year || 0) - (a.year || 0) ||
                    a.album.localeCompare(b.album) ||
                    (a.trackNum || 0) - (b.trackNum || 0)
            )

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
            {/* Toolbar */}
            <div className="flex-shrink-0 bg-background border-b z-20 p-4">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Mic2 className="w-6 h-6 text-blue-500" />
                            <h1 className="text-2xl font-bold">Album Artists</h1>
                        </div>
                        <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
                            {filteredArtists.length}
                        </span>

                        {/* Search */}
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                size={16}
                            />
                            <input
                                type="text"
                                placeholder="Filter album artists..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-muted pl-10 pr-4 py-1.5 rounded-md text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:px-8 custom-scrollbar">
                <div className="w-full">
                    {filteredArtists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
                            <Users className="w-16 h-16 opacity-20" />
                            <div className="text-center">
                                <p className="text-lg font-medium">No album artists found</p>
                                {searchQuery && (
                                    <p className="text-sm text-muted-foreground">Try a different search term.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-6 pb-8 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                            {filteredArtists.map((artist) => (
                                <ArtistCard
                                    key={artist.id}
                                    artist={artist}
                                    onClick={() => handleArtistClick(artist.name)}
                                    onPlayOptions={() => setPlayModalArtist(artist.name)}
                                />
                            ))}
                        </div>
                    )}
                </div>
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
