import { getDatabase } from './index'
import { randomUUID } from 'crypto'

export const getAllSettings = () => {
    const db = getDatabase()
    const rows = db.prepare('SELECT setting_key, setting_value FROM user_settings').all() as { setting_key: string, setting_value: string }[]
    const settings: Record<string, any> = {}
    rows.forEach(row => {
        try {
            settings[row.setting_key] = JSON.parse(row.setting_value)
        } catch {
            settings[row.setting_key] = row.setting_value
        }
    })
    return settings
}

export const saveSetting = (key: string, value: any) => {
    const db = getDatabase()
    const stringValue = JSON.stringify(value)
    // Assuming 'default' user_id for single user system
    const userId = 'default'

    // We need to upsert. The schema has UNIQUE(user_id, setting_key).
    // The provided schema in index.ts:
    // UNIQUE(user_id, setting_key)
    // ID column exists but isn't auto-increment, it's TEXT.
    // Implementation in IPC:
    // INSERT INTO user_settings (id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT ...

    // We need to generate ID only on insert. ON CONFLICT update doesn't need new ID.
    // However, if we blindly pass new UUID for ID in INSERT, it works.

    db.prepare(`
        INSERT INTO user_settings (id, user_id, setting_key, setting_value)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
    `).run(randomUUID(), userId, key, stringValue)
}
