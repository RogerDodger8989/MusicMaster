import { useState, useEffect } from 'react'
import { X, ListMusic } from 'lucide-react'
import { usePlaylists } from '../../store/playlists'
import { cn } from '../../lib/utils'
import { useDraggable } from '../../hooks/useDraggable'

interface CreatePlaylistModalProps {
    isOpen: boolean
    onClose: () => void
    initialTrackIds?: string[]
}

export function CreatePlaylistModal({
    isOpen,
    onClose,
    initialTrackIds = []
}: CreatePlaylistModalProps) {
    const [name, setName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const { createPlaylist } = usePlaylists()
    const { position, handleMouseDown, setPosition } = useDraggable()

    useEffect(() => {
        if (isOpen) {
            setName('')
            setIsCreating(false)
            setPosition({ x: 0, y: 0 })
        }
    }, [isOpen, setPosition])

    if (!isOpen) return null

    const handleCreate = async () => {
        if (!name.trim() || isCreating) return

        setIsCreating(true)
        const newId = await createPlaylist(name.trim(), initialTrackIds)
        setIsCreating(false)

        if (newId) {
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className="w-[400px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div
                    className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <ListMusic className="text-primary w-5 h-5" />
                        <h3 className="font-bold text-white">Create New Playlist</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="playlistName" className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                            Playlist Name
                        </label>
                        <input
                            id="playlistName"
                            autoFocus
                            type="text"
                            placeholder="My Awesome Playlist"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            className="w-full bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        {initialTrackIds.length > 0 && (
                            <p className="text-[10px] text-zinc-500 italic">
                                {initialTrackIds.length} track{initialTrackIds.length > 1 ? 's' : ''} will be added.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!name.trim() || isCreating}
                            className={cn(
                                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                                name.trim() && !isCreating
                                    ? "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            )}
                        >
                            {isCreating ? 'Creating...' : 'Create Playlist'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
