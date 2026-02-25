import { AlertCircle, Play, ListPlus, X } from 'lucide-react'
import { useDraggable } from '../hooks/useDraggable'

interface QueueConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onReplace: () => void
  onAppend: () => void
  title?: string
  message?: string
}

export function QueueConfirmationModal({
  isOpen,
  onClose,
  onReplace,
  onAppend,
  title = 'Clear Playlist?',
  message = 'Your playlist is not empty. Would you like to clear it and play these tracks, or just add them to the end?'
}: QueueConfirmationModalProps) {
  const { position, handleMouseDown } = useDraggable()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
      <div
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`
        }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto absolute"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Draggable Area */}
        <div
          className="cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          {/* Header with Icon */}
          <div className="p-6 pb-4 flex items-start gap-4">
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-2 flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-[0.98] group"
          >
            <Play
              size={18}
              fill="currentColor"
              className="group-hover:scale-110 transition-transform"
            />
            Clear & Play Now
          </button>

          <button
            onClick={onAppend}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            <ListPlus size={18} />
            Add to End of Queue
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 text-sm font-medium text-zinc-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
