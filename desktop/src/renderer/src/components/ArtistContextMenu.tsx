import { ListPlus, Play, UserCircle, ListMusic, Plus, ChevronRight, Check, Minus } from 'lucide-react'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Artist } from '../types'
import { useEffect, useRef, useState } from 'react'

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
  const {
    playlists,
    fetchPlaylists,
    addTrackToPlaylist,
    removeTrackByIdFromPlaylist
  } = usePlaylists()
  const [showPlaylists, setShowPlaylists] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPlaylists()
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fetchPlaylists, onClose])

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

  const handleTogglePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()

    const tracks = getArtistTracks()
    const trackIds = tracks.map((t) => t.id)
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) return

    const tracksInPlaylist = playlist.tracks.map((t) => t.id)
    const allPresent = trackIds.every((id) => tracksInPlaylist.includes(id))

    if (allPresent) {
      for (const id of trackIds) {
        await removeTrackByIdFromPlaylist(playlistId, id)
      }
    } else {
      for (const id of trackIds) {
        if (!tracksInPlaylist.includes(id)) {
          await addTrackToPlaylist(playlistId, id)
        }
      }
    }
  }

  const handleCreateNewPlaylist = () => {
    const tracks = getArtistTracks()
    const trackIds = tracks.map((t) => t.id)

    window.dispatchEvent(
      new CustomEvent('request-create-playlist', {
        detail: { trackIds }
      })
    )
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

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      <div
        className="relative group/sub"
        onMouseEnter={() => setShowPlaylists(true)}
        onMouseLeave={() => setShowPlaylists(false)}
      >
        <button className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <ListMusic size={16} />
            Add to Playlist
          </div>
          <ChevronRight size={14} className="text-zinc-500 group-hover/sub:text-white" />
        </button>

        {showPlaylists && (
          <div className="absolute left-full top-0 ml-1 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in slide-in-from-left-2 duration-100">
            {playlists.length === 0 ? (
              <div className="px-4 py-2 text-xs text-zinc-500 font-medium italic">
                No playlists created
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {[...playlists]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((pl) => {
                    const tracksInPlaylist = pl.tracks.map((t) => t.id)
                    const artistTracks = allTracks.filter(
                      (t) => t.artist === artist.name || t.albumArtist === artist.name
                    )
                    const trackIds = artistTracks.map((t) => t.id)
                    const allPresent =
                      trackIds.length > 0 && trackIds.every((id) => tracksInPlaylist.includes(id))
                    const somePresent =
                      !allPresent && trackIds.some((id) => tracksInPlaylist.includes(id))

                    return (
                      <button
                        key={pl.id}
                        onClick={(e) => handleTogglePlaylist(e, pl.id)}
                        className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center justify-between group transition-colors"
                      >
                        <span className="truncate">{pl.name}</span>
                        {allPresent && <Check size={14} className="text-blue-400 group-hover:text-white" />}
                        {somePresent && (
                          <Minus size={14} className="text-zinc-500 group-hover:text-white" />
                        )}
                      </button>
                    )
                  })}
              </div>
            )}
            <div className="h-px bg-zinc-800 my-1 mx-2" />
            <button
              onClick={handleCreateNewPlaylist}
              className="w-full px-4 py-2 text-left text-sm font-medium text-blue-400 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors"
            >
              <Plus size={14} />
              New Playlist...
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
