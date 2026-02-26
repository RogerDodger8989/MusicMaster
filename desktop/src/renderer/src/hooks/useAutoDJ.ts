import { useEffect, useRef } from 'react'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useSettings } from '../store/settings'
import type { Track } from '../types'

const RECENTLY_PLAYED_MAX = 20

// Compute a "mood vector" score relative to reference track (0 = no match, 1 = perfect match)
function moodSimilarity(a: Track, b: Track): number {
    const fields: (keyof Track)[] = [
        'moodAcoustic',
        'moodAggressive',
        'moodElectronic',
        'moodHappy',
        'moodSad',
        'moodRelaxed',
        'moodParty',
        'energy',
        'danceability'
    ]

    let total = 0
    let count = 0

    for (const field of fields) {
        const aVal = a[field] as number | undefined
        const bVal = b[field] as number | undefined
        if (aVal !== undefined && bVal !== undefined) {
            // Each field is 0–1, so difference is 0–1. Similarity = 1 - difference.
            total += 1 - Math.abs(aVal - bVal)
            count++
        }
    }

    // Default to neutral 0.5 if no mood data exists to avoid penalizing tracks without analysis
    return count > 0 ? total / count : 0.5
}

// BPM proximity score (±15 BPM = full score, tapers off beyond)
function bpmSimilarity(a: Track, b: Track): number {
    if (!a.bpm || !b.bpm) return 0.5 // neutral if no BPM data
    const diff = Math.abs(a.bpm - b.bpm)
    if (diff <= 15) return 1
    if (diff >= 60) return 0
    return 1 - (diff - 15) / 45
}

// Genre similarity based on overlapping tags (e.g. "Synthpop / Pop" matches "Synthpop")
function genreSimilarity(a: Track, b: Track): number {
    if (!a.genre || !b.genre) return 0.2 // slight base for unknown genres

    // Normalize and split by common separators
    const splitRegex = /[;/\\,]/
    const gA = new Set(a.genre.toLowerCase().split(splitRegex).map(s => s.trim()).filter(Boolean))
    const gB = b.genre.toLowerCase().split(splitRegex).map(s => s.trim()).filter(Boolean)

    if (gA.size === 0 || gB.length === 0) return 0.2

    const intersection = gB.filter(g => gA.has(g))

    // If any overlap, start at 0.7 and scale up to 1.0 based on overlap ratio
    if (intersection.length > 0) {
        return 0.7 + (0.3 * (intersection.length / Math.max(gA.size, gB.length)))
    }

    return 0
}

// Artist similarity (same artist is a strong signal for Radio)
function artistSimilarity(a: Track, b: Track): number {
    if (a.artist === b.artist) return 1
    if (a.albumArtist && a.albumArtist === b.albumArtist) return 0.8
    return 0
}

function scoreSimilarity(reference: Track, candidate: Track): number {
    const mood = moodSimilarity(reference, candidate)   // Weight: 0.40
    const bpm = bpmSimilarity(reference, candidate)     // Weight: 0.15
    const genre = genreSimilarity(reference, candidate) // Weight: 0.30
    const artist = artistSimilarity(reference, candidate) // Weight: 0.15

    return (mood * 0.40) + (bpm * 0.15) + (genre * 0.30) + (artist * 0.15)
}

export function useAutoDJ() {
    const { currentTrack, queue, currentIndex, addToQueue, history } = usePlayer()
    const { tracks: allTracks } = useLibrary()
    const {
        autoDjEnabled,
        autoDjRatingFilter,
        autoDjTriggerAt,
        autoDjAddCount
    } = useSettings()

    const recentlyPlayedRef = useRef<Set<string>>(new Set())
    const lastFilledRef = useRef<string | null>(null)

    // Keep recently played in sync with player history
    useEffect(() => {
        const recent = recentlyPlayedRef.current
        history.slice(0, RECENTLY_PLAYED_MAX).forEach((t) => recent.add(t.id))
        // Prune if over limit
        if (recent.size > RECENTLY_PLAYED_MAX) {
            const arr = Array.from(recent)
            arr.slice(0, arr.length - RECENTLY_PLAYED_MAX).forEach((id) => recent.delete(id))
        }
    }, [history])

    useEffect(() => {
        if (!autoDjEnabled) return
        if (!currentTrack) return

        // Count tracks remaining AFTER current (i.e., not yet played)
        const remaining = queue.length - currentIndex - 1

        // Only trigger when remaining drops to or below threshold
        if (remaining > autoDjTriggerAt) return

        // Prevent adding duplicates when the same track is still current
        const cacheKey = `${currentTrack.id}:${remaining}`
        if (lastFilledRef.current === cacheKey) return
        lastFilledRef.current = cacheKey

        // Build candidate pool
        const queueIds = new Set(queue.map((t) => t.id))
        const recentIds = recentlyPlayedRef.current

        let candidates = allTracks.filter((t) => {
            if (t.id === currentTrack.id) return false
            if (queueIds.has(t.id)) return false
            if (recentIds.has(t.id)) return false

            // Rating filter
            if (autoDjRatingFilter === 'rated' && (!t.rating || t.rating === 0)) return false
            if (autoDjRatingFilter === 'unrated' && t.rating && t.rating > 0) return false

            return true
        })

        // Score and sort by similarity
        candidates = candidates
            .map((t) => ({ track: t, score: scoreSimilarity(currentTrack, t) }))
            .sort((a, b) => b.score - a.score)
            .map((item) => item.track)

        // Pick top N
        const toAdd = candidates.slice(0, autoDjAddCount)
        if (toAdd.length > 0) {
            toAdd.forEach((t) => addToQueue(t))
            console.log(`[AutoDJ] Added ${toAdd.length} tracks to queue (${remaining} remaining)`)
        }
    }, [
        currentTrack?.id,
        queue.length,
        currentIndex,
        autoDjEnabled,
        autoDjRatingFilter,
        autoDjTriggerAt,
        autoDjAddCount
    ])
}
