import { useEffect, useState, useMemo } from 'react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { Users, Search } from 'lucide-react'
import { ArtistCard } from '../components/ArtistCard'
import { ArtistPlayModal } from '../components/ArtistPlayModal'
import { PageHeader } from '../components/PageHeader'

interface ArtistsViewProps {
  onArtistClick: (artistName: string) => void
}

export default function ArtistsView({ onArtistClick }: ArtistsViewProps) {
  const { artists, loadArtists, tracks } = useLibrary()
  const { playAlbum, toggleShuffle, isShuffle } = usePlayer()
  const [searchQuery, setSearchQuery] = useState('')
  const [playModalArtist, setPlayModalArtist] = useState<string | null>(null)

  useEffect(() => {
    loadArtists()
  }, [loadArtists])

  // Filtered Artists
  const filteredArtists = useMemo(() => {
    // User requested ALL artists in this view, so we don't filter by albumCount
    const libraryArtists = artists

    if (!searchQuery) return libraryArtists
    const query = searchQuery.toLowerCase()
    return libraryArtists.filter((artist) => artist.name.toLowerCase().includes(query))
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
    <div className="flex flex-col h-full bg-zinc-950 relative">
      <PageHeader
        icon={Users}
        iconColor="text-violet-400"
        title="Artists"
        count={filteredArtists.length}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            type="text"
            placeholder="Filter artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 pl-9 pr-4 py-1.5 rounded-md text-sm w-56 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
          />
        </div>
      </PageHeader>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:px-8 custom-scrollbar">
        <div className="w-full">
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
