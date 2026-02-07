import { useEffect, useState, useMemo } from 'react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { Users, Search, Settings2 } from 'lucide-react'
import { ArtistCard } from '../components/ArtistCard'
import { ArtistPlayModal } from '../components/ArtistPlayModal'
import { cn } from '../utils'

interface ArtistsViewProps {
  onArtistClick: (artistName: string) => void
}

export default function ArtistsView({ onArtistClick }: ArtistsViewProps) {
  const { artists, loadArtists, reanalyzeLibrary, tracks } = useLibrary()
  const { playAlbum, toggleShuffle, isShuffle } = usePlayer()
  const [searchQuery, setSearchQuery] = useState('')
  const [playModalArtist, setPlayModalArtist] = useState<string | null>(null)

  useEffect(() => {
    loadArtists()
  }, [loadArtists])

  // Filtered Artists
  const filteredArtists = useMemo(() => {
    if (!searchQuery) return artists
    const query = searchQuery.toLowerCase()
    return artists.filter((artist) => artist.name.toLowerCase().includes(query))
  }, [artists, searchQuery])

  // Playback Handlers
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
      // Fisher-Yates Shuffle
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
      .sort((a, b) => b.rating - a.rating) // Best first

    if (artistTracks.length > 0) {
      playAlbum(artistTracks)
      setPlayModalArtist(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background/95 relative">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-background border-b z-20 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Artists</h1>
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
                placeholder="Filter artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted pl-10 pr-4 py-1.5 rounded-md text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Re-analyze Button - useful for artists too */}
            <button
              onClick={() => reanalyzeLibrary()}
              className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors flex items-center gap-2 text-sm font-medium"
              title="Refresh library aggregation"
            >
              <Settings2 size={16} /> Re-analyze
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:px-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {filteredArtists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
              <Users className="w-16 h-16 opacity-20" />
              <div className="text-center">
                <p className="text-lg font-medium">No artists found</p>
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
                  onClick={() => onArtistClick(artist.name)}
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
