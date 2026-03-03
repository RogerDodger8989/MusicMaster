import { useState, useCallback, useEffect } from 'react'
import TopBar from './components/TopBar'
import { cn } from './lib/utils'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import SyncProgressToast from './components/SyncProgressToast'
import SettingsView from './views/SettingsView'
import AlbumsView from './views/AlbumsView'
import AlbumDetailView from './views/AlbumDetailView'
import ArtistDetailView from './views/ArtistDetailView'
import ArtistsView from './views/ArtistsView'
import TracksView from './views/TracksView'
import PlaylistsView from './views/PlaylistsView'
import UnsortedView from './views/UnsortedView'
import HomeView from './views/HomeView'
import FavoritesView from './views/FavoritesView'
import AlbumArtistsView from './views/AlbumArtistsView'
import GenresView from './views/GenresView'
import { useTagging } from './store/tagging'
import SearchModal from './components/SearchModal'
import TaggingModal from './components/TaggingModal'
import TagConfirmationModal from './components/TagConfirmationModal'
import QueuePanel from './components/QueuePanel'
import TrackContextMenu from './components/TrackContextMenu'
import AlbumContextMenu from './components/AlbumContextMenu'
import { TrackPlayOptionModal } from './components/modals/TrackPlayOptionModal'
import { CreatePlaylistModal } from './components/modals/CreatePlaylistModal'
import TagEditorModal from './components/modals/TagEditorModal'
import { client } from './api/client'
import { useLibrary } from './store/library'
import { useNavigation } from './store/navigation'
import { usePlayer } from './store/player'
import { useSettings, TrackPlayBehavior } from './store/settings'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAutoDJ } from './hooks/useAutoDJ'
import { useDJSession } from './hooks/useDJSession'
import { useMediaSession } from './hooks/useMediaSession'
import { scrobbleService } from './services/scrobbleService'
import { Track, Album } from './types'
import { useSyncStore } from './store/sync'
import { useUI } from './store/ui'
import MiniPlayerView from './views/MiniPlayerView'
import TheaterModeView from './views/TheaterModeView'
import { motion, AnimatePresence } from 'framer-motion'

function App(): React.JSX.Element {
  const { initialize, selectedTracks: selectedTrackIds, tracks: allTracks } = useLibrary()
  const { current, navigateTo, goBack } = useNavigation()
  const {
    currentTrack,
    duration,
    currentTime,
    seek,
    togglePlay,
    playTrack,
    playNext,
    addToQueue,
    loadSession,
    next,
    prev
  } = usePlayer()
  const { setTrackPlayBehavior, loadSettings } = useSettings()
  const { startTagging, updateProgress, finishTagging } = useTagging()
  useAutoDJ()
  useDJSession()
  useMediaSession()

  const activeView = current.view
  const viewParams = current.params

  const [playModalOpen, setPlayModalOpen] = useState(false)
  const [selectedTrackForPlay, setSelectedTrackForPlay] = useState<Track | null>(null)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [queueWidth, setQueueWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [queueSelectedIndex, setQueueSelectedIndex] = useState<number | null>(null)

  const [createPlaylistModalOpen, setCreatePlaylistModalOpen] = useState(false)
  const [initialTrackIdsForNewPlaylist, setInitialTrackIdsForNewPlaylist] = useState<string[]>([])

  const [taggingModalOpen, setTaggingModalOpen] = useState(false)
  const [selectedItemForTagging, setSelectedItemForTagging] = useState<Track | Album | null>(null)
  const [taggingItemType, setTaggingItemType] = useState<'track' | 'album'>('track')

  const [tagConfirmationOpen, setTagConfirmationOpen] = useState(false)
  const [tagConfirmationData, setTagConfirmationData] = useState<{
    track: Track
    candidate: any
    type: 'track' | 'album'
  } | null>(null)

  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false)
  const [tagEditorTracks, setTagEditorTracks] = useState<Track[]>([])
  const [tagEditorContext, setTagEditorContext] = useState<'track' | 'album' | undefined>(undefined)

  const [trackContextMenu, setTrackContextMenu] = useState<{
    track: Track
    selectedTrackIds?: string[]
    x: number
    y: number
  } | null>(null)
  const [albumContextMenu, setAlbumContextMenu] = useState<{
    album: Album
    x: number
    y: number
  } | null>(null)

  const { isMiniPlayer, isTheaterMode } = useUI()

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX
        if (newWidth > 300 && newWidth < 800) {
          setQueueWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])

  // Initialize library data and listeners
  useEffect(() => {
    const initApp = async () => {
      console.log('🚀 Initializing App...')
      // Load library data first so views are populated as early as possible
      initialize()
      await loadSettings()
      await loadSession()

      // Start scrobble service and update API keys with LOADED settings
      const settings = useSettings.getState()
      console.log(
        '🎵 Starting scrobble service with session key:',
        settings.lastfmSessionKey ? 'present' : 'missing'
      )
      scrobbleService.start()

      if (window.api) {
        if (settings.lastfmApiKey) {
          console.log('🔑 Pushing Last.fm API key to main process')
          window.api.scrobble.updateLastFmKey(settings.lastfmApiKey).catch((err) => {
            console.error('Failed to set Last.fm key:', err)
          })
        }
        if (settings.lastfmApiSecret) {
          console.log('🔑 Pushing Last.fm API secret to main process')
          window.api.scrobble.updateLastFmSecret(settings.lastfmApiSecret).catch((err) => {
            console.error('Failed to set Last.fm secret:', err)
          })
        }
        if (settings.listenbrainzToken) {
          console.log('🔑 Pushing ListenBrainz token to main process')
          window.api.scrobble.updateListenBrainzToken(settings.listenbrainzToken).catch((err) => {
            console.error('Failed to set ListenBrainz token:', err)
          })
        }
      }
    }

    initApp()

    // Setup global background sync polling
    const syncPollInterval = setInterval(async () => {
      try {
        const status = await client.getSyncStatus()
        const store = useSyncStore.getState()
        if (status.isRunning) {
          store.updateProgress({
            isRunning: true,
            current: status.current,
            total: status.total,
            trackName: status.trackName,
            percentage: status.percentage,
            errors: status.errors
          })
        } else if (store.progress?.isRunning && !status.isRunning) {
          // Finished
          store.updateProgress({
            isRunning: false,
            current: status.total,
            total: status.total,
            trackName: 'Complete',
            percentage: 100,
            errors: status.errors
          })
          store.completeSync()
          // Reload library data implicitly when a background sync finishes
          useLibrary.getState().loadTracks()
        }
      } catch (e) {
        // ignore network error
      }
    }, 2000)

    return () => {
      clearInterval(syncPollInterval)
      scrobbleService.stop()
    }
  }, [initialize, loadSettings, loadSession])

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onSpacePress: () => {
      togglePlay()
    },
    onBackspacePress: () => {
      if (current.view !== 'home') {
        goBack()
      }
    },
    onEscapePress: () => {
      setPlayModalOpen(false)
      setTaggingModalOpen(false)
      setIsTagEditorOpen(false) // Close tag editor on escape
      if (isQueueOpen) {
        setIsQueueOpen(false)
      }
    },
    onArrowLeftPress: () => {
      if (currentTrack) seek(Math.max(0, currentTime - 5))
    },
    onArrowRightPress: () => {
      if (currentTrack && duration) seek(Math.min(duration, currentTime + 5))
    },
    enabled: true
  })

  // Listen for request-track-play
  useEffect(() => {
    const handleRequest = (e: CustomEvent) => {
      const track = e.detail.track as Track
      if (track) {
        const behavior = useSettings.getState().trackPlayBehavior
        const hasQueue = usePlayer.getState().queue.length > 0

        if (behavior === 'ask' && hasQueue) {
          setSelectedTrackForPlay(track)
          setPlayModalOpen(true)
        } else {
          // If behavior is 'ask' but no queue, just play it
          const effectiveBehavior = behavior === 'ask' ? 'replace' : behavior
          switch (effectiveBehavior) {
            case 'replace':
              playTrack(track)
              break
            case 'play_next':
              playNext(track)
              break
            case 'add_last':
              addToQueue(track)
              break
          }
        }
      }
    }
    window.addEventListener('request-track-play', handleRequest as EventListener)
    return () => window.removeEventListener('request-track-play', handleRequest as EventListener)
  }, [playTrack, playNext, addToQueue])

  // Listen for request-create-playlist
  useEffect(() => {
    const handleCreatePlaylistRequest = (e: CustomEvent) => {
      const trackIds = e.detail.trackIds as string[]
      setInitialTrackIdsForNewPlaylist(trackIds || [])
      setCreatePlaylistModalOpen(true)
    }
    window.addEventListener('request-create-playlist', handleCreatePlaylistRequest as EventListener)
    return () => window.removeEventListener('request-create-playlist', handleCreatePlaylistRequest as EventListener)
  }, [])

  // Listen for request-track-tagging, request-album-tagging, and request-track-info
  useEffect(() => {
    const handleTrackTaggingRequest = (e: CustomEvent) => {
      const track = e.detail.track as Track
      if (track) {
        setSelectedItemForTagging(track)
        setTaggingItemType('track')
        setTaggingModalOpen(true)
      }
    }

    const handleAlbumTaggingRequest = (e: CustomEvent) => {
      const album = e.detail.album as Album
      if (album) {
        setSelectedItemForTagging(album)
        setTaggingItemType('album')
        setTaggingModalOpen(true)
      }
    }

    const handleTrackEditRequest = (e: CustomEvent) => {
      const { tracks, context } = e.detail
      if (tracks && tracks.length > 0) {
        setTagEditorTracks(tracks)
        setTagEditorContext(context)
        setIsTagEditorOpen(true)
      }
    }

    window.addEventListener('request-track-tagging', handleTrackTaggingRequest as EventListener)
    window.addEventListener('request-album-tagging', handleAlbumTaggingRequest as EventListener)
    window.addEventListener('request-track-edit', handleTrackEditRequest as EventListener)

    return () => {
      window.removeEventListener('request-track-tagging', handleTrackTaggingRequest as EventListener)
      window.removeEventListener('request-album-tagging', handleAlbumTaggingRequest as EventListener)
      window.removeEventListener('request-track-edit', handleTrackEditRequest as EventListener)
    }
  }, [])

  // Sync Tag Editor tracks with selection if open
  useEffect(() => {
    if (isTagEditorOpen && selectedTrackIds.length > 0) {
      const selected = allTracks.filter((t) => selectedTrackIds.includes(t.id))
      if (selected.length > 0) {
        setTagEditorTracks(selected)
      }
    }
  }, [selectedTrackIds, isTagEditorOpen, allTracks])

  // Global Context Menu Listeners
  useEffect(() => {
    const handleTrackContextMenuRequest = (e: CustomEvent) => {
      const { track, selectedTrackIds, x, y } = e.detail
      if (track) {
        setTrackContextMenu({ track, selectedTrackIds, x, y })
      }
    }
    const handleAlbumContextMenuRequest = (e: CustomEvent) => {
      const { album, x, y } = e.detail
      if (album) {
        setAlbumContextMenu({ album, x, y })
      }
    }

    window.addEventListener('show-track-context-menu', handleTrackContextMenuRequest as EventListener)
    window.addEventListener('show-album-context-menu', handleAlbumContextMenuRequest as EventListener)

    return () => {
      window.removeEventListener(
        'show-track-context-menu',
        handleTrackContextMenuRequest as EventListener
      )
      window.removeEventListener(
        'show-album-context-menu',
        handleAlbumContextMenuRequest as EventListener
      )
    }
  }, [])

  // Listen for Player commands from main process (Thumbar, global shortcuts etc)
  useEffect(() => {
    if (!window.api || !window.api.player.onCommand) return

    const unsub = window.api.player.onCommand((command) => {
      console.log('🎮 Player command received from main:', command)
      switch (command) {
        case 'togglePlay':
          togglePlay()
          break
        case 'prev':
          prev()
          break
        case 'next':
          next()
          break
      }
    })

    return () => unsub()
  }, [togglePlay, prev, next])

  const handleTaggingSave = async (id: string, metadata: any, type: 'track' | 'album') => {
    console.log(`💾 [UI] Saving MB Metadata for ${type}:`, id, metadata)

    if (type === 'track') {
      const track = selectedItemForTagging as Track
      setTagConfirmationData({
        track,
        candidate: metadata,
        type: 'track'
      })
      setTagConfirmationOpen(true)
      setTaggingModalOpen(false)
    } else {
      const album = selectedItemForTagging as Album
      // Create a virtual track structure for the confirmation modal comparison
      const virtualTrack: any = {
        id: album.id,
        title: '', // Not used for album comparison
        artist: album.artist,
        album: album.name,
        year: album.year,
        releaseDate: album.releaseDate,
        trackNum: 0,
        musicbrainzAlbumId: album.musicbrainzAlbumId,
        musicbrainzTrackId: (album as any).tracks?.[0]?.musicbrainzTrackId, // Fallback to first track ID if available
        // Include other album-level metadata
        label: (album as any).label,
        catalogNumber: (album as any).catalogNumber,
        barcode: (album as any).barcode,
        country: (album as any).country,
        originalReleaseDate: (album as any).originalReleaseDate,
        media: (album as any).media,
        script: (album as any).script,
        totalDiscs: (album as any).totalDiscs,
        totalTracks: (album as any).totalTracks,
        albumType: (album as any).albumType,
        releaseStatus: (album as any).status
      }
      setTagConfirmationData({
        track: virtualTrack as Track,
        candidate: metadata,
        type: 'album'
      })
      setTagConfirmationOpen(true)
      setTaggingModalOpen(false)
    }
  }

  const handleConfirmTagging = async (
    _trackId: string,
    _candidate: any,
    selectedFields: string[]
  ) => {
    if (!tagConfirmationData) return

    console.log('✅ [UI] Confirmed tagging with fields:', selectedFields)
    const { track, candidate, type } = tagConfirmationData

    try {
      if (type === 'track') {
        // Single track tagging
        startTagging(1, track.title || 'Track')
        await client.applyCandidate(track.id, candidate, {
          writeToFile: true,
          selectedFields
        })
        updateProgress(1, track.title || 'Track')
        console.log('✅ [UI] Track updated successfully')
      } else {
        // Album tagging - minimize modal and show progress
        setTagConfirmationOpen(false)
        setTagConfirmationData(null)

        // Get album info for progress tracking
        const album = selectedItemForTagging as Album
        const trackCount = (album as any).trackCount || candidate.trackCount || 12 // Fallback estimate

        startTagging(trackCount, `${album.name} by ${album.artist}`)

        // Tag album (this will update all tracks)
        const updatedCount = await client.tagAlbumMetadata(track.id, candidate.id)

        // Simulate progress updates for better UX
        for (let i = 1; i <= updatedCount; i++) {
          updateProgress(i, `Track ${i} of ${updatedCount}`)
          await new Promise(resolve => setTimeout(resolve, 80)) // Small delay for visual feedback
        }

        console.log(`✅ [UI] Album tagged successfully. ${updatedCount} tracks updated.`)
      }

      initialize() // Refresh library
      finishTagging()
    } catch (error) {
      console.error('❌ [UI] Error applying tags:', error)
      finishTagging()
    } finally {
      if (type === 'track') {
        setTagConfirmationOpen(false)
        setTagConfirmationData(null)
      }
    }
  }

  const handlePlayOptionSelect = useCallback(
    (option: TrackPlayBehavior, remember: boolean) => {
      if (!selectedTrackForPlay) return

      if (remember) {
        setTrackPlayBehavior(option)
      }

      switch (option) {
        case 'replace':
          playTrack(selectedTrackForPlay)
          break
        case 'play_next':
          playNext(selectedTrackForPlay)
          break
        case 'add_last':
          addToQueue(selectedTrackForPlay)
          break
      }

      setPlayModalOpen(false)
      setSelectedTrackForPlay(null)
    },
    [selectedTrackForPlay, playTrack, playNext, addToQueue, setTrackPlayBehavior]
  )

  const renderView = () => {
    switch (activeView) {
      case 'settings':
        return <SettingsView />
      case 'albums':
        return <AlbumsView onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })} />
      case 'artists':
        return (
          <ArtistsView
            onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
          />
        )
      case 'tracks':
        return <TracksView />
      case 'playlists':
        return <PlaylistsView playlistId={viewParams?.playlistId} />
      case 'unsorted':
        return <UnsortedView />
      case 'favorites':
        return <FavoritesView />
      case 'genres':
        return <GenresView />
      case 'album-artists':
        return (
          <AlbumArtistsView
            onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
          />
        )
      case 'album-detail':
        return <AlbumDetailView albumId={viewParams?.albumId} onBack={() => goBack()} />
      case 'artist-detail':
        return (
          <ArtistDetailView
            artistName={viewParams?.artistName}
            onBack={() => goBack()}
            onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })}
            onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
          />
        )
      case 'home':
      default:
        return <HomeView />
    }
  }

  return (
    <div
      className={cn('h-screen flex flex-col overflow-hidden bg-black', isResizing && 'select-none')}
    >
      {/* Search Modal */}
      <SearchModal />

      {/* Play Option Modal */}
      <TrackPlayOptionModal
        isOpen={playModalOpen}
        onClose={() => setPlayModalOpen(false)}
        onSelect={handlePlayOptionSelect}
        trackTitle={selectedTrackForPlay?.title || ''}
      />

      <CreatePlaylistModal
        isOpen={createPlaylistModalOpen}
        onClose={() => setCreatePlaylistModalOpen(false)}
        initialTrackIds={initialTrackIdsForNewPlaylist}
      />

      <TaggingModal
        isOpen={taggingModalOpen}
        onClose={() => setTaggingModalOpen(false)}
        item={selectedItemForTagging}
        itemType={taggingItemType}
        onSave={handleTaggingSave}
      />

      {tagConfirmationData && (
        <TagConfirmationModal
          isOpen={tagConfirmationOpen}
          onClose={() => setTagConfirmationOpen(false)}
          track={tagConfirmationData.track}
          candidate={tagConfirmationData.candidate}
          type={tagConfirmationData.type}
          onConfirm={handleConfirmTagging}
        />
      )}

      <AnimatePresence mode="wait">
        {isMiniPlayer ? (
          <motion.div
            key="miniplayer"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-1 flex flex-col overflow-hidden bg-zinc-950 relative"
          >
            <div className="absolute top-0 left-0 right-0 z-50">
              <TopBar />
            </div>
            <div className="flex-1 min-h-0">
              <MiniPlayerView />
            </div>
          </motion.div>
        ) : isTheaterMode ? (
          <motion.div
            key="theatermode"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 overflow-hidden bg-black relative"
          >
            <div className="absolute inset-0 z-0">
              <TheaterModeView />
            </div>
            <div className="absolute top-0 left-0 right-0 z-50">
              <TopBar />
            </div>
            <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none *:pointer-events-auto">
              <PlayerBar
                onQueueToggle={() => setIsQueueOpen(!isQueueOpen)}
                onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })}
                onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="mainapp"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Top Bar */}
            <TopBar />

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <Sidebar />

              {/* Main Content Container (Dynamic width) */}
              <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 overflow-auto bg-zinc-900 border-r border-zinc-800">
                  {renderView()}
                </main>

                {/* Resizable Handle */}
                {isQueueOpen && (
                  <div
                    onMouseDown={startResizing}
                    className="w-1 bg-zinc-800 hover:bg-blue-600 cursor-col-resize transition-colors z-10"
                  />
                )}

                {/* Queue Panel */}
                <QueuePanel
                  isOpen={isQueueOpen}
                  width={queueWidth}
                  onClose={() => setIsQueueOpen(false)}
                  selectedTrackIndex={queueSelectedIndex}
                  onTrackSelect={setQueueSelectedIndex}
                />
              </div>
            </div>

            {/* Player Bar */}
            <PlayerBar
              onQueueToggle={() => setIsQueueOpen(!isQueueOpen)}
              onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })}
              onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Progress Toast */}
      <SyncProgressToast />

      {isTagEditorOpen && (
        <TagEditorModal
          tracks={tagEditorTracks}
          context={tagEditorContext}
          onClose={() => setIsTagEditorOpen(false)}
        />
      )}

      {/* Global Context Menus */}
      {trackContextMenu && (
        <TrackContextMenu
          track={trackContextMenu.track}
          selectedTrackIds={trackContextMenu.selectedTrackIds}
          x={trackContextMenu.x}
          y={trackContextMenu.y}
          onClose={() => setTrackContextMenu(null)}
        />
      )}

      {albumContextMenu && (
        <AlbumContextMenu
          album={albumContextMenu.album}
          x={albumContextMenu.x}
          y={albumContextMenu.y}
          onClose={() => setAlbumContextMenu(null)}
        />
      )}
    </div>
  )
}

export default App
