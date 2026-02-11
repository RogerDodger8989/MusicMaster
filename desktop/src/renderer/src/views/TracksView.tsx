import { useState, useMemo } from 'react'
import { Search, LayoutGrid, List, Settings2 } from 'lucide-react'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import { cn } from '../lib/utils'
import TrackList from '../components/TrackList'

export default function TracksView() {
  const { tracks } = useLibrary()
  const {
    tracksViewMode, setTracksViewMode,
    tracksColumns, setTracksColumns,
    sortField, setSortField,
    sortOrder, setSortOrder
  } = useSettings()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTracks = useMemo(() => {
    let result = tracks

    // 1. Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      )
    }

    // 2. Sort
    return [...result].sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      // Handle specific fields
      if (sortField === 'artist') {
        valA = a.artist || a.albumArtist || ''
        valB = b.artist || b.albumArtist || ''
      }
      else if (sortField === 'album') {
        valA = a.album || ''
        valB = b.album || ''
      } else if (sortField === 'year') {
        valA = a.year || 0
        valB = b.year || 0
      } else if (sortField === 'playCount') {
        valA = a.playCount || 0
        valB = b.playCount || 0
      } else if (sortField === 'rating') {
        valA = a.rating || 0
        valB = b.rating || 0
      } else if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      }

      // Fallback for strings
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      // Fallback for numbers
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA
      }

      return 0
    })
  }, [tracks, searchQuery, sortField, sortOrder])

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">Tracks</h2>
            <p className="text-zinc-500 text-sm mt-1">
              {filteredTracks.length} tracks in your library
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggles */}
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setTracksViewMode('list')}
              className={cn(
                "p-2 rounded-md transition-all",
                tracksViewMode === 'list' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTracksViewMode('grid')}
              className={cn(
                "p-2 rounded-md transition-all",
                tracksViewMode === 'grid' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Grid View (Cards)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Column Settings (List Mode only) */}
          {tracksViewMode === 'list' && (
            <div className="relative group">
              <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
              {/* Popover */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 hidden group-hover:block z-50">
                <div className="text-xs font-medium text-zinc-500 px-2 py-1 uppercase tracking-wider mb-1">Columns</div>
                {[
                  { id: 'title', label: 'Title' },
                  { id: 'artist', label: 'Artist' },
                  { id: 'album', label: 'Album' },
                  { id: 'vibe', label: 'Vibe' },
                  { id: 'played', label: 'Played' },
                  { id: 'rating', label: 'Rating' },
                  { id: 'time', label: 'Time' },
                ].map(col => (
                  <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={tracksColumns.includes(col.id)}
                      onChange={() => {
                        const newCols = tracksColumns.includes(col.id)
                          ? tracksColumns.filter(c => c !== col.id)
                          : [...tracksColumns, col.id]
                        setTracksColumns(newCols)
                      }}
                      className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="relative w-full md:w-64" onClick={(e) => e.stopPropagation()}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>
        </div>
      </div>

      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <TrackList
          tracks={filteredTracks}
          viewMode={tracksViewMode}
          visibleColumns={tracksColumns}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={(field) => {
            if (sortField === field) {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            } else {
              setSortField(field)
              setSortOrder('asc')
            }
          }}
        />
      </div>

    </div>
  )
}
