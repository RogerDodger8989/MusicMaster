import axios from 'axios'
import { getDatabase } from './database'

const run = async () => {
    try {
        const db = getDatabase()
        const setting = db.prepare("SELECT setting_value FROM user_settings WHERE setting_key = 'listenbrainzUsername'").get() as any
        let username = setting.setting_value
        try { username = JSON.parse(username) } catch { }

        console.log(`Checking ListenBrainz for user: ${username}`)
        const response = await axios.get(`https://api.listenbrainz.org/1/feedback/user/${username}/get-feedback`, {
            params: { score: 1, count: 5, metadata: true }
        })
        console.log('Feedback API response with metadata:true:')
        console.log(JSON.stringify(response.data.feedback, null, 2))
    } catch (e) {
        console.error(e)
    }
}
run()
