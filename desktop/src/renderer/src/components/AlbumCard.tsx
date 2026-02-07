import { Album } from '../types'
import { cn } from '../utils'
import { Play, Heart } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useState } from 'react'
import AlbumContextMenu from './AlbumContextMenu'

interface AlbumCardProps {
    album: Album
    onClick?: () => void
    onPlayOptions?: (e: React.MouseEvent) => void
    className?: string
}

export function AlbumCard({ album, onClick, onPlayOptions, className }: AlbumCardProps) {
    const { playAlbum } = usePlayer()
    const { tracks: allTracks, toggleAlbumLoved } = useLibrary()
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

    const handleQuickPlay = async (e: React.MouseEvent) => {
        e.stopPropagation()

        if (onPlayOptions) {
            onPlayOptions(e)
            return
        }

        try {
            // Try local store first
            let tracks = allTracks.filter(t => t.album === album.name && (t.albumArtist === album.artist || t.artist === album.artist))

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
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'album_ref',
                        name: album.name,
                        artist: album.artist
                    }))
                    e.dataTransfer.effectAllowed = 'copy'
                }}
                onContextMenu={handleContextMenu}
                className={cn(
                    "group relative flex flex-col gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing",
                    className
                )}
                onClick={onClick}
            >
                {/* Cover Art Container */}
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted shadow-sm group-hover:shadow-md transition-all">
                    {/* Heart Badge - Top Left Triangle */}
                    <div
                        className="absolute top-0 left-0 z-30 w-12 h-12 cursor-pointer"
                        onClick={handleToggleLove}
                        title={album.loved ? "Unlove Album" : "Love Album"}
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

                    {/* Rating Badge - Blue Corner Triangle */}
                    {album.rating > 0 && (
                        <div className="absolute top-0 right-0 z-20 w-10 h-10 pointer-events-none">
                            <div
                                className="absolute inset-0 bg-blue-600 shadow-lg"
                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                            />
                            <span className="absolute top-1 right-1 text-[9px] font-black text-white rotate-[15deg]">
                                {album.rating.toFixed(1)}
                            </span>
                        </div>
                    )}

                    {album.coverArtPath ? (
                        <img
                            src={album.coverArtPath.startsWith('asset:') ? album.coverArtPath : `asset:///${album.coverArtPath.replace(/\\/g, '/')}`}
                            alt={album.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            onError={async (e) => {
                                if (album.id) {
                                    const img = e.target as HTMLImageElement
                                    // Prevent infinite loop if fallback also fails
                                    if (img.src.includes('blob:')) return

                                    try {
                                        const result = await (window as any).api.tracks.getCoverBufferByAlbum(album.id)
                                        if (result && result.data) {
                                            const blob = new Blob([result.data], { type: `image/${result.format || 'jpeg'}` })
                                            img.src = URL.createObjectURL(blob)
                                        }
                                    } catch (err) {
                                        console.error('Failed to load fallback cover:', err)
                                    }
                                }
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
