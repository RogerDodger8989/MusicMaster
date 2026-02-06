import { Music2, Moon, Sun, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTheme } from '../store/theme'
import { useNavigation } from '../store/navigation'
import { useSearch } from '../store/search'
import { cn } from '../lib/utils'

export default function TopBar() {
    const { theme, toggleTheme } = useTheme()
    const { goBack, goForward, canGoBack, canGoForward } = useNavigation()
    const { setIsOpen } = useSearch()

    return (
        <div className="h-16 border-b border-zinc-800 dark:border-zinc-800 bg-zinc-950 dark:bg-zinc-950 flex items-center justify-between px-6">
            {/* Left: Navigation and Search */}
            <div className="flex items-center gap-6 flex-1">
                {/* Logo */}
                <div className="flex items-center gap-3 mr-4">
                    <Music2 className="w-8 h-8 text-blue-500" />
                    <h1 className="text-2xl font-bold text-white hidden md:block">MusicMaster</h1>
                </div>

                {/* Navigation Arrows */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={goBack}
                        disabled={!canGoBack()}
                        className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
                        title="Back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={goForward}
                        disabled={!canGoForward()}
                        className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
                        title="Forward"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div
                    className="flex-1 max-w-xl relative cursor-pointer"
                    onClick={() => setIsOpen(true)}
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search tracks, albums, artists..."
                        readOnly
                        className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                    />
                </div>
            </div>

            {/* Right: Theme Toggle */}
            <button
                onClick={toggleTheme}
                className={cn(
                    'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-white ml-4',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                aria-label="Toggle theme"
            >
                {theme === 'dark' ? (
                    <Sun className="w-5 h-5" />
                ) : (
                    <Moon className="w-5 h-5" />
                )}
            </button>
        </div>
    )
}
