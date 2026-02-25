import { useState, useEffect } from 'react'
import { Search, X, Check, Save, Info, Music2, User, Disc, Loader2, ExternalLink, ListMusic, AlertTriangle, Minus } from 'lucide-react'
import { Track, Album } from '../types'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'
import { client } from '../api/client'

interface TaggingModalProps {
  isOpen: boolean
  onClose: () => void
  item: Track | Album | null
  itemType: 'track' | 'album'
  onSave: (id: string, metadata: any, type: 'track' | 'album') => Promise<void>
}

export default function TaggingModal({
  isOpen,
  onClose,
  item,
  itemType,
  onSave
}: TaggingModalProps) {
  const [searchTitle, setSearchTitle] = useState('')
  const [searchArtist, setSearchArtist] = useState('')
  const [searchAlbum, setSearchAlbum] = useState('')
  const [searchMbid, setSearchMbid] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [matches, setMatches] = useState<any[]>([])
  const [albumDetails, setAlbumDetails] = useState<any | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  const currentTrackMbid = item && itemType === 'track' ? (item as any).musicbrainzTrackId : null;
  const currentAlbumMbid = item ? (item as any).musicbrainzAlbumId : null;

  const { position, handleMouseDown } = useDraggable()

  useEffect(() => {
    if (item && isOpen) {
      if (itemType === 'track') {
        const track = item as Track
        setSearchTitle(track.title)
        setSearchArtist(track.artist)
        setSearchAlbum(track.album)
        handleSearch('track', track.artist, track.title, track.album)
      } else {
        const album = item as Album
        setSearchArtist(album.artist)
        setSearchAlbum(album.name)
        handleSearch('album', album.artist, '', album.name)
      }
    } else {
      setResults([])
      setSelectedResult(null)
      setMatches([])
    }
  }, [item, isOpen, itemType])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // Use capture phase to intercept the event before App.tsx window listener
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [onClose])

  useEffect(() => {
    const fetchPreview = async () => {
      if (itemType === 'album' && item && selectedResult) {
        setIsPreviewLoading(true)
        try {
          const matchData = await client.previewMatchAlbum(item.id, selectedResult.id)
          if (Array.isArray(matchData)) {
            setMatches(matchData)
            setAlbumDetails(null)
          } else {
            setMatches((matchData as any).matches || [])
            setAlbumDetails((matchData as any).album || null)
          }
        } catch (error) {
          console.error('Failed to fetch match preview:', error)
          setMatches([])
          setAlbumDetails(null)
        } finally {
          setIsPreviewLoading(false)
        }
      } else {
        setMatches([])
        setAlbumDetails(null)
      }
    }
    fetchPreview()
  }, [selectedResult, itemType, item])

  const handleSearch = async (
    type?: 'track' | 'album',
    artist?: string,
    title?: string,
    album?: string,
    mbid?: string
  ) => {
    const qType = type || itemType
    const qArtist = artist !== undefined ? artist : searchArtist
    const qTitle = title !== undefined ? title : searchTitle
    const qAlbum = album !== undefined ? album : searchAlbum
    const qMbid = mbid !== undefined ? mbid : searchMbid

    setIsSearching(true)
    setSelectedResult(null)
    setError(null)
    try {
      let mbidResults: any[] = []
      if (qType === 'track') {
        mbidResults = await client.searchMetadata(qArtist, qTitle, qAlbum, qMbid, currentTrackMbid, currentAlbumMbid)
      } else {
        mbidResults = await client.searchAlbums(qArtist, qAlbum || '', qMbid, currentAlbumMbid)
      }
      setResults(mbidResults)

      // Pre-select if item already has MusicBrainz ID
      if (item && mbidResults.length > 0) {
        const existingMbid = item.musicbrainzAlbumId || (item as any).musicbrainzTrackId
        if (existingMbid) {
          const match = mbidResults.find(r => r.id === existingMbid)
          if (match) {
            setSelectedResult(match)
          }
        }
      }
    } catch (err: any) {
      console.error('MB Search failed:', err)
      setError(err.message || 'Failed to search MusicBrainz. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSave = async () => {
    if (!item || !selectedResult) return
    setIsSaving(true)
    try {
      const metadata = itemType === 'album' ? (albumDetails || selectedResult) : selectedResult
      await onSave(item.id, metadata, itemType)
      onClose()
    } catch (error) {
      console.error('Failed to save metadata:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !item) return null

  const showPreview = itemType === 'album' && selectedResult

  const sortedResults = [...results].sort((a, b) => {
    let aScore = 0;
    let bScore = 0;
    if (currentTrackMbid && a.id === currentTrackMbid) aScore += 2;
    if (currentAlbumMbid && (a.albumId === currentAlbumMbid || a.id === currentAlbumMbid)) aScore += 2;
    if (currentTrackMbid && b.id === currentTrackMbid) bScore += 2;
    if (currentAlbumMbid && (b.albumId === currentAlbumMbid || b.id === currentAlbumMbid)) bScore += 2;
    return bScore - aScore;
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 pointer-events-auto animate-in fade-in duration-200">
      <div
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className={cn(
          "bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300",
          showPreview ? "max-w-6xl" : "max-w-4xl",
          "max-h-[85vh]"
        )}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Identify {itemType === 'track' ? 'Track' : 'Album'}
              </h2>
              <p className="text-xs text-zinc-500">Match with MusicBrainz metadata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Search & Original */}
          <div className={cn(
            "border-r border-zinc-800 p-6 flex flex-col gap-6 bg-zinc-900/50 transition-all",
            showPreview ? "w-1/4" : "w-1/3"
          )}>
            <section>
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">
                Current Metadata
              </h3>
              <div className="space-y-2 text-sm">
                {itemType === 'track' ? (
                  <>
                    <div className="flex items-center gap-2 text-white">
                      <Music2 size={14} className="text-zinc-500" />
                      <span className="truncate">{(item as Track).title}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center gap-2 text-zinc-400">
                  <User size={14} className="text-zinc-500" />
                  <span className="truncate">{item.artist}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Disc size={14} className="text-zinc-500" />
                  <span className="truncate">
                    {itemType === 'track' ? (item as Track).album : (item as Album).name}
                  </span>
                </div>
                {itemType === 'album' && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <ListMusic size={14} className="text-zinc-500" />
                    <span className="truncate">{(item as Album).trackCount || '?'} Tracks</span>
                  </div>
                )}
                {(itemType === 'track' && (item as Track).musicbrainzTrackId) ? (
                  <div className="flex items-center gap-2 text-blue-400 text-[10px] font-mono mt-2 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">
                    <Check size={10} />
                    <span className="truncate">Track MBID Found: {(item as Track).musicbrainzTrackId}</span>
                  </div>
                ) : null}
                {item.musicbrainzAlbumId ? (
                  <div className="flex items-center gap-2 text-purple-400 text-[10px] font-mono mt-1 bg-purple-400/10 px-2 py-1 rounded border border-purple-400/20">
                    <Check size={10} />
                    <span className="truncate">Album MBID Found: {item.musicbrainzAlbumId}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">
                Search MusicBrainz
              </h3>
              <div className="space-y-3">
                {itemType === 'track' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Title</label>
                    <input
                      type="text"
                      value={searchTitle}
                      onChange={(e) => setSearchTitle(e.target.value)}
                      placeholder="Track title"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Artist</label>
                  <input
                    type="text"
                    value={searchArtist}
                    onChange={(e) => setSearchArtist(e.target.value)}
                    placeholder="Artist name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Album</label>
                  <input
                    type="text"
                    value={searchAlbum}
                    onChange={(e) => setSearchAlbum(e.target.value)}
                    placeholder="Album name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">MusicBrainz ID (Optional)</label>
                  <input
                    type="text"
                    value={searchMbid}
                    onChange={(e) => setSearchMbid(e.target.value)}
                    placeholder="e.g. 5a1b3... or paste URL"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                  />
                </div>
                <button
                  onClick={() => handleSearch(itemType, searchArtist, searchTitle, searchAlbum, searchMbid)}
                  disabled={isSearching}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
                {error && (
                  <div className="mt-2 text-red-500 text-xs text-center">
                    {error}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Middle: Results */}
          <div className={cn(
            "flex-col overflow-hidden bg-black/20 transition-all flex",
            showPreview ? "w-2/5 border-r border-zinc-800" : "flex-1"
          )}>
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                {results.length} Suggestions Found
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2">
              {isSearching ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-sm">Fetching MusicBrainz results...</p>
                </div>
              ) : sortedResults.length > 0 ? (
                sortedResults.map((res) => {
                  const isTrackMatch = currentTrackMbid && res.id === currentTrackMbid;
                  const isAlbumMatch = currentAlbumMbid && (res.albumId === currentAlbumMbid || res.id === currentAlbumMbid);
                  const isPerfectMatch = isTrackMatch && isAlbumMatch;

                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={res.id}
                      onClick={() => setSelectedResult(res)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedResult(res)
                        }
                      }}
                      className={cn(
                        'w-full text-left p-4 rounded-xl border transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        selectedResult?.id === res.id
                          ? 'bg-blue-600/10 border-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                          : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/50 group-hover:border-zinc-600 transition-colors">
                          {res.coverArt ? (
                            <img src={res.coverArt} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Disc size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white truncate text-base">
                              {res.title || res.album}
                            </span>
                            {selectedResult?.id === res.id && (
                              <Check size={14} className="text-blue-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-zinc-400">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User size={12} className="text-zinc-500 shrink-0" />
                              <span className="truncate">{res.artist}</span>
                            </div>
                            {itemType === 'track' && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Disc size={12} className="text-zinc-500 shrink-0" />
                                <span className="truncate">{res.album}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-3 text-[10px] text-zinc-500 font-mono">
                            {isPerfectMatch && (
                              <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                <Check size={10} /> Saved Match
                              </span>
                            )}
                            {!isPerfectMatch && isTrackMatch && (
                              <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                <Check size={10} /> Track Matched
                              </span>
                            )}
                            {!isPerfectMatch && isAlbumMatch && (
                              <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                <Check size={10} /> Album Matched
                              </span>
                            )}
                            {res.releaseDate && <span>📅 {res.releaseDate}</span>}
                            {res.country && <span className="flex items-center gap-1">🌍 {res.country}</span>}
                            {itemType === 'track' && res.trackNum && <span># {res.trackNum}</span>}
                            {itemType === 'album' && res.trackCount && (
                              <span>🎵 {res.trackCount} Tracks</span>
                            )}
                            {res.media && <span className="flex items-center gap-1">💿 {res.media}</span>}
                            {res.label && <span className="truncate max-w-[120px]">🏢 {res.label}</span>}
                            <span className="truncate text-zinc-400">ID: {res.id.split('-')[0]}...</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const mbid = itemType === 'track' && res.albumId ? res.albumId : res.id
                            const mbType = (itemType === 'track' && res.albumId) || itemType === 'album' ? 'release' : 'recording'
                            window.open(`https://musicbrainz.org/${mbType}/${mbid}`, '_blank')
                          }}
                          title="View on MusicBrainz"
                          className="p-3 ml-4 rounded-[10px] text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/80 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <ExternalLink size={18} />
                        </button >
                      </div >
                    </div >
                  )
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 opacity-50">
                  <Search size={48} className="text-zinc-800" />
                  <p className="text-sm">No results found. Try adjusting your search query.</p>
                </div>
              )}
            </div >
          </div >

          {/* Right: Preview (Only for albums) */}
          {
            showPreview && (
              <div className="w-[35%] flex flex-col overflow-hidden bg-black/40 animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    Track Matching Preview
                  </h3>
                  {isPreviewLoading && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {isPreviewLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      <p className="text-xs">Analyzing matches...</p>
                    </div>
                  ) : (
                    <div className="space-y-1 h-full">
                      {matches.length === 0 ? (
                        <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-zinc-500 gap-3 py-8 opacity-60">
                          <ListMusic className="w-8 h-8" />
                          <p className="text-xs text-center px-4">No track matching data returned for this release.</p>
                        </div>
                      ) : (
                        matches.map((m: any, i: number) => {
                          const isNameSimilar = m.localTrack ? (
                            m.localTrack.title.toLowerCase().includes(m.mbTrack.title.toLowerCase()) ||
                            m.mbTrack.title.toLowerCase().includes(m.localTrack.title.toLowerCase())
                          ) : false;
                          const isNumberMatchOnly = m.matchType === 'number' && !isNameSimilar;

                          return (
                            <div key={i} className="bg-zinc-800/40 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                              <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                                {m.mbTrack.number || i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{m.mbTrack.title}</p>
                                {m.localTrack ? (
                                  <p className={cn("text-xs flex items-center gap-1", isNumberMatchOnly ? "text-amber-500" : "text-emerald-500/80")}>
                                    {isNumberMatchOnly ? <AlertTriangle size={10} /> : <Check size={10} />}
                                    {isNumberMatchOnly ? 'Name Mismatch:' : 'Matched:'} {m.localTrack.title}
                                  </p>
                                ) : (
                                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                                    <Minus size={10} /> Missing in local library
                                  </p>
                                )}
                              </div>
                              {m.localTrack && (
                                <span className={cn("text-[8px] uppercase tracking-wider font-bold ml-auto shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded",
                                  isNumberMatchOnly ? "text-amber-500 bg-amber-500/10 border border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
                                )}>
                                  {isNumberMatchOnly ? 'WARN' : 'MATCH'}
                                </span>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          }
        </div >

        {/* Footer */}
        < div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between" >
          <div className="text-xs text-zinc-500 max-w-md">
            {selectedResult ? (
              <span className="text-blue-400 font-medium">
                Ready to update {itemType === 'track' ? 'tags' : 'album & tracks'} with selected
                MusicBrainz entry.
              </span>
            ) : (
              'Select a suggestion from the list to apply metadata.'
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedResult || isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-95"
            >
              <Save size={18} />
              {isSaving ? 'Syncing...' : 'Sync Metadata'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
