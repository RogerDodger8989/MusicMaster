import { Play, Shuffle, X, ListPlus } from 'lucide-react'
import { useDraggable } from '../hooks/useDraggable'

interface AlbumPlayModalProps {
  albumName: string
  artistName?: string
  isOpen: boolean
  onClose: () => void
  onPlayAll: () => void
  onShuffleAll: () => void
  onAddToQueue: () => void
}

export function AlbumPlayModal({
  albumName,
  isOpen,
  onClose,
  onPlayAll,
  onShuffleAll,
  onAddToQueue
}: AlbumPlayModalProps) {
  if (!isOpen) return null

  const { position, handleMouseDown } = useDraggable()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="pointer-events-auto relative w-[320px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b border-zinc-800 cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h3 className="font-bold text-white flex items-center gap-2 truncate pr-4">
            <Play size={16} className="text-blue-500 fill-blue-500 flex-shrink-0" />
            <span className="truncate">{albumName}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white flex-shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2">
          <button
            onClick={() => {
              onPlayAll()
              onClose()
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Play size={20} className="text-blue-500 fill-blue-500" />
            </div>
            <div>
              <div className="font-medium text-white">Play Album</div>
              <div className="text-xs text-zinc-400">Play tracks in order</div>
            </div>
          </button>

          <button
            onClick={() => {
              onShuffleAll()
              onClose()
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <Shuffle size={20} className="text-purple-500" />
            </div>
            <div>
              <div className="font-medium text-white">Shuffle Album</div>
              <div className="text-xs text-zinc-400">Shuffle all tracks</div>
            </div>
          </button>

          <button
            onClick={() => {
              onAddToQueue()
              onClose()
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group text-left"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <ListPlus size={20} className="text-green-500" />
            </div>
            <div>
              <div className="font-medium text-white">Add to Queue</div>
              <div className="text-xs text-zinc-400">Add to end of queue</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
