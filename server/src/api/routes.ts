import { Router } from 'express'
import * as albums from './controllers/albums.controller'
import * as artists from './controllers/artists.controller'
import * as tracks from './controllers/tracks.controller'
import * as search from './controllers/search.controller'
import * as scan from './controllers/scan.controller'
import * as playlists from './controllers/playlists.controller'
import * as settings from './controllers/settings.controller'
import * as player from './controllers/player.controller'
import * as scrobble from './controllers/scrobble.controller'
import * as metadata from './controllers/metadata.controller'
import * as system from './controllers/system.controller'
import * as dashboard from './controllers/dashboard.controller'
import * as media from './controllers/media.controller'

const router = Router()

// Albums
router.get('/albums', albums.listAlbums)
router.get('/albums/:id', albums.getAlbum)
router.put('/albums/:id', albums.updateAlbum)
router.post('/albums/:id/rate', albums.rateAlbum)
router.post('/albums/:id/loved', albums.toggleAlbumLoved)

// Artists
router.get('/artists', artists.listArtists)
router.get('/artists/similar', artists.getSimilarArtists)
router.get('/artists/:id', artists.getArtist)
router.put('/artists/:id', artists.updateArtistDetails)
router.post('/artists/:id/loved', artists.toggleArtistLoved)

// Tracks
router.get('/tracks', tracks.listTracks)
router.get('/tracks/:id', tracks.getTrack)
router.put('/tracks/:id', tracks.updateTrack)
router.post('/tracks/:id/rate', tracks.rateTrack)
router.post('/tracks/:id/loved', tracks.loveTrack)

// Playlists
router.get('/playlists', playlists.listPlaylists)
router.get('/playlists/:id', playlists.getPlaylist)
router.post('/playlists', playlists.createNewPlaylist)
router.delete('/playlists/:id', playlists.removePlaylist)
router.post('/playlists/:id/tracks', playlists.addToPlaylist)
router.delete('/playlists/:id/tracks/:trackId', playlists.deleteFromPlaylist)
router.put('/playlists/:id', playlists.updatePlaylist)

// Settings
router.get('/settings', settings.getSettings)
router.post('/settings', settings.updateSetting)

// Player
router.get('/player', player.getSession)
router.post('/player', player.updateSession)

// Scrobble & Auth
router.post('/scrobble', scrobble.scrobbleTrack)
router.post('/scrobble/nowplaying', scrobble.updateNowPlaying)
router.post('/scrobble/sync', scrobble.syncPlayCounts)
router.get('/scrobble/sync/status', scrobble.getSyncStatus)
router.get('/auth/lastfm/token', scrobble.getLastFmAuthToken)
router.post('/auth/lastfm/session', scrobble.getLastFmSession)

// Metadata & MusicBrainz
router.get('/metadata/coverage', metadata.getCoverage)
router.get('/metadata/identify/:trackId', metadata.identifyTrack)
router.get('/metadata/search', metadata.searchMusicBrainz)
router.get('/metadata/details/:type/:id', metadata.getMusicBrainzDetails)
router.get('/metadata/candidates/:trackId', metadata.getCandidates)
router.post('/metadata/candidates/:trackId/apply', metadata.applyCandidate)

// Library Enhancement & Sync
router.post('/metadata/enhance', metadata.enhanceLibrary)
router.get('/metadata/enhance/status', metadata.getEnhanceStatus)
router.post('/metadata/sync', metadata.syncMetadata)
router.get('/metadata/sync/status', metadata.getFileSyncStatus)
router.post('/metadata/write/:id', metadata.writeTrackMetadata)

// Search & Genres
router.get('/search', search.search)
router.get('/genres', albums.getGenres)

// Dashboard
router.get('/dashboard/stats', dashboard.getStats)

// Media & Streaming
router.get('/cover/album/:id', media.getCover)
router.get('/cover/artist/:id', media.getArtistImage)
router.get('/stream/:id', media.streamTrack)

// Scanning & Folders
router.get('/scan/status', scan.getScanStatus)
router.post('/scan/start', scan.startScan)
router.get('/folders', scan.listFolders)
router.post('/folders', scan.createFolder)
router.delete('/folders/:id', scan.deleteFolder)

// System & Filesystem
router.get('/system/drives', system.listDrives)
router.get('/system/browse', system.listDirectory)

export default router
