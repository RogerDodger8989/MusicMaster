import { getDatabase, DbTrack } from './index'
import { dbTrackToTrack } from './tracks'
import { randomUUID } from 'crypto'

export interface DbPlaylist {
    id: string
    name: string
    description: string | null
    created_at: string
    updated_at: string
}

export const getAllPlaylists = () => {
    const db = getDatabase()
    const playlists = db.prepare('SELECT * FROM playlists ORDER BY updated_at DESC').all() as DbPlaylist[]

    // Attach tracks to each playlist
    // Note: In a REST API, we might want to return just metadata and fetch tracks separately,
    // but to match current frontend expectation, we'll attach them.
    // Or we could create a getPlaylistDetails(id) endpoint.
    // The IPC implementation returns everything.

    const result = playlists.map(pl => {
        const tracks = db.prepare(`
            SELECT t.* FROM tracks t
            JOIN playlist_tracks pt ON t.id = pt.track_id
            WHERE pt.playlist_id = ?
            ORDER BY pt.position ASC
        `).all(pl.id) as DbTrack[]

        return {
            ...pl,
            tracks: tracks.map(dbTrackToTrack)
        }
    })

    return result
}

export const createPlaylist = (name: string, trackIds: string[]) => {
    const db = getDatabase()
    const plId = randomUUID()

    const transaction = db.transaction(() => {
        db.prepare('INSERT INTO playlists (id, name) VALUES (?, ?)').run(plId, name)

        const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)')
        trackIds.forEach((trackId, index) => {
            insertTrack.run(randomUUID(), plId, trackId, index)
        })
    })

    transaction()
    return plId
}

export const deletePlaylist = (id: string) => {
    const db = getDatabase()
    db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
}

export const addTrackToPlaylist = (playlistId: string, trackId: string) => {
    const db = getDatabase()
    const row = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as { maxPos: number | null }
    const nextPos = (row?.maxPos ?? -1) + 1

    db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), playlistId, trackId, nextPos)

    db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
}

export const removeTrackFromPlaylist = (playlistId: string, trackId: string, position: number) => {
    const db = getDatabase()

    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? AND position = ?')
            .run(playlistId, trackId, position)

        // Close gaps
        db.prepare(`
            UPDATE playlist_tracks 
            SET position = position - 1 
            WHERE playlist_id = ? AND position > ?
        `).run(playlistId, position)

        db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
    })

    transaction()
}

export const renamePlaylist = (id: string, name: string) => {
    const db = getDatabase()
    db.prepare('UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, id)
}
export const reorderPlaylistTracks = (playlistId: string, trackIds: string[]) => {
    const db = getDatabase()
    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId)

        const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)')
        trackIds.forEach((trackId, index) => {
            insertTrack.run(randomUUID(), playlistId, trackId, index)
        })

        db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
    })

    transaction()
}
export const removeTrackByIdFromPlaylist = (playlistId: string, trackId: string) => {
    const db = getDatabase()

    const transaction = db.transaction(() => {
        db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
            .run(playlistId, trackId)

        // Close gaps by re-ordering everything
        const tracks = db.prepare(`
            SELECT id FROM playlist_tracks 
            WHERE playlist_id = ? 
            ORDER BY position ASC
        `).all(playlistId) as { id: string }[]

        const updatePos = db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?')
        tracks.forEach((row, index) => {
            updatePos.run(index, row.id)
        })

        db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId)
    })

    transaction()
}
