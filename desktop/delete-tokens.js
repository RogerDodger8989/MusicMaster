const Database = require('better-sqlite3');
const db = new Database('c:/Users/denni/AppData/Roaming/musicmaster/database.sqlite');
db.prepare("DELETE FROM user_settings WHERE setting_key = 'tidal_access_token' OR setting_key = 'tidal_refresh_token' OR setting_key = 'tidal_token_expires_at'").run();
console.log('Successfully cleaned tokens');
