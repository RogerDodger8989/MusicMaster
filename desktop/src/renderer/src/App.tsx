import { useState, useCallback, useEffect } from 'react'
import TopBar from './components/TopBar'
import { cn } from './lib/utils'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import SettingsView from './views/SettingsView'
import AlbumsView from './views/AlbumsView'
import AlbumDetailView from './views/AlbumDetailView'
import ArtistDetailView from './views/ArtistDetailView'
import ArtistsView from './views/ArtistsView'
import TracksView from './views/TracksView'
import PlaylistsView from './views/PlaylistsView'
import SearchModal from './components/SearchModal'
import QueuePanel from './components/QueuePanel'
import { TrackPlayOptionModal } from './components/modals/TrackPlayOptionModal'
import { useLibrary } from './store/library'
import { useNavigation } from './store/navigation'
import { usePlayer } from './store/player'
import { useSettings, TrackPlayBehavior } from './store/settings'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { scrobbleService } from './services/scrobbleService'
import { Track } from './types'

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

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth > 300 && newWidth < 800) {
        setQueueWidth(newWidth)
      }
    }
  }, [isResizing])

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
    loadSettings()
    loadSession()
    
    // Start scrobble service and update API keys
    const settings = useSettings.getState()
    scrobbleService.start(settings.lastfmSessionKey || undefined)
    
    if (settings.lastfmApiKey) {
      window.api.scrobble.updateLastFmKey(settings.lastfmApiKey).catch(err => {
        console.error('Failed to set Last.fm key:', err)
      })
    }
    if (settings.listenbrainzToken) {
      window.api.scrobble.updateListenBrainzToken(settings.listenbrainzToken).catch(err => {
        console.error('Failed to set ListenBrainz token:', err)
      })
    }
    
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
            case 'replace': playTrack(track); break;
            case 'play_next': playNext(track); break;
            case 'add_last': addToQueue(track); break;
          }
        }
      }
    }
    window.addEventListener('request-track-play', handleRequest as EventListener)
    return () => window.removeEventListener('request-track-play', handleRequest as EventListener)
  }, [playTrack, playNext, addToQueue])

  const handlePlayOptionSelect = useCallback((option: TrackPlayBehavior, remember: boolean) => {
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
  }, [selectedTrackForPlay, playTrack, playNext, addToQueue, setTrackPlayBehavior])

  const renderView = () => {
    switch (activeView) {
      case 'settings':
        return <SettingsView />
      case 'albums':
        return <AlbumsView onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })} />
      case 'artists':
        return <ArtistsView onArtistClick={(name) => navigateTo('artist-detail', { artistName: name })} />
      case 'tracks':
        return <TracksView />
      case 'playlists':
        return <PlaylistsView />
      case 'album-detail':
        return (
          <AlbumDetailView
            albumId={viewParams?.albumId}
            onBack={() => goBack()}
          />
        )
      case 'artist-detail':
        return (
          <ArtistDetailView
            artistName={viewParams?.artistName}
            onBack={() => goBack()}
            onAlbumClick={(id) => navigateTo('album-detail', { albumId: id })}
          />
        )
      case 'home':
      default:
        return (
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-white">Welcome to MusicMaster</h2>
            <p className="text-zinc-400 mb-4">
              Your advanced music metadata management system inspired by Roon and MusicBee.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-2 text-white">Add Music Folders</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Configure your music folders in Settings to start building your library.
                </p>
                <button
                  onClick={() => navigateTo('settings')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Settings
                </button>
              </div>
              <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-2 text-white">Browse Albums</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Explore your music collection by albums.
                </p>
                <button
                  onClick={() => navigateTo('albums')}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  View Albums
                </button>
              </div>
              <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-2 text-white">Real-time Monitoring</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  Enable folder watching to automatically detect new music files.
                </p>
                <button
                  onClick={() => navigateTo('settings')}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden bg-black", isResizing && "select-none")}>
      {/* Search Modal */}
      <SearchModal />

      {/* Play Option Modal */}
      <TrackPlayOptionModal
        isOpen={playModalOpen}
        onClose={() => setPlayModalOpen(false)}
        onSelect={handlePlayOptionSelect}
        trackTitle={selectedTrackForPlay?.title || ''}
      />

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
    </div>
  )
}

export default App
