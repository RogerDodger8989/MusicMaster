/**
 * ReplayGain Audio Level Normalization
 *
 * ReplayGain stores volume adjustments as dB values in audio metadata.
 * This utility converts dB values to linear volume multipliers.
 */

/**
 * Convert decibels to linear gain multiplier
 * Formula: linear = 10^(dB/20)
 * @param db - Decibel value
 * @returns Linear gain multiplier (0-∞, where 1.0 = no change)
 */
export function dbToLinearGain(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Calculate effective ReplayGain based on mode and track metadata
 * @param track - Track object with optional ReplayGain metadata
 * @param mode - 'track', 'album', or 'off'
 * @returns Linear gain multiplier to apply to playback volume
 */
export function calculateReplayGain(
  track: {
    replayGainTrack?: number
    replayGainAlbum?: number
    replayGainTrackPeak?: number
    replayGainAlbumPeak?: number
  },
  mode: 'track' | 'album' | 'off'
): number {
  if (mode === 'off') return 1.0

  let gainDb: number | undefined

  if (mode === 'album') {
    gainDb = track.replayGainAlbum
  } else if (mode === 'track') {
    gainDb = track.replayGainTrack
  }

  if (gainDb === undefined) {
    // Fallback: if album mode but no album gain, try track gain
    if (mode === 'album' && track.replayGainTrack !== undefined) {
      gainDb = track.replayGainTrack
    } else {
      return 1.0 // No ReplayGain data available
    }
  }

  return dbToLinearGain(gainDb)
}

/**
 * Calculate safe volume with peaks protection
 * ReplayGain can cause clipping with peak values. This calculates
 * a safe multiplier that prevents clipping.
 * @param gainDb - Gain in decibels
 * @param peakLinear - Peak value (0-1, where 1.0 = full scale)
 * @returns Safe linear gain that won't cause clipping
 */
export function calculateSafeGain(gainDb: number, peakLinear: number = 1.0): number {
  const gain = dbToLinearGain(gainDb)
  const amplifiedPeak = peakLinear * gain

  // If amplified peak exceeds 1.0, reduce gain to prevent clipping
  if (amplifiedPeak > 1.0) {
    return 1.0 / peakLinear
  }

  return gain
}
