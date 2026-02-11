
import { getDatabase } from './index'
import * as fs from 'fs'

async function fix() {
    const db = getDatabase()
    const correctMbid = '65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab'

    console.log('🛠️ Fixing Metallica hijacking...')

    // 1. Get current Metallica entry
    const artist = db.prepare("SELECT * FROM artists WHERE name LIKE 'Metallica'").get() as any

    if (!artist) {
        console.log('⚠️ Metallica not found in artists table.')
        return
    }

    console.log('Found artist:', artist.name, 'with MBID:', artist.musicbrainz_artistid)

    // 2. Delete the hijacked image if it exists
    if (artist.image_path && artist.image_path.includes('artist_')) {
        try {
            // Check if it's a relative or absolute path
            // In the DB it seems to be stored as 'external_cache\artist_...'
            // We need to resolve it relative to the data dir
            const userDataPath = process.env.DATA_PATH || './data'
            const fullPath = artist.image_path.startsWith('http') ? null : (artist.image_path.includes(':') ? artist.image_path : `${userDataPath}/${artist.image_path}`)

            if (fullPath && fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
                console.log('🗑️ Deleted hijacked image:', fullPath)
            }
        } catch (e) {
            console.warn('⚠️ Could not delete image file:', e)
        }
    }

    // 3. Reset metadata and LOCK MBID
    db.prepare(`
        UPDATE artists 
        SET musicbrainz_artistid = ?,
            bio = NULL,
            image_path = NULL,
            artist_type = 'Group',
            type = 'Group',
            last_enrich_attempt = NULL,
            mbid_verified = 1,
            image_verified = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(correctMbid, artist.id)

    // 4. Also update tracks for this artist to ensure they have the right MBID
    db.prepare(`
        UPDATE tracks 
        SET musicbrainz_artistid = ?
        WHERE artist LIKE 'Metallica'
    `).run(correctMbid)

    console.log('✅ Metallica reset to correct MBID:', correctMbid)
    console.log('🚀 Next enrichment run will fetch the correct photo and bio.')
}

fix().catch(console.error)
