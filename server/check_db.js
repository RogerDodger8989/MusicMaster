const { getDatabase } = require('./src/database');
const db = getDatabase();
const columns = db.pragma('table_info(albums_cache)', { simple: false });
console.log(columns);
