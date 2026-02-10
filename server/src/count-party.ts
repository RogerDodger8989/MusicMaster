/**
 * Count actual party matches
 */

import { getDatabase } from './database'

const db = getDatabase()

const count = db.prepare(`
  SELECT COUNT(*) as count
  FROM tracks t
  LEFT JOIN acousticbrainz_data ab ON t.id = ab.track_id
  WHERE ab.id IS NOT NULL
  AND ab.arousal IS NOT NULL
  AND ab.valence IS NOT NULL
  AND ab.arousal >= 0.75
  AND ab.valence >= 0.6
  AND ab.bpm IS NOT NULL
  AND ab.bpm >= 120
  AND ab.danceability IS NOT NULL
  AND ab.danceability >= 0.8
`).get() as any

console.log(`Total tracks matching Party criteria: ${count.count}`)

process.exit(0)
