import { useState, useEffect, useMemo } from 'react'
import { Music2, Plus, Edit2, Trash2, Settings, Check, EyeOff } from 'lucide-react'
import { VibesButtons, Vibe } from '../components/VibesButtons'
import CustomVibeBuilder, { CustomVibeInput } from '../components/modals/CustomVibeBuilder'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import { client } from '../api/client'
import { AlbumCard } from '../components/AlbumCard'
import TrackList from '../components/TrackList'
import { useNavigation } from '../store/navigation'
import { cn } from '../utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface HomeViewProps { }

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

  // Fetch available vibes on mount
  useEffect(() => {
    fetchVibes()
    fetchCustomVibes()
  }, [])

  const fetchVibes = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/vibes')
      const data = await response.json()
      if (data.success && data.data) {
        setVibes(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch vibes:', error)
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

      playAlbum(vibeTracks, 0)
      console.log(`🎵 Started "${vibe.name}" playlist with ${vibeTracks.length} tracks`)
    } catch (error) {
      console.error('Error loading vibe playlist:', error)
      setSelectedVibe(null)
    } finally {
      setIsLoading(false)
    }
  }

  const allVibes = [...vibes, ...customVibes]

  // --- Section Data Calculations ---

  // Most Played: Top tracks by play count
  const mostPlayedTracks = useMemo(() => {
    return tracks
      .filter(t => t.playCount > 0)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5)
  }, [tracks])

  // Explore: Random albums from the library
  const exploreAlbums = useMemo(() => {
    return [...albums]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
  }, [albums])

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

  const Section = ({ id, title, children }: { id: string, title: string, children: React.ReactNode }) => {
    const isVisible = visibleSections.includes(id)
    const index = homeSectionsOrder.indexOf(id)

    // Notice: we moved the isVisible and isConfigMode check to the outer mapping loop
    // so AnimatePresence can handle unmounting properly.

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
                  onClick={() => moveSection(id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-zinc-500 hover:text-white disabled:opacity-20"
                >
                  <ChevronUp size={16} />
                </button>
                <div className="w-px h-4 bg-white/10" />
                <button
                  onClick={() => moveSection(id, 'down')}
                  disabled={index === homeSectionsOrder.length - 1}
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
              onClick={() => toggleSection(id)}
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

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-950 p-8 overflow-y-auto custom-scrollbar">
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
              <Section key="vibes" id="vibes" title="🎵 Vibes">
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
              <Section key="most_played" id="most_played" title="🔝 Most Played Tracks">
                <div className="bg-zinc-900/40 rounded-xl border border-white/5 p-2">
                  <TrackList tracks={mostPlayedTracks} hideHeader />
                </div>
              </Section>
            )
          }

          if (sectionId === 'explore') {
            content = (
              <Section key="explore" id="explore" title="🔭 Explore from your library">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  {exploreAlbums.map(album => (
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

          if (sectionId === 'newly_added') {
            content = (
              <Section key="newly_added" id="newly_added" title="🔥 Newly added releases">
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
              <Section key="recently_played" id="recently_played" title="🎧 Recently played">
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
              <Section key="recently_released" id="recently_released" title="✨ Recently released">
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
