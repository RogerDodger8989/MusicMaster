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

    return count > 0 ? total / count : 0
}

// BPM proximity score (±15 BPM = full score, tapers off beyond)
function bpmSimilarity(a: Track, b: Track): number {
    if (!a.bpm || !b.bpm) return 0.5 // neutral if no BPM data
    const diff = Math.abs(a.bpm - b.bpm)
    if (diff <= 15) return 1
    if (diff >= 60) return 0
    return 1 - (diff - 15) / 45
}

// Genre match (binary)
function genreMatch(a: Track, b: Track): number {
    if (!a.genre || !b.genre) return 0
    return a.genre.toLowerCase() === b.genre.toLowerCase() ? 1 : 0
}

function scoreSimilarity(reference: Track, candidate: Track): number {
    const mood = moodSimilarity(reference, candidate) // Weight: 0.6
    const bpm = bpmSimilarity(reference, candidate) // Weight: 0.3
    const genre = genreMatch(reference, candidate) // Weight: 0.1
    return mood * 0.6 + bpm * 0.3 + genre * 0.1
}

export function useAutoDJ() {
    const { currentTrack, queue, currentIndex, addToQueue, history } = usePlayer()
    const { tracks: allTracks } = useLibrary()
    const settings = useSettings()
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
        const {
            autoDjEnabled,
            autoDjRatingFilter,
            autoDjTriggerAt,
            autoDjAddCount
        } = settings

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
        toAdd.forEach((t) => addToQueue(t))

        console.log(`[AutoDJ] Added ${toAdd.length} tracks to queue (${remaining} remaining)`)
    }, [currentTrack?.id, queue.length, currentIndex])
}
