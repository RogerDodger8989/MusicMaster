import { Album } from '../types'
import { cn } from '../utils'
import { Play, Heart } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { client } from '../api/client'
import { useState } from 'react'
import AlbumContextMenu from './AlbumContextMenu'
import { RatingStars } from './RatingStars'

interface AlbumCardProps {
  album: Album
  onClick?: () => void
  onPlayOptions?: (e: React.MouseEvent) => void
  className?: string
}

export function AlbumCard({ album, onClick, onPlayOptions, className }: AlbumCardProps) {
  const { playAlbum } = usePlayer()
  const { tracks: allTracks, toggleAlbumLoved } = useLibrary()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleQuickPlay = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (onPlayOptions) {
      onPlayOptions(e)
      return
    }

    try {
      // Try local store first
      let tracks = allTracks.filter(
        (t) =>
          t.album === album.name && (t.albumArtist === album.artist || t.artist === album.artist)
      )

      // Fallback to IPC if store is not loaded or missing tracks
      if (tracks.length === 0) {
        tracks = await (window as any).api.tracks.getTracksByAlbum(album.name, album.artist)
      }

      if (tracks && tracks.length > 0) {
        // Sort by disc/track
        tracks.sort((a, b) => {
          const discA = a.discNum || 1
          const discB = b.discNum || 1
          if (discA !== discB) return discA - discB
          return (a.trackNum || 0) - (b.trackNum || 0)
        })
        playAlbum(tracks, 0)
      } else {
        console.warn('No tracks found for album:', album.name)
      }
    } catch (err) {
      console.error('Failed to quick play album:', err)
    }
  }

  const handleToggleLove = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleAlbumLoved(album.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            'application/json',
            JSON.stringify({
              type: 'album_ref',
              name: album.name,
              artist: album.artist
            })
          )
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onContextMenu={handleContextMenu}
        className={cn(
          'group relative flex flex-col gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing',
          className
        )}
        onClick={onClick}
      >
        {/* Cover Art Container */}
        <div className="relative aspect-square w-full rounded-md bg-muted shadow-sm group-hover:shadow-md transition-all">
          {/* Cover Art Wrapper (for overflow-hidden & Hover Overlay) */}
          <div className="absolute inset-0 overflow-hidden rounded-md">
            {album.coverArtPath || album.id ? (
              <img
                src={client.getCoverUrl(album.id)}
                alt={album.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none' // Hide if failed
                  console.warn(`Failed to load cover for ${album.name}`)
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary/50">
                <span className="text-4xl text-muted-foreground/50">♪</span>
              </div>
            )}

            {/* Hover Play Button Overlay - Managed with z-index for better reliability */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Background overlay that still allows navigation to detail */}
              <div className="absolute inset-0 bg-black/20" onClick={onClick} />
              <div className="absolute bottom-2 left-2 z-20">
                <button
                  onClick={handleQuickPlay}
                  title="Quick Play"
                  className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg transform transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>

          {/* Heart Badge - Top Left Triangle */}
          <div
            className="absolute top-0 left-0 z-30 w-12 h-12 cursor-pointer"
            onClick={handleToggleLove}
            title={album.loved ? 'Unlove Album' : 'Love Album'}
          >
            {album.loved ? (
              <>
                <div
                  className="absolute inset-0 bg-blue-600 shadow-lg pointer-events-none"
                  style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                />
                <Heart
                  size={14}
                  fill="currentColor"
                  className="absolute top-1.5 left-1.5 text-red-500 z-40 pointer-events-none"
                />
              </>
            ) : (
              <div className="absolute top-1.5 left-1.5 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Heart size={14} />
              </div>
            )}
          </div>

          {/* Rating Badge (Interactive Selector) */}
          <div className="absolute top-0 right-0 z-50 group/rating flex flex-row-reverse items-center p-1.5">
            {/* The Triangle Badge (Trigger) */}
            <div
              className={cn(
                "w-12 h-12 cursor-pointer transition-opacity relative",
                album.rating > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-40"
              )}
            >
              <div
                className="absolute inset-0 bg-blue-600 shadow-lg"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
              />
              <span className="absolute top-1.5 right-1.5 text-sm font-black text-white rotate-[15deg] select-none">
                {album.rating > 0 ? Math.round(album.rating) : '?'}
              </span>
            </div>

            {/* Hover Selector Popover (Contiguous with Bridge) */}
            <div className="flex items-center opacity-0 group-hover/rating:opacity-100 pointer-events-none group-hover/rating:pointer-events-auto transition-all duration-300 translate-x-2 group-hover/rating:translate-x-0 whitespace-nowrap">
              {/* Invisible bridge to catch mouse events between triangle and bar */}
              <div className="w-5 h-12 -mr-2 cursor-default" />

              <div className="flex items-center gap-0.5 bg-black/90 backdrop-blur-3xl border border-white/10 p-1 rounded-full shadow-2xl scale-90 group-hover/rating:scale-100">
                <RatingStars
                  rating={album.rating}
                  onChange={(r) => {
                    const { rateAlbum } = useLibrary.getState()
                    rateAlbum(album.id, r)
                  }}
                  size={14}
                  className="px-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <h3 className="font-medium leading-none truncate" title={album.name}>
            {album.name}
          </h3>
          <p className="text-sm text-muted-foreground truncate" title={album.artist}>
            {album.artist}
          </p>
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-muted-foreground/60 font-medium">{album.year}</span>
          </div>
        </div>
      </div>

      {contextMenu && (
        <AlbumContextMenu
          album={album}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
