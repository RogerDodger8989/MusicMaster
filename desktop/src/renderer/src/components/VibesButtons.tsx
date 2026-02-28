import React, { useState, useEffect } from 'react'
import { DEFAULT_VIBES } from '../constants/defaultVibes'

export interface Vibe {
  id: string
  name: string
  emoji: string
  description: string
  filters?: {
    energy?: { min?: number; max?: number }
    danceability?: { min?: number; max?: number }
    moods?: string[]
  }
}

interface VibesButtonsProps {
  onVibeSelect: (vibeId: string) => void
  selectedVibe?: string | null
  isLoading?: boolean
  vibes?: Vibe[]
}

/**
 * Snazzy vibes buttons component
 * Shows 8 different mood-based vibes with emojis
 */
export const VibesButtons: React.FC<VibesButtonsProps> = ({
  onVibeSelect,
  selectedVibe,
  isLoading = false,
  vibes = []
}) => {
  const [allVibes, setAllVibes] = useState<Vibe[]>(vibes.length > 0 ? vibes : DEFAULT_VIBES as Vibe[])

  // Fetch vibes from API if not provided
  useEffect(() => {
    if (vibes.length === 0) {
      fetchVibes()
    }
  }, [vibes])

  const fetchVibes = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/vibes')
      const data = await response.json()
      if (data.success && data.data) {
        setAllVibes(data.data)
      } else {
        setAllVibes(DEFAULT_VIBES as Vibe[])
      }
    } catch (error) {
      console.error('Failed to fetch vibes:', error)
      setAllVibes(DEFAULT_VIBES as Vibe[])
    }
  }

  return (
    <div className="w-full">
      {/* Grid layout - up to 6 columns on desktop, 3 on mobile for compactness */}
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {allVibes.map((vibe) => (
          <button
            key={vibe.id}
            onClick={() => onVibeSelect(vibe.id)}
            disabled={isLoading}
            className={`
              group relative overflow-hidden rounded-lg p-2.5
              transition-all duration-200 ease-out
              ${selectedVibe === vibe.id
                ? 'ring-1 ring-cyan-400 shadow-lg shadow-cyan-400/20 scale-[1.02]'
                : 'ring-1 ring-slate-700/50 hover:ring-slate-500 hover:scale-[1.02]'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
              bg-slate-800/40 hover:bg-slate-700/60
            `}
            title={vibe.description}
          >
            {/* Background glow on selected */}
            {selectedVibe === vibe.id && (
              <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              {/* Emoji - smaller */}
              <div className="text-2xl drop-shadow-md">
                {vibe.emoji}
              </div>

              {/* Name - smaller and tighter */}
              <div className="text-[11px] font-bold text-slate-200 text-center leading-tight truncate w-full">
                {vibe.name}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Info text */}
      {selectedVibe && allVibes.find(v => v.id === selectedVibe) && (
        <div className="text-center text-sm text-slate-400 mt-4">
          <p>🔒 {allVibes.find(v => v.id === selectedVibe)?.description}</p>
          <p className="text-xs text-slate-500 mt-1">(locked until changed)</p>
        </div>
      )}
    </div>
  )
}
