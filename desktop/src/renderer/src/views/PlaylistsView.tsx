import { ListMusic, Play, Trash2, Plus, Sparkles, Search, Settings2, Download, Share2 } from 'lucide-react'
import { usePlaylists, Playlist } from '../store/playlists'
import { useSmartPlaylists, SmartPlaylist } from '../store/smartPlaylists'
import { usePlayer } from '../store/player'
import { useDJ } from '../store/dj'
import { useEffect, useState, useMemo } from 'react'
import { cn } from '../lib/utils'
import { PlaylistMosaic } from '../components/PlaylistMosaic'
import { useTrackSelection } from '../hooks/useTrackSelection'
import { PageHeader } from '../components/PageHeader'
import SmartPlaylistBuilder from '../components/SmartPlaylistBuilder'
import { useNavigation } from '../store/navigation'
import TrackList from '../components/TrackList'

interface PlaylistsViewProps {
  playlistId?: string
}

export default function PlaylistsView({ playlistId }: PlaylistsViewProps) {
  const { navigateTo } = useNavigation()
  const {
    playlists: manualPlaylists,
    fetchPlaylists: fetchManual,
    deletePlaylist: deleteManual,
    removeTrackFromPlaylist,
    reorderTracks
  } = usePlaylists()

  const {
    playlists: smartPlaylists,
    fetchPlaylists: fetchSmart,
    deletePlaylist: deleteSmart,
    resolvePlaylist
  } = useSmartPlaylists()

  const { playAlbum } = usePlayer()

  const [playlistTracks, setPlaylistTracks] = useState<any[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'smart' | 'manual'>('all')
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [editingSmartPlaylist, setEditingSmartPlaylist] = useState<SmartPlaylist | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingType, setDeletingType] = useState<'manual' | 'smart'>('manual')

  useEffect(() => {
    fetchManual()
    fetchSmart()
  }, [fetchManual, fetchSmart])

  // Sync selectedPlaylist with prop
  const selectedPlaylist = useMemo(() => {
    return (
      manualPlaylists.find((p) => p.id === playlistId) ||
      smartPlaylists.find((p) => p.id === playlistId) ||
      null
    )
  }, [playlistId, manualPlaylists, smartPlaylists])

  // Load tracks when a playlist is selected
  useEffect(() => {
    if (!selectedPlaylist) {
      setPlaylistTracks([])
      return
    }

    if ('rules' in selectedPlaylist) {
      // Smart playlist
      setTracksLoading(true)
      resolvePlaylist(selectedPlaylist.id).then((tracks) => {
        setPlaylistTracks(tracks)
        setTracksLoading(false)
      })
    } else {
      // Manual playlist
      setPlaylistTracks(selectedPlaylist.tracks || [])
    }
  }, [selectedPlaylist, resolvePlaylist])

  useTrackSelection(playlistTracks)

  const filteredPlaylists = useMemo(() => {
    const manual = manualPlaylists.map((p) => ({ ...p, type: 'manual' as const }))
    const smart = smartPlaylists.map((p) => ({ ...p, type: 'smart' as const }))

    let combined = [...manual, ...smart]

    // Inject virtual DJ playlist
    if (filterTab === 'all' || filterTab === 'smart') {
      combined.unshift({
        id: 'virtual-dj',
        name: 'AI DJ',
        description: 'Your personal AI host kurerar din musik i realtid.',
        type: 'smart',
        trackCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rules: [],
        limitRandom: true,
        sortField: 'added',
        sortOrder: 'desc'
      } as any)
    }

    if (filterTab === 'manual') combined = manual
    if (filterTab === 'smart') combined = smart

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      combined = combined.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }

    return combined.sort((a, b) => a.name.localeCompare(b.name))
  }, [manualPlaylists, smartPlaylists, filterTab, searchQuery])

  const handleDelete = async (id: string, type: 'manual' | 'smart') => {
    if (type === 'manual') await deleteManual(id)
    else await deleteSmart(id)

    if (playlistId === id) navigateTo('playlists')
    setShowDeleteConfirm(false)
    setDeletingId(null)
  }

  const handlePlayPlaylist = async (p: Playlist | SmartPlaylist | any) => {
    if (p.id === 'virtual-dj') {
      await useDJ.getState().startDJ()
      return
    }

    let tracks: any[] = []
    if ('rules' in p) {
      setTracksLoading(true)
      tracks = await resolvePlaylist(p.id)
      setTracksLoading(false)
    } else {
      tracks = p.tracks
    }
    if (tracks.length > 0) {
      playAlbum(tracks, 0)
    }
  }

  const handleEditSmart = (p: SmartPlaylist) => {
    setEditingSmartPlaylist(p)
    setIsBuilderOpen(true)
  }

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!selectedPlaylist || 'rules' in selectedPlaylist) return
    const newTracks = Array.from(selectedPlaylist.tracks)
    const [removed] = newTracks.splice(fromIndex, 1)
    newTracks.splice(toIndex, 0, removed)

    const trackIds = newTracks.map((t) => t.id)
    await reorderTracks(selectedPlaylist.id, trackIds)
  }

  const handleRemoveTrack = async (trackId: string, position: number) => {
    if (selectedPlaylist && !('rules' in selectedPlaylist)) {
      await removeTrackFromPlaylist(selectedPlaylist.id, trackId, position)
      fetchManual()
    }
  }

  const handlePlaylistClick = (id: string) => {
    navigateTo('playlists', { playlistId: id })
  }

  const handleConvertToManual = async () => {
    if (!selectedPlaylist || !('rules' in selectedPlaylist)) return
    const name = `${selectedPlaylist.name} (Copy)`
    const trackIds = playlistTracks.map((t) => t.id)
    const id = await usePlaylists.getState().createPlaylist(name, trackIds)
    if (id) {
      navigateTo('playlists', { playlistId: id })
    }
  }

  const handleExportM3U8 = () => {
    if (!selectedPlaylist || playlistTracks.length === 0) return

    let content = '#EXTM3U\n'
    playlistTracks.forEach((track) => {
      content += `#EXTINF:${Math.round(track.duration)},${track.artist} - ${track.title}\n`
      content += `${track.filePath}\n`
    })

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedPlaylist.name}.m3u8`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (selectedPlaylist) {
    if (selectedPlaylist.id === 'virtual-dj') {
      navigateTo('home')
      return null
    }

    const isSmart = 'rules' in selectedPlaylist
    return (
      <div className="h-full flex flex-col bg-zinc-950">
        <PageHeader
          icon={isSmart ? Sparkles : ListMusic}
          iconColor={isSmart ? 'text-blue-400' : 'text-zinc-400'}
          title={selectedPlaylist.name}
          subtitle={selectedPlaylist.description || (isSmart ? 'Smart Playlist' : 'Manual Playlist')}
          count={playlistTracks.length}
        >
          <button
            onClick={handleExportM3U8}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-all font-medium text-sm"
            title="Export to M3U8"
          >
            <Download size={16} /> Export
          </button>
          {isSmart && (
            <>
              <button
                onClick={() => handleEditSmart(selectedPlaylist as SmartPlaylist)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-all font-medium text-sm"
              >
                <Settings2 size={16} /> Edit Rules
              </button>
              <button
                onClick={handleConvertToManual}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl transition-all font-medium text-sm"
                title="Convert to manual playlist"
              >
                <Share2 size={16} /> Convert
              </button>
            </>
          )}
          <button
            onClick={() => handlePlayPlaylist(selectedPlaylist)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-900/40"
          >
            <Play size={18} fill="currentColor" /> Play
          </button>
        </PageHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {tracksLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600 space-y-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Updating list...</p>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
              <ListMusic size={60} strokeWidth={1} />
              <p className="text-lg">No tracks match this playlist</p>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0">
              <TrackList
                tracks={playlistTracks}
                isReorderable={!isSmart}
                onReorder={handleReorder}
                onRemove={!isSmart ? handleRemoveTrack : undefined}
              />
            </div>
          )}
        </div>

        <style>{`
          @keyframes music-bar {
            0%, 100% { height: 4px; }
            50% { height: 12px; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <PageHeader
        icon={ListMusic}
        iconColor="text-blue-400"
        title="Playlists"
        subtitle="Manage and play your custom collections"
        count={filteredPlaylists.length}
      >
        <div className="flex items-center gap-4 h-full">
          <div className="relative group flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-sm rounded-xl pl-10 pr-4 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:w-64 transition-all placeholder:text-zinc-600"
            />
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
            {(['all', 'smart', 'manual'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize',
                  filterTab === tab
                    ? 'bg-zinc-800 text-white shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setEditingSmartPlaylist(null)
              setIsBuilderOpen(true)
            }}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-all font-bold text-sm shrink-0 border border-blue-600/20"
          >
            <Sparkles size={16} /> New Smart
          </button>
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('request-create-playlist', { detail: { trackIds: [] } })
              )
            }
            className="flex items-center gap-2 px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all font-bold text-sm shrink-0 border border-zinc-800"
          >
            <Plus size={16} /> New Manual
          </button>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {filteredPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl text-center space-y-4">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
              <Search size={40} />
            </div>
            <div className="max-w-sm">
              <h3 className="text-xl font-bold text-white">No playlists found</h3>
              <p className="text-zinc-500 mt-2">Try adjusting your search or filter settings.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {filteredPlaylists.map((pl) => (
              <div
                key={pl.id}
                className="group relative bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 hover:bg-zinc-800/60 transition-all cursor-pointer hover:border-zinc-700 shadow-xl space-y-4"
                onClick={() => handlePlaylistClick(pl.id)}
              >
                <div className="relative">
                  <PlaylistMosaic
                    tracks={'tracks' in pl ? pl.tracks : []}
                    size="md"
                    className="w-full aspect-square"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayPlaylist(pl)
                      }}
                      className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all text-white"
                    >
                      <Play size={24} fill="currentColor" />
                    </button>
                  </div>
                  {pl.type === 'smart' && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white p-1.5 rounded-lg shadow-lg">
                      <Sparkles size={14} />
                    </div>
                  )}
                  {pl.id === 'virtual-dj' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-purple-600/40 to-cyan-600/40 animate-pulse rounded-xl" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    {pl.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-bold">
                      {pl.id === 'virtual-dj' ? 'AI Session' : (pl.type === 'smart'
                        ? `${pl.trackCount ?? 0} tracks`
                        : `${pl.tracks.length} tracks`)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {pl.type === 'smart' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditSmart(pl as SmartPlaylist)
                          }}
                          className="p-1.5 text-zinc-500 hover:text-blue-400 transition-all rounded-lg hover:bg-blue-400/10"
                        >
                          <Settings2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingId(pl.id)
                          setDeletingType(pl.type)
                          setShowDeleteConfirm(true)
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl relative w-full max-w-[320px] animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h4 className="text-white text-xl font-bold mb-2">Delete playlist?</h4>
              <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                This will permanently delete "{filteredPlaylists.find((p) => p.id === deletingId)?.name}
                ".
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => deletingId && handleDelete(deletingId, deletingType)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isBuilderOpen && (
        <SmartPlaylistBuilder
          existingPlaylist={editingSmartPlaylist}
          onClose={() => {
            setIsBuilderOpen(false)
            setEditingSmartPlaylist(null)
          }}
          onSaved={() => {
            fetchSmart()
          }}
        />
      )}
    </div>
  )
}
