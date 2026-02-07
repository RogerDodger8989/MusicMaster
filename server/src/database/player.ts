import { getDatabase, DbPlaybackState, DbTrack } from './index'
import { dbTrackToTrack } from './tracks'

export const getPlaybackSession = () => {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM playback_state WHERE id = ?').get('default') as DbPlaybackState | undefined
    if (!row) return null

    // Get the actual tracks for the queue
    let queue: any[] = []
    if (row.queue_ids) {
        try {
            const ids = JSON.parse(row.queue_ids) as string[]
            if (ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',')
                // We use raw SELECT * for tracks and convert
                const tracks = db.prepare(`SELECT * FROM tracks WHERE id IN (${placeholders})`).all(...ids) as DbTrack[]

                // Preserve order from ids array
                // Map ids to found tracks
                const trackMap = new Map(tracks.map(t => [t.id, t]))

                queue = ids.map(id => trackMap.get(id)).filter(Boolean) as DbTrack[]

                // Convert DB tracks to frontend Track type
                queue = queue.map(dbTrackToTrack)
            }
        } catch (e) {
            console.error('Failed to parse queue IDs:', e)
        }
    }

    return {
        currentTrackId: row.current_track_id,
        currentIndex: row.current_index,
        queue,
        volume: row.volume,
        isShuffle: row.is_shuffle === 1,
        repeatMode: row.repeat_mode,
        currentTime: row.current_time
    }
}

export const savePlaybackSession = (session: any) => {
    const db = getDatabase()
    const queueIds = JSON.stringify(session.queueIds || [])

    db.prepare(`
        INSERT INTO playback_state (id, current_track_id, queue_ids, current_index, volume, is_shuffle, repeat_mode, current_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            current_track_id = excluded.current_track_id,
            queue_ids = excluded.queue_ids,
            current_index = excluded.current_index,
            volume = excluded.volume,
            is_shuffle = excluded.is_shuffle,
            repeat_mode = excluded.repeat_mode,
            current_time = excluded.current_time,
            updated_at = CURRENT_TIMESTAMP
    `).run(
        'default',
        session.currentTrackId || null,
        queueIds,
        session.currentIndex || -1,
        session.volume ?? 1.0,
        session.isShuffle ? 1 : 0,
        session.repeatMode || 'normal',
        session.currentTime || 0
    )
}
