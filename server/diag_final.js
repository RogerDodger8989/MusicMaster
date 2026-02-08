const { getDatabase } = require('./src/database/index');
const { musicBrainzService } = require('./src/services/musicbrainz');
const { upsertArtistWithMBID, addPerformer, addAlbumCredit } = require('./src/database/musicbrainz');

async function diag() {
    console.log('--- Manual Enrichment Starting ---');
    const db = getDatabase();
    const normalize = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();

    const album = db.prepare("SELECT id, name, artist, musicbrainz_album_id as mbid FROM albums_cache WHERE name = 'Steal This Album!'").get();
    if (!album) return console.error('Album not found');
    console.log('Album:', album);

    console.log('Fetching release details...');
    const release = await musicBrainzService.getReleaseDetails(album.mbid);
    if (!release) return console.error('Failed to fetch release');

    // 1. Save Album Credits
    const albumRoles = musicBrainzService.extractRoles(release);
    for (const [role, artists] of Object.entries(albumRoles)) {
        for (const artistInfo of artists) {
            console.log(`  Adding album credit: ${artistInfo.name} (${role})`);
            const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || null);
            console.log(`  Artist ID: ${artistId}`);
            addAlbumCredit(album.id, artistId, role);
        }
    }

    // 2. Map Tracks and Save Performers
    const tracks = db.prepare("SELECT id, title, musicbrainz_track_id as mbid FROM tracks WHERE album = 'Steal This Album!'").all();
    console.log(`Processing ${tracks.length} tracks...`);

    const mbTrackMap = new Map();
    for (const media of release.media || []) {
        for (const mbTrack of media.tracks || []) {
            if (mbTrack.recording?.id) {
                mbTrackMap.set(normalize(mbTrack.title), mbTrack.recording.id);
            }
        }
    }

    for (const track of tracks) {
        let trackMbid = track.mbid;
        if (!trackMbid || trackMbid === album.mbid) {
            trackMbid = mbTrackMap.get(normalize(track.title));
            if (trackMbid) {
                console.log(`  Auto-corrected MBID for ${track.title}: ${trackMbid}`);
                db.prepare('UPDATE tracks SET musicbrainz_track_id = ? WHERE id = ?').run(trackMbid, track.id);
            }
        }

        if (trackMbid) {
            console.log(`  Processing track: ${track.title}`);
            const recording = await musicBrainzService.getRecordingDetails(trackMbid);
            if (recording) {
                const roles = musicBrainzService.extractRoles(recording);
                for (const [role, artists] of Object.entries(roles)) {
                    for (const artistInfo of artists) {
                        const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || null);
                        console.log(`    Performer: ${artistInfo.name} (${role}) -> ${artistId}`);
                        addPerformer(track.id, artistId, role);
                    }
                }
            }
        }
    }

    db.prepare("UPDATE albums_cache SET enriched_at = CURRENT_TIMESTAMP WHERE id = ?").run(album.id);
    console.log('--- Manual Enrichment Finished ---');
}
diag().catch(console.error);
