import {
  ListPlus,
  Play,
  ListMusic,
  ChevronRight,
  User,
  Disc,
  FolderOpen,
  Fingerprint,
  Plus,
  Check,
  Minus
} from 'lucide-react'
import { cn } from '../lib/utils'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Track } from '../types'
import { useEffect, useState, useRef, useLayoutEffect } from 'react'

interface TrackContextMenuProps {
  track: Track
  selectedTrackIds?: string[]
  x: number
  y: number
  onClose: () => void
}

export default function TrackContextMenu({
  track,
  selectedTrackIds,
  x,
  y,
  onClose
}: TrackContextMenuProps) {
  const {
    playlists,
    fetchPlaylists,
    addTrackToPlaylist,
    removeTrackByIdFromPlaylist
  } = usePlaylists()
  const { playAlbum } = usePlayer()
  const { albums } = useLibrary()
  const { navigateTo } = useNavigation()
  const [showPlaylists, setShowPlaylists] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ left: x, top: y })
  const [subMenuSide, setSubMenuSide] = useState<'right' | 'left'>('right')

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const winW = window.innerWidth
      const winH = window.innerHeight

      let newX = x
      let newY = y

      // Vertical adjustment (flip if overflow)
      if (y + rect.height > winH) {
        newY = y - rect.height
        // If still overflowing top, just clamp to top
        if (newY < 0) newY = 10
      }

      // Horizontal adjustment (flip if overflow)
      if (x + rect.width > winW) {
        newX = x - rect.width
        // If still overflowing left, clamp to left
        if (newX < 0) newX = 10
      }

      // sub-menu positioning logic
      const subMenuWidth = 224 // w-56 is 14rem
      if (newX + rect.width + subMenuWidth > winW) {
        setSubMenuSide('left')
      } else {
        setSubMenuSide('right')
      }

      setCoords({ left: newX, top: newY })
    }
  }, [x, y])

  useEffect(() => {
    fetchPlaylists()

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Check if it's a right click - if so, don't close if it's on a track
        // but usually mousedown for right click is what triggers this.
        onClose()
      }
    }
    // Use capture phase to handle it before other listeners if needed,
    // or just ensure we don't close on the same event that opened it.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fetchPlaylists, onClose])

  const handleTogglePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()

    const ids = selectedTrackIds || [track.id]
    const playlist = playlists.find((p) => p.id === playlistId)
    if (!playlist) return

    const tracksInPlaylist = playlist.tracks.map((t) => t.id)
    const allPresent = ids.every((id) => tracksInPlaylist.includes(id))

    if (allPresent) {
      for (const id of ids) {
        await removeTrackByIdFromPlaylist(playlistId, id)
      }
    } else {
      for (const id of ids) {
        if (!tracksInPlaylist.includes(id)) {
          await addTrackToPlaylist(playlistId, id)
        }
      }
    }
    // Note: No onClose() here to keep the menu open
  }

  const handleCreateNewPlaylist = () => {
    window.dispatchEvent(
      new CustomEvent('request-create-playlist', {
        detail: { trackIds: selectedTrackIds || [track.id] }
      })
    )
    onClose()
  }

  const handlePlayNext = () => {
    window.dispatchEvent(
      new CustomEvent('request-track-play', {
        detail: { track, option: 'play_next' }
      })
    )
    onClose()
  }

  const handleAddToQueue = () => {
    window.dispatchEvent(
      new CustomEvent('request-track-play', {
        detail: { track, option: 'add_last' }
      })
    )
    onClose()
  }

  const handleGoToArtist = () => {
    navigateTo('artist-detail', { artistName: track.artist })
    onClose()
  }

  const handleGoToAlbum = () => {
    const album = albums.find(
      (a) => a.name === track.album && (a.artist === track.albumArtist || a.artist === track.artist)
    )
    if (album) {
      navigateTo('album-detail', { albumId: album.id })
    }
    onClose()
  }

  const handleLocateFile = () => {
    // Try Electron IPC first, fall back to server HTTP API
    if ((window as any).api?.util?.showItemInFolder) {
      ; (window as any).api.util.showItemInFolder(track.filePath)
    } else {
      fetch(`/api/system/show-in-folder?path=${encodeURIComponent(track.filePath)}`).catch(
        (err) => console.error('Failed to show in folder:', err)
      )
    }
    onClose()
  }

  const handleIdentify = () => {
    window.dispatchEvent(
      new CustomEvent('request-track-tagging', {
        detail: { track }
      })
    )
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: coords.left, top: coords.top }}
    >
      <button
        onClick={() => {
          playAlbum([track], 0)
          onClose()
        }}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Play size={16} fill="currentColor" />
        Play Now
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

      {/* Navigation Options */}
      <button
        onClick={handleGoToArtist}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <User size={16} />
        Go to Artist
      </button>
      <button
        onClick={handleGoToAlbum}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Disc size={16} />
        Go to Album
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
          <div
            className={cn(
              'absolute top-0 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in duration-100',
              subMenuSide === 'right' ? 'left-full ml-1 slide-in-from-left-2' : 'right-full mr-1 slide-in-from-right-2'
            )}
          >
            {playlists.length === 0 ? (
              <div className="px-4 py-2 text-xs text-zinc-500 font-medium italic">
                No playlists created
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {[...playlists]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((pl) => {
                    const ids = selectedTrackIds || [track.id]
                    const tracksInPlaylist = pl.tracks.map((t) => t.id)
                    const allPresent = ids.every((id) => tracksInPlaylist.includes(id))
                    const somePresent = !allPresent && ids.some((id) => tracksInPlaylist.includes(id))

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
        onClick={handleLocateFile}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <FolderOpen size={16} />
        Locate file in explorer
      </button>

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
