/**
 * Mood Taxonomy Service
 * Implements Arousal-Valence model for music mood classification
 * Maps MusicBrainz tags to standardized mood categories
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface MoodCategory {
    id: string
    name: string
    emoji: string
    description: string
    arousal: number      // 0.0-1.0 (low to high energy/activation)
    valence: number      // 0.0-1.0 (negative to positive emotion)
    synonyms: string[]   // MusicBrainz tag variations
    bpmRange?: { min?: number; max?: number }
}

export interface ArousalValenceCoordinates {
    arousal: number
    valence: number
    confidence: number
}

// ============================================================================
// MOOD CATEGORIES (Arousal-Valence Quadrants + Specific Cases)
// ============================================================================

export const MOOD_CATEGORIES: Record<string, MoodCategory> = {
    // High Arousal, High Valence (Quadrant 1)
    party: {
        id: 'party',
        name: 'Party',
        emoji: '🎉',
        description: 'High energy dance music with positive vibes',
        arousal: 0.9,
        valence: 0.8,
        synonyms: ['party', 'dance', 'club', 'upbeat', 'festive', 'celebration', 'danceable'],
        bpmRange: { min: 120 }
    },

    happy: {
        id: 'happy',
        name: 'Happy',
        emoji: '😊',
        description: 'Cheerful and uplifting music',
        arousal: 0.7,
        valence: 0.9,
        synonyms: ['happy', 'cheerful', 'uplifting', 'joyful', 'positive', 'bright', 'sunny', 'optimistic'],
        bpmRange: { min: 100, max: 160 }
    },

    energetic: {
        id: 'energetic',
        name: 'Energetic',
        emoji: '⚡',
        description: 'High intensity and powerful music',
        arousal: 0.85,
        valence: 0.75,
        synonyms: ['energetic', 'fast', 'driving', 'power', 'intense', 'dynamic', 'powerful', 'explosive'],
        bpmRange: { min: 140 }
    },

    // High Arousal, Low Valence (Quadrant 2)
    aggressive: {
        id: 'aggressive',
        name: 'Aggressive',
        emoji: '🔥',
        description: 'Raw and intense music with edge',
        arousal: 0.9,
        valence: 0.4,
        synonyms: ['aggressive', 'angry', 'heavy', 'raw', 'fierce', 'brutal', 'intense', 'hard'],
        bpmRange: { min: 130 }
    },

    // Low Arousal, Low Valence (Quadrant 3)
    sad: {
        id: 'sad',
        name: 'Sad',
        emoji: '😢',
        description: 'Melancholic and introspective',
        arousal: 0.3,
        valence: 0.2,
        synonyms: ['sad', 'melancholic', 'depressing', 'blue', 'sorrowful', 'gloomy', 'mournful', 'tragic', 'dark'],
        bpmRange: { max: 100 }
    },

    // Low Arousal, High Valence (Quadrant 4)
    relaxed: {
        id: 'relaxed',
        name: 'Relaxed',
        emoji: '😌',
        description: 'Mellow and easy-going',
        arousal: 0.25,
        valence: 0.7,
        synonyms: ['relaxed', 'chill', 'mellow', 'easy', 'smooth', 'laid-back', 'easygoing', 'tranquil'],
        bpmRange: { max: 100 }
    },

    calm: {
        id: 'calm',
        name: 'Calm',
        emoji: '😴',
        description: 'Peaceful and serene',
        arousal: 0.2,
        valence: 0.6,
        synonyms: ['calm', 'ambient', 'chillout', 'relaxing', 'peaceful', 'serene', 'soothing', 'meditative', 'quiet'],
        bpmRange: { max: 90 }
    },

    // Neutral Arousal (Special Categories)
    acoustic: {
        id: 'acoustic',
        name: 'Acoustic',
        emoji: '🎸',
        description: 'Stripped and intimate',
        arousal: 0.4,
        valence: 0.5,
        synonyms: ['acoustic', 'organic', 'stripped', 'intimate', 'unplugged', 'folk', 'natural'],
        bpmRange: { min: 80, max: 120 }
    }
}

// ============================================================================
// TAG CLASSIFICATION
// ============================================================================

/**
 * Classify a MusicBrainz tag to a mood category
 * Returns the category if matched, null otherwise
 */
export function classifyMusicBrainzTag(tag: string): MoodCategory | null {
    const normalizedTag = tag.toLowerCase().trim()

    for (const category of Object.values(MOOD_CATEGORIES)) {
        if (category.synonyms.some(syn => normalizedTag.includes(syn) || syn.includes(normalizedTag))) {
            return category
        }
    }

    return null
}

/**
 * Maps genre keywords to mood categories
 */
const GENRE_MOOD_MAP: Record<string, string[]> = {
    mood_relaxed: ['ambient', 'chill', 'relaxed', 'calm', 'downtempo', 'lounge', 'classical', 'new age', 'meditation', 'smooth jazz', 'orchestral', 'soundtrack', 'cinematic'],
    mood_happy: ['pop', 'happy', 'cheerful', 'upbeat', 'sunny', 'disco', 'bubblegum', 'funk'],
    mood_aggressive: ['metal', 'hardcore', 'punk', 'heavy', 'industrial', 'grunge', 'aggressive', 'angry', 'thrash', 'death metal'],
    mood_party: ['dance', 'club', 'house', 'techno', 'trance', 'edm', 'party', 'uptempo', 'hip hop', 'rap'],
    mood_sad: ['blues', 'melancholic', 'sad', 'emo', 'gothic', 'dark'],
    mood_acoustic: ['folk', 'acoustic', 'jazz', 'unplugged', 'songwriter', 'country']
}

/**
 * Infer mood scores from genre string
 */
export function calculateMoodsFromGenre(genre: string | null): MoodScores {
    const moods: MoodScores = {
        mood_happy: 0,
        mood_sad: 0,
        mood_aggressive: 0,
        mood_party: 0,
        mood_relaxed: 0,
        mood_acoustic: 0
    }

    if (!genre) return moods

    const normalizedGenre = genre.toLowerCase()

    for (const [mood, keywords] of Object.entries(GENRE_MOOD_MAP)) {
        if (keywords.some(kw => normalizedGenre.includes(kw))) {
            moods[mood as keyof MoodScores] = 1.0
        }
    }

    return moods
}

/**
 * Find the closest mood category based on arousal-valence coordinates
 * Uses Euclidean distance in 2D space
 */
export function findClosestMoodCategory(
    arousal: number,
    valence: number
): { category: MoodCategory; distance: number } {
    let closestCategory = MOOD_CATEGORIES.party
    let minDistance = Infinity

    for (const category of Object.values(MOOD_CATEGORIES)) {
        const distance = Math.sqrt(
            Math.pow(arousal - category.arousal, 2) +
            Math.pow(valence - category.valence, 2)
        )

        if (distance < minDistance) {
            minDistance = distance
            closestCategory = category
        }
    }

    return { category: closestCategory, distance: minDistance }
}

// ============================================================================
// AROUSAL-VALENCE CALCULATION
// ============================================================================

interface MoodScores {
    mood_happy?: number | null
    mood_sad?: number | null
    mood_aggressive?: number | null
    mood_party?: number | null
    mood_relaxed?: number | null
    mood_acoustic?: number | null
}

/**
 * Calculate valence from mood scores
 * Valence = emotional positivity (0 = very negative, 1 = very positive)
 * 
 * Algorithm:
 * - Positive moods (happy, party, relaxed) increase valence
 * - Negative moods (sad, aggressive) decrease valence
 * - Neutral moods (acoustic) have minimal effect
 */
export function calculateValence(moods: MoodScores): number {
    const weights: Record<string, number> = {
        mood_happy: 1.0,      // Strong positive
        mood_party: 0.9,      // Strong positive
        mood_relaxed: 0.7,    // Moderate positive
        mood_acoustic: 0.0,   // Neutral
        mood_sad: -0.8,       // Strong negative
        mood_aggressive: -0.3 // Moderate negative (can be positive for some)
    }

    let weightedSum = 0
    let totalWeight = 0

    for (const [moodKey, moodValue] of Object.entries(moods)) {
        if (moodValue !== null && moodValue !== undefined && moodValue > 0) {
            const weight = weights[moodKey] || 0
            weightedSum += moodValue * weight
            totalWeight += Math.abs(moodValue)
        }
    }

    if (totalWeight === 0) {
        return 0.5 // Default neutral
    }

    // Normalize from [-1, 1] to [0, 1]
    const valence = (weightedSum / totalWeight + 1) / 2

    // Clamp to valid range
    return Math.max(0, Math.min(1, valence))
}

/**
 * Calculate arousal-valence coordinates from audio features and moods
 * Returns coordinates with confidence score
 */
export function calculateArousalValence(
    energy: number | null,
    danceability: number | null,
    moods: MoodScores
): ArousalValenceCoordinates {
    // Use energy as primary arousal indicator
    // Supplement with danceability for refinement
    let arousal = energy || 0.5
    if (danceability !== null && danceability !== undefined) {
        arousal = (arousal * 0.7) + (danceability * 0.3)
    }

    const valence = calculateValence(moods)

    // Calculate confidence based on data availability
    let confidence = 0
    if (energy !== null) confidence += 0.5
    if (danceability !== null) confidence += 0.2
    const moodCount = Object.values(moods).filter(v => v !== null && v !== undefined && v > 0).length
    confidence += Math.min(0.3, moodCount * 0.1)

    return {
        arousal: Math.max(0, Math.min(1, arousal)),
        valence: Math.max(0, Math.min(1, valence)),
        confidence: Math.max(0, Math.min(1, confidence))
    }
}

/**
 * Assign mood category based on arousal-valence coordinates
 * and BPM if available
 */
export function assignMoodCategory(
    arousal: number,
    valence: number,
    bpm: number | null
): MoodCategory {
    const { category, distance } = findClosestMoodCategory(arousal, valence)

    // Verify BPM matches if specified
    if (bpm !== null && category.bpmRange) {
        const { min, max } = category.bpmRange
        const bpmMatches =
            (min === undefined || bpm >= min) &&
            (max === undefined || bpm <= max)

        // If BPM doesn't match, find alternative category
        if (!bpmMatches) {
            // Find categories with compatible BPM and similar A-V
            const alternatives = Object.values(MOOD_CATEGORIES)
                .filter(cat => {
                    if (!cat.bpmRange) return true
                    const { min: bpmMin, max: bpmMax } = cat.bpmRange
                    return (bpmMin === undefined || bpm >= bpmMin) &&
                        (bpmMax === undefined || bpm <= bpmMax)
                })
                .map(cat => ({
                    category: cat,
                    distance: Math.sqrt(
                        Math.pow(arousal - cat.arousal, 2) +
                        Math.pow(valence - cat.valence, 2)
                    )
                }))
                .sort((a, b) => a.distance - b.distance)

            if (alternatives.length > 0) {
                return alternatives[0].category
            }
        }
    }

    return category
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate confidence score for mood classification
 * Based on data completeness and strength of mood signals
 */
export function calculateConfidenceScore(
    hasEnergy: boolean,
    hasDanceability: boolean,
    hasBPM: boolean,
    moods: MoodScores,
    arousalValenceDistance: number
): number {
    let score = 0

    // Audio features contribute to confidence
    if (hasEnergy) score += 0.3
    if (hasDanceability) score += 0.2
    if (hasBPM) score += 0.1

    // Strong mood signals contribute
    const maxMood = Math.max(...Object.values(moods).filter(v => v !== null && v !== undefined) as number[], 0)
    if (maxMood > 0.8) score += 0.3
    else if (maxMood > 0.6) score += 0.2
    else if (maxMood > 0.4) score += 0.1

    // Proximity to category center increases confidence
    // Distance ranges from 0 (exact match) to ~1.4 (opposite corners)
    const proximityScore = Math.max(0, 0.2 * (1 - arousalValenceDistance / 1.4))
    score += proximityScore

    return Math.max(0, Math.min(1, score))
}
