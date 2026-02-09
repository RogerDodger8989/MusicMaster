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
import SearchModal from './components/SearchModal'
import TaggingModal from './components/TaggingModal'
import TagConfirmationModal from './components/TagConfirmationModal'
import QueuePanel from './components/QueuePanel'
import TrackContextMenu from './components/TrackContextMenu'
import { TrackPlayOptionModal } from './components/modals/TrackPlayOptionModal'
import { client } from './api/client'
import { useLibrary } from './store/library'
import { useNavigation } from './store/navigation'
import { usePlayer } from './store/player'
import { useSettings, TrackPlayBehavior } from './store/settings'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { scrobbleService } from './services/scrobbleService'
import { Track, Album } from './types'

function App(): React.JSX.Element {
  const { initialize } = useLibrary()
  const { current, navigateTo, goBack } = useNavigation()
  const { playTrack, playNext, addToQueue, loadSession, togglePlay } = usePlayer()
  const { setTrackPlayBehavior, loadSettings } = useSettings()

  const activeView = current.view
  const viewParams = current.params

  const [playModalOpen, setPlayModalOpen] = useState(false)
  const [selectedTrackForPlay, setSelectedTrackForPlay] = useState<Track | null>(null)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [queueWidth, setQueueWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [queueSelectedIndex, setQueueSelectedIndex] = useState<number | null>(null)

  const [taggingModalOpen, setTaggingModalOpen] = useState(false)
  const [selectedItemForTagging, setSelectedItemForTagging] = useState<Track | Album | null>(null)
  const [taggingItemType, setTaggingItemType] = useState<'track' | 'album'>('track')

  const [tagConfirmationOpen, setTagConfirmationOpen] = useState(false)
  const [tagConfirmationData, setTagConfirmationData] = useState<{
    track: Track
    candidate: any
    type: 'track' | 'album'
  } | null>(null)

  const [trackContextMenu, setTrackContextMenu] = useState<{
    track: Track
    x: number
    y: number
  } | null>(null)

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

    return () => {
      scrobbleService.stop()
      initialize()
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
      if (isQueueOpen) {
        setIsQueueOpen(false)
      }
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

  // Listen for request-track-tagging
  useEffect(() => {
    const handleTaggingRequest = (e: CustomEvent) => {
      const track = e.detail.track as Track
      if (track) {
        setSelectedItemForTagging(track)
        setTaggingItemType('track')
        setTaggingModalOpen(true)
      }
    }
    window.addEventListener('request-track-tagging', handleTaggingRequest as EventListener)
    return () =>
      window.removeEventListener('request-track-tagging', handleTaggingRequest as EventListener)
  }, [])

  // Listen for request-album-tagging
  useEffect(() => {
    const handleAlbumTaggingRequest = (e: CustomEvent) => {
      const album = e.detail.album as Album
      if (album) {
        setSelectedItemForTagging(album)
        setTaggingItemType('album')
        setTaggingModalOpen(true)
      }
    }
    window.addEventListener('request-album-tagging', handleAlbumTaggingRequest as EventListener)
    return () =>
      window.removeEventListener(
        'request-album-tagging',
        handleAlbumTaggingRequest as EventListener
      )
  }, [])

  // Global Context Menu Listener
  useEffect(() => {
    const handleContextMenuRequest = (e: CustomEvent) => {
      const { track, x, y } = e.detail
      if (track) {
        setTrackContextMenu({ track, x, y })
      }
    }
    window.addEventListener('show-track-context-menu', handleContextMenuRequest as EventListener)
    return () =>
      window.removeEventListener(
        'show-track-context-menu',
        handleContextMenuRequest as EventListener
      )
  }, [])

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
        title: '', // Not used for album comparison header
        artist: album.artist,
        album: album.name,
        year: album.year,
        trackNum: 0,
        musicbrainzAlbumId: album.musicbrainzAlbumId,
        musicbrainzTrackId: (album as any).tracks?.[0]?.musicbrainzTrackId // Fallback to first track ID if available
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
        // Use applyCandidate with granular fields
        await client.applyCandidate(track.id, candidate, {
          writeToFile: true,
          selectedFields
        })
        console.log('✅ [UI] Track updated successfully')
      } else {
        // Album tagging
        const updatedCount = await client.tagAlbumMetadata(track.id, candidate.id)
        console.log(`✅ [UI] Album tagged successfully. ${updatedCount} tracks updated.`)
      }

      initialize() // Refresh library
    } catch (error) {
      console.error('❌ [UI] Error applying tags:', error)
    } finally {
      setTagConfirmationOpen(false)
      setTagConfirmationData(null)
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
        return <PlaylistsView />
      case 'unsorted':
        return <UnsortedView />
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

      {/* Sync Progress Toast */}
      <SyncProgressToast />

      {/* Global Track Context Menu */}
      {trackContextMenu && (
        <TrackContextMenu
          track={trackContextMenu.track}
          x={trackContextMenu.x}
          y={trackContextMenu.y}
          onClose={() => setTrackContextMenu(null)}
        />
      )}
    </div>
  )
}

export default App
