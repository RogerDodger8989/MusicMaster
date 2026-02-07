import { useEffect, useRef } from 'react'
import { X, Eye, ArrowUp, ArrowDown } from 'lucide-react'
import { useDraggable } from '../hooks/useDraggable'
import { cn } from '../utils'
import { SortField, SortOrder } from '../types'

interface ViewSettingsProps {
  isOpen: boolean
  onClose: () => void
  viewMode: 'grid' | 'list' | 'cover'
  sortBy: SortField
  sortOrder: SortOrder
  onViewModeChange: (mode: 'grid' | 'list' | 'cover') => void
  onSortChange: (field: SortField, order: SortOrder) => void
  className?: string
}

export function ViewSettings({
  isOpen,
  onClose,
  viewMode,
  sortBy,
  sortOrder,
  onViewModeChange,
  onSortChange,
  className
}: ViewSettingsProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const { position, handleMouseDown } = useDraggable()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-200">
      <div
        ref={modalRef}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className={cn(
          'bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-6 text-white animate-in zoom-in duration-200',
          className
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-zinc-800 pb-3 cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h2 className="font-semibold flex items-center gap-2 text-lg">
            <Eye size={18} className="text-blue-500" />
            View Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* View Mode */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Layout
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['cover', 'grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  'px-3 py-2 text-sm rounded-lg border transition-all capitalize',
                  viewMode === mode
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Sort By
          </label>
          <div className="grid grid-cols-1 gap-2">
            {(['title', 'artist', 'album', 'year', 'duration'] as const).map((field) => (
              <div key={field} className="flex gap-2">
                <button
                  onClick={() => onSortChange(field, sortOrder)}
                  className={cn(
                    'flex-1 px-4 py-2 text-sm rounded-lg border transition-all capitalize text-left',
                    sortBy === field
                      ? 'bg-zinc-800 border-zinc-700 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  )}
                >
                  {field}
                </button>

                {sortBy === field && (
                  <button
                    onClick={() => onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                    title="Toggle Order"
                  >
                    {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
