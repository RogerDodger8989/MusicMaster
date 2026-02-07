import { Music2, Moon, Sun, ChevronLeft, ChevronRight, Search, Clock } from 'lucide-react'
import { useTheme } from '../store/theme'
import { useNavigation, ViewState } from '../store/navigation'
import { useSearch } from '../store/search'
import { cn } from '../lib/utils'
import { useState, useRef, useEffect } from 'react'

export default function TopBar() {
    const { theme, toggleTheme } = useTheme()
    const { goBack, goForward, canGoBack, canGoForward, history, future, jumpTo } = useNavigation()
    const { setIsOpen } = useSearch()

    const [historyMenu, setHistoryMenu] = useState<{ x: number, y: number, items: ViewState[], isForward: boolean } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const handleContextMenu = (e: React.MouseEvent, items: ViewState[], isForward: boolean) => {
        if (items.length === 0) return
        e.preventDefault()
        setHistoryMenu({ x: e.clientX, y: e.clientY, items, isForward })
    }

    const formatViewName = (view: string, params?: any) => {
        const name = view.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        if (params) {
            if (params.artistName) return params.artistName
            if (params.albumId) return `Album Detail`
            if (params.genre) return `Genre: ${params.genre}`
        }
        return name
    }

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setHistoryMenu(null)
            }
        }
        if (historyMenu) {
            window.addEventListener('mousedown', handleClickOutside)
        }
        return () => window.removeEventListener('mousedown', handleClickOutside)
    }, [historyMenu])

    return (
        <div className="h-16 border-b border-zinc-800 dark:border-zinc-800 bg-zinc-950 dark:bg-zinc-950 flex items-center justify-between px-6 z-50">
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
                        onContextMenu={(e) => handleContextMenu(e, history, false)}
                        disabled={!canGoBack()}
                        className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors relative"
                        title="Back (Right-click for history)"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={goForward}
                        onContextMenu={(e) => handleContextMenu(e, future, true)}
                        disabled={!canGoForward()}
                        className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors relative"
                        title="Forward (Right-click for history)"
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

            {/* History Dropdown Menu */}
            {historyMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-[100] bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: historyMenu.x, top: historyMenu.y }}
                >
                    <div className="px-3 py-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 mb-1 flex items-center gap-2">
                        <Clock size={10} />
                        {historyMenu.isForward ? 'Future' : 'History'}
                    </div>
                    {(historyMenu.isForward ? historyMenu.items : [...historyMenu.items].reverse()).map((item, idx) => {
                        // For history, reverse so most recent is top. Index in store is still needed for jumpTo.
                        const actualIdx = historyMenu.isForward ? idx : (historyMenu.items.length - 1 - idx)
                        return (
                            <button
                                key={`${item.view}-${actualIdx}`}
                                onClick={() => {
                                    jumpTo(actualIdx, historyMenu.isForward)
                                    setHistoryMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-blue-600 transition-colors truncate"
                            >
                                {formatViewName(item.view, item.params)}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
