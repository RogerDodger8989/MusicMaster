import React, { useState, useEffect } from 'react'

export interface Vibe {
  id: string
  name: string
  emoji: string
  description: string
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
  const [allVibes, setAllVibes] = useState<Vibe[]>(vibes)

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
      }
    } catch (error) {
      console.error('Failed to fetch vibes:', error)
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Grid layout - up to 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {allVibes.map((vibe) => (
          <button
            key={vibe.id}
            onClick={() => onVibeSelect(vibe.id)}
            disabled={isLoading}
            className={`
              group relative overflow-hidden rounded-lg p-4
              transition-all duration-200 ease-out
              ${selectedVibe === vibe.id
                ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/30 scale-[1.02]'
                : 'ring-1 ring-slate-600 hover:ring-slate-500 hover:scale-[1.01]'
              }
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
              bg-gradient-to-br from-slate-700 to-slate-800
              hover:from-slate-600 hover:to-slate-700
            `}
            title={vibe.description}
          >
            {/* Background shimmer effect */}
            <div
              className={`
                absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent
                opacity-0 group-hover:opacity-10 translate-x-[-100%] group-hover:translate-x-[100%]
                transition-all duration-500
              `}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              {/* Emoji - large and prominent */}
              <div className="text-4xl drop-shadow-lg">
                {vibe.emoji}
              </div>

              {/* Name */}
              <div className="text-sm font-semibold text-white text-center">
                {vibe.name}
              </div>

              {/* Selection indicator */}
              {selectedVibe === vibe.id && (
                <div className="mt-1 flex items-center justify-center">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-400/20 border border-cyan-400/50">
                    <span className="text-xs font-medium text-cyan-300">Playing</span>
                  </div>
                </div>
              )}
            </div>

            {/* Animated border on hover */}
            {selectedVibe === vibe.id && (
              <div className="absolute inset-0 border-2 border-cyan-400 rounded-lg animate-pulse" />
            )}
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
