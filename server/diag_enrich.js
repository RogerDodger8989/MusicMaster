const { getDatabase } = require('./src/database/index');
const { musicBrainzService } = require('./src/services/musicbrainz');
const { acousticBrainzService } = require('./src/services/acousticbrainz');
const { upsertAlbumWithMBID, upsertArtistWithMBID, addAlbumCredit, addPerformer, storeAcousticBrainzData } = require('./src/database/musicbrainz');

async function diag() {
    const db = getDatabase();
    const albumName = 'Steal This Album!';
    const album = db.prepare('SELECT id, name, artist, musicbrainz_album_id as mbid FROM albums_cache WHERE name = ?').get(albumName);

    if (!album) {
        console.error('Album not found in DB');
        return;
    }
    console.log('Found album in DB:', album);

    console.log('Fetching release details from MB...');
    const release = await musicBrainzService.getReleaseDetails(album.mbid);
    if (!release) {
        console.error('Failed to fetch release details');
        return;
    }
    console.log('Release title:', release.title);
    console.log('Release relations count:', release.relations?.length || 0);

    const albumRoles = musicBrainzService.extractRoles(release);
    console.log('Extracted Album Roles:', albumRoles);

    for (const [role, artists] of Object.entries(albumRoles)) {
        for (const artistInfo of artists) {
            console.log(`Adding album credit: ${artistInfo.name} as ${role}`);
            const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || '');
            addAlbumCredit(album.id, artistId, role);
        }
    }

    const tracks = db.prepare('SELECT id, title, musicbrainz_track_id as mbid FROM tracks WHERE album = ? AND (album_artist = ? OR artist = ?)')
        .all(album.name, album.artist, album.artist);

    console.log(`Found ${tracks.length} tracks in database for this album.`);

    // Build a map of track titles to recording MBIDs from the release details
    const mbTrackMap = new Map();
    for (const media of release.media || []) {
        for (const mbTrack of media.tracks || []) {
            if (mbTrack.recording?.id) {
                mbTrackMap.set(mbTrack.title.toLowerCase(), mbTrack.recording.id);
            }
        }
    }

    for (const track of tracks) {
        let trackMbid = track.mbid;

        // Auto-correct MBID if it matches album MBID or is missing
        if (!trackMbid || trackMbid === album.mbid) {
            const correctedMbid = mbTrackMap.get(track.title.toLowerCase());
            if (correctedMbid) {
                console.log(`  Auto-corrected MBID for track "${track.title}": ${correctedMbid}`);
                trackMbid = correctedMbid;
            }
        }

        console.log(`Processing track: ${track.title} (MBID: ${trackMbid})`);
        if (!trackMbid) continue;

        const recording = await musicBrainzService.getRecordingDetails(trackMbid);
        if (recording) {
            if (recording.error) {
                console.error(`  MB API Error for track ${track.title}:`, recording.error);
                continue;
            }
            console.log(`  Recording Keys:`, Object.keys(recording));
            console.log(`  Recording Relations Raw:`, JSON.stringify(recording.relations || [], null, 2).substring(0, 500) + '...');
            console.log(`  Recording relations count: ${recording.relations?.length || 0}`);
            const trackRoles = musicBrainzService.extractRoles(recording);
            console.log(`  Extracted track roles:`, trackRoles);
            for (const [role, artists] of Object.entries(trackRoles)) {
                for (const artistInfo of artists) {
                    const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || '');
                    addPerformer(track.id, artistId, role);
                }
            }
        }
    }
    console.log('Diagnostic finished.');
}

diag().catch(console.error);
