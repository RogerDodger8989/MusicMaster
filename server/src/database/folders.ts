import { getDatabase, type DbMusicFolder } from './index'
import type { MusicFolder } from '../types'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

/**
 * Get all music folders
 */
export function getAllMusicFolders(): MusicFolder[] {
    const db = getDatabase()
    const stmt = db.prepare('SELECT * FROM music_folders ORDER BY created_at DESC')
    const rows = stmt.all() as DbMusicFolder[]

    return rows.map(dbFolderToMusicFolder)
}

/**
 * Add a new music folder
 */
export function addMusicFolder(folderPath: string, watchEnabled = false): MusicFolder {
    const db = getDatabase()

    const id = uuidv4()
    const name = path.basename(folderPath)

    const stmt = db.prepare(`
    INSERT INTO music_folders (id, path, name, watch_enabled)
    VALUES (?, ?, ?, ?)
  `)

    stmt.run(id, folderPath, name, watchEnabled ? 1 : 0)

    return {
        id,
        path: folderPath,
        name,
        watchEnabled,
        trackCount: 0,
        createdAt: new Date()
    }
}

/**
 * Remove a music folder and all its tracks
 */
export function removeMusicFolder(folderId: string): void {
    const db = getDatabase()

    console.log(`🗑️ removeMusicFolder: Removing folder ${folderId}`)

    // Explicitly delete tracks first
    const trackDeleteStmt = db.prepare('DELETE FROM tracks WHERE folder_id = ?')
    const trackResult = trackDeleteStmt.run(folderId)
    console.log(`✅ Deleted ${trackResult.changes} tracks associated with folder ${folderId}`)

    // Remove folder
    const folderDeleteStmt = db.prepare('DELETE FROM music_folders WHERE id = ?')
    const folderResult = folderDeleteStmt.run(folderId)
    console.log(`✅ Deleted ${folderResult.changes} folders with ID ${folderId}`)
}

/**
 * Update music folder watch status
 */
export function updateFolderWatchStatus(folderId: string, watchEnabled: boolean): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE music_folders SET watch_enabled = ? WHERE id = ?')
    stmt.run(watchEnabled ? 1 : 0, folderId)
}

/**
 * Update folder last scanned time
 */
export function updateFolderLastScanned(folderId: string): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE music_folders SET last_scanned = CURRENT_TIMESTAMP WHERE id = ?')
    stmt.run(folderId)
}

/**
 * Update folder track count
 */
export function updateFolderTrackCount(folderId: string): void {
    const db = getDatabase()
    const stmt = db.prepare(`
    UPDATE music_folders
    SET track_count = (SELECT COUNT(*) FROM tracks WHERE folder_id = ?)
    WHERE id = ?
  `)
    stmt.run(folderId, folderId)
}

/**
 * Convert database folder to MusicFolder type
 */
function dbFolderToMusicFolder(dbFolder: DbMusicFolder): MusicFolder {
    return {
        id: dbFolder.id,
        path: dbFolder.path,
        name: dbFolder.name,
        watchEnabled: dbFolder.watch_enabled === 1,
        lastScanned: dbFolder.last_scanned ? new Date(dbFolder.last_scanned) : undefined,
        trackCount: dbFolder.track_count,
        createdAt: new Date(dbFolder.created_at)
    }
}
