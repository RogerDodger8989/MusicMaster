/**
 * Metadata Matching Service
 * Handles fuzzy matching and deduplication of tracks with MusicBrainz data
 */

import { musicBrainzService } from './musicbrainz'

export function levenshteinDistance(a: string, b: string): number {
    const aLen = a.length
    const bLen = b.length
    const distances = Array(bLen + 1)
        .fill(null)
        .map(() => Array(aLen + 1).fill(0))

    for (let i = 0; i <= aLen; i++) {
        distances[0][i] = i
    }
    for (let j = 0; j <= bLen; j++) {
        distances[j][0] = j
    }

    for (let j = 1; j <= bLen; j++) {
        for (let i = 1; i <= aLen; i++) {
            if (a[i - 1] === b[j - 1]) {
                distances[j][i] = distances[j - 1][i - 1]
            } else {
                distances[j][i] = Math.min(
                    distances[j - 1][i - 1] + 1,
                    distances[j][i - 1] + 1,
                    distances[j - 1][i] + 1
                )
            }
        }
    }

    return distances[bLen][aLen]
}

export function stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a

    if (longer.length === 0) {
        return 1.0
    }

    const editDistance = levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
}

export function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

export function calculateMatchScore(
    localArtist: string,
    localTitle: string,
    localAlbum: string,
    mbArtist: string,
    mbTitle: string,
    mbAlbum: string,
    weights: {
        artist: number
        title: number
        album: number
    } = { artist: 0.4, title: 0.5, album: 0.1 }
): number {
    const normalizeStrict = (s: string) => normalizeString(s || '')

    const localArtistNorm = normalizeStrict(localArtist)
    const localTitleNorm = normalizeStrict(localTitle)
    const localAlbumNorm = normalizeStrict(localAlbum)

    const mbArtistNorm = normalizeStrict(mbArtist)
    const mbTitleNorm = normalizeStrict(mbTitle)
    const mbAlbumNorm = normalizeStrict(mbAlbum)

    const artistScore = stringSimilarity(localArtistNorm, mbArtistNorm)
    const titleScore = stringSimilarity(localTitleNorm, mbTitleNorm)

    // If local album is empty, don't penalize as much
    let albumScore = 0.5
    if (localAlbumNorm && mbAlbumNorm) {
        albumScore = stringSimilarity(localAlbumNorm, mbAlbumNorm)
    }

    const weightedScore =
        artistScore * weights.artist +
        titleScore * weights.title +
        albumScore * weights.album

    return Math.round(weightedScore * 100)
}

export enum MatchConfidence {
    PERFECT = 'perfect', // 95-100
    HIGH = 'high', // 80-94
    MEDIUM = 'medium', // 60-79
    LOW = 'low', // 40-59
    MISMATCH = 'mismatch' // < 40
}

export function getConfidenceLevel(score: number): MatchConfidence {
    if (score >= 95) return MatchConfidence.PERFECT
    if (score >= 80) return MatchConfidence.HIGH
    if (score >= 60) return MatchConfidence.MEDIUM
    if (score >= 40) return MatchConfidence.LOW
    return MatchConfidence.MISMATCH
}

export function findBestMatch(
    localArtist: string,
    localTitle: string,
    localAlbum: string,
    mbResults: Array<{
        id: string
        title: string
        artist: string
        album: string
    }>,
    minConfidence: MatchConfidence = MatchConfidence.MEDIUM
): {
    result: typeof mbResults[0] | null
    score: number
    confidence: MatchConfidence
    allMatches: Array<{
        result: typeof mbResults[0]
        score: number
        confidence: MatchConfidence
    }>
} {
    const minScoreRequired =
        minConfidence === 'perfect'
            ? 95
            : minConfidence === 'high'
                ? 80
                : minConfidence === 'medium'
                    ? 60
                    : minConfidence === 'low'
                        ? 40
                        : 0

    const matches = mbResults
        .map((result) => ({
            result,
            score: calculateMatchScore(
                localArtist,
                localTitle,
                localAlbum,
                result.artist,
                result.title,
                result.album
            ),
            confidence: getConfidenceLevel(
                calculateMatchScore(
                    localArtist,
                    localTitle,
                    localAlbum,
                    result.artist,
                    result.title,
                    result.album
                )
            )
        }))
        .sort((a, b) => b.score - a.score)

    const bestMatch = matches.find((m) => m.score >= minScoreRequired)

    return {
        result: bestMatch?.result || null,
        score: bestMatch?.score || 0,
        confidence: bestMatch?.confidence || MatchConfidence.MISMATCH,
        allMatches: matches
    }
}

/**
 * Advanced fuzzy matching with ISRC fallback
 * 5-argument version for Server API
 */
export async function advancedMatch(
    localArtist: string,
    localTitle: string,
    localAlbum: string,
    localDuration: number | undefined,
    isrc: string | null
): Promise<{
    mbid: string
    match: any
    score: number
    matchScore: number
    method: 'artist-title-album' | 'isrc' | 'none'
    confidence: MatchConfidence
} | null> {
    // Try ISRC first if available (most reliable)
    if (isrc) {
        try {
            const isrcResults = await musicBrainzService.searchByISRC(isrc)
            if (isrcResults.length > 0) {
                const best = findBestMatch(
                    localArtist,
                    localTitle,
                    localAlbum,
                    isrcResults,
                    MatchConfidence.LOW
                )
                if (best.result && best.score >= 40) {
                    return {
                        mbid: best.result.id,
                        match: best.result,
                        score: best.score,
                        matchScore: best.score,
                        method: 'isrc',
                        confidence: best.confidence
                    }
                }
            }
        } catch (e) {
            console.error('Advanced match ISRC error:', e)
        }
    }

    // Try fuzzy text matching
    try {
        const textResults = await musicBrainzService.searchTrack(
            localArtist,
            localTitle,
            localAlbum
        )
        const best = findBestMatch(
            localArtist,
            localTitle,
            localAlbum,
            textResults,
            MatchConfidence.LOW
        )

        if (best.result) {
            return {
                mbid: best.result.id,
                match: best.result,
                score: best.score,
                matchScore: best.score,
                method: 'artist-title-album',
                confidence: best.confidence
            }
        }
    } catch (e) {
        console.error('Advanced match text error:', e)
        return null
    }

    return null
}

/**
 * Score multiple release candidates with track info
 * Used for manual match selection UI
 */
export function scoreReleaseCandidates(
    localArtist: string,
    localTitle: string,
    localAlbum: string,
    localDuration: number,
    candidates: Array<{
        recordingMbid: string
        releaseMbid: string
        artistName: string
        albumName: string
        tracks: Array<{
            title: string
            duration: number
            position: number
        }>
    }>
): Array<{
    recordingMbid: string
    releaseMbid: string
    releaseGroupMbid?: string
    artistMbid?: string
    artistName: string
    albumName: string
    year?: number
    country?: string
    format?: string
    label?: string
    confidence: number
    tracks: Array<{
        title: string
        duration: number
        expectedDuration: number
        position: number
    }>
}> {
    return candidates.map((candidate) => {
        // Base score from artist/title/album matching
        const baseScore = calculateMatchScore(
            localArtist,
            localTitle,
            localAlbum,
            candidate.artistName,
            '',
            candidate.albumName
        )

        // Find the track in the release
        let trackScore = 0
        let matchedTrack: any = null

        for (const track of candidate.tracks) {
            const titleScore = stringSimilarity(
                normalizeString(localTitle),
                normalizeString(track.title)
            ) * 100

            // Duration tolerance: ±2 seconds
            // Note: track.duration from MB is in seconds (or ms? check service)
            // MB service usually returns ms, but `getReleaseCandidates` in MB service seems to convert to seconds if I read Step 578 line 565 correct:
            // "duration: Math.round(track.length / 1000)" -> yes seconds.
            const durationDiff = Math.abs(track.duration - localDuration)
            const durationScore = durationDiff <= 2 ? 100 : Math.max(0, 100 - durationDiff * 10)

            const combinedScore = titleScore * 0.7 + durationScore * 0.3

            if (combinedScore > trackScore) {
                trackScore = combinedScore
                matchedTrack = track
            }
        }

        // Final confidence score (base + track match)
        const confidence = Math.round((baseScore * 0.6 + trackScore * 0.4))

        // Add expected duration to all tracks
        const tracksWithExpected = candidate.tracks.map(track => ({
            ...track,
            expectedDuration: localDuration
        }))

        return {
            ...candidate,
            confidence,
            tracks: tracksWithExpected
        }
    }).sort((a, b) => b.confidence - a.confidence) // Sort by confidence
}
