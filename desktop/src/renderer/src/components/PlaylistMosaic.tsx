import { ListMusic } from 'lucide-react'
import { cn } from '../lib/utils'
import { Track } from '../types'

interface PlaylistMosaicProps {
    tracks: Track[]
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

export function PlaylistMosaic({ tracks, size = 'md', className }: PlaylistMosaicProps) {
    const covers = tracks
        .map(t => t.coverArtPath)
        .filter((path, index, self) => path && self.indexOf(path) === index) // Unique covers
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

    if (covers.length < 4) {
        // Single cover if not enough unique ones for a grid
        return (
            <div className={cn("bg-zinc-900 flex items-center justify-center overflow-hidden shadow-2xl", sizeClasses[size], className)}>
                {covers[0] ? (
                    <img
                        src={`asset:///${covers[0].replace(/\\/g, '/')}`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <ListMusic size={iconSizes[size]} className="text-zinc-800" />
                )}
            </div>
        )
    }

    return (
        <div className={cn("grid grid-cols-2 bg-zinc-900 overflow-hidden shadow-2xl", sizeClasses[size], className)}>
            {covers.map((path, i) => (
                <img
                    key={i}
                    src={`asset:///${path!.replace(/\\/g, '/')}`}
                    className="w-full h-full object-cover border-[0.5px] border-black/20"
                />
            ))}
        </div>
    )
}
