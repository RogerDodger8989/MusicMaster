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
import { acousticBrainzService } from './acousticbrainz'
import { musicBrainzService } from './musicbrainz'
import { backgroundEnricher } from './enricher'
import {
  upsertArtistWithMBID,
  addPerformer,
  addAlbumCredit
} from '../database/musicbrainz'
import { calculateArousalValence, assignMoodCategory, findClosestMoodCategory, calculateConfidenceScore } from './moodTaxonomy'
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

  // Query: Tracks with album MBID (recording_id can be NULL, we'll try to fetch it)
  const query = `
    SELECT DISTINCT 
      t.id as track_id,
      t.musicbrainz_album_id,
      t.musicbrainz_track_id,
      t.title,
      t.artist
    FROM tracks t
    WHERE t.musicbrainz_album_id IS NOT NULL
    ORDER BY t.musicbrainz_album_id
  `

  const rows = db.prepare(query).all() as any[]
  const groups = new Map<string, string[]>()

  for (const row of rows) {
    if (!groups.has(row.musicbrainz_album_id)) {
      groups.set(row.musicbrainz_album_id, [])
    }
    groups.get(row.musicbrainz_album_id)!.push(row.track_id)
  }

  return groups
}

/**
 * Fetch and store AcousticBrainz mood data for a track
 */
async function enrichTrackAcousticBrainz(trackId: string, recordingMbid: string | null, progress: EnrichmentProgress): Promise<boolean> {
  const db = getDatabase()
  let mbid = recordingMbid

  // If no recording MBID, try to fetch from MusicBrainz API using album + track title
  if (!mbid) {
    try {
      const track = db.prepare('SELECT musicbrainz_album_id, title, artist FROM tracks WHERE id = ?').get(trackId) as any
      if (!track?.musicbrainz_album_id) {
        return false
      }

      console.log(`  📍 Fetching recording ID for ${track.title} from album ${track.musicbrainz_album_id}`)

      // Fetch release info from MB to get recording IDs
      const releaseUrl = `https://musicbrainz.org/ws/2/release/${track.musicbrainz_album_id}?inc=recordings&client=MusicMaster/1.0`
      const response = await fetch(releaseUrl)
      if (!response.ok) {
        console.log(`  ❌ Failed to fetch from MusicBrainz: ${response.status}`)
        return false
      }

      const release = (await response.json()) as any

      // Try to match recording by track title
      if (release.media && release.media[0]?.tracks) {
        const matchedTrack = release.media[0].tracks.find((t: any) =>
          t.title.toLowerCase() === track.title.toLowerCase()
        )
        if (matchedTrack?.recording?.id) {
          mbid = matchedTrack.recording.id
          console.log(`  ✅ Found recording ID: ${mbid}`)
          // Update database with recording MBID for future use
          db.prepare('UPDATE tracks SET musicbrainz_track_id = ? WHERE id = ?').run(mbid, trackId)
        }
      }
    } catch (error) {
      console.error(`Failed to fetch recording ID for track ${trackId}:`, error)
      return false
    }
  }

  if (!mbid) {
    return false
  }

  try {
    console.log(`  🎵 Fetching AcousticBrainz data for recording ${mbid}`)

    // Fetch from AcousticBrainz with both low-level and high-level
    const analysisHigh = await acousticBrainzService.getRecordingAnalysis(mbid, true)
    const analysisLow = await acousticBrainzService.getRecordingAnalysis(mbid, false)

    if (!analysisHigh && !analysisLow) {
      console.log(`  ❌ No AcousticBrainz data found for ${mbid}`)
      return false
    }

    console.log(`  ✅ Got AcousticBrainz data`)

    // Extract simple mood/energy values from AcousticBrainz response
    const id = uuidv4()
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO acousticbrainz_data (
        id, track_id, mbid, bpm, bpm_confidence, key, key_confidence,
        energy, danceability, mood_acoustic, mood_aggressive, mood_electronic,
        mood_happy, mood_sad, mood_relaxed, mood_party,
        arousal, valence, mood_category, confidence_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const bpm = analysisLow?.lowLevel?.bpm || null
    const bpm_confidence = analysisLow?.lowLevel?.bpm_confidence || null
    const key = analysisLow?.lowLevel?.key_key || null
    const key_confidence = analysisLow?.lowLevel?.key_confidence || null

    const energy = analysisHigh?.highlevel?.energy?.energetic || null
    const danceability = analysisHigh?.highlevel?.danceability?.danceable || null
    const mood_acoustic = analysisHigh?.highlevel?.mood_acoustic?.acoustic || null
    const mood_aggressive = analysisHigh?.highlevel?.mood_aggressive?.aggressive || null
    const mood_electronic = analysisHigh?.highlevel?.mood_electronic?.electronic || null
    const mood_happy = analysisHigh?.highlevel?.mood_happy?.happy || null
    const mood_sad = analysisHigh?.highlevel?.mood_sad?.sad || null
    const mood_relaxed = analysisHigh?.highlevel?.mood_relaxed?.relaxed || null
    const mood_party = analysisHigh?.highlevel?.mood_party?.party || null

    // Calculate Arousal-Valence and mood category
    const { arousal, valence, confidence: avConfidence } = calculateArousalValence(
      energy,
      danceability,
      {
        mood_happy,
        mood_sad,
        mood_aggressive,
        mood_party,
        mood_relaxed,
        mood_acoustic
      }
    )

    // Assign mood category
    const moodCategory = assignMoodCategory(arousal, valence, bpm)

    // Calculate final confidence score
    const { distance } = findClosestMoodCategory(arousal, valence)
    const confidence_score = calculateConfidenceScore(
      energy !== null,
      danceability !== null,
      bpm !== null,
      {
        mood_happy,
        mood_sad,
        mood_aggressive,
        mood_party,
        mood_relaxed,
        mood_acoustic
      },
      distance
    )


    stmt.run(
      id,
      trackId,
      mbid,
      bpm,
      bpm_confidence,
      key,
      key_confidence,
      energy,
      danceability,
      mood_acoustic,
      mood_aggressive,
      mood_electronic,
      mood_happy,
      mood_sad,
      mood_relaxed,
      mood_party,
      arousal,
      valence,
      moodCategory.id,
      confidence_score
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
 * Fetch and store Performer/Credit data for an album
 */
async function enrichAlbumPerformers(albumMbid: string, progress: EnrichmentProgress): Promise<number> {
  const db = getDatabase()
  let performersAddedCount = 0

  try {
    console.log(`  🔍 Fetching MusicBrainz relationships for release ${albumMbid}`)
    const release = await musicBrainzService.getReleaseDetails(albumMbid)

    if (!release) {
      console.log(`  ❌ No release details found for MBID: ${albumMbid}`)
      return 0
    }

    // 1. Process Album-level credits (Producer, etc.)
    const albumRoles = musicBrainzService.extractRoles(release)
    const albumRow = db.prepare('SELECT id FROM albums_cache WHERE musicbrainz_album_id = ?').get(albumMbid) as { id: string } | undefined

    if (albumRow) {
      for (const [role, artists] of Object.entries(albumRoles)) {
        for (const artist of artists) {
          try {
            // Ensure artist exists in our artists table
            const artistId = upsertArtistWithMBID(artist.name, artist.mbid || null)
            addAlbumCredit(albumRow.id, artistId, role)

            // Proactively fetch artist bio/image
            backgroundEnricher.enrichArtistById(artistId, artist.name).catch(e =>
              console.warn(`[EnrichmentWorker] Proactive artist enrichment failed for ${artist.name}:`, e)
            )
          } catch (e) {
            console.error(`  ❌ Failed to add album credit for ${artist.name}:`, e)
          }
        }
      }
    }

    // 2. Process Track-level performers
    // Many releases have performance relationships at the recording level (inc=recording-level-rels)
    if (release.media) {
      for (const media of release.media) {
        if (!media.tracks) continue

        for (const mbTrack of media.tracks) {
          const recMbid = mbTrack.recording?.id
          if (!recMbid) continue

          // Find track in our DB by recording MBID
          let trackRow = db.prepare('SELECT id FROM tracks WHERE musicbrainz_track_id = ?').get(recMbid) as { id: string } | undefined

          // Fallback: match by album name + disc/track number
          if (!trackRow) {
            const discNum = media.position
            const trackNum = parseInt(mbTrack.number) || parseInt(mbTrack.position)

            const localAlbum = db.prepare('SELECT name, artist FROM albums_cache WHERE musicbrainz_album_id = ?').get(albumMbid) as { name: string, artist: string } | undefined

            if (localAlbum) {
              trackRow = db.prepare(`
                  SELECT id FROM tracks 
                  WHERE album = ? AND (album_artist = ? OR artist = ?) 
                  AND track_num = ? AND (disc_num = ? OR disc_num IS NULL)
              `).get(localAlbum.name, localAlbum.artist, localAlbum.artist, trackNum, discNum) as { id: string } | undefined

              if (trackRow) {
                console.log(`  🔗 Matched local track ${trackRow.id} via track/disc number fallback (${mbTrack.title})`)
                db.prepare('UPDATE tracks SET musicbrainz_track_id = ? WHERE id = ?').run(recMbid, trackRow.id)
              }
            }
          }

          if (!trackRow) continue

          // Fetch full recording details to get performers
          const recording = await musicBrainzService.getRecordingDetails(recMbid)
          if (!recording) continue

          const trackRoles = musicBrainzService.extractRoles(recording)
          for (const [role, artists] of Object.entries(trackRoles)) {
            for (const artist of artists) {
              try {
                const artistId = upsertArtistWithMBID(artist.name, artist.mbid || null)
                addPerformer(trackRow.id, artistId, role)
                performersAddedCount++

                // Proactively fetch artist bio/image
                backgroundEnricher.enrichArtistById(artistId, artist.name).catch(e =>
                  console.warn(`[EnrichmentWorker] Proactive artist enrichment failed for ${artist.name}:`, e)
                )
              } catch (e) {
                console.error(`  ❌ Failed to add performer for track ${trackRow.id}:`, e)
              }
            }
          }

          // Rate limit recordings lookups
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
        }
      }
    }

    progress.performersAdded += performersAddedCount
    return performersAddedCount
  } catch (error) {
    const msg = `Error enriching performers for album ${albumMbid}: ${(error as Error).message}`
    console.error(msg)
    progress.errors.push(msg)
    return 0
  }
}

/**
 * Main enrichment worker function
 */
export async function startEnrichmentWorker(progressCallback?: (progress: EnrichmentProgress) => void): Promise<EnrichmentProgress> {
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

    console.log('🚀 Starting enrichment worker...')

    // Get album groups
    const albumGroups = await getAlbumGroups()
    progress.totalAlbums = albumGroups.size

    // Count all tracks in the current DB
    const allTracks = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as any
    progress.totalTracks = allTracks.count || 0

    console.log(`📊 Found ${progress.totalAlbums} albums with ${progress.totalTracks} total tracks in DB`)

    // Process each album
    for (const [albumMbid, trackIds] of albumGroups) {
      console.log(`🎵 Enriching album ${albumMbid} with ${trackIds.length} tracks...`)

      // 1. Enrich Album Performers and Credits (MusicBrainz)
      await enrichAlbumPerformers(albumMbid, progress)

      // 2. Enrich each track's AcousticBrainz data
      for (const trackId of trackIds) {
        const track = db.prepare('SELECT musicbrainz_track_id FROM tracks WHERE id = ?').get(trackId) as any

        // Pass null recording_id if not present - enrichTrackAcousticBrainz will try to fetch it
        const enriched = await enrichTrackAcousticBrainz(trackId, track?.musicbrainz_track_id || null, progress)
        if (enriched) {
          progress.enrichedTracks++
        }

        // Rate limit each request
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
      }

      progress.processedAlbums++

      if (progressCallback) {
        progressCallback(progress)
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

    console.log('✅ Enrichment completed:', progress)
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

/**
 * Check if all tracks are enriched (used at server startup)
 */
export function getEnrichmentCoverage() {
  const db = getDatabase()

  // Count all tracks in DB
  const total = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as any

  // Count those with AcousticBrainz data
  const enrichedMood = db.prepare(`
    SELECT COUNT(*) as count FROM tracks t
    INNER JOIN acousticbrainz_data ab ON t.id = ab.track_id
  `).get() as any

  // Count those with Performer data (either track-level or album-level)
  const enrichedPerformers = db.prepare(`
    SELECT COUNT(DISTINCT t.id) as count FROM tracks t
    LEFT JOIN performers p ON t.id = p.track_id
    LEFT JOIN albums_cache ac ON t.album = ac.name AND t.artist = ac.artist
    LEFT JOIN album_credits alc ON ac.id = alc.album_id
    WHERE p.id IS NOT NULL OR alc.id IS NOT NULL
  `).get() as any

  const enrichedCount = Math.min(enrichedMood.count || 0, enrichedPerformers.count || 0)

  return {
    totalTracks: total.count || 0,
    enrichedTracks: enrichedCount,
    enrichedMood: enrichedMood.count || 0,
    enrichedPerformers: enrichedPerformers.count || 0,
    coveragePercentage: total.count > 0 ? Math.round((enrichedCount / total.count) * 100) : 0
  }
}
