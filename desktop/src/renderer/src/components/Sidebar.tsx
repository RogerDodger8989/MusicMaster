import { Home, Disc3, Users, Music, ListMusic, Settings, FileQuestion } from 'lucide-react'
import { cn } from '../lib/utils'
import { useLibrary } from '../store/library'
import { useNavigation } from '../store/navigation'

type NavItem = {
    id: string
    label: string
    icon: React.ReactNode
}

const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'albums', label: 'Albums', icon: <Disc3 className="w-5 h-5" /> },
    { id: 'artists', label: 'Artists', icon: <Users className="w-5 h-5" /> },
    { id: 'tracks', label: 'Tracks', icon: <Music className="w-5 h-5" /> },
    { id: 'playlists', label: 'Playlists', icon: <ListMusic className="w-5 h-5" /> },
    { id: 'unsorted', label: 'Unsorted', icon: <FileQuestion className="w-5 h-5" /> }
]

export default function Sidebar() {
    const { tracks, albums } = useLibrary()
    const { current, navigateTo } = useNavigation()
    const activeView = current.view
    const setActiveView = (view: string) => navigateTo(view)

    return (
        <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                            'hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500',
                            activeView === item.id
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-300'
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
                        activeView === 'settings'
                            ? 'bg-blue-600 text-white'
                            : 'text-zinc-300'
                    )}
                >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                </button>
            </div>

            {/* Library Stats */}
            <div className="p-4 border-t border-zinc-800 text-sm text-zinc-500">
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span>Tracks</span>
                        <span className="font-medium text-zinc-400">{tracks.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Albums</span>
                        <span className="font-medium text-zinc-400">{albums.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Artists</span>
                        <span className="font-medium text-zinc-400">{new Set(tracks.map(t => t.artist)).size}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
