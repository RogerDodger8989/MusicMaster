/**
 * Background Enrichment Worker - Phase 9
 * 
 * Automated metadata enrichment with:
 * - Smart batching by Album MBID (reduce requests from 100k to ~7k)
 * - Performer/relationship extraction from MusicBrainz
 * - Mood/key/BPM data from AcousticBrainz
 * - Strict rate-limit safety (1.1s delay)
 * - Progress logging and recovery
 */

import { getDatabase } from '../database'
import { musicBrainzService } from './musicbrainz'
import { acousticBrainzService } from './acousticbrainz'
import { upsertArtistWithMBID } from '../database/musicbrainz'
import { v4 as uuidv4 } from 'uuid'

const RATE_LIMIT_MS = 1100 // 1.1 seconds between requests (MusicBrainz requirement)

export interface EnrichmentProgress {
  totalAlbums: number
  processedAlbums: number
  totalTracks: number
  enrichedTracks: number
  performersAdded: number
  acousticbrainzAdded: number
  errors: string[]
}

/**
 * Group tracks by Album MBID for smart batching
 */
async function getAlbumGroups(): Promise<Map<string, string[]>> {
  const db = getDatabase()

  // Query: Tracks with both track and album MBIDs, grouped by album
  const query = `
    SELECT 
      t.musicbrainz_album_id as album_mbid,
      t.id as track_id,
      t.musicbrainz_track_id
    FROM tracks t
    WHERE t.musicbrainz_track_id IS NOT NULL
      AND t.musicbrainz_album_id IS NOT NULL
    ORDER BY t.musicbrainz_album_id
  `

  const rows = db.prepare(query).all() as any[]
  const groups = new Map<string, string[]>()

  for (const row of rows) {
    if (!groups.has(row.album_mbid)) {
      groups.set(row.album_mbid, [])
    }
    const trackIds = groups.get(row.album_mbid)
    if (trackIds) {
      trackIds.push(row.track_id)
    } else {
      groups.set(row.album_mbid, [row.track_id])
    }
  }

  return groups
}

/**
 * Map MusicBrainz relation types to our DB role enum
 */
function mbRelationTypeToRole(mbType: string): string {
  const map: Record<string, string> = {
    'producer': 'Producer',
    'conductor': 'Conductor',
    'arranger': 'Arranger',
    'performer': 'Performer',
    'instrument': 'Performer',
    'vocals': 'Performer',
    'mix': 'Other',
    'mix-DJ': 'Remixer',
    'remixer': 'Remixer',
    'composer': 'Composer',
    'lyricist': 'Lyricist',
    'engineer': 'Other',
    'recording': 'Other',
    'mastering': 'Other',
    'editor': 'Other',
    'guest artist': 'Guest',
    'featured artist': 'Featured',
    'main artist': 'Main',
  }
  return map[mbType.toLowerCase()] || 'Other'
}

/**
 * Fetch and store performers for an album from MusicBrainz release relationships
 */
async function enrichAlbumPerformers(albumMbid: string, progress: EnrichmentProgress): Promise<number> {
  const db = getDatabase()

  // Look up which albums/tracks in our DB correspond to this MBID
  const albumRow = db.prepare(`
    SELECT id FROM albums_cache WHERE musicbrainz_albumid = ? LIMIT 1
  `).get(albumMbid) as { id: string } | undefined

  const trackRows = db.prepare(`
    SELECT id FROM tracks WHERE musicbrainz_album_id = ?
  `).all(albumMbid) as { id: string }[]

  if (!albumRow && trackRows.length === 0) {
    return 0
  }

  try {
    const release = await musicBrainzService.getReleaseDetails(albumMbid)
    if (!release) return 0

    let added = 0
    const insertPerformer = db.prepare(`
      INSERT OR IGNORE INTO performers (id, track_id, artist_id, role, instrument, credited_as, sort_position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertAlbumCredit = db.prepare(`
      INSERT OR IGNORE INTO album_credits (id, album_id, artist_id, role, credited_as, sort_position)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    // ----------------------------------------------------------------
    // 1. Release-level relations → album_credits
    // ----------------------------------------------------------------
    const releaseRelations: any[] = (release as any).relations || []
    for (const rel of releaseRelations) {
      if (rel['target-type'] !== 'artist' || !rel.artist) continue

      const artistName: string = rel.artist.name || ''
      const artistMbid: string = rel.artist.id || ''
      const role = mbRelationTypeToRole(rel.type)
      const instrument: string | null = rel.attributes?.join(', ') || null

      const dbArtistId = upsertArtistWithMBID(artistName, artistMbid)
      if (!dbArtistId) continue

      if (albumRow) {
        insertAlbumCredit.run(uuidv4(), albumRow.id, dbArtistId, role, instrument, 0)
        added++
      }
    }

    // ----------------------------------------------------------------
    // 2. Recording-level relations → performers (per track)
    // ----------------------------------------------------------------
    for (const media of release.media || []) {
      for (const mbTrack of media.tracks || []) {
        const recordingId: string = (mbTrack as any).recording?.id
        if (!recordingId) continue

        // Find the matching DB track by musicbrainz_track_id
        const dbTrack = db.prepare(`
          SELECT id FROM tracks WHERE musicbrainz_track_id = ? LIMIT 1
        `).get(recordingId) as { id: string } | undefined

        if (!dbTrack) continue

        const recording = (mbTrack as any).recording
        const recordingRelations: any[] = recording?.relations || []

        let sortPos = 0
        for (const rel of recordingRelations) {
          if (rel['target-type'] !== 'artist' || !rel.artist) continue

          const artistName: string = rel.artist.name || ''
          const artistMbid: string = rel.artist.id || ''
          const role = mbRelationTypeToRole(rel.type)
          const instrument: string | null = rel.attributes?.join(', ') || null
          const creditedAs: string | null = rel['target-credit'] || null

          const dbArtistId = upsertArtistWithMBID(artistName, artistMbid)
          if (!dbArtistId) continue

          insertPerformer.run(uuidv4(), dbTrack.id, dbArtistId, role, instrument, creditedAs, sortPos++)
          added++
        }
      }
    }

    if (added > 0) {
      console.log(`🎤 Stored ${added} performer credits for album ${albumMbid}`)
      progress.performersAdded += added
    }

    return added
  } catch (error) {
    const msg = `Error enriching performers for album ${albumMbid}: ${(error as Error).message}`
    console.error(msg)
    progress.errors.push(msg)
    return 0
  }
}

/**
 * Fetch and store AcousticBrainz mood data for a track
 */
async function enrichTrackAcousticBrainz(trackId: string, recordingMbid: string | null, progress: EnrichmentProgress): Promise<boolean> {
  if (!recordingMbid) {
    return false
  }

  const db = getDatabase()

  try {
    // Fetch from AcousticBrainz
    const analysisResult = await acousticBrainzService.getRecordingAnalysis(recordingMbid, true)

    if (!analysisResult?.lowLevel && !analysisResult?.highlevel) {
      return false
    }

    const lowLevel = analysisResult.lowLevel
    const highLevel = analysisResult.highlevel

    // Upsert into database
    const id = uuidv4()
    const stmt = db.prepare(`
      INSERT INTO acousticbrainz_data (
        id, track_id, mbid, bpm, bpm_confidence, key, key_confidence,
        energy, danceability, acousticness, instrumentalness, 
        liveness, speechiness, valence, loudness_integrated,
        mood_acoustic, mood_aggressive, mood_electronic, mood_happy,
        mood_sad, mood_relaxed, mood_party
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(track_id) DO UPDATE SET
        bpm = excluded.bpm,
        key = excluded.key,
        energy = excluded.energy,
        danceability = excluded.danceability,
        acousticness = excluded.acousticness,
        instrumentalness = excluded.instrumentalness,
        liveness = excluded.liveness,
        speechiness = excluded.speechiness,
        valence = excluded.valence,
        mood_acoustic = excluded.mood_acoustic,
        mood_aggressive = excluded.mood_aggressive,
        mood_electronic = excluded.mood_electronic,
        mood_happy = excluded.mood_happy,
        mood_sad = excluded.mood_sad,
        mood_relaxed = excluded.mood_relaxed,
        mood_party = excluded.mood_party,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      id,
      trackId,
      recordingMbid,
      lowLevel?.bpm || null,
      lowLevel?.bpm_confidence || null,
      lowLevel?.key_key || null,
      lowLevel?.key_confidence || null,
      highLevel?.energy?.energetic || null,
      highLevel?.danceability?.danceable || null,
      highLevel?.mood_acoustic?.acoustic || null,
      highLevel?.voice_instrumental?.instrumental || null,
      null, // liveness
      null, // speechiness
      null, // valence
      null, // loudness_integrated
      highLevel?.mood_acoustic?.acoustic || null,
      highLevel?.mood_aggressive?.aggressive || null,
      highLevel?.mood_electronic?.electronic || null,
      highLevel?.mood_happy?.happy || null,
      highLevel?.mood_sad?.sad || null,
      highLevel?.mood_relaxed?.relaxed || null,
      highLevel?.mood_party?.party || null
    )

    progress.acousticbrainzAdded++
    return true
  } catch (error) {
    const msg = `Error enriching AcousticBrainz for track ${trackId}: ${(error as Error).message}`
    console.error(msg)
    progress.errors.push(msg)
    return false
  }
}

/**
 * Main enrichment worker function
 */
export async function startEnrichmentWorker(onProgress?: (progress: EnrichmentProgress) => void): Promise<EnrichmentProgress> {
  const db = getDatabase()
  const logId = uuidv4()
  const progress: EnrichmentProgress = {
    totalAlbums: 0,
    processedAlbums: 0,
    totalTracks: 0,
    enrichedTracks: 0,
    performersAdded: 0,
    acousticbrainzAdded: 0,
    errors: []
  }

  try {
    // Log start
    db.prepare(`
      INSERT INTO enrichment_log (id, status, started_at)
      VALUES (?, 'in_progress', CURRENT_TIMESTAMP)
    `).run(logId)

    // Get album groups
    const albumGroups = await getAlbumGroups()
    progress.totalAlbums = albumGroups.size

    // Get all tracks in the current DB
    const allTracks = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as any
    progress.totalTracks = allTracks.count || 0

    // Process each album
    for (const [albumMbid, trackIds] of albumGroups) {
      console.log(`Enriching album ${albumMbid} with ${trackIds.length} tracks...`)

      // Enrich performers (once per album)
      await enrichAlbumPerformers(albumMbid, progress)

      // Apply rate limit after performers request
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))

      // Enrich each track's AcousticBrainz data
      for (const trackId of trackIds) {
        const track = db.prepare('SELECT musicbrainz_track_id FROM tracks WHERE id = ?').get(trackId) as any

        if (track?.musicbrainz_track_id) {
          const enriched = await enrichTrackAcousticBrainz(trackId, track.musicbrainz_track_id, progress)
          if (enriched) {
            progress.enrichedTracks++
          }

          // Rate limit each request
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
        }
      }

      progress.processedAlbums++

      if (onProgress) {
        onProgress(progress)
      }
    }

    // Log completion
    db.prepare(`
      UPDATE enrichment_log
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          performers_fetched = ?,
          acousticbrainz_fetched = ?,
          tracks_updated = ?
      WHERE id = ?
    `).run(progress.performersAdded, progress.acousticbrainzAdded, progress.enrichedTracks, logId)

    console.log('Enrichment completed:', progress)
    return progress
  } catch (error) {
    const msg = `Enrichment error: ${(error as Error).message}`
    console.error(msg)
    progress.errors.push(msg)

    // Log error
    db.prepare(`
      UPDATE enrichment_log
      SET status = 'error',
          completed_at = CURRENT_TIMESTAMP,
          error_message = ?
      WHERE id = ?
    `).run(msg, logId)

    return progress
  }
}

/**
 * Get enrichment history
 */
export function getEnrichmentHistory(limit: number = 50) {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM enrichment_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
}

/**
 * Get current enrichment status (last log entry)
 */
export function getEnrichmentStatus() {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM enrichment_log
    ORDER BY created_at DESC
    LIMIT 1
  `).get()
}
