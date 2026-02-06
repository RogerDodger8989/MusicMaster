import { ListMusic, Play, Shuffle, Trash2, Clock, Hash, ChevronRight } from 'lucide-react'
import { usePlaylists, Playlist } from '../store/playlists'
import { usePlayer } from '../store/player'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { formatDuration } from '../utils/format'
import { PlaylistMosaic } from '../components/PlaylistMosaic'

export default function PlaylistsView() {
    const { playlists, fetchPlaylists, deletePlaylist, isLoading } = usePlaylists()
    const { playAlbum, currentTrack, isPlaying } = usePlayer()
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)

    useEffect(() => {
        fetchPlaylists()
    }, [fetchPlaylists])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('Are you sure you want to delete this playlist?')) {
            await deletePlaylist(id)
            if (selectedPlaylist?.id === id) setSelectedPlaylist(null)
        }
    }

    if (isLoading && playlists.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    if (selectedPlaylist) {
        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row gap-8 items-end">
                    <div className="group relative flex-shrink-0">
                        <PlaylistMosaic tracks={selectedPlaylist.tracks} size="lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                            <button
                                onClick={() => playAlbum(selectedPlaylist.tracks, 0)}
                                className="p-4 rounded-full bg-blue-600 text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                            >
                                <Play size={24} fill="currentColor" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                            <button
                                onClick={() => setSelectedPlaylist(null)}
                                className="text-blue-500 text-sm font-bold hover:underline mb-2 block"
                            >
                                ← Back to Playlists
                            </button>
                            <h2 className="text-5xl font-black text-white tracking-tight">{selectedPlaylist.name}</h2>
                            <p className="text-zinc-500 font-medium">
                                {selectedPlaylist.tracks.length} tracks • {formatDuration(selectedPlaylist.tracks.reduce((acc, t) => acc + t.duration, 0))}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => playAlbum(selectedPlaylist.tracks, 0)}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                            >
                                <Play size={20} fill="currentColor" />
                                Play
                            </button>
                            <button
                                onClick={() => {
                                    const shuffled = [...selectedPlaylist.tracks].sort(() => Math.random() - 0.5)
                                    playAlbum(shuffled, 0)
                                }}
                                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                            >
                                <Shuffle size={20} />
                                Shuffle
                            </button>
                            <button
                                onClick={(e) => handleDelete(e, selectedPlaylist.id)}
                                className="p-3 text-zinc-500 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Track List */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[3rem_2fr_1.5fr_1.5fr_4rem] gap-4 px-6 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50">
                        <div className="text-center flex justify-center"><Hash className="w-3 h-3" /></div>
                        <div>Title</div>
                        <div>Artist</div>
                        <div>Album</div>
                        <div className="text-right flex justify-end"><Clock className="w-3 h-3" /></div>
                    </div>

                    <div className="divide-y divide-zinc-900">
                        {selectedPlaylist.tracks.map((track, idx) => {
                            const isActive = currentTrack?.id === track.id
                            return (
                                <div
                                    key={`${track.id}-${idx}`}
                                    onDoubleClick={() => playAlbum(selectedPlaylist.tracks, idx)}
                                    className={cn(
                                        "group grid grid-cols-[3rem_2fr_1.5fr_1.5fr_4rem] gap-4 px-6 py-4 items-center transition-all cursor-pointer hover:bg-white/5",
                                        isActive && "bg-blue-600/10"
                                    )}
                                >
                                    <div className="text-center text-xs font-bold text-zinc-600">
                                        {isActive && isPlaying ? (
                                            <div className="flex items-end gap-0.5 h-3 justify-center">
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.8s_ease-in-out_infinite]" />
                                                <div className="w-0.5 bg-blue-500 animate-[music-bar_0.5s_ease-in-out_infinite]" />
                                            </div>
                                        ) : (
                                            <span className={isActive ? "text-blue-500" : ""}>{idx + 1}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={cn("text-sm font-bold truncate", isActive ? "text-blue-500" : "text-zinc-200")}>
                                            {track.title}
                                        </div>
                                    </div>
                                    <div className="text-sm text-zinc-400 truncate">{track.artist}</div>
                                    <div className="text-sm text-zinc-400 truncate">{track.album}</div>
                                    <div className="text-right text-xs font-medium text-zinc-500 tabular-nums">
                                        {formatDuration(track.duration)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div>
                <h2 className="text-4xl font-black text-white tracking-tight">Your Playlists</h2>
                <p className="text-zinc-500 mt-2 font-medium">Manage and play your custom collections</p>
            </div>

            {playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-950 border border-dashed border-zinc-800 rounded-2xl text-center space-y-4">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
                        <ListMusic size={40} />
                    </div>
                    <div className="max-w-sm">
                        <h3 className="text-xl font-bold text-white">No playlists yet</h3>
                        <p className="text-zinc-500 mt-2">
                            Create a playlist from the queue or by right-clicking tracks (coming soon).
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {playlists.map(pl => (
                        <div
                            key={pl.id}
                            onClick={() => setSelectedPlaylist(pl)}
                            className="group bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 hover:bg-zinc-800/60 transition-all cursor-pointer hover:border-zinc-700 shadow-xl space-y-4"
                        >
                            <div className="relative">
                                <PlaylistMosaic tracks={pl.tracks} size="md" className="w-full aspect-square" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                    <Play size={32} className="text-white fill-current translate-y-2 group-hover:translate-y-0 transition-transform duration-300" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">{pl.name}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-zinc-500 font-bold">{pl.tracks.length} tracks</span>
                                    <button
                                        onClick={(e) => handleDelete(e, pl.id)}
                                        className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes music-bar {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
            `}</style>
        </div>
    )
}

