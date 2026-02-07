import { ListPlus, Play, User, Fingerprint } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'
import { Album } from '../types'
import { useEffect, useRef } from 'react'

interface AlbumContextMenuProps {
    album: Album
    x: number
    y: number
    onClose: () => void
}

export default function AlbumContextMenu({ album, x, y, onClose }: AlbumContextMenuProps) {
    const { playAlbum } = usePlayer()
    const { tracks: allTracks } = useLibrary()
    const { navigateTo } = useNavigation()
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const getAlbumTracks = async () => {
        let tracks = allTracks.filter(t =>
            t.album === album.name &&
            (t.albumArtist === album.artist || t.artist === album.artist)
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
        window.dispatchEvent(new CustomEvent('request-album-play', {
            detail: { tracks, option: 'play_next' }
        }))
        onClose()
    }

    const handleAddToQueue = async () => {
        const tracks = await getAlbumTracks()
        window.dispatchEvent(new CustomEvent('request-album-play', {
            detail: { tracks, option: 'add_last' }
        }))
        onClose()
    }

    const handleGoToArtist = () => {
        navigateTo('artist-detail', { artistName: album.artist })
        onClose()
    }

    const handleIdentify = () => {
        window.dispatchEvent(new CustomEvent('request-album-tagging', {
            detail: { album }
        }))
        onClose()
    }

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: x, top: y }}
        >
            <div className="px-4 py-2 mb-1 border-b border-zinc-800/50">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest truncate">{album.name}</div>
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

            <button
                onClick={handleGoToArtist}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-200 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition-colors"
            >
                <User size={16} />
                Go to Artist
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
