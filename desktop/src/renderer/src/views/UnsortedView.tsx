import { useState, useMemo } from 'react'
import { Folder, FileQuestion, Play, Search, Fingerprint, ChevronRight, ChevronDown } from 'lucide-react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { Track } from '../types'
import { cn } from '../utils'
import TrackContextMenu from '../components/TrackContextMenu'

import { useTrackSelection } from '../hooks/useTrackSelection'

export default function UnsortedView() {
    const { tracks } = useLibrary()
    const { playTrack } = usePlayer()
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [contextMenu, setContextMenu] = useState<{ track: Track, x: number, y: number } | null>(null)

    const unsortedTracks = useMemo(() => {
        return tracks.filter(t => !t.musicbrainzTrackId)
    }, [tracks])

    const filteredTracks = useMemo(() => {
        if (!searchQuery.trim()) return unsortedTracks
        const q = searchQuery.toLowerCase()
        return unsortedTracks.filter(t =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            t.filePath.toLowerCase().includes(q)
        )
    }, [unsortedTracks, searchQuery])

    const groupedFolders = useMemo(() => {
        const groups: Record<string, Track[]> = {}
        filteredTracks.forEach(track => {
            // Get directory path
            const lastSlash = Math.max(track.filePath.lastIndexOf('/'), track.filePath.lastIndexOf('\\'))
            const folderPath = track.filePath.substring(0, lastSlash)
            if (!groups[folderPath]) groups[folderPath] = []
            groups[folderPath].push(track)
        })

        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
    }, [filteredTracks])

    const toggleFolder = (path: string) => {
        const next = new Set(expandedFolders)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        setExpandedFolders(next)
    }

    const handleIdentify = (track: Track) => {
        window.dispatchEvent(new CustomEvent('request-track-tagging', {
            detail: { track }
        }))
    }

    const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } = useTrackSelection(filteredTracks)

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col" onClick={clearSelection}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileQuestion className="text-zinc-500" />
                        Unsorted Tracks
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                        {unsortedTracks.length} tracks lacking MusicBrainz IDs. Grouped by folder.
                    </p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search unsorted..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 custom-scrollbar">
                {groupedFolders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
                        <Folder className="w-12 h-12 mb-4 opacity-20" />
                        <p>No unsorted tracks found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-900">
                        {groupedFolders.map(([path, folderTracks]) => (
                            <div key={path} className="group/folder">
                                <div
                                    className="flex items-center gap-3 px-6 py-4 hover:bg-white/5 cursor-pointer transition-colors"
                                    onClick={() => toggleFolder(path)}
                                >
                                    {expandedFolders.has(path) ? (
                                        <ChevronDown size={16} className="text-zinc-500" />
                                    ) : (
                                        <ChevronRight size={16} className="text-zinc-500" />
                                    )}
                                    <Folder size={18} className="text-blue-500/80" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-zinc-200 truncate pr-4">
                                            {path.split(/[/\\]/).pop() || path}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 truncate mt-0.5 font-medium opacity-60">
                                            {path}
                                        </div>
                                    </div>
                                    <div className="text-xs font-black text-zinc-600 tabular-nums">
                                        {folderTracks.length} tracks
                                    </div>
                                </div>

                                {expandedFolders.has(path) && (
                                    <div className="bg-black/20 pb-2">
                                        {folderTracks.map((track) => {
                                            const isSelected = selectedTracks.includes(track.id)
                                            const globalIndex = filteredTracks.findIndex(t => t.id === track.id)

                                            return (
                                                <div
                                                    key={track.id}
                                                    onClick={(e) => handleTrackClick(e, track.id, globalIndex)}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation()
                                                        playTrack(track)
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault()
                                                        if (!isSelected) {
                                                            selectSingleTrack(track.id)
                                                        }
                                                        setContextMenu({ track, x: e.clientX, y: e.clientY })
                                                    }}
                                                    className={cn(
                                                        "group flex items-center gap-4 px-12 py-2.5 transition-all cursor-pointer border-l-2 select-none",
                                                        isSelected
                                                            ? "bg-white/10 border-blue-500"
                                                            : "hover:bg-white/5 border-transparent hover:border-blue-500/50"
                                                    )}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        const dragIds = isSelected ? selectedTracks : [track.id]
                                                        const dragTracks = filteredTracks.filter(t => dragIds.includes(t.id))

                                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                                            type: 'tracks',
                                                            data: dragTracks
                                                        }))
                                                        e.dataTransfer.effectAllowed = 'copy'
                                                    }}
                                                >
                                                    <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                                                        {isSelected ? (
                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                        ) : (
                                                            <>
                                                                <Play size={12} className="text-zinc-500 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                                                                <span className="text-[10px] text-zinc-600 font-bold group-hover:hidden">
                                                                    {track.trackNum || '-'}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={cn(
                                                            "text-sm font-semibold truncate transition-colors",
                                                            isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"
                                                        )}>
                                                            {track.title || track.filePath.split(/[/\\]/).pop()}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500 truncate flex items-center gap-2">
                                                            <span className="font-bold">{track.artist}</span>
                                                            <span className="opacity-30">•</span>
                                                            <span>{track.album}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleIdentify(track)
                                                        }}
                                                        className="p-2 rounded-lg bg-zinc-900 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-all border border-zinc-800 opacity-0 group-hover:opacity-100"
                                                        title="Identify with MusicBrainz"
                                                    >
                                                        <Fingerprint size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {contextMenu && (
                <TrackContextMenu
                    track={contextMenu.track}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    )
}
