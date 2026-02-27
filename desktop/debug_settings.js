const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'music-master', 'musicmaster.db');

try {
  const db = new Database(dbPath, { readonly: true });
  
  console.log('📊 USER SETTINGS:');
  const settings = db.prepare(`
    SELECT id, user_id, setting_key, setting_value, updated_at 
    FROM user_settings 
    ORDER BY updated_at DESC
  `).all();
  
  if (settings.length === 0) {
    console.log('❌ NO SETTINGS FOUND IN DATABASE');
  } else {
    console.table(settings.map(s => ({
      key: s.setting_key,
      value: s.setting_value.substring(0, 100),
      user_id: s.user_id,
      updated: s.updated_at
    })));
  }
  
  console.log(`\n✅ Total settings stored: ${settings.length}`);
  db.close();
} catch (error) {
  console.error('Error reading database:', error.message);
}
