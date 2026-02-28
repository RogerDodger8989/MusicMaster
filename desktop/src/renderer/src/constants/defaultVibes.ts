export const DEFAULT_VIBES = [
  {
    id: 'party',
    name: 'Party',
    emoji: '🎉',
    description: 'High energy, dance-worthy hits',
    filters: {
      energy: { min: 0.7 },
      danceability: { min: 0.7 },
      moods: ['mood_party', 'mood_happy']
    }
  },
  {
    id: 'chill',
    name: 'Chill',
    emoji: '😴',
    description: 'Relaxed and laid-back vibes',
    filters: {
      energy: { max: 0.4 },
      moods: ['mood_relaxed', 'mood_acoustic']
    }
  },
  {
    id: 'workout',
    name: 'Workout',
    emoji: '💪',
    description: 'Peak performance energy',
    filters: {
      energy: { min: 0.75 },
      moods: ['mood_aggressive', 'mood_party']
    }
  },
  {
    id: 'sad',
    name: 'Sad',
    emoji: '😢',
    description: 'Melancholic and introspective',
    filters: {
      moods: ['mood_sad']
    }
  },
  {
    id: 'late_night',
    name: 'Late Night',
    emoji: '🌙',
    description: 'Deep and atmospheric',
    filters: {
      moods: ['mood_relaxed']
    }
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    emoji: '🔥',
    description: 'Raw and intense',
    filters: {
      energy: { min: 0.7 },
      moods: ['mood_aggressive']
    }
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    emoji: '🎸',
    description: 'Stripped and intimate',
    filters: {
      energy: { max: 0.6 },
      moods: ['mood_acoustic']
    }
  },
  {
    id: 'pure_joy',
    name: 'Pure Joy',
    emoji: '✨',
    description: 'Uplifting and happy',
    filters: {
      energy: { min: 0.6 },
      danceability: { min: 0.7 },
      moods: ['mood_happy']
    }
  }
]
