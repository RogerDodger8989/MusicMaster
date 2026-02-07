import { ListPlus, Play, ListMusic, ChevronRight, User, Disc, FolderOpen, Fingerprint } from 'lucide-react'
import { usePlaylists } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Track } from '../types'
import { useEffect, useState, useRef } from 'react'

interface TrackContextMenuProps {
    track: Track
    x: number
    y: number
    onClose: () => void
}

export default function TrackContextMenu({ track, x, y, onClose }: TrackContextMenuProps) {
    const { playlists, fetchPlaylists, addTrackToPlaylist } = usePlaylists()
    const { playAlbum } = usePlayer()
    const { albums } = useLibrary()
    const { navigateTo } = useNavigation()
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

    const handleGoToArtist = () => {
        navigateTo('artist-detail', { artistName: track.artist })
        onClose()
    }

    const handleGoToAlbum = () => {
        const album = albums.find(a =>
            a.name === track.album &&
            (a.artist === track.albumArtist || a.artist === track.artist)
        )
        if (album) {
            navigateTo('album-detail', { albumId: album.id })
        }
        onClose()
    }

    const handleLocateFile = () => {
        window.api.util.showItemInFolder(track.filePath)
        onClose()
    }

    const handleIdentify = () => {
        window.dispatchEvent(new CustomEvent('request-track-tagging', {
            detail: { track }
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
