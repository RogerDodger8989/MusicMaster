import { Play, Clock, Music } from 'lucide-react'
import { Album } from '../types'
import { RatingStars } from './RatingStars'
import { cn } from '../utils'
import { formatDuration } from '../utils/format'
import { client } from '../api/client'

interface AlbumListItemProps {
  album: Album
  onClick?: () => void
  onPlay?: () => void
  className?: string
  viewFields?: {
    rating?: boolean
    year?: boolean
    duration?: boolean
    tracks?: boolean
    added?: boolean
  }
}

export function AlbumListItem({
  album,
  onClick,
  onPlay,
  className,
  viewFields = { rating: true, year: true, duration: true, tracks: true }
}: AlbumListItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-4 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/40 last:border-0',
        className
      )}
      onClick={onClick}
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
    >
      {/* Cover Art - Small */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
        {album.id ? (
          <img
            src={client.getCoverUrl(album.id)}
            alt={album.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = ''
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary/50">
            <span className="text-xl text-muted-foreground/50">♪</span>
          </div>
        )}

        {/* Hover Play Button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            className="p-1 rounded-full bg-primary text-primary-foreground shadow-sm hover:scale-105 transition-transform"
            onClick={(e) => {
              e.stopPropagation()
              onPlay?.()
            }}
          >
            <Play size={14} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="font-medium text-sm truncate leading-tight" title={album.name}>
          {album.name}
        </h3>
        <p className="text-xs text-muted-foreground truncate" title={album.artist}>
          {album.artist}
        </p>
      </div>

      {/* Dynamic Columns */}

      {viewFields.year && (
        <div
          className="hidden sm:flex items-center gap-1.5 w-16 text-xs text-muted-foreground"
          title="Year"
        >
          {album.year}
        </div>
      )}

      {viewFields.tracks && (
        <div
          className="hidden md:flex items-center gap-1.5 w-16 text-xs text-muted-foreground"
          title="Tracks"
        >
          <Music size={12} className="opacity-70" />
          {album.trackCount}
        </div>
      )}

      {viewFields.duration && (
        <div
          className="hidden lg:flex items-center gap-1.5 w-20 text-xs text-muted-foreground"
          title="Duration"
        >
          <Clock size={12} className="opacity-70" />
          {formatDuration(album.totalDuration)}
        </div>
      )}

      {viewFields.rating && (
        <div className="hidden sm:flex w-24 justify-end items-center gap-2">
          {album.playCount > 0 && (
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {album.playCount}
            </span>
          )}
          {album.rating > 0 && <RatingStars rating={album.rating} size={12} readOnly />}
        </div>
      )}
    </div>
  )
}
