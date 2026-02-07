import { ListPlus, Play, UserCircle } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Artist } from '../types'
import { useEffect, useRef } from 'react'

interface ArtistContextMenuProps {
  artist: Artist
  x: number
  y: number
  onClose: () => void
}

export default function ArtistContextMenu({ artist, x, y, onClose }: ArtistContextMenuProps) {
  const { playAlbum } = usePlayer()
  const { tracks: allTracks } = useLibrary()
  const { navigateTo } = useNavigation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const getArtistTracks = () => {
    return allTracks
      .filter((t) => t.artist === artist.name || t.albumArtist === artist.name)
      .sort((a, b) => {
        return (
          (b.year || 0) - (a.year || 0) ||
          a.album.localeCompare(b.album) ||
          (a.trackNum || 0) - (b.trackNum || 0)
        )
      })
  }

  const handlePlayNow = () => {
    const tracks = getArtistTracks()
    if (tracks.length > 0) playAlbum(tracks, 0)
    onClose()
  }

  const handlePlayNext = () => {
    const tracks = getArtistTracks()
    window.dispatchEvent(
      new CustomEvent('request-artist-play', {
        detail: { tracks, option: 'play_next' }
      })
    )
    onClose()
  }

  const handleAddToQueue = () => {
    const tracks = getArtistTracks()
    window.dispatchEvent(
      new CustomEvent('request-artist-play', {
        detail: { tracks, option: 'add_last' }
      })
    )
    onClose()
  }

  const handleGoToDetails = () => {
    navigateTo('artist-detail', { artistName: artist.name })
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      <div className="px-4 py-2 mb-1 border-b border-zinc-800/50">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest truncate">
          {artist.name}
        </div>
        <div className="text-[10px] text-zinc-600 truncate">
          {artist.albumCount} Albums • {artist.trackCount} Tracks
        </div>
      </div>

      <button
        onClick={handlePlayNow}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Play size={16} fill="currentColor" />
        Play Artist
      </button>
      <button
        onClick={handlePlayNext}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <ListPlus size={16} />
        Play Next
      </button>
      <button
        onClick={handleAddToQueue}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <ListPlus size={16} className="rotate-180" />
        Add to Queue
      </button>

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      <button
        onClick={handleGoToDetails}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <UserCircle size={16} />
        View Artist Details
      </button>
    </div>
  )
}
