import {
  ListPlus,
  Play,
  User,
  Fingerprint,
  ListMusic,
  Plus,
  ChevronRight,
  Check,
  Minus,
  Heart,
  Trash2,
  Radio,
  Mic2,
  Sparkles,
  Info,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { useRadio } from '../hooks/useRadio'
import { Album } from '../types'
import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { RatingStars } from './RatingStars'
import { client } from '../api/client'
import { cn } from '../lib/utils'

interface AlbumContextMenuProps {
  album: Album
  x: number
  y: number
  onClose: () => void
}

export default function AlbumContextMenu({ album, x, y, onClose }: AlbumContextMenuProps) {
  const { playAlbum } = usePlayer()
  const { startRadio } = useRadio()
  const { tracks: allTracks, rateAlbum, toggleAlbumLoved, loadAlbums, loadTracks } = useLibrary()
  const { navigateTo } = useNavigation()
  const {
    playlists,
    fetchPlaylists,
    addTrackToPlaylist,
    removeTrackByIdFromPlaylist
  } = usePlaylists()
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [showPlayMore, setShowPlayMore] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ left: x, top: y })
  const [subMenuSide, setSubMenuSide] = useState<'right' | 'left'>('right')
  const [showInfoSub, setShowInfoSub] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (setter: (v: boolean) => void) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setter(true)
  }

  const handleMouseLeave = (setter: (v: boolean) => void) => {
    timeoutRef.current = setTimeout(() => {
      setter(false)
    }, 150)
  }

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const winW = window.innerWidth
      const winH = window.innerHeight

      let newX = x
      let newY = y

      if (y + rect.height > winH) {
        newY = y - rect.height
        if (newY < 0) newY = 10
      }

      if (x + rect.width > winW) {
        newX = x - rect.width
        if (newX < 0) newX = 10
      }

      const subMenuWidth = 224
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

  const handleShowInfo = async () => {
    const tracks = await getAlbumTracks()
    if (tracks.length > 0) {
      window.dispatchEvent(
        new CustomEvent('request-track-info', {
          detail: { track: tracks[0] }
        })
      )
    }
    onClose()
  }

  const handleEditInfo = async () => {
    const tracks = await getAlbumTracks()
    if (tracks.length > 0) {
      window.dispatchEvent(
        new CustomEvent('request-track-edit', {
          detail: { tracks, context: 'album' }
        })
      )
    }
    onClose()
  }

  const handleDelete = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to remove "${album.name}" and all its tracks from your library? (Files will NOT be deleted from disk)`)
    if (confirmDelete) {
      try {
        await client.deleteAlbum(album.id)
        loadAlbums()
        loadTracks()
        onClose()
      } catch (err) {
        console.error('Failed to delete album:', err)
      }
    }
  }

  const handleLocateFolder = async () => {
    const tracks = await getAlbumTracks()
    if (tracks.length > 0) {
      const filePath = tracks[0].filePath
      if ((window as any).api?.util?.showItemInFolder) {
        ; (window as any).api.util.showItemInFolder(filePath)
      } else {
        fetch(`/api/system/show-in-folder?path=${encodeURIComponent(filePath)}`).catch(err => console.error(err))
      }
    }
    onClose()
  }

  const handlePasteArtwork = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const reader = new FileReader()
            reader.onloadend = async () => {
              const base64data = reader.result as string
              await client.pasteAlbumArtwork(album.id, base64data)
              loadAlbums() // Refresh to show new cover
            }
            reader.readAsDataURL(blob)
            onClose()
            return
          }
        }
      }
      alert('No image found in clipboard')
    } catch (err) {
      console.error('Failed to paste artwork:', err)
      alert('Failed to paste artwork. Make sure you have copied an image.')
    }
  }

  const handleAutoDJ = async () => {
    const tracks = await getAlbumTracks()
    if (tracks.length > 0) startRadio(tracks)
    onClose()
  }

  const handlePlayAllRated = async () => {
    try {
      // Find all rated tracks by this artist
      const tracks = await client.getTracks({ artistId: album.artist })
      const rated = tracks.filter(t => (t.rating || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0))
      if (rated.length > 0) {
        playAlbum(rated, 0)
      } else {
        alert('No rated tracks found for this artist')
      }
    } catch (err) {
      console.error('Failed to play rated tracks:', err)
    }
    onClose()
  }

  const handlePlayArtist = async () => {
    try {
      // Find all tracks by this artist
      const artistTracks = await client.getTracks({ artistId: album.artist })
      if (artistTracks.length > 0) {
        playAlbum(artistTracks, 0)
      }
    } catch (err) {
      console.error('Failed to play artist tracks:', err)
    }
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
      style={{ left: coords.left, top: coords.top }}
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

      {/* Play More Submenu */}
      <div
        className="relative group/more"
        onMouseEnter={() => handleMouseEnter(setShowPlayMore)}
        onMouseLeave={() => handleMouseLeave(setShowPlayMore)}
      >
        <button className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <Radio size={16} />
            Play more..
          </div>
          <ChevronRight size={14} className="text-zinc-500 group-hover/more:text-white" />
        </button>

        {showPlayMore && (
          <div
            className={cn(
              'absolute top-0 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in duration-100',
              subMenuSide === 'right' ? 'left-full slide-in-from-left-2' : 'right-full slide-in-from-right-2'
            )}
          >
            <button
              onClick={handleAutoDJ}
              className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Radio size={14} />
              Radio
            </button>
            <button
              onClick={handlePlayArtist}
              className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Mic2 size={14} />
              Play Artist
            </button>
            <button
              onClick={handlePlayAllRated}
              className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Sparkles size={14} />
              Play all rated songs
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      {/* Library Actions */}
      <div className="px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleAlbumLoved(album.id)}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              album.loved ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" : "text-zinc-500 hover:bg-zinc-800"
            )}
          >
            <Heart size={18} fill={album.loved ? "currentColor" : "none"} />
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <RatingStars
            rating={album.rating || 0}
            onChange={(r) => rateAlbum(album.id, r)}
            size={16}
          />
        </div>
      </div>

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
        onMouseEnter={() => handleMouseEnter(setShowPlaylists)}
        onMouseLeave={() => handleMouseLeave(setShowPlaylists)}
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
              subMenuSide === 'right' ? 'left-full slide-in-from-left-2' : 'right-full slide-in-from-right-2'
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
                    const tracksInPlaylist = pl.tracks.map((t) => t.id)
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
        onClick={handleLocateFolder}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <FolderOpen size={16} />
        Locate in explorer
      </button>

      <button
        onClick={handlePasteArtwork}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <ImageIcon size={16} />
        Paste Artwork
      </button>

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      {/* Info Submenu */}
      <div
        className="relative group/info"
        onMouseEnter={() => handleMouseEnter(setShowInfoSub)}
        onMouseLeave={() => handleMouseLeave(setShowInfoSub)}
      >
        <button className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <Info size={16} />
            Info
          </div>
          <ChevronRight size={14} className="text-zinc-500 group-hover/info:text-white" />
        </button>

        {showInfoSub && (
          <div
            className={cn(
              'absolute top-0 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in duration-100',
              subMenuSide === 'right' ? 'left-full slide-in-from-left-2' : 'right-full slide-in-from-right-2'
            )}
          >
            <button
              onClick={handleShowInfo}
              className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Info size={14} />
              Properties
            </button>
            <button
              onClick={handleEditInfo}
              className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
              <Plus size={14} />
              Edit Info
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleIdentify}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Fingerprint size={16} />
        Identify with MusicBrainz
      </button>

      <div className="h-px bg-zinc-800 my-1 mx-2" />

      <button
        onClick={handleDelete}
        className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-3 transition-colors"
      >
        <Trash2 size={16} />
        Remove from Library
      </button>
    </div>
  )
}
