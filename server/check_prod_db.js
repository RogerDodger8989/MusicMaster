const db = require('better-sqlite3')('c:/Users/denni/AppData/Roaming/MusicMaster/musicmaster.db');
const cols = db.pragma('table_info(albums_cache)', { simple: false });
console.log(cols.map(c => c.name).join(', '));
