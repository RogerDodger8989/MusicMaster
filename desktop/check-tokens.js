const Database = require('better-sqlite3');
const db = new Database('c:/Users/denni/AppData/Roaming/musicmaster/database.sqlite');
const res = db.prepare("SELECT setting_key, setting_value FROM user_settings WHERE setting_key LIKE 'tidal%'").all();
console.log(res);
