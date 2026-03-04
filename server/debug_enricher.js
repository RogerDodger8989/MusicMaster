const Database = require('better-sqlite3');
const db = new Database('data/musicmaster.db');

const randy = db.prepare("SELECT id, name, last_enrich_attempt FROM artists WHERE name = 'Randy Staub'").get();
console.log('Randy Staub:', randy);

db.close();
