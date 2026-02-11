import { useState, useMemo } from 'react'
import { Search, LayoutGrid, List, Settings2, Play, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [isSortOpen, setIsSortOpen] = useState(false)
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
    <div className="h-full flex flex-col bg-background/95">
      {/* Search & Controls Toolbar (Sticky Header matched to AlbumsView) */}
      <div className="flex-shrink-0 bg-background border-b z-20 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Tracks</h1>
            <span className="text-sm text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">
              {filteredTracks.length}
            </span>

            {/* Search Bar */}
            <div className="relative group ml-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Filter tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-900 px-3 py-1.5 pl-10 rounded-md text-sm w-48 md:w-64 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-all shadow-sm"
              >
                <Settings2 className="w-4 h-4" />
                <span className="font-medium">Sort: {sortField.charAt(0).toUpperCase() + sortField.slice(1).replace(/([A-Z])/g, ' $1')}</span>
              </button>

              {isSortOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 mb-1 border-b border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest uppercase">Sort By</span>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded hover:bg-zinc-700 text-zinc-300 transition-colors uppercase"
                      >
                        {sortOrder}
                      </button>
                    </div>
                    {[
                      { id: 'rating', label: 'Highest Rated' },
                      { id: 'playCount', label: 'Most Played' },
                      { id: 'createdAt', label: 'Recently Added' },
                      { id: 'title', label: 'Title (A-Z)' },
                      { id: 'artist', label: 'Artist' },
                      { id: 'album', label: 'Album' },
                      { id: 'year', label: 'Year' },
                      { id: 'duration', label: 'Duration' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortField(opt.id as any)
                          setIsSortOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors",
                          sortField === opt.id ? "bg-primary/20 text-primary" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                      >
                        {opt.label}
                        {sortField === opt.id && (
                          sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
              <button
                onClick={() => setTracksViewMode('list')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  tracksViewMode === 'list' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTracksViewMode('grid')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  tracksViewMode === 'grid' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTracksViewMode('cover')}
                className={cn(
                  "p-1.5 rounded transition-all",
                  tracksViewMode === 'cover' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
                title="Cover View"
              >
                <Play className="w-4 h-4 rotate-90" />
              </button>
            </div>

            {/* Column Visibility (List mode only) */}
            {tracksViewMode === 'list' && (
              <div className="relative group">
                <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md transition-colors shadow-sm">
                  <Settings2 className="w-4 h-4" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-2 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 mb-1 border-b border-zinc-800">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-loose">Columns</span>
                  </div>
                  <div className="space-y-1 py-1">
                    {[
                      { id: 'index', label: 'Index / Status' },
                      { id: 'title', label: 'Title' },
                      { id: 'artist', label: 'Artist' },
                      { id: 'album', label: 'Album' },
                      { id: 'vibe', label: 'Vibe (BPM/Key)' },
                      { id: 'played', label: 'Play Count' },
                      { id: 'rating', label: 'Rating & Loved' },
                      { id: 'time', label: 'Duration' },
                    ].map(col => (
                      <label key={col.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer transition-colors group/row">
                        <input
                          type="checkbox"
                          checked={tracksColumns.includes(col.id)}
                          onChange={() => {
                            const newCols = tracksColumns.includes(col.id)
                              ? tracksColumns.filter(c => c !== col.id)
                              : [...tracksColumns, col.id]
                            setTracksColumns(newCols)
                          }}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs font-medium text-zinc-400 group-hover/row:text-zinc-200">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
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
