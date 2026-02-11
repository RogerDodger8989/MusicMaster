
import { getDatabase } from './index'

async function check() {
    const db = getDatabase()
    const artist = db.prepare("SELECT * FROM artists WHERE name LIKE '%Metallica%'").get()
    console.log('ARTIST_ENTRY:', JSON.stringify(artist, null, 2))
}

check().catch(console.error)
