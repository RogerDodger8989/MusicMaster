import React from 'react'
import type { Track } from '../types'

interface AudioFeatures {
  energy?: number | null
  danceability?: number | null
  bpm?: number | null
  key?: string | null
  mood_happy?: number | null
  mood_sad?: number | null
  mood_aggressive?: number | null
  mood_party?: number | null
  mood_relaxed?: number | null
  mood_acoustic?: number | null
}

interface CompactAudioFeaturesProps {
  features?: AudioFeatures | Track | null
}

/**
 * Compact audio features display for NOW_PLAYING
 * Shows: Energy | Danceability | Mood | BPM in a single row
 */
export const CompactAudioFeatures: React.FC<CompactAudioFeaturesProps> = ({ features }) => {
  if (!features) {
    return null
  }

  // Handle both AudioFeatures and Track objects
  const energy = (features as any).energy ?? null
  const danceability = (features as any).danceability ?? null
  const bpm = (features as any).bpm ?? null
  const key = (features as any).key ?? null
  const moodHappy = (features as any).mood_happy ?? (features as any).moodHappy ?? null
  const moodSad = (features as any).mood_sad ?? (features as any).moodSad ?? null
  const moodAggressive = (features as any).mood_aggressive ?? (features as any).moodAggressive ?? null
  const moodParty = (features as any).mood_party ?? (features as any).moodParty ?? null
  const moodRelaxed = (features as any).mood_relaxed ?? (features as any).moodRelaxed ?? null
  const moodAcoustic = (features as any).mood_acoustic ?? (features as any).moodAcoustic ?? null

  // Determine dominant mood
  const moods = [
    { name: 'Happy', value: moodHappy },
    { name: 'Sad', value: moodSad },
    { name: 'Party', value: moodParty },
    { name: 'Relaxed', value: moodRelaxed },
    { name: 'Aggressive', value: moodAggressive },
    { name: 'Acoustic', value: moodAcoustic }
  ]

  const dominantMood = moods
    .filter(m => m.value && m.value > 0.5)
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0]?.name || 'Neutral'

  const getMoodEmoji = (mood: string) => {
    const emojiMap: Record<string, string> = {
      'Happy': '😊',
      'Sad': '😢',
      'Party': '🎉',
      'Relaxed': '😴',
      'Aggressive': '🔥',
      'Acoustic': '🎸',
      'Neutral': '🎵'
    }
    return emojiMap[mood] || '🎵'
  }

  const formatValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    return Math.round(value * 100) + '%'
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg text-xs font-mono text-slate-300">
      {/* Energy */}
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400">⚡</span>
        <span>{formatValue(energy)}</span>
      </div>

      <div className="w-px h-4 bg-slate-600/50" />

      {/* Danceability */}
      <div className="flex items-center gap-1.5">
        <span className="text-pink-400">💃</span>
        <span>{formatValue(danceability)}</span>
      </div>

      <div className="w-px h-4 bg-slate-600/50" />

      {/* Mood */}
      <div className="flex items-center gap-1.5">
        <span>{getMoodEmoji(dominantMood)}</span>
        <span className="text-slate-400">{dominantMood}</span>
      </div>

      <div className="w-px h-4 bg-slate-600/50" />

      {/* BPM */}
      <div className="flex items-center gap-1.5">
        <span className="text-cyan-400">♪</span>
        <span>{bpm ? bpm + ' BPM' : '—'}</span>
      </div>

      {/* Key (optional, only show if available) */}
      {key && (
        <>
          <div className="w-px h-4 bg-slate-600/50" />
          <div className="flex items-center gap-1.5">
            <span className="text-purple-400">🔑</span>
            <span className="text-slate-400">{key}</span>
          </div>
        </>
      )}
    </div>
  )
}
