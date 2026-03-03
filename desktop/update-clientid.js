const Database = require('better-sqlite3');
const db = new Database('c:/Users/denni/AppData/Roaming/musicmaster/database.sqlite');
db.prepare("UPDATE user_settings SET setting_value = '\"bpJkBnGDskh26K9i\"' WHERE setting_key = 'tidalClientId'").run();
console.log('Successfully updated Tidal Client ID');
