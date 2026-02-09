const Database = require('./node_modules/better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'data', 'musicmaster.db'))

// Find all artists with duplicate names
const duplicates = db.prepare(`
  SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
  FROM artists
  GROUP BY LOWER(name)
  HAVING count > 1
`).all()

console.log(`Found ${duplicates.length} groups of duplicate artists\n`)

let totalDeleted = 0

const deleteStmt = db.prepare('DELETE FROM artists WHERE id = ?')

for (const dup of duplicates) {
  console.log(`\n📋 Artist: "${dup.name}" (${dup.count} copies)`)
  
  const ids = dup.ids.split(',')
  const rows = db.prepare('SELECT id, image_path, bio FROM artists WHERE id IN (' + ids.map(() => '?').join(',') + ')').all(...ids)
  
  // Find the one with most data (has image + bio)
  let bestIdx = 0
  let bestScore = 0
  
  rows.forEach((r, i) => {
    let score = 0
    if (r.image_path) score++
    if (r.bio) score++
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  
  const keep = rows[bestIdx]
  console.log(`  ✅ Keeping: ${keep.id} (image: ${!!keep.image_path}, bio: ${!!keep.bio})`)
  
  // Delete the rest
  for (let i = 0; i < rows.length; i++) {
    if (i !== bestIdx) {
      deleteStmt.run(rows[i].id)
      console.log(`  ❌ Deleted: ${rows[i].id}`)
      totalDeleted++
    }
  }
}

console.log(`\n✅ Cleanup complete: ${totalDeleted} duplicate artists removed`)

db.close()
