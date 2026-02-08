// @ts-ignore
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export interface MusicBrainzWriteData {
  // Recording (Track) MBIDs
  trackId?: string // MUSICBRAINZ_TRACKID
  recordingMBID?: string // MUSICBRAINZ_RELEASETRACKID
  isrc?: string // ISRC

  // Album MBIDs
  albumId?: string // MUSICBRAINZ_ALBUMID
  releaseGroupMBID?: string // MUSICBRAINZ_RELEASEGROUPID

  // Artist MBIDs (supports multiple artists)
  artistId?: string // MUSICBRAINZ_ARTISTID (primary)
  artistMBIDs?: string[] // All track artist MBIDs
  albumArtistMBID?: string // MUSICBRAINZ_ALBUMARTISTID
  albumArtistMBIDs?: string[] // All album artist MBIDs

  // Release metadata
  releaseDate?: string // DATE
  originalDate?: string // ORIGINALDATE
  label?: string // ORGANIZATION/LABEL
  catalogNumber?: string // CATALOGNUMBER
  barcode?: string // BARCODE
  country?: string // RELEASECOUNTRY
  media?: string // MEDIA
  albumType?: string // MUSICBRAINZ_ALBUMTYPE
  releaseStatus?: string // MUSICBRAINZ_ALBUMSTATUS

  // Genre and tags
  genres?: string[] // GENRE

  // AcousticBrainz audio analysis
  bpm?: number // BPM
  key?: string // INITIALKEY
  keySignature?: string // KEY_SIGNATURE
  energy?: number // ENERGY (0-1)
  danceability?: number // DANCEABILITY (0-1)
  acousticness?: number // ACOUSTICNESS (0-1)
  valence?: number // VALENCE (0-1, mood)
  instrumentalness?: number // INSTRUMENTALNESS (0-1)

  // Movement/Work metadata
  workMBID?: string // MUSICBRAINZ_WORKID
  movement?: string // MOVEMENTNAME
  movementNumber?: number // MOVEMENT
  movementTotal?: number // MOVEMENTTOTAL

  // Cover Art
  coverPath?: string // Path to cover image to embed
}

/**
 * Write rating, loved status, and play count to audio file
 *
 * FLAC: Uses FMPS_RATING (0.0-1.0), LOVED tag, and PLAY_COUNT tag (requires metaflac)
 * MP3: Uses POPM frame (Popularimeter) with rating 0-255, LOVED, and PLAY_COUNT
 *
 * @param filePath - Path to audio file
 * @param rating - Rating from 0-5 (supports 0.5 increments)
 * @param loved - Whether track is loved/favorited
 * @param playCount - Total play count (optional)
 */
export async function writeMetadata(
  filePath: string,
  rating: number,
  loved: boolean,
  playCount?: number,
  musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
  const ext = path.extname(filePath).toLowerCase()

  try {
    if (ext === '.flac') {
      await writeFLACMetadata(filePath, rating, loved, playCount, musicBrainzData)
    } else if (ext === '.mp3') {
      await writeMP3Metadata(filePath, rating, loved, playCount, musicBrainzData)
    } else {
      console.log(`⚠️ Unsupported file format: ${ext}, skipping file write`)
      return
    }

    console.log(
      `✅ Wrote metadata to ${filePath}: rating=${rating}, loved=${loved}, playCount=${playCount || 0}`
    )
  } catch (error) {
    console.error(`❌ Failed to write metadata to ${filePath}:`, error)
    // Don't throw - just log and continue
  }
}

/**
 * Write metadata to FLAC file using metaflac command-line tool
 */
async function writeFLACMetadata(
  filePath: string,
  rating: number,
  loved: boolean,
  playCount?: number,
  musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
  // Convert 0-5 rating to 0.0-1.0 scale
  const fmpsRating = (rating / 5).toFixed(2)

  try {
    // Check if metaflac is available
    await execAsync('where metaflac')
  } catch (error) {
    console.warn(
      '⚠️ metaflac not found - install FLAC tools (part of flac.exe/metaflac.exe) to write FLAC metadata. Skipping FLAC file write.'
    )
    throw new Error('metaflac not installed on system path')
  }

  // Remove existing tags
  await execAsync(`metaflac --remove-tag=FMPS_RATING "${filePath}"`)
  await execAsync(`metaflac --remove-tag=FMPS_RATING_USER "${filePath}"`)
  await execAsync(`metaflac --remove-tag=RATING "${filePath}"`)
  await execAsync(`metaflac --remove-tag=LOVED "${filePath}"`)
  await execAsync(`metaflac --remove-tag=PLAY_COUNT "${filePath}"`)

  // Set new tags
  await execAsync(`metaflac --set-tag=FMPS_RATING=${fmpsRating} "${filePath}"`)
  await execAsync(`metaflac --set-tag=RATING=${rating} "${filePath}"`)
  await execAsync(`metaflac --set-tag=FMPS_RATING_USER=MusicMaster "${filePath}"`)

  if (loved) {
    await execAsync(`metaflac --set-tag=LOVED=1 "${filePath}"`)
  }

  if (playCount !== undefined) {
    await execAsync(`metaflac --set-tag=PLAY_COUNT=${playCount} "${filePath}"`)
  }

  if (musicBrainzData) {
    // Write MusicBrainz IDs
    const mbTags = [
      // Recording/Track IDs
      {
        key: 'MUSICBRAINZ_TRACKID',
        value: musicBrainzData.trackId || musicBrainzData.recordingMBID
      },
      { key: 'MUSICBRAINZ_RELEASETRACKID', value: musicBrainzData.recordingMBID },
      { key: 'ISRC', value: musicBrainzData.isrc },

      // Album IDs
      { key: 'MUSICBRAINZ_ALBUMID', value: musicBrainzData.albumId },
      { key: 'MUSICBRAINZ_RELEASEGROUPID', value: musicBrainzData.releaseGroupMBID },

      // Artist IDs (primary)
      { key: 'MUSICBRAINZ_ARTISTID', value: musicBrainzData.artistId },
      { key: 'MUSICBRAINZ_ALBUMARTISTID', value: musicBrainzData.albumArtistMBID },

      // Release metadata
      { key: 'DATE', value: musicBrainzData.releaseDate },
      { key: 'ORIGINALDATE', value: musicBrainzData.originalDate },
      { key: 'ORGANIZATION', value: musicBrainzData.label },
      { key: 'LABEL', value: musicBrainzData.label },
      { key: 'CATALOGNUMBER', value: musicBrainzData.catalogNumber },
      { key: 'BARCODE', value: musicBrainzData.barcode },
      { key: 'RELEASECOUNTRY', value: musicBrainzData.country },
      { key: 'MEDIA', value: musicBrainzData.media },
      { key: 'MUSICBRAINZ_ALBUMTYPE', value: musicBrainzData.albumType },
      { key: 'MUSICBRAINZ_ALBUMSTATUS', value: musicBrainzData.releaseStatus },

      // AcousticBrainz data
      { key: 'BPM', value: musicBrainzData.bpm?.toString() },
      { key: 'INITIALKEY', value: musicBrainzData.key },
      { key: 'KEY_SIGNATURE', value: musicBrainzData.keySignature },
      { key: 'ENERGY', value: musicBrainzData.energy?.toFixed(3) },
      { key: 'DANCEABILITY', value: musicBrainzData.danceability?.toFixed(3) },
      { key: 'ACOUSTICNESS', value: musicBrainzData.acousticness?.toFixed(3) },
      { key: 'VALENCE', value: musicBrainzData.valence?.toFixed(3) },
      { key: 'INSTRUMENTALNESS', value: musicBrainzData.instrumentalness?.toFixed(3) },

      // Movement/Work metadata
      { key: 'MUSICBRAINZ_WORKID', value: musicBrainzData.workMBID },
      { key: 'MOVEMENTNAME', value: musicBrainzData.movement },
      { key: 'MOVEMENT', value: musicBrainzData.movementNumber?.toString() },
      { key: 'MOVEMENTTOTAL', value: musicBrainzData.movementTotal?.toString() }
    ]

    // Write single-value tags
    for (const tag of mbTags) {
      if (tag.value) {
        await execAsync(`metaflac --remove-tag=${tag.key} "${filePath}"`)
        await execAsync(`metaflac --set-tag=${tag.key}="${tag.value}" "${filePath}"`)
      }
    }

    // Write multiple artist MBIDs
    if (musicBrainzData.artistMBIDs && musicBrainzData.artistMBIDs.length > 0) {
      await execAsync(`metaflac --remove-tag=MUSICBRAINZ_ARTISTID "${filePath}"`)
      for (const mbid of musicBrainzData.artistMBIDs) {
        await execAsync(`metaflac --set-tag=MUSICBRAINZ_ARTISTID="${mbid}" "${filePath}"`)
      }
    }

    // Write multiple album artist MBIDs
    if (musicBrainzData.albumArtistMBIDs && musicBrainzData.albumArtistMBIDs.length > 0) {
      await execAsync(`metaflac --remove-tag=MUSICBRAINZ_ALBUMARTISTID "${filePath}"`)
      for (const mbid of musicBrainzData.albumArtistMBIDs) {
        await execAsync(`metaflac --set-tag=MUSICBRAINZ_ALBUMARTISTID="${mbid}" "${filePath}"`)
      }
    }

    // Write genres (replace existing)
    if (musicBrainzData.genres && musicBrainzData.genres.length > 0) {
      await execAsync(`metaflac --remove-tag=GENRE "${filePath}"`)
      for (const genre of musicBrainzData.genres) {
        await execAsync(`metaflac --set-tag=GENRE="${genre}" "${filePath}"`)
      }
    }

    // Embed Cover Art
    if (musicBrainzData.coverPath) {
      try {
        // Remove existing picture
        await execAsync(`metaflac --remove --block-type=PICTURE "${filePath}"`)
        // Import new picture
        // 3 = Cover (front)
        await execAsync(`metaflac --import-picture-from="3:image/jpeg:${musicBrainzData.coverPath}" "${filePath}"`)
      } catch (error) {
        console.error(`Failed to embed cover art for ${filePath}:`, error)
      }
    }
  }
}

async function writeMP3Metadata(
  filePath: string,
  rating: number,
  loved: boolean,
  playCount?: number,
  musicBrainzData?: MusicBrainzWriteData
): Promise<void> {
  // Convert 0-5 rating to 0-255 scale
  const popmRating = Math.round((rating / 5) * 255)

  // Read existing tags
  const tags = NodeID3.read(filePath)

  // Update POPM frame and userDefinedText for LOVED and PLAY_COUNT
  const updatedTags: NodeID3.Tags = {
    ...tags,
    popularimeter: {
      email: 'MusicWest',
      rating: popmRating,
      counter: 0
    },
    userDefinedText: [
      ...(tags.userDefinedText?.filter(
        (t) => t.description !== 'LOVED' && t.description !== 'PLAY_COUNT'
      ) || []),
      {
        description: 'LOVED',
        value: loved ? '1' : '0'
      }
    ]
  }

  if (playCount !== undefined) {
    updatedTags.userDefinedText!.push({
      description: 'PLAY_COUNT',
      value: playCount.toString()
    })
  }

  if (musicBrainzData) {
    // Map standard ID3 frames
    if (musicBrainzData.releaseDate) updatedTags.date = musicBrainzData.releaseDate
    if (musicBrainzData.originalDate) {
      // node-id3 types are missing originalDate but it is supported as 'originalReleaseTime' or 'originalDate'
      ; (updatedTags as any).originalDate = musicBrainzData.originalDate
    }
    if (musicBrainzData.label) updatedTags.publisher = musicBrainzData.label // TPUB
    if (musicBrainzData.genres) updatedTags.genre = musicBrainzData.genres.join(';')
    if (musicBrainzData.bpm) updatedTags.bpm = musicBrainzData.bpm.toString()
    if (musicBrainzData.key) updatedTags.initialKey = musicBrainzData.key

    // Map TXXX (User Defined Text) frames for MusicBrainz IDs
    const mbMap = [
      // Recording/Track IDs
      {
        desc: 'MusicBrainz Release Track Id',
        val: musicBrainzData.trackId || musicBrainzData.recordingMBID
      },
      {
        desc: 'MUSICBRAINZ_TRACKID',
        val: musicBrainzData.trackId || musicBrainzData.recordingMBID
      },
      { desc: 'MUSICBRAINZ_RELEASETRACKID', val: musicBrainzData.recordingMBID },
      { desc: 'ISRC', val: musicBrainzData.isrc },

      // Album IDs
      { desc: 'MusicBrainz Album Id', val: musicBrainzData.albumId },
      { desc: 'MUSICBRAINZ_ALBUMID', val: musicBrainzData.albumId },
      { desc: 'MUSICBRAINZ_RELEASEGROUPID', val: musicBrainzData.releaseGroupMBID },

      // Artist IDs
      { desc: 'MusicBrainz Artist Id', val: musicBrainzData.artistId },
      { desc: 'MUSICBRAINZ_ARTISTID', val: musicBrainzData.artistId },
      { desc: 'MUSICBRAINZ_ALBUMARTISTID', val: musicBrainzData.albumArtistMBID },

      // Release metadata
      { desc: 'CATALOGNUMBER', val: musicBrainzData.catalogNumber },
      { desc: 'BARCODE', val: musicBrainzData.barcode },
      { desc: 'RELEASECOUNTRY', val: musicBrainzData.country },
      { desc: 'MEDIA', val: musicBrainzData.media },
      { desc: 'MUSICBRAINZ_ALBUMTYPE', val: musicBrainzData.albumType },
      { desc: 'MusicBrainz Album Type', val: musicBrainzData.albumType },
      { desc: 'MUSICBRAINZ_ALBUMSTATUS', val: musicBrainzData.releaseStatus },
      { desc: 'MusicBrainz Album Status', val: musicBrainzData.releaseStatus },

      // AcousticBrainz audio analysis
      { desc: 'ENERGY', val: musicBrainzData.energy?.toFixed(3) },
      { desc: 'DANCEABILITY', val: musicBrainzData.danceability?.toFixed(3) },
      { desc: 'ACOUSTICNESS', val: musicBrainzData.acousticness?.toFixed(3) },
      { desc: 'VALENCE', val: musicBrainzData.valence?.toFixed(3) },
      { desc: 'INSTRUMENTALNESS', val: musicBrainzData.instrumentalness?.toFixed(3) },

      // Movement/Work metadata
      { desc: 'MUSICBRAINZ_WORKID', val: musicBrainzData.workMBID },
      { desc: 'MOVEMENTNAME', val: musicBrainzData.movement },
      { desc: 'MOVEMENT', val: musicBrainzData.movementNumber?.toString() },
      { desc: 'MOVEMENTTOTAL', val: musicBrainzData.movementTotal?.toString() }
    ]

    // Write all TXXX frames
    for (const item of mbMap) {
      if (item.val) {
        updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(
          (t) => t.description !== item.desc
        )
        updatedTags.userDefinedText.push({ description: item.desc, value: item.val })
      }
    }

    // Handle multiple artist MBIDs (join with semicolon)
    if (musicBrainzData.artistMBIDs && musicBrainzData.artistMBIDs.length > 0) {
      const mbids = musicBrainzData.artistMBIDs.join(';')
      updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(
        (t) => t.description !== 'MUSICBRAINZ_ARTISTID'
      )
      updatedTags.userDefinedText.push({ description: 'MUSICBRAINZ_ARTISTID', value: mbids })
    }

    // Handle multiple album artist MBIDs
    if (musicBrainzData.albumArtistMBIDs && musicBrainzData.albumArtistMBIDs.length > 0) {
      const mbids = musicBrainzData.albumArtistMBIDs.join(';')
      updatedTags.userDefinedText = updatedTags.userDefinedText!.filter(
        (t) => t.description !== 'MUSICBRAINZ_ALBUMARTISTID'
      )
      updatedTags.userDefinedText.push({ description: 'MUSICBRAINZ_ALBUMARTISTID', value: mbids })
    }

    if (musicBrainzData.coverPath) {
      try {
        const imageBuffer = fs.readFileSync(musicBrainzData.coverPath)
        updatedTags.image = {
          mime: 'image/jpeg',
          type: {
            id: 3,
            name: 'front cover'
          },
          description: 'Cover',
          imageBuffer: imageBuffer
        }
      } catch (error) {
        console.error('Failed to read cover image for embedding:', error)
      }
    }
  }

  // Write tags back to file
  const success = NodeID3.write(updatedTags, filePath)

  if (!success) {
    throw new Error('Failed to write ID3 tags')
  }
}

/**
 * Read rating and loved status from audio file
 *
 * @param filePath - Path to audio file
 * @returns Object with rating (0-5) and loved (boolean)
 */
export async function readMetadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
  const ext = path.extname(filePath).toLowerCase()

  try {
    if (ext === '.flac') {
      return await readFLACMetadata(filePath)
    } else if (ext === '.mp3') {
      return await readMP3Metadata(filePath)
    } else {
      return { rating: 0, loved: false }
    }
  } catch (error) {
    console.error(`Error reading metadata from ${filePath}:`, error)
    return { rating: 0, loved: false }
  }
}

/**
 * Read metadata from FLAC file
 */
async function readFLACMetadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
  const metadata = await parseFile(filePath)

  // Try to read FMPS_RATING tag
  const fmpsRating = metadata.native?.vorbis?.find((tag) => tag.id === 'FMPS_RATING')?.value as
    | string
    | undefined
  const lovedTag = metadata.native?.vorbis?.find((tag) => tag.id === 'LOVED')?.value as
    | string
    | undefined

  const rating = fmpsRating ? parseFloat(fmpsRating) * 5 : 0
  const loved = lovedTag === '1'

  return { rating, loved }
}

/**
 * Read metadata from MP3 file
 */
async function readMP3Metadata(filePath: string): Promise<{ rating: number; loved: boolean }> {
  const tags = NodeID3.read(filePath)

  const popmRating = tags.popularimeter?.rating || 0
  const rating = (popmRating / 255) * 5

  const loved = tags.userDefinedText?.find((t) => t.description === 'LOVED')?.value === '1'

  return { rating, loved }
}

/**
 * Check if metaflac is available (required for FLAC support)
 */
export async function checkMetaflacAvailable(): Promise<boolean> {
  try {
    await execAsync('metaflac --version')
    return true
  } catch {
    return false
  }
}

/**
 * Build MusicBrainzWriteData from database row
 * Fetches all MusicBrainz metadata for a track from the database
 *
 * @param db - Database instance
 * @param trackId - Internal track ID
 * @returns MusicBrainzWriteData object ready for writing
 */
export function buildMusicBrainzDataFromDb(db: any, trackId: string): MusicBrainzWriteData | null {
  // Get track with MusicBrainz data
  const track = db
    .prepare(
      `
        SELECT 
            t.musicbrainz_track_id as recording_mbid,
            t.isrc,
            t.movement_name as movement,
            t.movement_num as movement_number,
            a.mbid as album_mbid,
            a.album_type,
            a.status as release_status,
            a.release_date,
            a.original_release_date,
            a.label,
            a.catalog_number,
            a.barcode,
            a.release_country as country,
            a.release_group_mbid
        FROM tracks t
        LEFT JOIN albums a ON t.musicbrainz_album_id = a.mbid
        WHERE t.id = ?
    `
    )
    .get(trackId)

  if (!track) {
    return null
  }

  // Get all track artists (for multi-artist tracks)
  const trackArtists = db
    .prepare(
      `
        SELECT art.mbid, ta.join_phrase, ta.position
        FROM track_artists ta
        JOIN artists art ON ta.artist_id = art.id
        WHERE ta.track_id = ?
        ORDER BY ta.position
    `
    )
    .all(trackId)

  // Get all album artists
  const albumArtists = db
    .prepare(
      `
        SELECT art.mbid, aa.join_phrase, aa.position
        FROM album_artists aa
        JOIN artists art ON aa.artist_id = art.id
        WHERE aa.album_id = (SELECT album_id FROM tracks WHERE id = ?)
        ORDER BY aa.position
    `
    )
    .all(trackId)

  // Get genre tags
  const genres = db
    .prepare(
      `
        SELECT g.name
        FROM track_genres tg
        JOIN genres g ON tg.genre_id = g.id
        WHERE tg.track_id = ?
        ORDER BY tg.vote_count DESC
        LIMIT 5
    `
    )
    .all(trackId)
    .map((row: any) => row.name)

  // Get AcousticBrainz data
  const acousticData = db
    .prepare(
      `
        SELECT 
            bpm,
            key,
            key_signature,
            energy,
            danceability,
            acousticness,
            valence,
            instrumentalness
        FROM acousticbrainz_data
        WHERE recording_mbid = ?
    `
    )
    .get(track.recording_mbid)

  // Build the data object
  const data: MusicBrainzWriteData = {
    // Recording
    recordingMBID: track.recording_mbid,
    trackId: track.recording_mbid,
    isrc: track.isrc,

    // Album
    albumId: track.album_mbid,
    releaseGroupMBID: track.release_group_mbid,

    // Artists
    artistMBIDs: trackArtists.map((a: any) => a.mbid).filter(Boolean),
    artistId: trackArtists[0]?.mbid,
    albumArtistMBIDs: albumArtists.map((a: any) => a.mbid).filter(Boolean),
    albumArtistMBID: albumArtists[0]?.mbid,

    // Release metadata
    releaseDate: track.release_date,
    originalDate: track.original_release_date,
    label: track.label,
    catalogNumber: track.catalog_number,
    barcode: track.barcode,
    country: track.country,
    media: track.media,
    albumType: track.album_type,
    releaseStatus: track.release_status,

    // Genres
    genres: genres.length > 0 ? genres : undefined,

    // Movement/Work
    workMBID: track.work_mbid,
    movement: track.movement,
    movementNumber: track.movement_number,
    movementTotal: track.movement_total
  }

  // Add AcousticBrainz data if available
  if (acousticData) {
    data.bpm = acousticData.bpm
    data.key = acousticData.key
    data.keySignature = acousticData.key_signature
    data.energy = acousticData.energy
    data.danceability = acousticData.danceability
    data.acousticness = acousticData.acousticness
    data.valence = acousticData.valence
    data.instrumentalness = acousticData.instrumentalness
  }

  return data
}

/**
 * Write MusicBrainz metadata from database to audio file
 *
 * @param db - Database instance
 * @param trackId - Internal track ID
 * @returns true if successful, false otherwise
 */
export async function writeMusicBrainzDataToFile(db: any, trackId: string): Promise<boolean> {
  try {
    // Get track path
    const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId)
    if (!track?.file_path) {
      console.error(`Track ${trackId} not found or has no file_path`)
      return false
    }

    // Build MusicBrainz data from database
    const mbData = buildMusicBrainzDataFromDb(db, trackId)
    if (!mbData) {
      console.error(`No MusicBrainz data found for track ${trackId}`)
      return false
    }

    // Get current rating/loved/playcount to preserve them
    const trackMeta = db
      .prepare('SELECT rating, loved, play_count FROM tracks WHERE id = ?')
      .get(trackId)

    // Write all metadata including MusicBrainz data
    await writeMetadata(
      track.file_path,
      trackMeta.rating || 0,
      trackMeta.loved === 1,
      trackMeta.play_count,
      mbData
    )

    console.log(`✅ Wrote MusicBrainz data to file: ${track.file_path}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to write MusicBrainz data for track ${trackId}:`, error)
    return false
  }
}

/**
 * Bulk write MusicBrainz metadata for multiple tracks
 *
 * @param db - Database instance
 * @param trackIds - Array of track IDs to update
 * @param onProgress - Optional callback for progress updates
 * @returns Summary object with success/failure counts
 */
export async function bulkWriteMusicBrainzData(
  db: any,
  trackIds: string[],
  onProgress?: (current: number, total: number, trackPath: string) => void
): Promise<{ success: number; failed: number; skipped: number }> {
  const results = { success: 0, failed: 0, skipped: 0 }

  for (let i = 0; i < trackIds.length; i++) {
    const trackId = trackIds[i]

    // Get track path for progress callback
    const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId)

    if (onProgress) {
      onProgress(i + 1, trackIds.length, track?.file_path || 'unknown')
    }

    try {
      const success = await writeMusicBrainzDataToFile(db, trackId)
      if (success) {
        results.success++
      } else {
        results.skipped++
      }
    } catch (error) {
      console.error(`Error writing MusicBrainz data for track ${trackId}:`, error)
      results.failed++
    }

    // Small delay to avoid overwhelming system
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  return results
}

/**
 * Write MusicBrainz data for all tracks that have MBID but haven't been written to file yet
 *
 * @param db - Database instance
 * @param onProgress - Optional callback for progress updates
 * @returns Summary object with success/failure counts
 */
export async function syncAllMusicBrainzData(
  db: any,
  onProgress?: (current: number, total: number, trackPath: string) => void
): Promise<{ success: number; failed: number; skipped: number }> {
  // Get all tracks that have MBIDs
  const tracks = db
    .prepare(
      `
        SELECT id
        FROM tracks
        WHERE mbid IS NOT NULL
        ORDER BY id
    `
    )
    .all()

  const trackIds = tracks.map((t: any) => t.id)

  console.log(`📝 Starting MusicBrainz sync for ${trackIds.length} tracks...`)

  return await bulkWriteMusicBrainzData(db, trackIds, onProgress)
}
