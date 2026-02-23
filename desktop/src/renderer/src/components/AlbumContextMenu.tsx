import { ListPlus, Play, User, Fingerprint, ListMusic, Plus, ChevronRight, Check, Minus } from 'lucide-react'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Album } from '../types'
import { useEffect, useRef, useState } from 'react'

interface AlbumContextMenuProps {
  album: Album
  x: number
  y: number
  onClose: () => void
}

export default function AlbumContextMenu({ album, x, y, onClose }: AlbumContextMenuProps) {
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

  const getAlbumTracks = async () => {
    let tracks = allTracks.filter(
      (t) => t.album === album.name && (t.albumArtist === album.artist || t.artist === album.artist)
    )

    if (tracks.length === 0) {
      tracks = await (window as any).api.tracks.getTracksByAlbum(album.name, album.artist)
    }

    return tracks.sort((a, b) => {
      const discA = a.discNum || 1
      const discB = b.discNum || 1
      if (discA !== discB) return discA - discB
      return (a.trackNum || 0) - (b.trackNum || 0)
    })
  }

  const handlePlayNow = async () => {
    const tracks = await getAlbumTracks()
    if (tracks.length > 0) playAlbum(tracks, 0)
    onClose()
  }

  const handlePlayNext = async () => {
    const tracks = await getAlbumTracks()
    window.dispatchEvent(
      new CustomEvent('request-album-play', {
        detail: { tracks, option: 'play_next' }
      })
    )
    onClose()
  }

  const handleAddToQueue = async () => {
    const tracks = await getAlbumTracks()
    window.dispatchEvent(
      new CustomEvent('request-album-play', {
        detail: { tracks, option: 'add_last' }
      })
    )
    onClose()
  }

  const handleGoToArtist = () => {
    navigateTo('artist-detail', { artistName: album.artist })
    onClose()
  }

  const handleIdentify = () => {
    window.dispatchEvent(
      new CustomEvent('request-album-tagging', {
        detail: { album }
      })
    )
    onClose()
  }

  const handleTogglePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()

    const tracks = await getAlbumTracks()
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

  const handleCreateNewPlaylist = async () => {
    const tracks = await getAlbumTracks()
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
          {album.name}
        </div>
        <div className="text-[10px] text-zinc-600 truncate">{album.artist}</div>
      </div>

      <button
        onClick={handlePlayNow}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Play size={16} fill="currentColor" />
        Play Album
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
        onClick={handleGoToArtist}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <User size={16} />
        Go to Artist
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
                    // We need to wait for album tracks, but for UI state we can use a simpler check or just accept it's async
                    // However, getAlbumTracks is usually sync if allTracks is populated.
                    // Let's assume sync filter here for UI performance.
                    const albumTracks = allTracks.filter(
                      (t) =>
                        t.album === album.name &&
                        (t.albumArtist === album.artist || t.artist === album.artist)
                    )
                    const trackIds = albumTracks.map((t) => t.id)
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

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      <button
        onClick={handleIdentify}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors text-blue-400 hover:text-white"
      >
        <Fingerprint size={16} />
        Identify with MusicBrainz
      </button>
    </div>
  )
}
