import { Home, Disc3, Users, Music, ListMusic, Settings, FileQuestion, Heart, Mic2, Tags, ChevronDown, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { useNavigation } from '../store/navigation'
import { useSettings } from '../store/settings'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useDJ } from '../store/dj'
import { client } from '../api/client'

type NavItem = {
  id: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
  { id: 'tracks', label: 'Tracks', icon: <Music className="w-5 h-5" /> },
  { id: 'albums', label: 'Albums', icon: <Disc3 className="w-5 h-5" /> },
  { id: 'genres', label: 'Genres', icon: <Tags className="w-5 h-5" /> },
  { id: 'album-artists', label: 'Album Artists', icon: <Mic2 className="w-5 h-5" /> },
  { id: 'artists', label: 'Artists', icon: <Users className="w-5 h-5" /> },
  { id: 'favorites', label: 'Favorites', icon: <Heart className="w-5 h-5" /> },
  { id: 'virtual-dj', label: 'AI DJ', icon: <Sparkles className="w-5 h-5 text-purple-400" /> },
  { id: 'playlists', label: 'Playlists', icon: <ListMusic className="w-5 h-5" /> },
  { id: 'unsorted', label: 'Unsorted', icon: <FileQuestion className="w-5 h-5" /> }
]

export default function Sidebar() {
  const { current, navigateTo } = useNavigation()
  const { startDJ } = useDJ.getState()
  const activeView = current.view
  const setActiveView = (view: string) => {
    if (view === 'virtual-dj') {
      startDJ()
      return
    }
    navigateTo(view)
  }

  const isCoverExpanded = useSettings((state) => state.isCoverExpanded)
  const toggleCoverExpanded = useSettings((state) => state.toggleCoverExpanded)
  const { currentTrack: playerTrack } = usePlayer()
  const { albums, tracks: allTracks } = useLibrary()

  const currentTrack = playerTrack
    ? allTracks.find((t) => t.id === playerTrack.id) || playerTrack
    : null

  const handleCoverContextMenu = (e: React.MouseEvent) => {
    if (!currentTrack) return
    e.preventDefault()
    window.dispatchEvent(
      new CustomEvent('show-track-context-menu', {
        detail: {
          track: currentTrack,
          x: e.clientX,
          y: e.clientY
        }
      })
    )
  }

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full min-h-0">
      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar min-h-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              'hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500',
              activeView === item.id ? 'bg-blue-600 text-white' : 'text-zinc-300'
            )}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Settings at Bottom */}
      <div className="p-4 border-t border-zinc-800">
        <button
          onClick={() => setActiveView('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
            'hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500',
            activeView === 'settings' ? 'bg-blue-600 text-white' : 'text-zinc-300'
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>

      {/* Expanded Player Cover */}
      <AnimatePresence>
        {isCoverExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 256, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="w-full border-t border-zinc-800 relative group/expanded shrink-0 overflow-hidden bg-zinc-900"
            onContextMenu={handleCoverContextMenu}
          >
            {currentTrack ? (
              <>
                <img
                  src={client.getCoverUrl(
                    albums.find(
                      (a) =>
                        a.name === currentTrack.album &&
                        a.artist === (currentTrack.albumArtist || currentTrack.artist)
                    )?.id || ''
                  )}
                  alt={currentTrack?.album || 'Album Art'}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105 min-h-[256px]"
                  onError={(e) => {
                    ; (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />

                {/* Collapse Overlay */}
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover/expanded:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm"
                  onClick={toggleCoverExpanded}
                  title="Collapse cover"
                >
                  <div className="bg-zinc-900/80 p-3 rounded-full text-white transform -translate-y-4 group-hover/expanded:translate-y-0 transition-all duration-300">
                    <ChevronDown className="w-8 h-8" />
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-[256px] flex flex-col items-center justify-center text-zinc-700">
                <Music className="w-16 h-16 mb-2 opacity-50" />
                <p className="text-xs font-medium">No track playing</p>

                <div
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover/expanded:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={toggleCoverExpanded}
                  title="Collapse cover"
                >
                  <div className="bg-zinc-900/80 p-3 rounded-full text-white transform -translate-y-4 group-hover/expanded:translate-y-0 transition-all duration-300">
                    <ChevronDown className="w-8 h-8" />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
