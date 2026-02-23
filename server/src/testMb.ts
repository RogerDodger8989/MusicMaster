import Database from 'better-sqlite3'
import path from 'path'
import { request } from 'urllib'

// Connect to DB
const dbPath = path.join(process.cwd(), 'data', 'musicmaster.db')
const db = new Database(dbPath, { readonly: true })

function run() {
    // 1. Get credentials
    const getSetting = (k: string) => {
        const row = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get(k) as any
        if (!row) return null
        try { return JSON.parse(row.setting_value) } catch { return row.setting_value }
    }

    const username = getSetting('musicbrainzUsername')
    const password = getSetting('musicbrainzPassword')
    console.log('Credentials found:', { username, password: password ? '***' : null })

    // 2. Get rated tracks
    const rows = db.prepare('SELECT id, title, artist, rating, musicbrainz_recordingid, musicbrainz_trackid FROM tracks WHERE rating > 0').all() as any[]
    console.log(`Found ${rows.length} rated tracks in DB:`)
    rows.forEach(r => console.log(` - ${r.artist} - ${r.title} | Rating: ${r.rating} | RecordingID: ${r.musicbrainz_recordingid} | TrackID: ${r.musicbrainz_trackid}`))

    const testTrack = rows.find(r => r.musicbrainz_recordingid)
    if (!testTrack) {
        console.log('No track has a musicbrainz_recordingid to test with!')
        return
    }

    if (!username || !password) {
        console.log('Missing credentials.')
        return
    }

    console.log(`Testing submission for ${testTrack.title}...`)
    testSubmit(testTrack.musicbrainz_recordingid, testTrack.rating, username, password)
}

async function testSubmit(recordingId: string, rating: number, user: string, pass: string) {
    const scaledRating = Math.max(0, Math.min(100, Math.round((rating / 5) * 100)))
    const url = `https://musicbrainz.org/ws/2/rating?client=musicmaster-1.0.0`

    const xmlBody = `
    <metadata xmlns="http://musicbrainz.org/ns/mmd-2.0#">
      <recording-list>
        <recording id="${recordingId}">
          <user-rating>${scaledRating}</user-rating>
        </recording>
      </recording-list>
    </metadata>`.trim()

    try {
        const res = await request(url, {
            method: 'POST',
            digestAuth: `${user}:${pass}`,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Accept': 'application/xml',
                'User-Agent': 'MusicMaster/1.0.0'
            },
            content: xmlBody
        })

        console.log('\\n----------------------------------')
        console.log('Status code:', res.status)
        console.log('Response body:', res.data.toString())
        console.log('----------------------------------\\n')
    } catch (e) {
        console.error('Request failed:', e)
    }
}

run()
