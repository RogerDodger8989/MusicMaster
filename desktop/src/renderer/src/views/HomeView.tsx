import { useState, useEffect, useMemo, useRef } from 'react'
import { Music2, Plus, Edit2, Trash2, Settings, Check, EyeOff, RotateCcw } from 'lucide-react'
import { VibesButtons, Vibe } from '../components/VibesButtons'
import CustomVibeBuilder, { CustomVibeInput } from '../components/modals/CustomVibeBuilder'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import { client } from '../api/client'
import { DEFAULT_VIBES } from '../constants/defaultVibes'
import { AlbumCard } from '../components/AlbumCard'
import TrackList from '../components/TrackList'
import { useNavigation } from '../store/navigation'
import { cn } from '../utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DJCard } from '../components/DJCard'

interface HomeViewProps { }

interface SectionProps {
  title: string
  children: React.ReactNode
  isVisible: boolean
  isConfigMode: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: () => void
}

const Section = ({
  title,
  children,
  isVisible,
  isConfigMode,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggle
}: SectionProps) => {
  return (
    <div className={cn(
      "mb-12 transition-all p-4 rounded-2xl",
      !isVisible && isConfigMode ? "opacity-40 bg-zinc-950/20 grayscale" : "opacity-100",
      isConfigMode && "border border-white/5 bg-white/2"
    )}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {isConfigMode && (
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1">
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20"
              >
                <ChevronUp size={16} />
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button
                onClick={onMoveDown}
                disabled={isLast}
                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
        </div>

        {isConfigMode && (
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
              isVisible ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
            )}
          >
            {isVisible ? (
              <>
                <Check size={12} />
                Visible
              </>
            ) : (
              <>
                <EyeOff size={12} />
                Hidden
              </>
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * HOME VIEW - Configurable Dashboard
 */
export default function HomeView({ }: HomeViewProps) {
  const { playAlbum } = usePlayer()
  const { albums, tracks } = useLibrary()
  const { visibleSections, homeSectionsOrder, toggleSection, setHomeSectionsOrder } = useSettings()
  const { navigateTo } = useNavigation()

  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [vibes, setVibes] = useState<Vibe[]>([])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [editingVibe, setEditingVibe] = useState<CustomVibeInput | null>(null)
  const [customVibes, setCustomVibes] = useState<Vibe[]>([])
  const [isConfigMode, setIsConfigMode] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState('forever')
  const [mostPlayedTracks, setMostPlayedTracks] = useState<any[]>([])
  const [mostPlayedLimit, setMostPlayedLimit] = useState(10)
  const [exploreSeed, setExploreSeed] = useState(0)

  // Section Refs
  const mostPlayedRef = useRef<HTMLDivElement>(null)

  // Fetch available vibes on mount
  useEffect(() => {
    fetchVibes()
    fetchCustomVibes()
  }, [])

  useEffect(() => {
    fetchMostPlayed()
  }, [selectedTimeRange, mostPlayedLimit, tracks]) // Also refresh if limit or library tracks change

  const fetchMostPlayed = async () => {
    try {
      const data = await client.getMostPlayedTracks(selectedTimeRange, mostPlayedLimit)
      console.log('[DEBUG] First 2 MostPlayedTracks received from backend:', data?.slice(0, 2))
      setMostPlayedTracks(data)
    } catch (error) {
      console.error('Failed to fetch most played tracks:', error)
    }
  }

  const fetchVibes = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/vibes')
      const data = await response.json()
      if (data.success && data.data) {
        setVibes(data.data)
      } else {
        setVibes(DEFAULT_VIBES as Vibe[])
      }
    } catch (error) {
      console.error('Failed to fetch vibes:', error)
      setVibes(DEFAULT_VIBES as Vibe[])
    }
  }

  const fetchCustomVibes = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/vibes/custom')
      const data = await response.json()
      if (Array.isArray(data)) {
        setCustomVibes(data)
      }
    } catch (error) {
      console.error('Failed to fetch custom vibes:', error)
    }
  }

  const handleSaveCustomVibe = async (vibe: CustomVibeInput) => {
    try {
      const url = editingVibe
        ? `http://localhost:3000/api/vibes/custom/${vibe.id}`
        : 'http://localhost:3000/api/vibes/custom'

      const method = editingVibe ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vibe)
      })

      const data = await response.json()

      if (data.success) {
        console.log(editingVibe ? 'Vibe updated' : 'Vibe created')
        fetchCustomVibes() // Refresh custom vibes list
        setIsBuilderOpen(false)
        setEditingVibe(null)
      } else {
        console.error('Failed to save vibe:', data.error)
      }
    } catch (error) {
      console.error('Error saving custom vibe:', error)
    }
  }

  const handleEditCustomVibe = (vibeId: string) => {
    const vibe = customVibes.find(v => v.id === vibeId)
    if (!vibe) return

    // Convert Vibe to CustomVibeInput format
    const input: CustomVibeInput = {
      id: vibe.id,
      name: vibe.name,
      emoji: vibe.emoji,
      description: vibe.description,
      energy_min: vibe.filters?.energy?.min,
      energy_max: vibe.filters?.energy?.max,
      danceability_min: vibe.filters?.danceability?.min,
      danceability_max: vibe.filters?.danceability?.max,
      mood_filters: vibe.filters?.moods
    }

    setEditingVibe(input)
    setIsBuilderOpen(true)
  }

  const handleDeleteCustomVibe = async (vibeId: string) => {
    if (!confirm('Are you sure you want to delete this custom vibe?')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3000/api/vibes/custom/${vibeId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        console.log('Vibe deleted')
        fetchCustomVibes() // Refresh list
        if (selectedVibe === vibeId) {
          setSelectedVibe(null)
        }
      } else {
        console.error('Failed to delete vibe:', data.error)
      }
    } catch (error) {
      console.error('Error deleting custom vibe:', error)
    }
  }

  /**
   * Handle vibe selection - fetch tracks from server and start playback
   */
  const handleVibeSelect = async (vibeId: string) => {
    if (selectedVibe === vibeId) return

    setSelectedVibe(vibeId)
    setIsLoading(true)

    try {
      const vibe = allVibes.find((v) => v.id === vibeId)
      if (!vibe) {
        console.error(`Vibe not found: ${vibeId}`)
        return
      }

      // Fetch directly from server - SOURCE OF TRUTH
      // This ensures we use the robust backend logic (including "belt and suspenders" safety checks)
      const vibeTracks = await client.getVibePlaylist(vibeId, 100)

      if (vibeTracks.length === 0) {
        console.error('No tracks available for this vibe')
        setIsLoading(false)
        return
      }

      const normalize = (value?: string | null) => (value || '').toString().toLowerCase().trim()
      const keyWithAlbum = (track: any) =>
        `${normalize(track.title)}|${normalize(track.artist)}|${normalize(track.album)}`
      const keyNoAlbum = (track: any) => `${normalize(track.title)}|${normalize(track.artist)}`

      const localByKey = new Map<string, typeof tracks[number]>()
      const localByKeyNoAlbum = new Map<string, typeof tracks[number]>()

      for (const track of tracks) {
        localByKey.set(keyWithAlbum(track), track)
        localByKeyNoAlbum.set(keyNoAlbum(track), track)
      }

      const mappedTracks = vibeTracks
        .map((track) => localByKey.get(keyWithAlbum(track)) || localByKeyNoAlbum.get(keyNoAlbum(track)))
        .filter(Boolean) as typeof tracks

      if (mappedTracks.length === 0) {
        console.error('Vibe tracks not found in local library. Check server DB alignment.')
        setIsLoading(false)
        return
      }

      playAlbum(mappedTracks, 0)
      console.log(`🎵 Started "${vibe.name}" playlist with ${mappedTracks.length} tracks`)
    } catch (error) {
      console.error('Error loading vibe playlist:', error)
      setSelectedVibe(null)
    } finally {
      setIsLoading(false)
    }
  }

  const allVibes = [...vibes, ...customVibes]

  // --- Section Data Calculations ---

  // Most Played: Removed local calculation, now using fetched state 'mostPlayedTracks'

  // Explore: Random albums from the library
  const exploreAlbums = useMemo(() => {
    return [...albums]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
  }, [albums, exploreSeed])

  // Newly Added Releases: Albums sorted by creation date
  const newlyAddedAlbums = useMemo(() => {
    return [...albums]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 6)
  }, [albums])

  // Recently Played: Albums sorted by last-played-track date if we had it, but for now using a mix or just recent playCount increase
  // Since we don't have lastPlayed on albums strictly, let's use albums with high play count that are also recent?
  // Let's assume recently played = albums of recently played tracks
  const recentlyPlayedAlbums = useMemo(() => {
    const recentPlayTracks = [...tracks]
      .filter(t => t.playCount > 0)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 20)

    const albumNames = new Set(recentPlayTracks.map(t => t.album))
    return albums
      .filter(a => albumNames.has(a.name))
      .slice(0, 6)
  }, [tracks, albums])

  // Recently Released: Albums sorted by year/release date
  const recentlyReleasedAlbums = useMemo(() => {
    return [...albums]
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 6)
  }, [albums])

  // --- Handlers ---

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = homeSectionsOrder.indexOf(id)
    if (index === -1) return
    const newOrder = [...homeSectionsOrder]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newOrder.length) return
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]]
    setHomeSectionsOrder(newOrder)
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-950 px-8 py-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between mb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Music2 className="w-10 h-10 text-cyan-400" />
            <h1 className="text-5xl font-bold text-white">MusicMaster</h1>
          </div>
          <p className="text-xl text-slate-400">
            Welcome back! Here's what's happening.
          </p>
        </div>
        <button
          onClick={() => setIsConfigMode(!isConfigMode)}
          className={`p-3 rounded-full transition-all ${isConfigMode ? 'bg-blue-600 text-white rotate-180' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
          title="Configure Home View"
        >
          <Settings size={20} />
        </button>
      </div>

      <DJCard />

      {/* Dynamic Sections Based on Order */}
      <AnimatePresence>
        {homeSectionsOrder.map(sectionId => {
          // If section is not visible AND we are not in config mode, don't render it
          // This allows AnimatePresence to handle the exit animation
          const isVisible = visibleSections.includes(sectionId)
          if (!isVisible && !isConfigMode) return null

          let content: React.ReactNode = null

          if (sectionId === 'vibes') {
            content = (
              <Section
                key="vibes"
                title="🎵 Vibes"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('vibes') === 0}
                isLast={homeSectionsOrder.indexOf('vibes') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('vibes', 'up')}
                onMoveDown={() => moveSection('vibes', 'down')}
                onToggle={() => toggleSection('vibes')}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      Pick a mood to start a dynamic playlist
                    </p>
                    <button
                      onClick={() => {
                        setEditingVibe(null)
                        setIsBuilderOpen(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-xs font-bold shadow-lg shadow-purple-900/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Custom Vibe
                    </button>
                  </div>

                  <VibesButtons
                    vibes={allVibes}
                    selectedVibe={selectedVibe}
                    onVibeSelect={handleVibeSelect}
                    isLoading={isLoading}
                  />

                  {customVibes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {customVibes.map(vibe => (
                        <div
                          key={vibe.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded-md border text-[10px] font-bold transition-all",
                            selectedVibe === vibe.id ? "bg-purple-500/20 border-purple-500/50 text-purple-200" : "bg-zinc-900/50 border-zinc-800 text-zinc-400"
                          )}
                        >
                          <span>{vibe.emoji} {vibe.name}</span>
                          <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-1.5">
                            <button
                              onClick={() => handleEditCustomVibe(vibe.id)}
                              className="hover:text-blue-400 transition-colors"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomVibe(vibe.id)}
                              className="hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )
          }

          if (sectionId === 'most_played') {
            content = (
              <Section
                key="most_played"
                title="🔝 Most Played Tracks"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('most_played') === 0}
                isLast={homeSectionsOrder.indexOf('most_played') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('most_played', 'up')}
                onMoveDown={() => moveSection('most_played', 'down')}
                onToggle={() => toggleSection('most_played')}
              >
                <div className="flex flex-col gap-4" ref={mostPlayedRef}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {[
                        { id: 'this-week', label: 'This Week' },
                        { id: 'week', label: 'Last Week' },
                        { id: 'month', label: 'Last Month' },
                        { id: 'year', label: 'This Year' },
                        { id: 'last-year', label: 'Last Year' },
                        { id: 'forever', label: 'Forever' }
                      ].map(range => (
                        <button
                          key={range.id}
                          onClick={() => setSelectedTimeRange(range.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                            selectedTimeRange === range.id
                              ? "bg-cyan-500 text-black"
                              : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                          )}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        const newLimit = mostPlayedLimit === 10 ? 100 : 10
                        setMostPlayedLimit(newLimit)
                        if (newLimit === 10) {
                          mostPlayedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-cyan-500/20 transition-all flex items-center gap-2 mb-2"
                    >
                      {mostPlayedLimit === 10 ? (
                        <>
                          <Plus size={12} strokeWidth={3} />
                          Top 100
                        </>
                      ) : (
                        <>
                          <ChevronUp size={12} strokeWidth={3} />
                          Top 10
                        </>
                      )}
                    </button>
                  </div>

                  <motion.div
                    layout
                    className="bg-zinc-900/40 rounded-xl border border-white/5 p-2 overflow-hidden"
                    initial={false}
                    animate={{ height: "auto" }}
                  >
                    {mostPlayedTracks.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <TrackList
                          tracks={mostPlayedTracks.slice(0, mostPlayedLimit)}
                          hideHeader
                          onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
                          onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })}
                        />

                        {mostPlayedLimit === 100 && mostPlayedTracks.length > 10 && (
                          <div className="flex justify-center p-4 border-t border-white/5">
                            <button
                              onClick={() => {
                                setMostPlayedLimit(10)
                                mostPlayedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                              className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-full text-xs font-black uppercase tracking-widest border border-cyan-500/20 transition-all"
                            >
                              <ChevronUp size={14} strokeWidth={3} />
                              Back to Top 10
                            </button>
                          </div>
                        )}

                        {mostPlayedLimit === 10 && mostPlayedTracks.length >= 10 && (
                          <div className="flex justify-center p-4 border-t border-white/5">
                            <button
                              onClick={() => setMostPlayedLimit(100)}
                              className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-full text-xs font-black uppercase tracking-widest border border-cyan-500/20 transition-all"
                            >
                              <Plus size={14} strokeWidth={3} />
                              Show Top 100
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                        <Music2 className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm italic">No tracks played in this period yet.</p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </Section>
            )
          }

          if (sectionId === 'explore') {
            content = (
              <Section
                key="explore"
                title="🔭 Explore from your library"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('explore') === 0}
                isLast={homeSectionsOrder.indexOf('explore') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('explore', 'up')}
                onMoveDown={() => moveSection('explore', 'down')}
                onToggle={() => toggleSection('explore')}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setExploreSeed(s => s + 1)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-md transition-all text-xs font-bold border border-white/5"
                    >
                      <RotateCcw size={14} className={cn("transition-transform duration-500", exploreSeed > 0 && "rotate-[-360deg]")} />
                      Another set
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {exploreAlbums.map(album => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        onClick={() => navigateTo('album-detail', { albumId: album.id })}
                      />
                    ))}
                  </div>
                </div>
              </Section>
            )
          }

          if (sectionId === 'newly_added') {
            content = (
              <Section
                key="newly_added"
                title="🔥 Newly added releases"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('newly_added') === 0}
                isLast={homeSectionsOrder.indexOf('newly_added') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('newly_added', 'up')}
                onMoveDown={() => moveSection('newly_added', 'down')}
                onToggle={() => toggleSection('newly_added')}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  {newlyAddedAlbums.map(album => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => navigateTo('album-detail', { albumId: album.id })}
                    />
                  ))}
                </div>
              </Section>
            )
          }

          if (sectionId === 'recently_played') {
            content = (
              <Section
                key="recently_played"
                title="🎧 Recently played"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('recently_played') === 0}
                isLast={homeSectionsOrder.indexOf('recently_played') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('recently_played', 'up')}
                onMoveDown={() => moveSection('recently_played', 'down')}
                onToggle={() => toggleSection('recently_played')}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  {recentlyPlayedAlbums.map(album => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => navigateTo('album-detail', { albumId: album.id })}
                    />
                  ))}
                </div>
              </Section>
            )
          }

          if (sectionId === 'recently_released') {
            content = (
              <Section
                key="recently_released"
                title="✨ Recently released"
                isVisible={isVisible}
                isConfigMode={isConfigMode}
                isFirst={homeSectionsOrder.indexOf('recently_released') === 0}
                isLast={homeSectionsOrder.indexOf('recently_released') === homeSectionsOrder.length - 1}
                onMoveUp={() => moveSection('recently_released', 'up')}
                onMoveDown={() => moveSection('recently_released', 'down')}
                onToggle={() => toggleSection('recently_released')}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  {recentlyReleasedAlbums.map(album => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => navigateTo('album-detail', { albumId: album.id })}
                    />
                  ))}
                </div>
              </Section>
            )
          }

          if (!content) return null

          return (
            <motion.div
              key={sectionId}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 1
              }}
            >
              {content}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Custom Vibe Builder Modal */}
      <CustomVibeBuilder
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false)
          setEditingVibe(null)
        }}
        onSave={handleSaveCustomVibe}
        editingVibe={editingVibe}
      />
    </div>
  )
}
