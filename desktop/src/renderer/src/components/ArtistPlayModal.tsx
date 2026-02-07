import { useRef } from 'react'
import { Play, Shuffle, Heart, X } from 'lucide-react'
import { useDraggable } from '../hooks/useDraggable'
import { cn } from '../utils'

interface ArtistPlayModalProps {
  artistName: string
  isOpen: boolean
  onClose: () => void
  onPlayAll: () => void
  onShuffleAll: () => void
  onPlayRated: () => void
}

export function ArtistPlayModal({
  artistName,
  isOpen,
  onClose,
  onPlayAll,
  onShuffleAll,
  onPlayRated
}: ArtistPlayModalProps) {
  const { position, handleMouseDown } = useDraggable()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Modal Container */}
      <div
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="pointer-events-auto relative w-[320px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header (Drag Handle) */}
        <div
          className="flex items-center justify-between p-4 border-b border-zinc-800 cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h3 className="font-bold text-white flex items-center gap-2">
            <Play size={16} className="text-blue-500 fill-blue-500" />
            Play {artistName}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <button
            onClick={onPlayAll}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <Play
                size={14}
                className="text-zinc-400 group-hover:text-white ml-0.5 fill-current"
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">All songs</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-zinc-400">
                Oldest to Newest
              </div>
            </div>
          </button>

          <button
            onClick={onShuffleAll}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-purple-600 transition-colors">
              <Shuffle size={14} className="text-zinc-400 group-hover:text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">All songs shuffled</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-zinc-400">
                Randomized order
              </div>
            </div>
          </button>

          <button
            onClick={onPlayRated}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-red-600 transition-colors">
              <Heart size={14} className="text-zinc-400 group-hover:text-white fill-current" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Top Rated</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-zinc-400">
                Rated & Loved Tracks
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
