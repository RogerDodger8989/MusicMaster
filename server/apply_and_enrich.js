const { getDatabase } = require('./src/database/index');
const { musicBrainzService } = require('./src/services/musicbrainz');
const { lastFmService } = require('./src/services/lastfm');
const { upsertArtistWithMBID, addAlbumCredit, addPerformer } = require('./src/database/musicbrainz');

async function ensureArtistImage(artistId, artistName) {
    const db = getDatabase();
    const dbArtist = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(artistId);
    if (!dbArtist?.image_path) {
        try {
            console.log(`  Fetching image for ${artistName}...`);
            const info = await lastFmService.getArtistInfo(artistName);
            if (info?.image) {
                const imageUrl = lastFmService.getBestImage(info.image);
                if (imageUrl) {
                    const filename = `artist_${artistId}.jpg`;
                    const localPath = await lastFmService.downloadImage(imageUrl, filename);
                    if (localPath) {
                        db.prepare('UPDATE artists SET image_path = ? WHERE id = ?').run(localPath, artistId);
                        console.log(`  ✅ Saved image for ${artistName}: ${localPath}`);
                    }
                }
            }
        } catch (e) {
            console.warn(`  ⚠️ Failed to fetch image for ${artistName}:`, e.message);
        }
    }
}

async function main() {
    console.log('--- Applying Verified Data & Enriching ---');
    const db = getDatabase();
    const normalize = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();

    const verifiedReleaseId = '2e9eec60-ee5d-3a26-a650-73287e0f349f';
    const albumName = 'Steal This Album!';

    // 1. Update Album MBID
    console.log(`Updating album "${albumName}" with verified MBID: ${verifiedReleaseId}`);
    db.prepare("UPDATE albums_cache SET musicbrainz_album_id = ? WHERE name = ?").run(verifiedReleaseId, albumName);

    const album = db.prepare("SELECT id, name, artist FROM albums_cache WHERE name = ?").get(albumName);
    if (!album) return console.error('Album not found after update');
    console.log(`Working with Album ID: ${album.id}`);

    // 2. Fetch Verified Release Details
    console.log('Fetching verified release details...');
    const release = await musicBrainzService.getReleaseDetails(verifiedReleaseId);
    if (!release) return console.error('Failed to fetch release details');
    console.log(`Fetched release: ${release.title}`);

    // 3. Save Album Credits (Verified)
    console.log('Saving album credits...');
    const albumRoles = musicBrainzService.extractRoles(release);

    // Fetch band members as fallback
    const albumArtistMBID = release['artist-credit']?.[0]?.artist?.id;
    let bandMembers = [];
    if (albumArtistMBID) {
        console.log(`  Checking for band members of ${release['artist-credit'][0].name} (${albumArtistMBID})...`);
        bandMembers = await musicBrainzService.getArtistMembers(albumArtistMBID);
        console.log(`  Found ${bandMembers.length} band members.`);
    }

    console.log('Extracted roles from release:', JSON.stringify(albumRoles, null, 2));

    const roleCount = Object.keys(albumRoles).length;
    console.log(`Found ${roleCount} unique roles on release.`);

    for (const [role, artists] of Object.entries(albumRoles)) {
        for (const artistInfo of artists) {
            console.log(`  Adding Album Credit: ${artistInfo.name} as ${role}`);
            const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || null);
            await ensureArtistImage(artistId, artistInfo.name);
            addAlbumCredit(album.id, artistId, role);
        }
    }

    const isProduction = (role) => {
        const r = role.toLowerCase();
        return r.includes('producer') || r.includes('engineer') || r.includes('mix') ||
            r.includes('master') || r.includes('design') || r.includes('photo') ||
            r.includes('legal') || r.includes('management') || r.includes('art');
    };
    const tracks = db.prepare("SELECT id, title FROM tracks WHERE album = ?").all(albumName);
    console.log(`Processing ${tracks.length} tracks with verified mappings...`);

    const mbTrackMap = new Map();
    for (const media of release.media || []) {
        for (const mbTrack of media.tracks || []) {
            if (mbTrack.recording?.id) {
                mbTrackMap.set(normalize(mbTrack.title), mbTrack.recording.id);
            }
        }
    }

    for (const track of tracks) {
        const normalizedTitle = normalize(track.title);
        const trackMbid = mbTrackMap.get(normalizedTitle);

        if (trackMbid) {
            console.log(`  Enriching track: ${track.title} (${trackMbid})`);
            // Update track MBID in DB
            db.prepare('UPDATE tracks SET musicbrainz_track_id = ? WHERE id = ?').run(trackMbid, track.id);

            // Fetch Recording Details for Performers
            const recording = await musicBrainzService.getRecordingDetails(trackMbid);
            if (recording) {
                const roles = musicBrainzService.extractRoles(recording);

                // Track if we added any performance roles
                let hasPerformance = false;
                for (const [role, artists] of Object.entries(roles)) {
                    if (!isProduction(role)) hasPerformance = true;
                    for (const artistInfo of artists) {
                        const artistId = upsertArtistWithMBID(artistInfo.name, artistInfo.mbid || null);
                        await ensureArtistImage(artistId, artistInfo.name);
                        addPerformer(track.id, artistId, role);
                    }
                }

                // Fallback: If no performers found, use band members
                if (!hasPerformance && bandMembers.length > 0) {
                    console.log(`    Applying band members as fallback performers for: ${track.title}`);
                    for (const member of bandMembers) {
                        const artistId = upsertArtistWithMBID(member.name, member.mbid);
                        await ensureArtistImage(artistId, member.name);
                        addPerformer(track.id, artistId, member.role);
                    }
                }
            }
        } else {
            console.warn(`  No verified MBID found for track: ${track.title}`);
        }
    }

    // 5. Final pass for credits (ensure images/MBIDs are correct)
    console.log('Final verification and image fetch for all credits...');
    const allCredits = db.prepare(`
        SELECT DISTINCT a.id, a.name, a.mbid 
        FROM artists a
        JOIN album_credits ac ON a.id = ac.artist_id
        WHERE ac.album_id = ?
    `).all(album.id);

    for (const cred of allCredits) {
        await ensureArtistImage(cred.id, cred.name);
    }

    // 5. Mark as enriched
    db.prepare("UPDATE albums_cache SET enriched_at = CURRENT_TIMESTAMP WHERE id = ?").run(album.id);
    console.log('--- Enrichment Complete! ---');

    // Final verification of counts
    const perfCount = db.prepare('SELECT count(*) as count FROM performers').get().count;
    const credCount = db.prepare('SELECT count(*) as count FROM album_credits').get().count;
    console.log(`Final Database Stats: Performers=${perfCount}, AlbumCredits=${credCount}`);
}

main().catch(console.error);
