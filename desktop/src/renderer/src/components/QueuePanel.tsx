import {
  X,
  ListMusic,
  Save,
  Trash2,
  Shuffle,
  GripVertical,
  Play,
  Pause,
  Heart,
  Clock
} from 'lucide-react'
import { RatingStars } from './RatingStars'
import { usePlayer } from '../store/player'
import { usePlaylists } from '../store/playlists'
import { useLibrary } from '../store/library'
import { cn } from '../lib/utils'
import { formatDuration } from '../utils/format'
import { useState, useEffect } from 'react'
import { useDraggable } from '../hooks/useDraggable'
import { client } from '../api/client'

interface QueuePanelProps {
  isOpen: boolean
  width: number
  onClose: () => void
  selectedTrackIndex?: number | null
  onTrackSelect?: (index: number | null) => void
}

type Tab = 'queue' | 'played'

export default function QueuePanel({
  isOpen,
  width,
  onClose,
  selectedTrackIndex,
  onTrackSelect
}: QueuePanelProps) {
  const {
    queue,
    isPlaying,
    playAlbum,
    currentIndex,
    setQueue,
    clearQueue,
    shuffleSubsequent,
    togglePlay,
    playFromQueueAndCleanup,
    history,
    reorderQueue,
    insertToQueue
  } = usePlayer()
  const { createPlaylist, playlists } = usePlaylists()
  const { albums, toggleLoved, rateTrack } = useLibrary()

  const [activeTab, setActiveTab] = useState<Tab>('queue')
  const [playlistName, setPlaylistName] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const clearDrag = useDraggable()
  const saveDrag = useDraggable()
  const loadDrag = useDraggable()
  const deleteDrag = useDraggable()

  // Handle Delete key press
  useEffect(() => {
    if (!isOpen || activeTab !== 'queue' || selectedTrackIndex === null) return

    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        e.preventDefault()
        setShowDeleteConfirm(true)
      }
    }

    window.addEventListener('keydown', handleDeleteKey)
    return () => window.removeEventListener('keydown', handleDeleteKey)
  }, [isOpen, activeTab, selectedTrackIndex])

  // Handle Enter/Escape for delete modal
  useEffect(() => {
    if (!showDeleteConfirm || selectedTrackIndex === null || selectedTrackIndex === undefined)
      return

    const handleModal = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleDeleteTrack(selectedTrackIndex)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowDeleteConfirm(false)
      }
    }

    window.addEventListener('keydown', handleModal)
    return () => window.removeEventListener('keydown', handleModal)
  }, [showDeleteConfirm, selectedTrackIndex])

  if (!isOpen) return null

  const handleSaveQueue = async () => {
    if (!playlistName.trim() || queue.length === 0) return
    const trackIds = queue.map((t) => t.id)
    await createPlaylist(playlistName.trim(), trackIds)
    setPlaylistName('')
  }

  const handleDeleteTrack = (index: number) => {
    const newQueue = queue.filter((_, i) => i !== index)
    setQueue(newQueue)
    setShowDeleteConfirm(false)
    onTrackSelect?.(null)
  }

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIndex !== null) {
      e.dataTransfer.dropEffect = 'move'
    } else {
      e.dataTransfer.dropEffect = 'copy'
    }
    // If index is undefined, we are dropping at the end
    setDropTargetIndex(index ?? queue.length)
  }

  const handleDrop = async (index: number, e?: React.DragEvent) => {
    // Internal Reorder
    if (draggedIndex !== null) {
      if (draggedIndex === index) {
        setDraggedIndex(null)
        setDropTargetIndex(null)
        return
      }
      reorderQueue(draggedIndex, index)
      setDraggedIndex(null)
      setDropTargetIndex(null)
    }
    // External Drop
    else if (e) {
      e.preventDefault()
      setDropTargetIndex(null)
      try {
        const json = e.dataTransfer.getData('application/json')
        if (!json) return
        const data = JSON.parse(json)

        if (data.type === 'album_ref') {
          const tracks = await (window as any).api.tracks.getTracksByAlbum(data.name, data.artist)
          if (tracks && tracks.length) insertToQueue(tracks, index)
        } else if (data.type === 'album' && Array.isArray(data.data)) {
          insertToQueue(data.data, index)
        } else if (data.type === 'tracks' && Array.isArray(data.data)) {
          insertToQueue(data.data, index)
        }
      } catch (err) {
        console.error('Failed to parse drop data:', err)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, track: any) => {
    e.preventDefault()
    window.dispatchEvent(
      new CustomEvent('show-track-context-menu', {
        detail: { track, x: e.clientX, y: e.clientY }
      })
    )
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Create invisible drag image for cleaner look if desired
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="h-full bg-zinc-950 border-l border-zinc-800 flex flex-col relative z-40"
    >
      {/* Header / Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            'flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors',
            activeTab === 'queue'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Queue ({queue.length})
        </button>
        <button
          onClick={() => setActiveTab('played')}
          className={cn(
            'flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors',
            activeTab === 'played'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Played
        </button>
        <button onClick={onClose} className="px-4 text-zinc-500 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Actions Bar */}
      {activeTab === 'queue' && queue.length > 0 && (
        <div className="p-3 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={shuffleSubsequent}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
              title="Shuffle remaining tracks"
            >
              <Shuffle size={16} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
              title="Save queue as playlist"
            >
              <Save size={16} />
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
              title="Load from playlist"
            >
              <Clock size={16} />
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 bg-zinc-900 hover:bg-red-900/20 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
              title="Clear queue"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* List Content */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        onDragOver={(e) => activeTab === 'queue' && handleDragOver(e, queue.length)}
        onDrop={(e) => activeTab === 'queue' && handleDrop(queue.length, e)}
      >
        {(activeTab === 'queue' ? queue : history).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-700 space-y-4">
            <ListMusic size={48} className="opacity-10" />
            <p className="text-sm font-medium">
              No tracks {activeTab === 'queue' ? 'in queue' : 'played yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900/50">
            {(activeTab === 'queue' ? queue : history).map((track, idx) => {
              const isCurrentInQueue = activeTab === 'queue' && currentIndex === idx

              return (
                <div
                  key={`${track.id}-${idx}-${activeTab}`}
                  className="relative"
                  onDragOver={(e) => activeTab === 'queue' && handleDragOver(e, idx)}
                  // Stop propagation to prevent container drop from overriding index
                  onDrop={(e) => {
                    if (activeTab === 'queue') {
                      e.stopPropagation()
                      handleDrop(idx, e)
                    }
                  }}
                >
                  {/* Drop Indicator - Above */}
                  {activeTab === 'queue' && dropTargetIndex === idx && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}

                  <div
                    draggable={activeTab === 'queue'}
                    onDragStart={(e) => activeTab === 'queue' && handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => {
                      if (activeTab === 'queue') {
                        playFromQueueAndCleanup(idx)
                      } else {
                        playAlbum([track], 0)
                      }
                    }}
                    onClick={() => {
                      if (activeTab === 'queue') {
                        onTrackSelect?.(selectedTrackIndex === idx ? null : idx)
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, track)}
                    className={cn(
                      'group flex items-center gap-3 p-3 transition-colors relative cursor-pointer',
                      isCurrentInQueue ? 'bg-blue-600/15' : 'hover:bg-white/[0.03]',
                      selectedTrackIndex === idx && 'bg-blue-600/25 border-l-2 border-blue-500',
                      draggedIndex === idx && 'opacity-20 grayscale scale-[0.98]',
                      dropTargetIndex === idx && 'bg-blue-500/5'
                    )}
                  >
                    {/* Grip Handle (Only for Queue) */}
                    {activeTab === 'queue' && (
                      <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-zinc-700">
                        <GripVertical size={14} />
                      </div>
                    )}

                    {/* Cover Interaction */}
                    <div
                      className="relative w-12 h-12 bg-zinc-900 rounded overflow-hidden flex-shrink-0 cursor-pointer shadow-lg border border-zinc-800/50"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isCurrentInQueue) {
                          togglePlay()
                        } else {
                          if (activeTab === 'queue') {
                            playFromQueueAndCleanup(idx)
                          } else {
                            playAlbum([track], 0)
                          }
                        }
                      }}
                    >
                      {(() => {
                        const albumId = albums.find(
                          (a) =>
                            a.name === track.album &&
                            a.artist === (track.albumArtist || track.artist)
                        )?.id
                        const coverUrl = client.getCoverUrl(albumId || '')

                        return (
                          <img
                            src={coverUrl}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              ; (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )
                      })()}

                      {/* Overlays */}
                      {isCurrentInQueue && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          {isPlaying ? (
                            <Pause size={16} fill="white" />
                          ) : (
                            <Play size={16} fill="white" />
                          )}
                        </div>
                      )}
                      {!isCurrentInQueue && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play size={16} fill="white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div
                        className={cn(
                          'text-[13px] font-bold truncate leading-tight',
                          isCurrentInQueue ? 'text-blue-500' : 'text-zinc-200'
                        )}
                      >
                        {track.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate font-medium">
                        {track.artist}
                      </div>

                      {/* Rating & Love Row */}
                      <div className="flex items-center gap-3 pt-0.5 transition-opacity">
                        <RatingStars
                          rating={track.rating}
                          onChange={(r) => rateTrack(track.id, r)}
                          size={10}
                        />
                        <Heart
                          size={10}
                          className={cn(
                            'cursor-pointer transition-colors',
                            track.loved
                              ? 'text-red-500 fill-current'
                              : 'text-zinc-800 hover:text-red-500/50'
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLoved(track.id)
                          }}
                        />
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-[10px] font-bold text-zinc-700 tabular-nums">
                      {formatDuration(track.duration)}
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Append Indicator */}
            {activeTab === 'queue' && dropTargetIndex === queue.length && (
              <div className="h-0.5 bg-blue-500 mx-2 my-1 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}
          </div>
        )}
      </div>

      {/* Delete Track Confirmation */}
      {showDeleteConfirm && selectedTrackIndex !== null && selectedTrackIndex !== undefined && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center">
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
          <div
            style={{
              transform: `translate(${deleteDrag.position.x}px, ${deleteDrag.position.y}px)`
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative pointer-events-auto w-full max-w-[280px]"
          >
            <h4
              className="text-white font-bold mb-2 cursor-move"
              onMouseDown={deleteDrag.handleMouseDown}
            >
              Delete Track?
            </h4>
            <p className="text-zinc-500 text-xs mb-2 leading-relaxed">
              {queue[selectedTrackIndex]?.title || 'Unknown Track'}
            </p>
            <p className="text-zinc-600 text-xs mb-6 leading-relaxed">
              Remove this track from your queue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (selectedTrackIndex !== null && selectedTrackIndex !== undefined) {
                    handleDeleteTrack(selectedTrackIndex)
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Queue Confirmation */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center">
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
          <div
            style={{ transform: `translate(${clearDrag.position.x}px, ${clearDrag.position.y}px)` }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative pointer-events-auto w-full max-w-[280px]"
          >
            <h4
              className="text-white font-bold mb-2 cursor-move"
              onMouseDown={clearDrag.handleMouseDown}
            >
              Clear Queue?
            </h4>
            <p className="text-zinc-500 text-xs mb-6 leading-relaxed">
              This will remove all tracks from your playback queue. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  clearQueue()
                  setShowClearConfirm(false)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Playlist Modal */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
          <div
            style={{ transform: `translate(${saveDrag.position.x}px, ${saveDrag.position.y}px)` }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative pointer-events-auto w-full max-w-[280px]"
          >
            <h4
              className="text-white font-bold mb-2 cursor-move"
              onMouseDown={saveDrag.handleMouseDown}
            >
              Save Queue
            </h4>
            <p className="text-zinc-500 text-xs mb-4">Enter a name for your new playlist.</p>
            <input
              type="text"
              autoFocus
              placeholder="Playlist name..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white mb-6 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleSaveQueue()
                  setShowSaveModal(false)
                }}
                disabled={!playlistName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Playlist Modal */}
      {showLoadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />
          <div
            style={{ transform: `translate(${loadDrag.position.x}px, ${loadDrag.position.y}px)` }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl relative pointer-events-auto w-full max-w-[280px] flex flex-col max-h-[80%] overflow-hidden"
          >
            <div className="p-6 pb-2">
              <h4
                className="text-white font-bold mb-2 cursor-move"
                onMouseDown={loadDrag.handleMouseDown}
              >
                Load Playlist
              </h4>
              <p className="text-zinc-500 text-xs">Select a playlist to load into the queue.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
              {playlists.length === 0 ? (
                <p className="text-zinc-600 text-[10px] text-center py-8">No playlists found.</p>
              ) : (
                <div className="space-y-1">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        setQueue(pl.tracks)
                        setShowLoadModal(false)
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 group transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-blue-500">
                        <ListMusic size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-zinc-300 truncate">{pl.name}</div>
                        <div className="text-[10px] text-zinc-600 font-medium">
                          {pl.tracks.length} tracks
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-800/50">
              <button
                onClick={() => setShowLoadModal(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
