import { ListMusic } from 'lucide-react'
import { cn } from '../lib/utils'
import { Track } from '../types'
import { client } from '../api/client'
import { useLibrary } from '../store/library'

interface PlaylistMosaicProps {
  tracks: Track[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlaylistMosaic({ tracks, size = 'md', className }: PlaylistMosaicProps) {
  const { albums } = useLibrary()

  const coverUrls = tracks
    .map((t) => {
      const album = albums.find(
        (a) => a.name === t.album && (a.artist === t.artist || a.artist === t.albumArtist)
      )
      return client.getCoverUrl(album?.id || '')
    })
    .filter((url, index, self) => url && self.indexOf(url) === index) // Unique covers
    .slice(0, 4)

  const sizeClasses = {
    sm: 'w-10 h-10 rounded',
    md: 'w-48 h-48 rounded-xl',
    lg: 'w-64 h-64 rounded-2xl'
  }

  const iconSizes = {
    sm: 16,
    md: 48,
    lg: 64
  }

  if (coverUrls.length < 4) {
    // Single cover if not enough unique ones for a grid
    return (
      <div
        className={cn(
          'bg-zinc-900 flex items-center justify-center overflow-hidden shadow-2xl',
          sizeClasses[size],
          className
        )}
      >
        {coverUrls[0] ? (
          <img src={coverUrls[0]} className="w-full h-full object-cover" />
        ) : (
          <ListMusic size={iconSizes[size]} className="text-zinc-800" />
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 bg-zinc-900 overflow-hidden shadow-2xl',
        sizeClasses[size],
        className
      )}
    >
      {coverUrls.map((url, i) => (
        <img
          key={i}
          src={url}
          className="w-full h-full object-cover border-[0.5px] border-black/20"
        />
      ))}
    </div>
  )
}
