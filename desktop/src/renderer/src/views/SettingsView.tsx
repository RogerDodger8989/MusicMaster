import { useEffect } from 'react'
import { FolderOpen, Trash2, Eye, EyeOff, Play } from 'lucide-react'
import { useFolders } from '../store/folders'
import { useLibrary } from '../store/library'
import { useSettings, TrackPlayBehavior, ReplayGainMode } from '../store/settings'
import { cn } from '../lib/utils'

export default function SettingsView() {
    const { folders, isLoading, loadFolders, addFolder, removeFolder, updateFolderWatch, browseFolder } = useFolders()
    const settings = useSettings()

    useEffect(() => {
        loadFolders()
    }, [])

    useEffect(() => {
        // Ensure settings are loaded
        settings.loadSettings()
    }, [])

    const handleAddFolder = async () => {
        try {
            console.log('handleAddFolder: Starting...')
            console.log('window.api:', window.api)

            const folderPath = await browseFolder()
            console.log('Selected folder:', folderPath)

            if (folderPath) {
                // Add folder to database
                await addFolder(folderPath, false)
                console.log('Folder added successfully')

                // Reload folders to get the new folder with ID
                await loadFolders()

                // Get the newly added folder
                const newFolder = folders.find(f => f.path === folderPath)
                if (newFolder) {
                    // Automatically start scanning the new folder
                    console.log('Auto-starting scan for new folder...')
                    await handleScanFolder(newFolder.id, newFolder.path)
                }
            }
        } catch (error) {
            console.error('handleAddFolder error:', error)
            alert(`Error adding folder: ${error}`)
        }
    }

    const handleScanFolder = async (folderId: string, folderPath: string) => {
        try {
            await window.api.scanner.start(folderId, folderPath)
        } catch (error) {
            console.error('Scan error:', error)
        }
    }

    return (
        <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-white">Settings</h2>

            {/* Music Folders Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Music Folders</h3>
                    <button
                        onClick={handleAddFolder}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Add Folder
                    </button>
                </div>

                {folders.length === 0 ? (
                    <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                        <FolderOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-400 mb-4">No music folders configured</p>
                        <p className="text-sm text-zinc-500">
                            Add a folder to start building your music library
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <FolderOpen className="w-5 h-5 text-blue-500" />
                                        <span className="font-medium text-white">{folder.name}</span>
                                        {folder.watchEnabled && (
                                            <span className="px-2 py-0.5 bg-green-900/30 text-green-400 text-xs rounded-full border border-green-800">
                                                Watching
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-500 ml-8">{folder.path}</p>
                                    <div className="flex items-center gap-4 ml-8 mt-2 text-xs text-zinc-600">
                                        <span>{folder.trackCount} tracks</span>
                                        {folder.lastScanned && (
                                            <span>Last scanned: {new Date(folder.lastScanned).toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Scan Button */}
                                    <button
                                        onClick={() => handleScanFolder(folder.id, folder.path)}
                                        className={cn(
                                            'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400',
                                            'focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        )}
                                        title="Scan folder"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>

                                    {/* Watch Toggle */}
                                    <button
                                        onClick={() => updateFolderWatch(folder.id, !folder.watchEnabled)}
                                        className={cn(
                                            'p-2 rounded-lg hover:bg-zinc-800 transition-colors',
                                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                                            folder.watchEnabled ? 'text-green-400' : 'text-zinc-400'
                                        )}
                                        title={folder.watchEnabled ? 'Disable watching' : 'Enable watching'}
                                    >
                                        {folder.watchEnabled ? (
                                            <Eye className="w-4 h-4" />
                                        ) : (
                                            <EyeOff className="w-4 h-4" />
                                        )}
                                    </button>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeFolder(folder.id)}
                                        className={cn(
                                            'p-2 rounded-lg hover:bg-red-900/30 transition-colors text-red-400',
                                            'focus:outline-none focus:ring-2 focus:ring-red-500'
                                        )}
                                        title="Remove folder"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Other Settings Sections */}
            <div className="space-y-6">
                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
                    <p className="text-sm text-zinc-500">Theme and color scheme settings coming soon...</p>
                </div>

                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Playback</h3>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-zinc-400">On Double-Click / Play Single Track</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    { id: 'ask', label: 'Ask' },
                                    { id: 'play_next', label: 'Play Next' },
                                    { id: 'add_last', label: 'Add to Queue' },
                                    { id: 'replace', label: 'Play Now' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => settings.setTrackPlayBehavior(opt.id as TrackPlayBehavior)}
                                        className={cn(
                                            "px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
                                            settings.trackPlayBehavior === opt.id
                                                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                                                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-1">
                                Choose what happens when you double-click a track or select "Play" on a single item.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
                            <label className="text-sm font-medium text-zinc-400">ReplayGain Normalization</label>
                            <p className="text-[11px] text-zinc-600 mb-2">
                                ReplayGain automatically adjusts volume for a consistent listening level across all tracks.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'off', label: 'Off' },
                                    { id: 'track', label: 'Track Level' },
                                    { id: 'album', label: 'Album Level' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => settings.setReplayGainMode(opt.id as ReplayGainMode)}
                                        className={cn(
                                            "px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
                                            settings.replayGainMode === opt.id
                                                ? "bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20"
                                                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-2">
                                <strong>Track Level:</strong> Normalize each track individually<br />
                                <strong>Album Level:</strong> Normalize per album (preserves album dynamics)<br />
                                <strong>Off:</strong> Disable ReplayGain
                            </p>
                        </div>

                        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
                            <div>
                                <label className="text-sm font-medium text-zinc-400">Gapless Playback</label>
                                <p className="text-[11px] text-zinc-600 mt-1">
                                    Preloads the next track for seamless transitions.
                                </p>
                            </div>
                            <button
                                onClick={() => settings.setGaplessEnabled(!settings.gaplessEnabled)}
                                className={cn(
                                    "px-3 py-2 text-xs font-semibold rounded-lg border transition-all",
                                    settings.gaplessEnabled
                                        ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
                                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                                )}
                            >
                                {settings.gaplessEnabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Scrobbling</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <label className="text-sm font-medium text-zinc-400">ListenBrainz Token</label>
                                    <p className="text-xs text-zinc-600 mt-1">Paste your ListenBrainz token and enable to scrobble</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.listenbrainzEnabled}
                                    onChange={(e) => settings.setListenbrainzEnabled(e.target.checked)}
                                    className="w-4 h-4 cursor-pointer"
                                    title="Enable ListenBrainz scrobbling"
                                />
                            </div>
                            <input
                                type="text"
                                value={settings.listenbrainzToken}
                                onChange={(e) => settings.setListenbrainzToken(e.target.value)}
                                placeholder="Paste your ListenBrainz token..."
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <label className="text-sm font-medium text-zinc-400">Last.fm API Key</label>
                                    <p className="text-xs text-zinc-600 mt-1">Paste your Last.fm API key and enable to scrobble</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.lastfmEnabled}
                                    onChange={(e) => settings.setLastfmEnabled(e.target.checked)}
                                    className="w-4 h-4 cursor-pointer"
                                    title="Enable Last.fm scrobbling"
                                />
                            </div>
                            <input
                                type="text"
                                value={settings.lastfmApiKey}
                                onChange={(e) => settings.setLastfmApiKey(e.target.value)}
                                placeholder="Paste your Last.fm API key..."
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                        </div>

                        <p className="text-xs text-zinc-500">
                            📊 <strong>Play Tracking:</strong> Each completed track play is recorded and automatically submitted to configured services.
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Integrations</h3>
                    <p className="text-sm text-zinc-500">MusicBrainz, Spotify integration coming soon...</p>
                </div>

                <div className="p-6 bg-red-900/10 border border-red-900/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-500 mb-4">Maintenance</h3>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => useLibrary.getState().reanalyzeLibrary()}
                            className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        >
                            <Play className="w-4 h-4 text-blue-500" />
                            Re-analyze Library
                        </button>
                        <button
                            onClick={async () => {
                                if (confirm('Are you sure you want to completely RESET your music library? This will clear all tracks, albums, and statistics.')) {
                                    await window.api.library.reset()
                                    const library = useLibrary.getState()
                                    await library.loadTracks()
                                    await library.loadAlbums()
                                    await library.loadGenres()
                                    await loadFolders()
                                }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Reset Library
                        </button>
                    </div>
                    <p className="text-xs text-red-500/70 mt-3">
                        Use Reset Library if your collection becomes out of sync or shows orphaned files.
                    </p>
                </div>
            </div>
        </div>
    )
}
