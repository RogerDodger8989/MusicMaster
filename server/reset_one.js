const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');
db.prepare('UPDATE albums_cache SET enriched_at = NULL WHERE name = ?').run('Steal This Album!');
db.close();
console.log('✅ Reset enrichment for Steal This Album!');
