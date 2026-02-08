/**
 * Metadata Matching Service - Module 2d
 * Handles fuzzy matching and deduplication of tracks with MusicBrainz data
 */

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Lower value = better match
 */
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

/**
 * Calculate similarity score between two strings (0-1, where 1 is perfect match)
 */
export function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.length === 0) {
    return 1.0
  }

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Normalize string for comparison
 * Removes punctuation, converts to lowercase, removes extra spaces
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
}

/**
 * Calculate match score for artist, title, album combination
 * Returns score between 0-100
 */
export function calculateMatchScore(
  localArtist: string,
  localTitle: string,
  localAlbum: string,
  mbArtist: string,
  mbTitle: string,
  mbAlbum: string,
  weights: {
    artist: number // 0-1
    title: number // 0-1
    album: number // 0-1
  } = { artist: 0.4, title: 0.5, album: 0.1 }
): number {
  const normalizeStrict = (s: string) => normalizeString(s)

  const localArtistNorm = normalizeStrict(localArtist)
  const localTitleNorm = normalizeStrict(localTitle)
  const localAlbumNorm = normalizeStrict(localAlbum)

  const mbArtistNorm = normalizeStrict(mbArtist)
  const mbTitleNorm = normalizeStrict(mbTitle)
  const mbAlbumNorm = normalizeStrict(mbAlbum)

  const artistScore = stringSimilarity(localArtistNorm, mbArtistNorm)
  const titleScore = stringSimilarity(localTitleNorm, mbTitleNorm)
  const albumScore =
    localAlbumNorm && mbAlbumNorm ? stringSimilarity(localAlbumNorm, mbAlbumNorm) : 0.5 // Neutral if no album

  const weightedScore =
    artistScore * weights.artist + titleScore * weights.title + albumScore * weights.album

  return Math.round(weightedScore * 100)
}

/**
 * Match score categories
 */
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

/**
 * Match a local track against multiple MusicBrainz results
 */
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
  result: (typeof mbResults)[0] | null
  score: number
  confidence: MatchConfidence
  allMatches: Array<{
    result: (typeof mbResults)[0]
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
 * Detect likely duplicates in local library based on artist + title
 */
export function findPotentialDuplicates(
  tracks: Array<{ id: string; artist: string; title: string; album: string }>,
  threshold: number = 90
): Array<{
  group: Array<{ id: string; artist: string; title: string }>
  score: number
}> {
  const groups: Map<string, Array<(typeof tracks)[0]>> = new Map()

  for (let i = 0; i < tracks.length; i++) {
    let grouped = false

    for (const [, group] of groups) {
      const representative = group[0]
      const score = calculateMatchScore(
        representative.artist,
        representative.title,
        representative.album,
        tracks[i].artist,
        tracks[i].title,
        tracks[i].album
      )

      if (score >= threshold) {
        group.push(tracks[i])
        grouped = true
        break
      }
    }

    if (!grouped) {
      groups.set(`${i}`, [tracks[i]])
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      group: group.map((t) => ({ id: t.id, artist: t.artist, title: t.title })),
      score: calculateMatchScore(
        group[0].artist,
        group[0].title,
        group[0].album,
        group[1].artist,
        group[1].title,
        group[1].album
      )
    }))
}

/**
 * Extract artist names from semicolon or slash separated string
 */
export function parseArtistString(artistStr: string): string[] {
  return artistStr
    .split(/[;/&]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
}

/**
 * Match primary artist (first artist in multi-artist track)
 */
export function getPrimaryArtist(artistStr: string): string {
  const artists = parseArtistString(artistStr)
  return artists[0] || ''
}

/**
 * Check if two tracks are likely the same (for deduplication)
 */
export function isSameTrack(
  artist1: string,
  title1: string,
  artist2: string,
  title2: string,
  threshold: number = 85
): boolean {
  const score = calculateMatchScore(artist1, title1, '', artist2, title2, '', {
    artist: 0.5,
    title: 0.5,
    album: 0
  })

  return score >= threshold
}

/**
 * Advanced fuzzy matching with ISRC fallback
 */
export async function advancedMatch(
  localArtist: string,
  localTitle: string,
  localAlbum: string,
  isrc: string | null,
  searchFn: (
    artist: string,
    title: string,
    album: string
  ) => Promise<
    Array<{
      id: string
      title: string
      artist: string
      album: string
      releaseDate?: string
      trackNum?: number
      discNum?: number
    }>
  >,
  searchByISRCFn?: (isrc: string) => Promise<
    Array<{
      id: string
      title: string
      artist: string
      album: string
      releaseDate?: string
      trackNum?: number
      discNum?: number
    }>
  >
): Promise<{
  match: {
    id: string
    title: string
    artist: string
    album: string
    releaseDate?: string
    trackNum?: number
    discNum?: number
  } | null
  score: number
  method: 'artist-title-album' | 'isrc' | 'none'
  confidence: MatchConfidence
}> {
  // Try ISRC first if available (most reliable)
  if (isrc && searchByISRCFn) {
    const isrcResults = await searchByISRCFn(isrc)
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
          match: best.result,
          score: best.score,
          method: 'isrc',
          confidence: best.confidence
        }
      }
    }
  }

  // Try fuzzy text matching
  const textResults = await searchFn(localArtist, localTitle, localAlbum)
  const best = findBestMatch(localArtist, localTitle, localAlbum, textResults, MatchConfidence.LOW)

  return {
    match: best.result || null,
    score: best.score,
    method: best.result ? 'artist-title-album' : 'none',
    confidence: best.confidence
  }
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
  return candidates
    .map((candidate) => {
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
        const titleScore =
          stringSimilarity(normalizeString(localTitle), normalizeString(track.title)) * 100

        // Duration tolerance: ±2 seconds
        const durationDiff = Math.abs(track.duration - localDuration)
        const durationScore = durationDiff <= 2 ? 100 : Math.max(0, 100 - durationDiff * 10)

        const combinedScore = titleScore * 0.7 + durationScore * 0.3

        if (combinedScore > trackScore) {
          trackScore = combinedScore
          matchedTrack = track
        }
      }

      // Final confidence score (base + track match)
      const confidence = Math.round(baseScore * 0.6 + trackScore * 0.4)

      // Add expected duration to all tracks
      const tracksWithExpected = candidate.tracks.map((track) => ({
        ...track,
        expectedDuration: localDuration
      }))

      return {
        ...candidate,
        confidence,
        tracks: tracksWithExpected
      }
    })
    .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
}
