import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { usePlayer } from '../store/player'
import { ArrowLeft, Play, Clock, Heart, Calendar, Hash, Music as MusicIcon, X, Users } from 'lucide-react'
import { RatingStars } from '../components/RatingStars'
import { formatDuration } from '../utils/format'
import { cn } from '../utils'
import { useDraggable } from '../hooks/useDraggable'
import { useTrackSelection } from '../hooks/useTrackSelection'
import { QueueConfirmationModal } from '../components/QueueConfirmationModal'
import AlbumContextMenu from '../components/AlbumContextMenu'
import { client } from '../api/client'
import type { Album } from '../types'

interface AlbumDetailViewProps {
  albumId: string
  onBack: () => void
}

export default function AlbumDetailView({ albumId, onBack }: AlbumDetailViewProps) {
  const { albums, tracks, loadTracks, rateTrack, toggleLoved, rateAlbum, toggleAlbumLoved } =
    useLibrary()
  const { navigateTo } = useNavigation()
  const {
    playAlbum,
    playTrack: playTrackAction,
    currentTrack,
    isPlaying,
    queue,
    insertToQueue
  } = usePlayer()
  const [isZoomed, setIsZoomed] = useState(false)
  const [isBioExpanded, setIsBioExpanded] = useState(false)
  const [enrichedAlbum, setEnrichedAlbum] = useState<Album | null>(null)
  const [performers, setPerformers] = useState<any[]>([])
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [albumContextMenu, setAlbumContextMenu] = useState<{
    album: Album
    x: number
    y: number
  } | null>(null)
  const [showOnlyPerformers, setShowOnlyPerformers] = useState(true)
  const { position, handleMouseDown } = useDraggable()

  // Find album
  const storeAlbum = useMemo(() => albums.find((a) => a.id === albumId), [albums, albumId])
  const album = enrichedAlbum || storeAlbum

  // Fetch full album details and performers
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [albumData, performersData] = await Promise.all([
          client.getAlbum(albumId),
          client.getAlbumPerformers(albumId)
        ])
        if (albumData) setEnrichedAlbum(albumData)
        if (performersData) setPerformers(performersData)
      } catch (err) {
        console.error('Failed to fetch album details/performers:', err)
      }
    }
    fetchData()
  }, [albumId])

  // Automatically enrich artist images when performers are loaded
  useEffect(() => {
    if (performers.length > 0) {
      const artistIds = performers
        .map(p => p.artist_id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index) // unique IDs only

      if (artistIds.length > 0) {
        console.log(`[AlbumDetail] Triggering enrichment for ${artistIds.length} performers`)
        client.enrichArtists(artistIds).catch(err =>
          console.warn('[AlbumDetail] Failed to trigger enrichment:', err)
        )
      }
    }
  }, [performers])

  // Find tracks for this album
  const albumTracks = useMemo(() => {
    if (!album) return []
    const albumName = album.name?.trim().toLowerCase()
    const albumArtist = album.artist?.trim().toLowerCase()

    return tracks
      .filter((t) => {
        const tAlbum = t.album?.trim().toLowerCase()
        const tArtist = t.artist?.trim().toLowerCase()
        const tAlbumArtist = t.albumArtist?.trim().toLowerCase()

        return (
          tAlbum === albumName &&
          (tAlbumArtist === albumArtist || tArtist === albumArtist || !albumArtist)
        )
      })
      .sort((a, b) => {
        const discA = a.discNum || 1
        const discB = b.discNum || 1
        if (discA !== discB) return discA - discB
        const trackA = a.trackNum || 0
        const trackB = b.trackNum || 0
        return trackA - trackB
      })
  }, [tracks, album])

  const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } =
    useTrackSelection(albumTracks)

  // Load tracks if empty
  useEffect(() => {
    if (tracks.length === 0) loadTracks()
  }, [tracks.length, loadTracks])

  // Close zoom on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false)
    }
    if (isZoomed) {
      window.addEventListener('keydown', handleEsc)
    }
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isZoomed])

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <p>Album not found</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-secondary rounded-md">
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background/95 overflow-hidden" onClick={clearSelection}>
      {/* Header / Hero - Fixed and Compact */}
      <div
        className="p-4 md:p-6 flex flex-col md:flex-row gap-6 bg-gradient-to-b from-primary/5 to-transparent relative flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Art - Smaller */}
        <div
          className="flex-shrink-0 group relative cursor-zoom-in"
          onClick={() => setIsZoomed(true)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (album) {
              setAlbumContextMenu({ album, x: e.clientX, y: e.clientY })
            }
          }}
        >
          <div className="w-32 h-32 md:w-36 md:h-36 rounded-lg shadow-xl overflow-hidden bg-zinc-900 border border-border/10 transition-transform hover:scale-[1.02]">
            <img
              src={client.getCoverUrl(album.id)}
              alt={album.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement
                img.src = '/placeholder-album.png'
                img.onerror = null
              }}
            />
          </div>
        </div>

        {/* Album Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 hover:text-foreground uppercase tracking-widest mb-1 transition-colors"
              >
                <ArrowLeft size={10} /> Back
              </button>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate leading-tight">
                {album.name}
              </h1>
              <button
                onClick={() => navigateTo('artist-detail', { artistName: album.artist })}
                className="text-lg md:text-xl font-medium text-muted-foreground hover:text-primary transition-colors text-left"
              >
                {album.artist}
              </button>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-4 bg-secondary/10 p-2.5 rounded-xl border border-border/5 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40">
                  Rating
                </span>
                <RatingStars
                  rating={album.rating}
                  onChange={(r) => rateAlbum(albumId, r)}
                  size={16}
                  className="hover:scale-105 transition-transform"
                />
              </div>

              <div className="w-[1px] h-6 bg-border/20" />

              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40">
                  Love
                </span>
                <button
                  onClick={() => toggleAlbumLoved(albumId)}
                  className={cn(
                    'transition-all hover:scale-110 active:scale-95',
                    album.loved ? 'text-red-500' : 'text-muted-foreground/30 hover:text-red-400'
                  )}
                >
                  <Heart size={20} fill={album.loved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-3">
            <button
              onClick={() => {
                if (albumTracks.length > 0) {
                  if (queue.length > 0) {
                    setIsConfirmModalOpen(true)
                  } else {
                    playAlbum(albumTracks)
                  }
                }
              }}
              className="px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Play size={14} fill="currentColor" /> Play All
            </button>

            <div className="flex items-center gap-3 bg-white/5 py-1 px-3 rounded-full border border-white/5">
              <span className="flex items-center gap-1">
                <Calendar size={11} className="opacity-50" /> {album.year}
              </span>
              <span className="w-[1px] h-3 bg-white/10" />
              <span className="flex items-center gap-1">
                <Clock size={11} className="opacity-50" />{' '}
                {formatDuration(album.totalDuration || 0)}
              </span>
              <span className="w-[1px] h-3 bg-white/10" />
              <span className="flex items-center gap-1">
                <MusicIcon size={11} className="opacity-50" /> {album.trackCount} Tracks
              </span>
            </div>

            {album.genre &&
              album.genre
                .split(' / ')
                .slice(0, 5)
                .map((g, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary/80 border border-primary/20 font-medium whitespace-nowrap"
                  >
                    <Hash size={10} className="opacity-50" /> {g.trim()}
                  </span>
                ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content (Bio + Tracks) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-6xl mx-auto p-4 md:pt-4 md:pb-8 md:px-8" onClick={clearSelection}>
          {/* Album Bio */}
          {album.bio && (
            <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-1000">
              <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                About the Album
              </h3>
              <div
                className={cn(
                  'text-[14px] text-zinc-400/90 leading-relaxed font-light',
                  !isBioExpanded && 'line-clamp-2'
                )}
              >
                {album.bio.split('\n').map((line, i) => {
                  const cleanLine = line
                    .replace(/<a href=".*">Read more on Last.fm<\/a>.*$/, '')
                    .trim()
                  if (!cleanLine) return null
                  return (
                    <p key={i} className={i > 0 ? 'mt-3' : ''}>
                      {cleanLine}
                    </p>
                  )
                })}
              </div>
              {album.bio.length > 150 && (
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="text-[11px] text-primary/70 hover:text-primary font-bold transition-colors flex items-center gap-1 group"
                >
                  {isBioExpanded ? 'Show less' : 'Read more'}
                  <span
                    className={cn(
                      'transition-transform duration-300',
                      isBioExpanded ? 'rotate-180' : ''
                    )}
                  >
                    ↓
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Performers & Credits */}
          {performers.length > 0 && (
            <div className="mb-8 space-y-6 animate-in fade-in slide-in-from-top-2 duration-1000 delay-200">
              <div className="flex items-center justify-between border-b border-border/5 pb-2">
                <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users size={12} strokeWidth={2.5} />
                  Credits
                </h3>
                <label className="flex items-center gap-2 group cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showOnlyPerformers}
                      onChange={(e) => setShowOnlyPerformers(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-muted-foreground/10 rounded-full peer peer-checked:bg-primary/40 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-muted-foreground/40 rounded-full peer-checked:translate-x-3 peer-checked:bg-primary transition-all duration-300" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors uppercase tracking-widest">
                    Only Performers
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
                {(() => {
                  // Categorize roles
                  const categorized = performers.reduce((acc: any, p) => {
                    const role = p.role?.toLowerCase() || ''
                    const isProduction = role.includes('producer') ||
                      role.includes('engineer') ||
                      role.includes('mix') ||
                      role.includes('master') ||
                      role.includes('director') ||
                      role.includes('conductor') ||
                      role.includes('arranger') ||
                      role.includes('coordinator') ||
                      role.includes('design') ||
                      role.includes('photography') ||
                      role.includes('art') ||
                      role.includes('technician') ||
                      role.includes('editor') ||
                      role.includes('management') ||
                      role.includes('legal') ||
                      role.includes('publisher') ||
                      role.includes('copyright') ||
                      role.includes('phonographic copyright') ||
                      role.includes('license')

                    if (showOnlyPerformers && isProduction) return acc

                    const artistName = p.artist_name
                    if (artistName && !acc[artistName]) {
                      acc[artistName] = {
                        id: p.artist_id,
                        name: artistName,
                        image: p.artist_image,
                        roles: new Set(),
                        isProduction
                      }
                    }
                    if (artistName) acc[artistName].roles.add(p.role)
                    return acc
                  }, {})

                  return Object.values(categorized).map((artist: any) => (
                    <div key={artist.name} className="flex items-center gap-3 group/credit">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border border-white/5 flex-shrink-0">
                        {artist.image ? (
                          <img
                            src={client.getArtistImageUrl(artist.id)}
                            alt={artist.name}
                            className="w-full h-full object-cover group-hover/credit:scale-110 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary uppercase text-[10px] font-bold">
                            {artist.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => navigateTo('artist-detail', { artistName: artist.name })}
                          className="text-[13px] font-semibold text-zinc-200 group-hover/credit:text-primary transition-colors text-left leading-tight"
                        >
                          {artist.name}
                        </button>
                        <div className="text-[10px] text-muted-foreground/60 leading-tight">
                          {Array.from(artist.roles).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* Track List */}
          <div className="mb-10">
            {/* Header */}
            <div className="grid grid-cols-[3rem_1fr_3rem_6rem_4rem_4rem] gap-4 px-4 py-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] border-b border-border/5 mb-2">
              <div className="text-center">#</div>
              <div>Title</div>
              <div className="text-right">Played</div>
              <div className="text-right">Rating</div>
              <div className="text-center">Love</div>
              <div className="text-right">Time</div>
            </div>

            <div className="space-y-0.5">
              {albumTracks.map((track) => {
                const isCurrentTrack = currentTrack?.id === track.id
                const isCurrentPlaying = isCurrentTrack && isPlaying
                const isSelected = selectedTracks.includes(track.id)
                const globalIndex = albumTracks.findIndex((t) => t.id === track.id)

                return (
                  <div
                    key={track.id}
                    onClick={(e) => handleTrackClick(e, track.id, globalIndex)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      window.dispatchEvent(
                        new CustomEvent('request-track-play', { detail: { track } })
                      )
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (!isSelected) {
                        selectSingleTrack(track.id)
                      }
                      window.dispatchEvent(
                        new CustomEvent('show-track-context-menu', {
                          detail: { track, x: e.clientX, y: e.clientY }
                        })
                      )
                    }}
                    className={cn(
                      'group grid grid-cols-[3rem_1fr_3rem_6rem_4rem_4rem] gap-4 px-4 py-2 rounded-md transition-all items-center border border-transparent select-none cursor-default',
                      isSelected
                        ? 'bg-white/10'
                        : isCurrentTrack
                          ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/20'
                          : 'hover:bg-white/5 hover:border-white/5'
                    )}
                    draggable
                    onDragStart={(e) => {
                      const dragIds = isSelected ? selectedTracks : [track.id]
                      const dragTracks = tracks.filter((t) => dragIds.includes(t.id))
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({ type: 'tracks', data: dragTracks })
                      )
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    <div
                      className={cn(
                        'text-center text-xs relative transition-colors',
                        isCurrentTrack
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground/60 group-hover:text-primary'
                      )}
                    >
                      <span className="group-hover:hidden transition-opacity">
                        {isCurrentPlaying ? (
                          <MusicIcon className="w-3 h-3 mx-auto animate-pulse" />
                        ) : (
                          track.trackNum
                        )}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          playTrackAction(track)
                        }}
                        className="hidden group-hover:flex items-center justify-center absolute inset-0 w-full h-full text-primary"
                      >
                        <Play size={12} fill="currentColor" />
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div
                        className={cn(
                          'text-[13px] font-medium truncate transition-colors',
                          isCurrentTrack
                            ? 'text-primary'
                            : 'text-foreground/90 group-hover:text-foreground'
                        )}
                      >
                        {track.title}
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="text-[11px] text-muted-foreground/60 hover:text-primary/80 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigateTo('artist-detail', { artistName: track.artist })
                          }}
                        >
                          {track.artist}
                        </span>
                        {(track.bpm || track.key) && (
                          <span className="text-[10px] text-muted-foreground/30 font-light tabular-nums">
                            • {[track.bpm && `${Math.round(track.bpm)} BPM`, track.key].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground/60 font-medium tabular-nums">
                      {track.playCount > 0 && track.playCount}
                    </div>

                    <div
                      className={cn(
                        'flex justify-end transition-opacity duration-300',
                        track.rating > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      )}
                    >
                      <RatingStars
                        rating={track.rating}
                        size={12}
                        onChange={(r) => rateTrack(track.id, r)}
                      />
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleLoved(track.id)}
                        className={cn(
                          'transition-all hover:scale-110 active:scale-95 duration-200',
                          track.loved
                            ? 'text-red-500 opacity-100'
                            : 'text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:text-red-400'
                        )}
                      >
                        <Heart size={14} fill={track.loved ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    <div
                      className={cn(
                        'text-right text-[11px] font-medium tabular-nums transition-colors',
                        isCurrentTrack
                          ? 'text-primary/70 font-bold'
                          : 'text-muted-foreground/60 group-hover:text-foreground'
                      )}
                    >
                      {formatDuration(track.duration)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setIsZoomed(false)}
        >
          <button
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]"
            onClick={() => setIsZoomed(false)}
          >
            <X size={32} />
          </button>

          <div
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300 cursor-move"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
          >
            <img
              src={client.getCoverUrl(album.id)}
              alt={album.name}
              className="max-w-full max-h-full h-auto w-auto object-contain shadow-2xl rounded-lg border border-white/10"
            />
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-white/80 space-y-1">
            <p className="text-xl font-bold">{album.name}</p>
            <p className="text-lg opacity-70">{album.artist}</p>
          </div>
        </div>
      )}

      <QueueConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onReplace={() => {
          playAlbum(albumTracks)
          setIsConfirmModalOpen(false)
        }}
        onAppend={() => {
          insertToQueue(albumTracks, queue.length)
          setIsConfirmModalOpen(false)
        }}
        title="Clear Playlist?"
        message={`Your playlist is not empty. Would you like to clear it and play "${album.name}", or just add it to the end?`}
      />

      {albumContextMenu && (
        <AlbumContextMenu
          album={albumContextMenu.album}
          x={albumContextMenu.x}
          y={albumContextMenu.y}
          onClose={() => setAlbumContextMenu(null)}
        />
      )}
    </div>
  )
}
