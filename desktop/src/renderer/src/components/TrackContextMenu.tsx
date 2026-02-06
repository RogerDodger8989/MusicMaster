import { ListPlus, Play, ListMusic, ChevronRight } from 'lucide-react'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { Track } from '../types'
import { cn } from '../lib/utils'
import { useEffect, useState, useRef } from 'react'

interface TrackContextMenuProps {
    track: Track
    x: number
    y: number
    onClose: () => void
}

export default function TrackContextMenu({ track, x, y, onClose }: TrackContextMenuProps) {
    const { playlists, fetchPlaylists, addTrackToPlaylist } = usePlaylists()
    const { playAlbum, queue } = usePlayer()
    const [showPlaylists, setShowPlaylists] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchPlaylists()

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [fetchPlaylists, onClose])

    const handleAddToPlaylist = async (playlistId: string) => {
        await addTrackToPlaylist(playlistId, track.id)
        alert(`Added to playlist!`)
        onClose()
    }

    const handlePlayNext = () => {
        window.dispatchEvent(new CustomEvent('request-track-play', {
            detail: { track, option: 'play_next' }
        }))
        onClose()
    }

    const handleAddToQueue = () => {
        window.dispatchEvent(new CustomEvent('request-track-play', {
            detail: { track, option: 'add_last' }
        }))
        onClose()
    }

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: x, top: y }}
        >
            <button
                onClick={() => { playAlbum([track], 0); onClose(); }}
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
                            <div className="px-4 py-2 text-xs text-zinc-500 font-medium italic">No playlists created</div>
                        ) : (
                            playlists.map(pl => (
                                <button
                                    key={pl.id}
                                    onClick={() => handleAddToPlaylist(pl.id)}
                                    className="w-full px-4 py-2 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white truncate transition-colors"
                                >
                                    {pl.name}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
