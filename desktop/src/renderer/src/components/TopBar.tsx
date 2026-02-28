import { Music2, Moon, Sun, ChevronLeft, ChevronRight, Search, Clock, Loader2, Minus, Maximize2, X, Monitor, Pin, Square, RectangleHorizontal, Tv, Maximize } from 'lucide-react'
import { useTheme } from '../store/theme'
import { useNavigation, ViewState } from '../store/navigation'
import { useSearch } from '../store/search'
import { useTagging } from '../store/tagging'
import { cn } from '../lib/utils'
import { useState, useRef, useEffect } from 'react'

import { useUI } from '../store/ui'

export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { goBack, goForward, canGoBack, canGoForward, history, future, jumpTo } = useNavigation()
  const { setIsOpen } = useSearch()
  const { progress } = useTagging()
  const { isMiniPlayer, toggleMiniPlayer, isAlwaysOnTop, setAlwaysOnTop, isTheaterMode, toggleTheaterMode, isFullScreen, setFullScreen } = useUI()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  // Debug navigation state
  useEffect(() => {
    console.log('[TopBar] Navigation state updated:')
    console.log('  History length:', history.length)
    console.log('  Future length:', future.length)
    console.log('  canGoBack:', canGoBack())
    console.log('  canGoForward:', canGoForward())
  }, [history, future, canGoBack, canGoForward])

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isBarMode = windowWidth >= 500

  const [historyMenu, setHistoryMenu] = useState<{
    x: number
    y: number
    items: ViewState[]
    isForward: boolean
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent, items: ViewState[], isForward: boolean) => {
    if (items.length === 0) return
    e.preventDefault()
    setHistoryMenu({ x: e.clientX, y: e.clientY, items, isForward })
  }

  const formatViewName = (view: string, params?: any) => {
    const name = view
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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
    <div
      className={cn(
        isMiniPlayer ? 'h-10' : 'h-16',
        'flex items-center justify-between px-6 z-50 select-none transition-colors duration-300',
        (!isMiniPlayer && !isTheaterMode) && 'border-b border-zinc-800 dark:border-zinc-800 bg-zinc-950 dark:bg-zinc-950',
        (isMiniPlayer || isTheaterMode) && 'bg-transparent border-none'
      )}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Navigation and Search */}
      {(!isMiniPlayer && !isTheaterMode) && (
        <div className="flex items-center gap-6 flex-1">
          {/* Logo */}
          <div className="flex items-center gap-3 mr-4">
            <Music2 className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white hidden md:block">MusicMaster</h1>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                console.log('[TopBar] Back button clicked. canGoBack:', canGoBack())
                goBack()
              }}
              onContextMenu={(e) => handleContextMenu(e, history, false)}
              disabled={!canGoBack()}
              className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors relative"
              title="Back (Right-click for history)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                console.log('[TopBar] Forward button clicked. canGoForward:', canGoForward())
                goForward()
              }}
              onContextMenu={(e) => handleContextMenu(e, future, true)}
              disabled={!canGoForward()}
              className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors relative"
              title="Forward (Right-click for history)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl relative cursor-pointer group" onClick={() => setIsOpen(true)} style={{ WebkitAppRegion: 'no-drag' } as any}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tracks, albums, artists..."
              readOnly
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            />
          </div>
        </div>
      )}

      {(isMiniPlayer || isTheaterMode) && <div className="flex-1" />}

      {/* Right: Theme Toggle + Tagging Progress */}
      <div className="flex items-center gap-4">
        {/* Tagging Progress Indicator */}
        {progress && progress.isTagging && (
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg animate-in fade-in slide-in-from-right duration-200">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <div className="flex flex-col gap-1 min-w-[200px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">Tagging...</span>
                <span className="text-xs font-mono text-zinc-500">
                  {progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 truncate">{progress.currentTrack}</span>
            </div>
          </div>
        )}

        {/* Action Buttons Container */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Always on Top (Toggle) */}
          <button
            onClick={() => setAlwaysOnTop(!isAlwaysOnTop)}
            className={cn(
              'p-2 rounded-lg hover:bg-zinc-800 transition-colors',
              isAlwaysOnTop ? 'text-blue-400' : 'text-zinc-500'
            )}
            title={isAlwaysOnTop ? 'Always on Top: On' : 'Always on Top: Off'}
          >
            <Pin className={cn("w-4 h-4 transition-all", isAlwaysOnTop ? "rotate-45 fill-blue-400" : "-rotate-45")} />
          </button>

          {/* Theme Toggle */}
          {(!isMiniPlayer && !isTheaterMode) && (
            <button
              onClick={toggleTheme}
              className={cn(
                'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}

          {(!isMiniPlayer && !isTheaterMode) && <div className="w-px h-6 bg-zinc-800 mx-2" />}

          {/* MiniPlayer Mode Toggle (Standard vs Bar) */}
          {isMiniPlayer && (
            <button
              onClick={() => {
                if (isBarMode) {
                  window.api.window.setSize(400, 550)
                } else {
                  window.api.window.setSize(600, 120)
                }
              }}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title={isBarMode ? "Standard Mode" : "Bar Mode"}
            >
              <div className="relative">
                {isBarMode ? <Square size={16} /> : <RectangleHorizontal size={16} />}
              </div>
            </button>
          )}

          {/* MiniPlayer Toggle (Left of Minimize) */}
          <button
            onClick={toggleMiniPlayer}
            className={cn(
              'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white',
              isMiniPlayer && 'text-blue-400'
            )}
            title="MiniPlayer Mode"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Theater Mode Toggle */}
          <button
            onClick={toggleTheaterMode}
            className={cn(
              'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white',
              isTheaterMode && 'text-blue-400'
            )}
            title="Theater Mode"
          >
            <Tv className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setFullScreen(!isFullScreen)}
            className={cn(
              'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white',
              isFullScreen && 'text-blue-400'
            )}
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* Window Controls */}
          <button
            onClick={() => window.api.window.minimize()}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.api.window.toggleMaximize()}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white hidden md:block"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.api.window.close()}
            className="p-2 rounded-lg hover:bg-red-600 transition-all text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          {(historyMenu.isForward ? historyMenu.items : [...historyMenu.items].reverse()).map(
            (item, idx) => {
              // For history, reverse so most recent is top. Index in store is still needed for jumpTo.
              const actualIdx = historyMenu.isForward ? idx : historyMenu.items.length - 1 - idx
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
            }
          )}
        </div>
      )}
    </div>
  )
}
