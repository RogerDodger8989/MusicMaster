import { Artist } from '../types'
import { cn } from '../utils'
import { Users, Heart, Disc, Music, Play } from 'lucide-react'
import { useLibrary } from '../store/library'
import { useState } from 'react'
import { client } from '../api/client'
import ArtistContextMenu from './ArtistContextMenu'

interface ArtistCardProps {
  artist: Artist
  onClick?: () => void
  onPlayOptions?: (e: React.MouseEvent) => void
  className?: string
}

export function ArtistCard({ artist, onClick, onPlayOptions, className }: ArtistCardProps) {
  const { toggleArtistLoved } = useLibrary()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleToggleLove = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleArtistLoved(artist.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={cn(
          'group relative flex flex-col gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        {/* Image Container */}
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-zinc-900 border border-zinc-800 shadow-sm group-hover:shadow-md transition-all">
          {/* Heart Badge - Top Left Triangle */}
          <div
            className="absolute top-0 left-0 z-30 w-12 h-12 cursor-pointer"
            onClick={handleToggleLove}
            title={artist.loved ? 'Unlove Artist' : 'Love Artist'}
          >
            {artist.loved ? (
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

          {/* Artist Image Container */}
          <div className="relative h-full w-full">
            {/* Placeholder / Background (Always visible as base) */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
              <Users size={64} className="opacity-30 text-zinc-600" />
            </div>

            {/* Actual Image (Overlays placeholder) */}
            {artist.imagePath && (
              <img
                src={
                  artist.imagePath.startsWith('http') || artist.imagePath.startsWith('asset:///')
                    ? artist.imagePath
                    : client.getArtistImageUrl(artist.id)
                }
                alt={artist.name}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-all duration-500",
                  "group-hover:scale-105 filter grayscale-[0.2] group-hover:grayscale-0",
                )}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none' // Hide image if broken, revealing placeholder
                }}
              />
            )}
          </div>

          {/* Play Options Button - Above Albums Count */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayOptions?.(e)
            }}
            className="absolute bottom-9 left-2 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            title="Play Options"
          >
            <Play size={14} fill="white" className="text-white ml-0.5" />
          </button>

          {/* Bottom Stats Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-7 bg-blue-600/90 backdrop-blur-sm flex items-center justify-between px-3">
            <div className="flex items-center gap-1.5">
              <Disc size={12} className="text-white/70" />
              <span className="text-[10px] font-bold text-white">{artist.albumCount}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-white max-w-[4ch] text-right">
                {artist.trackCount}
              </span>
              <Music size={12} className="text-white/70" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1 text-center">
          <h3
            className="font-bold leading-none truncate group-hover:text-blue-400 transition-colors"
            title={artist.name}
          >
            {artist.name}
          </h3>
        </div>
      </div>

      {contextMenu && (
        <ArtistContextMenu
          artist={artist}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
