import { getDatabase } from '../database'
import { backgroundEnricher } from '../services/enricher'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function forceEnrich(artistName: string) {
    console.log(`🚀 Forcing enrichment for: ${artistName}`)

    const db = getDatabase()
    const artist = db.prepare('SELECT id, name FROM artists WHERE name = ?').get(artistName) as { id: string, name: string } | undefined

    if (!artist) {
        console.error(`❌ Artist not found: ${artistName}`)
        process.exit(1)
    }

    console.log(`✅ Found artist: ${artist.name} (ID: ${artist.id})`)

    await backgroundEnricher.enrichArtistById(artist.id, artist.name, true)

    console.log('✨ Enrichment complete')
    process.exit(0)
}

const target = process.argv[2]
if (!target) {
    console.error('Usage: npx ts-node src/scripts/force_enrich.ts "Artist Name"')
    process.exit(1)
}

forceEnrich(target).catch(err => {
    console.error('❌ Failed:', err)
    process.exit(1)
})
