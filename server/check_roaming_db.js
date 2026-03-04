const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'music-master', 'musicmaster.db');
const db = new Database(dbPath);

const desplat = db.prepare("SELECT * FROM artists WHERE name = 'Alexandre Desplat'").get();
console.log('Alexandre Desplat Data:', JSON.stringify(desplat, null, 2));

const soad = db.prepare("SELECT * FROM artists WHERE name = 'System of a Down'").get();
console.log('System of a Down Data:', JSON.stringify(soad, null, 2));

const rock = db.prepare("SELECT * FROM artists WHERE name = 'Bob Rock'").get();
console.log('Bob Rock Data:', JSON.stringify(rock, null, 2));

db.close();
