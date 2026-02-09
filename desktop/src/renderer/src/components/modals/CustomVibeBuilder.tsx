/**
 * Custom Vibe Builder Modal
 * Allows users to create custom mood-based playlists with filters
 */

import React, { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'

interface CustomVibeBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSave: (vibe: CustomVibeInput) => void
  editingVibe?: CustomVibeInput | null
}

export interface CustomVibeInput {
  id?: string
  name: string
  emoji: string
  description?: string
  energy_min?: number
  energy_max?: number
  danceability_min?: number
  danceability_max?: number
  mood_filters?: string[]
}

const MOOD_OPTIONS = [
  { value: 'mood_happy', label: 'Happy', emoji: '😊' },
  { value: 'mood_sad', label: 'Sad', emoji: '😢' },
  { value: 'mood_party', label: 'Party', emoji: '🎉' },
  { value: 'mood_relaxed', label: 'Relaxed', emoji: '😴' },
  { value: 'mood_aggressive', label: 'Aggressive', emoji: '🔥' },
  { value: 'mood_acoustic', label: 'Acoustic', emoji: '🎸' }
]

export default function CustomVibeBuilder({ 
  isOpen, 
  onClose, 
  onSave,
  editingVibe 
}: CustomVibeBuilderProps) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [description, setDescription] = useState('')
  const [energyMin, setEnergyMin] = useState<number>(0)
  const [energyMax, setEnergyMax] = useState<number>(100)
  const [danceMin, setDanceMin] = useState<number>(0)
  const [danceMax, setDanceMax] = useState<number>(100)
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])

  // Load editing vibe data
  useEffect(() => {
    if (editingVibe) {
      setName(editingVibe.name)
      setEmoji(editingVibe.emoji)
      setDescription(editingVibe.description || '')
      setEnergyMin((editingVibe.energy_min ?? 0) * 100)
      setEnergyMax((editingVibe.energy_max ?? 1) * 100)
      setDanceMin((editingVibe.danceability_min ?? 0) * 100)
      setDanceMax((editingVibe.danceability_max ?? 1) * 100)
      setSelectedMoods(editingVibe.mood_filters || [])
    } else {
      resetForm()
    }
  }, [editingVibe, isOpen])

  const resetForm = () => {
    setName('')
    setEmoji('✨')
    setDescription('')
    setEnergyMin(0)
    setEnergyMax(100)
    setDanceMin(0)
    setDanceMax(100)
    setSelectedMoods([])
  }

  const handleMoodToggle = (mood: string) => {
    setSelectedMoods(prev => 
      prev.includes(mood) 
        ? prev.filter(m => m !== mood)
        : [...prev, mood]
    )
  }

  const handleSave = () => {
    const hasFilters = 
      energyMin > 0 || energyMax < 100 || 
      danceMin > 0 || danceMax < 100 || 
      selectedMoods.length > 0

    if (!name.trim() || !emoji.trim() || !hasFilters) {
      alert('Please provide a name, emoji, and at least one filter')
      return
    }

    const vibe: CustomVibeInput = {
      id: editingVibe?.id || `custom_${Date.now()}`,
      name: name.trim(),
      emoji: emoji.trim(),
      description: description.trim() || undefined,
      energy_min: energyMin > 0 ? energyMin / 100 : undefined,
      energy_max: energyMax < 100 ? energyMax / 100 : undefined,
      danceability_min: danceMin > 0 ? danceMin / 100 : undefined,
      danceability_max: danceMax < 100 ? danceMax / 100 : undefined,
      mood_filters: selectedMoods.length > 0 ? selectedMoods : undefined
    }

    onSave(vibe)
    resetForm()
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {editingVibe ? 'Edit Custom Vibe' : 'Create Custom Vibe'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name & Emoji */}
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Vibe Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Energetic Chill"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Emoji *
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="✨"
                className="w-20 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-center text-2xl focus:outline-none focus:border-purple-500"
                maxLength={2}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. High energy with relaxed mood"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              maxLength={100}
            />
          </div>

          {/* Energy Range */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-3">
              ⚡ Energy Range
            </label>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Minimum</span>
                  <span className="text-sm font-semibold text-amber-400">{energyMin}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={energyMin}
                  onChange={(e) => setEnergyMin(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Maximum</span>
                  <span className="text-sm font-semibold text-amber-400">{energyMax}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={energyMax}
                  onChange={(e) => setEnergyMax(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Danceability Range */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-3">
              💃 Danceability Range
            </label>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Minimum</span>
                  <span className="text-sm font-semibold text-pink-400">{danceMin}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={danceMin}
                  onChange={(e) => setDanceMin(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">Maximum</span>
                  <span className="text-sm font-semibold text-pink-400">{danceMax}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={danceMax}
                  onChange={(e) => setDanceMax(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>
            </div>
          </div>

          {/* Mood Filters */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-3">
              😊 Mood Filters
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood.value}
                  onClick={() => handleMoodToggle(mood.value)}
                  className={`
                    px-4 py-3 rounded-lg border transition-all
                    ${selectedMoods.includes(mood.value)
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }
                  `}
                >
                  <span className="text-2xl mb-1 block">{mood.emoji}</span>
                  <span className="text-sm font-medium">{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <p className="text-xs text-zinc-400">
              * At least one filter must be set (energy, danceability, or mood)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800 bg-zinc-900 sticky bottom-0">
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold hover:from-purple-700 hover:to-purple-600 transition-all"
          >
            {editingVibe ? 'Update Vibe' : 'Create Vibe'}
          </button>
        </div>
      </div>
    </div>
  )
}
