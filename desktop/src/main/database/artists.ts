import { getDatabase } from './index'
import { Artist } from '../types'

export function getAllArtists(): Artist[] {
    const db = getDatabase()
    const rows = db.prepare(`
        SELECT 
            id, name, bio, 
            album_count as albumCount, 
            track_count as trackCount, 
            image_path as imagePath,
            loved
        FROM artists 
        ORDER BY name ASC
    `).all() as any[]

    return rows.map(row => ({
        ...row,
        loved: row.loved === 1
    }))
}

export function updateArtistLoved(id: string, loved: boolean): void {
    const db = getDatabase()
    const stmt = db.prepare('UPDATE artists SET loved = ? WHERE id = ?')
    stmt.run(loved ? 1 : 0, id)
}
