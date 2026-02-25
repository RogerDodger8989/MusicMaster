const db = require('better-sqlite3')('./data/musicmaster.db')

// Hitta Alexandre Desplat-spåret
const tracks = db.prepare("SELECT id, title, artist, composer, publisher, conductor, grouping FROM tracks WHERE artist LIKE '%Desplat%' OR title LIKE '%Child%' LIMIT 5").all()
console.log('TRACKS I DB:', JSON.stringify(tracks, null, 2))

// Visa om kolumnerna finns
const cols = db.prepare('PRAGMA table_info(tracks)').all().map(c => c.name)
console.log('publisher i DB:', cols.includes('publisher'))
console.log('conductor i DB:', cols.includes('conductor'))
console.log('grouping i DB:', cols.includes('grouping'))

// Ta första track och uppdatera composer
if (tracks.length > 0) {
    const id = tracks[0].id
    db.prepare("UPDATE tracks SET composer='Alexandre Desplat', publisher='Warner Bros', conductor='Test' WHERE id=?").run(id)
    const updated = db.prepare('SELECT id, title, composer, publisher, conductor FROM tracks WHERE id=?').get(id)
    console.log('EFTER UPDATE:', JSON.stringify(updated, null, 2))
}
