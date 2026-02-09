import { useState, useEffect } from 'react'
import { Music2, Play, Plus, Edit2, Trash2 } from 'lucide-react'
import { VibesButtons, Vibe } from '../components/VibesButtons'
import CustomVibeBuilder, { CustomVibeInput } from '../components/modals/CustomVibeBuilder'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'

interface HomeViewProps {}

/**
 * HOME VIEW - Mood-based vibe selection
 */
export default function HomeView({}: HomeViewProps) {
  const { playTrack, currentTrack } = usePlayer()
  const { tracks } = useLibrary()
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [vibes, setVibes] = useState<Vibe[]>([])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [editingVibe, setEditingVibe] = useState<CustomVibeInput | null>(null)
  const [customVibes, setCustomVibes] = useState<Vibe[]>([])

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
      energy_min: vibe.filters.energy?.min,
      energy_max: vibe.filters.energy?.max,
      danceability_min: vibe.filters.danceability?.min,
      danceability_max: vibe.filters.danceability?.max,
      mood_filters: vibe.filters.moods
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
   * Handle vibe selection - fetch tracks and start playback
   */
  const handleVibeSelect = async (vibeId: string) => {
    if (selectedVibe === vibeId) {
      // Already playing this vibe
      return
    }

    setSelectedVibe(vibeId)
    setIsLoading(true)

    try {
      // Fetch vibe playlist from server
      const response = await fetch(`http://localhost:3000/api/vibes/${vibeId}?limit=50`)
      const data = await response.json()

      if (!data.success || !data.tracks || data.tracks.length === 0) {
        console.error(`No tracks available for vibe "${vibeId}"`)
        setIsLoading(false)
        return
      }

      // Map server tracks to local tracks
      const vibeTracks = data.tracks
        .map((t: any) => {
          const localTrack = tracks.find(lt => lt.id === t.id)
          return localTrack
        })
        .filter((t: any) => t !== undefined)

      if (vibeTracks.length === 0) {
        console.error('No matching local tracks found')
        setIsLoading(false)
        return
      }

      // Start playing the first track of the vibe
      playTrack(vibeTracks[0])

      console.log(`🎵 Started "${data.vibe.name}" playlist with ${vibeTracks.length} tracks`)
    } catch (error) {
      console.error('Error loading vibe playlist:', error)
      setSelectedVibe(null)
    } finally {
      setIsLoading(false)
    }
  }

  const currentVibeInfo = [...vibes, ...customVibes].find(v => v.id === selectedVibe)

  const allVibes = [...vibes, ...customVibes]

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-950 p-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Music2 className="w-10 h-10 text-cyan-400" />
          <h1 className="text-5xl font-bold text-white">MusicMaster</h1>
        </div>
        <p className="text-xl text-slate-400">
          Choose your vibe and let the music take you
        </p>
      </div>

      {/* Vibes Section */}
      <div className="flex-1">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">🎵 Pick Your Vibe</h2>
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
        </div>

        {/* Now Playing Info */}
        {selectedVibe && currentTrack && (
          <div className="mt-12 p-6 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
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

        {/* Quick Info */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>💡 Pick a vibe to start a curated playlist based on your mood</p>
          <p className="mt-2 text-xs">Your playlist will remain locked to this vibe until you select a different one</p>
        </div>
      </div>

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
