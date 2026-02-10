import { getVibePlaylist } from './src/services/vibesService';
import { getDatabase } from './src/database';

async function auditVibe(vibeId: string) {
    console.log(`\n--- AUDITING ${vibeId.toUpperCase()} VIBE ---`);
    const tracks = getVibePlaylist(vibeId, 50);
    console.log(`Found ${tracks.length} tracks in ${vibeId} vibe.`);

    for (const t of tracks) {
        console.log(`[${t.artist} - ${t.title}]`);
        console.log(`  Energy: ${t.energy}, Arousal: ${t.arousal}, Valence: ${t.valence}, BPM: ${t.bpm}, Category: ${t.mood_category}`);
    }
}

async function run() {
    await auditVibe('chill');
    await auditVibe('party');
    await auditVibe('workout');
}

run().then(() => console.log('\nAudit Complete')).catch(console.error);
