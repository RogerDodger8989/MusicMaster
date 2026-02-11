import { useState, useEffect } from 'react'
import { Music2, Play, Plus, Edit2, Trash2, Settings, Check, EyeOff } from 'lucide-react'
import { VibesButtons, Vibe } from '../components/VibesButtons'
import CustomVibeBuilder, { CustomVibeInput } from '../components/modals/CustomVibeBuilder'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import { client } from '../api/client'
import { AlbumCard } from '../components/AlbumCard'
import TrackList from '../components/TrackList'
import { useNavigation } from '../store/navigation'

interface HomeViewProps { }

/**
 * HOME VIEW - Configurable Dashboard
 */
export default function HomeView({ }: HomeViewProps) {
  const { playAlbum, currentTrack } = usePlayer()
  const { albums, tracks } = useLibrary()
  const { visibleSections, toggleSection } = useSettings()
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

  const currentVibeInfo = [...vibes, ...customVibes].find(v => v.id === selectedVibe)
  const allVibes = [...vibes, ...customVibes]

  // --- Calculated Data ---
  const recentlyAddedAlbums = albums
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6)

  const recentlyPlayedTracks = tracks
    // Assuming we have 'lastPlayed' or sorting by updated/playcount interactively?
    // For now, let's filter by playCount > 0 and maybe sort by random or if we had a date.
    // The Track interface doesn't strictly have lastPlayed in frontend types? 
    // Let's use playCount for "Most Played" or actually "Recently Played" if we had the field.
    // Fallback: Just show random loved tracks or high playcount.
    .filter(t => t.playCount > 0)
    .sort((a, b) => b.playCount - a.playCount) // Actually "Most Played"
    .slice(0, 10)

  // Section Component Helper
  const Section = ({ id, title, children }: { id: string, title: string, children: React.ReactNode }) => {
    const isVisible = visibleSections.includes(id)

    if (!isVisible && !isConfigMode) return null

    return (
      <div className={`mb-12 transition-opacity ${!isVisible && isConfigMode ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex items-center gap-4 mb-6">
          {isConfigMode && (
            <button
              onClick={() => toggleSection(id)}
              className={`p-1 rounded-full ${isVisible ? 'bg-green-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}
            >
              {isVisible ? <Check size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <h2 className="text-2xl font-bold text-white">{title}</h2>
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

      {/* Vibes Section (Always Visible or Configurable?) Let's make it configurable 'vibes' */}
      <Section id="vibes" title="🎵 Pick Your Vibe">
        <div className="flex items-center justify-between mb-6">
          <div />
          <button
            onClick={() => {
              setEditingVibe(null)
              setIsBuilderOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            Create Custom Vibe
          </button>
        </div>

        <VibesButtons
          vibes={allVibes}
          selectedVibe={selectedVibe}
          onVibeSelect={handleVibeSelect}
          isLoading={isLoading}
        />

        {/* Custom Vibes with Edit/Delete */}
        {customVibes.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">✨ Your Custom Vibes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {customVibes.map(vibe => (
                <div
                  key={vibe.id}
                  className="relative group"
                >
                  <button
                    onClick={() => handleVibeSelect(vibe.id)}
                    className={`
                        w-full p-6 rounded-lg border transition-all
                        ${selectedVibe === vibe.id
                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-zinc-800 border-zinc-700 hover:border-purple-500/50'
                      }
                      `}
                  >
                    <div className="text-4xl mb-2">{vibe.emoji}</div>
                    <div className="text-sm font-semibold text-white">{vibe.name}</div>
                    {selectedVibe === vibe.id && (
                      <div className="mt-2 text-xs text-purple-300">Playing</div>
                    )}
                  </button>

                  {/* Edit/Delete buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditCustomVibe(vibe.id)
                      }}
                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCustomVibe(vibe.id)
                      }}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Now Playing Info (Vibe) */}
        {selectedVibe && currentTrack && (
          <div className="mt-8 p-6 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">
                  {currentVibeInfo?.emoji} Now Playing: {currentVibeInfo?.name}
                </h3>
                <p className="text-slate-300">
                  <span className="font-medium">{currentTrack.title}</span> by{' '}
                  <span className="font-medium">{currentTrack.artist}</span>
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  {currentVibeInfo?.description}
                </p>
              </div>
              <Play className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
          </div>
        )}
      </Section>

      <Section id="recently_added" title="🔥 Recently Added">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {recentlyAddedAlbums.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => navigateTo('album-detail', { albumId: album.id })}
            />
          ))}
        </div>
      </Section>

      <Section id="recently_played" title="🎧 Recently Played (Most Played)">
        <div className="bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden">
          <TrackList tracks={recentlyPlayedTracks} />
        </div>
      </Section>

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
