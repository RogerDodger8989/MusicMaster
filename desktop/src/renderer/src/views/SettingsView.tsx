import { useEffect, useState } from 'react'
import { FolderOpen, Trash2, Eye, EyeOff, Play, ExternalLink, Download } from 'lucide-react'
import { useFolders } from '../store/folders'
import { useLibrary } from '../store/library'
import { useSettings, TrackPlayBehavior, ReplayGainMode } from '../store/settings'
import { useSyncStore } from '../store/sync'
import { cn } from '../lib/utils'
import { scrobbleService } from '../services/scrobbleService'

export default function SettingsView() {
    const { folders, isLoading, loadFolders, addFolder, removeFolder, updateFolderWatch, browseFolder } = useFolders()
    const settings = useSettings()
    const { progress, startSync, updateProgress, completeSync } = useSyncStore()
    const [lastfmAuthToken, setLastfmAuthToken] = useState('')
    const [lastfmAuthUrl, setLastfmAuthUrl] = useState('')
    const [lastfmAuthInProgress, setLastfmAuthInProgress] = useState(false)
    const [exportingCSV, setExportingCSV] = useState(false)
    const [writeToFiles, setWriteToFiles] = useState(false)
    const [lbSyncProgress, setLbSyncProgress] = useState<{
        phase: 'fetching' | 'matching';
        fetched?: number;
        page?: number;
        current?: number;
        total?: number;
        isRunning: boolean;
    }>({ isRunning: false, phase: 'fetching' })

    useEffect(() => {
        loadFolders()
    }, [])

    useEffect(() => {
        // Ensure settings are loaded
        settings.loadSettings()
    }, [])

    useEffect(() => {
        // Listen for sync progress from main process
        const unsubscribe = window.api.scrobble.onSyncProgress((syncProgress) => {
            updateProgress({
                isRunning: true,
                current: syncProgress.current,
                total: syncProgress.total,
                trackName: syncProgress.trackName,
                percentage: syncProgress.percentage,
                errors: []
            })
        })

        return () => {
            unsubscribe()
        }
    }, [updateProgress])

    useEffect(() => {
        // Listen for ListenBrainz full sync progress
        const unsubscribe = window.api.scrobble.onListenBrainzSyncProgress((progress) => {
            setLbSyncProgress(prev => ({ ...prev, ...progress, isRunning: true }))
        })

        return () => {
            unsubscribe()
        }
    }, [])

    const handleSyncPlayCounts = async () => {
        if (progress?.isRunning) {
            alert('Sync is already running!')
            return
        }

        console.log(`🔍 DEBUG: lastfmUsername: "${settings.lastfmUsername}" (${typeof settings.lastfmUsername})`)
        console.log(`🔍 DEBUG: listenbrainzUsername: "${settings.listenbrainzUsername}" (${typeof settings.listenbrainzUsername})`)

        startSync()

        try {
            const result = await window.api.scrobble.syncAllPlayCounts(
                settings.lastfmUsername || undefined,
                settings.listenbrainzUsername || undefined,
                writeToFiles
            )

            completeSync()

            if (result.errors.length > 0) {
                alert(`✅ Synced ${result.synced}/${result.total} tracks\n\n❌ Failed tracks:\n${result.errors.slice(0, 10).join('\n')}${result.errors.length > 10 ? `\n...and ${result.errors.length - 10} more` : ''}`)
            } else {
                alert(`✅ Successfully synced all ${result.synced} tracks!${!writeToFiles ? '\n\n📝 Note: Play counts updated in database only.\nTo write to files, enable "Write to files" option.' : ''}`)
            }

            // Reload library to show updated play counts
            await useLibrary.getState().loadTracks()
        } catch (error) {
            console.error('Failed to sync play counts:', error)
            completeSync()
            alert('❌ Failed to sync play counts: ' + error)
        }
    }

    const handleExportCSV = async () => {
        setExportingCSV(true)
        try {
            const filePath = await window.api.scrobble.exportPlayCountsCSV()
            if (filePath) {
                alert(`✅ Play counts exported to:\n${filePath}`)
            } else {
                alert('Export cancelled')
            }
        } catch (error) {
            console.error('Failed to export CSV:', error)
            alert('❌ Failed to export CSV: ' + error)
        } finally {
            setExportingCSV(false)
        }
    }

    const handleLastFmStartAuth = async () => {
        setLastfmAuthInProgress(true)
        try {
            const result = await window.api.scrobble.getLastFmAuthToken()
            if (result) {
                setLastfmAuthToken(result.token)
                setLastfmAuthUrl(result.authUrl)
                console.log('✅ Last.fm auth started. Token:', result.token.substring(0, 8) + '...')
                console.log('Auth URL:', result.authUrl)
                // Automatically open URL
                window.open(result.authUrl, '_blank')
            } else {
                alert('Failed to get auth token from Last.fm. Check console for errors.')
            }
        } catch (error) {
            console.error('Failed to get Last.fm auth token:', error)
            alert('Failed to start Last.fm authentication: ' + error)
        }
        setLastfmAuthInProgress(false)
    }

    const handleLastFmCompleteAuth = async () => {
        if (!lastfmAuthToken) {
            alert('No auth token available. Please start authorization first.')
            return
        }
        try {
            console.log('🔄 Completing Last.fm auth with token:', lastfmAuthToken.substring(0, 8) + '...')
            const sessionKey = await window.api.scrobble.getLastFmSession(lastfmAuthToken)
            if (sessionKey) {
                settings.setLastfmSessionKey(sessionKey)
                scrobbleService.setLastFmSession(sessionKey)
                console.log('✅ Last.fm session obtained and updated in service:', sessionKey.substring(0, 8) + '...')
                setLastfmAuthToken('')
                setLastfmAuthUrl('')
                alert('Last.fm authenticated successfully!')
            } else {
                alert('Failed to get Last.fm session. Make sure you authorized the app on Last.fm first.')
            }
        } catch (error) {
            console.error('Failed to complete Last.fm auth:', error)
            alert('Failed to complete Last.fm authentication: ' + error)
        }
    }

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

    const handleLbFullSync = async () => {
        if (!settings.listenbrainzUsername) {
            alert('Please enter your ListenBrainz username first.')
            return
        }

        if (lbSyncProgress.isRunning) return

        setLbSyncProgress({ isRunning: true, phase: 'fetching', fetched: 0, page: 0 })

        try {
            const result = await window.api.scrobble.syncAllListenBrainz(settings.listenbrainzUsername)
            alert(`✅ ListenBrainz sync complete!\n\nUpdated play counts for ${result.updated} tracks out of ${result.total}.`)

            // Reload library to show updated play counts
            await useLibrary.getState().loadTracks()
        } catch (error) {
            console.error('ListenBrainz sync failed:', error)
            alert('❌ ListenBrainz sync failed: ' + error)
        } finally {
            setLbSyncProgress(prev => ({ ...prev, isRunning: false }))
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

                    {/* Important Notice */}
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/30 rounded-lg">
                        <p className="text-xs text-blue-300 mb-2">
                            <strong>📋 Before you start:</strong>
                        </p>
                        <ul className="text-xs text-blue-200 space-y-1 ml-4 list-disc">
                            <li><strong>ListenBrainz:</strong> Get your token from <a href="https://listenbrainz.org/profile/" target="_blank" rel="noreferrer" className="underline hover:text-blue-100">listenbrainz.org/profile/</a></li>
                            <li><strong>Last.fm:</strong> Create API key at <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer" className="underline hover:text-blue-100">last.fm/api/account/create</a></li>
                        </ul>
                    </div>

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
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 mb-3"
                            />
                            <div className="mb-3">
                                <label className="text-sm font-medium text-zinc-400">ListenBrainz Username</label>
                                <p className="text-xs text-zinc-600 mt-1">Your ListenBrainz username (for play count sync)</p>
                            </div>
                            <input
                                type="text"
                                value={settings.listenbrainzUsername}
                                onChange={(e) => settings.setListenbrainzUsername(e.target.value)}
                                placeholder="Enter your ListenBrainz username..."
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
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-3"
                            />
                            <div className="mb-3">
                                <label className="text-sm font-medium text-zinc-400">Last.fm Shared Secret</label>
                                <p className="text-xs text-zinc-600 mt-1">Required for authentication (get it when you create your API key)</p>
                            </div>
                            <input
                                type="password"
                                value={settings.lastfmApiSecret}
                                onChange={(e) => settings.setLastfmApiSecret(e.target.value)}
                                placeholder="Paste your Last.fm shared secret..."
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-3"
                            />
                        </div>

                        {settings.lastfmApiKey && !settings.lastfmSessionKey && (
                            <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
                                <h4 className="text-sm font-semibold text-red-400 mb-2">🔐 Last.fm Authentication Required</h4>
                                <p className="text-xs text-zinc-400 mb-3">
                                    To submit scrobbles to Last.fm, you need to authorize this app:
                                </p>
                                {!lastfmAuthUrl ? (
                                    <button
                                        onClick={handleLastFmStartAuth}
                                        disabled={lastfmAuthInProgress}
                                        className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        {lastfmAuthInProgress ? 'Getting auth URL...' : 'Start Last.fm Authorization'}
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="p-3 bg-yellow-900/20 border border-yellow-900/30 rounded-lg mb-3">
                                            <p className="text-xs text-yellow-200 font-semibold mb-2">⚠️ IMPORTANT STEPS:</p>
                                            <ol className="text-xs text-yellow-100 space-y-1 ml-4 list-decimal">
                                                <li>Click the button below to open Last.fm</li>
                                                <li>Click <strong>"Yes, allow access"</strong> on Last.fm's page</li>
                                                <li>Come back here and click <strong>"Complete Authorization"</strong></li>
                                            </ol>
                                        </div>
                                        <a
                                            href={lastfmAuthUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors text-center"
                                        >
                                            ↗ Open Last.fm Authorization Page
                                        </a>
                                        <button
                                            onClick={handleLastFmCompleteAuth}
                                            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            ✓ Complete Authorization (After allowing on Last.fm)
                                        </button>
                                        <button
                                            onClick={() => {
                                                setLastfmAuthToken('')
                                                setLastfmAuthUrl('')
                                            }}
                                            className="w-full px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {settings.lastfmSessionKey && (
                            <div className="p-3 bg-green-900/20 border border-green-900/30 rounded-lg">
                                <p className="text-xs text-green-400">✅ Last.fm authenticated and ready to scrobble</p>
                            </div>
                        )}

                        {settings.lastfmSessionKey && (
                            <div>
                                <label className="text-sm font-medium text-zinc-400">Last.fm Username</label>
                                <p className="text-xs text-zinc-600 mt-1">Your Last.fm username (for play count sync)</p>
                                <input
                                    type="text"
                                    value={settings.lastfmUsername}
                                    onChange={(e) => settings.setLastfmUsername(e.target.value)}
                                    placeholder="Enter your Last.fm username..."
                                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mt-2"
                                />
                            </div>
                        )}

                        <p className="text-xs text-zinc-500">
                            📊 <strong>Play Tracking:</strong> Each completed track play is recorded and automatically submitted to configured services.
                        </p>

                        {/* Play Count Sync Section */}
                        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-400 mb-2">📊 Play Count Sync & Export</h4>
                            <p className="text-xs text-zinc-400 mb-4">
                                Sync play counts from Last.fm and ListenBrainz, then save the highest value to your database. Optionally write to files (slower).
                            </p>

                            {progress?.isRunning && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-zinc-300">{progress.trackName}</span>
                                        <span className="text-xs text-zinc-400">{progress.current}/{progress.total}</span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-2.5 transition-all duration-300 ease-out"
                                            style={{ width: `${progress.percentage}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1 text-center">{progress.percentage}%</p>
                                </div>
                            )}

                            {/* Write to Files checkbox */}
                            <div className="mb-3 flex items-center gap-2 p-2 bg-yellow-900/10 border border-yellow-900/30 rounded">
                                <input
                                    type="checkbox"
                                    id="writeToFiles"
                                    checked={writeToFiles}
                                    onChange={(e) => setWriteToFiles(e.target.checked)}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="writeToFiles" className="text-xs text-zinc-300 cursor-pointer">
                                    <strong>Write to files</strong> (slow, requires metaflac for FLAC)
                                </label>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSyncPlayCounts}
                                        disabled={progress?.isRunning || lbSyncProgress.isRunning}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors text-sm font-semibold"
                                    >
                                        {progress?.isRunning ? 'Syncing...' : 'Sync All (Online)'}
                                    </button>
                                    <button
                                        onClick={handleExportCSV}
                                        disabled={exportingCSV}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        {exportingCSV ? 'Exporting...' : 'Export CSV'}
                                    </button>
                                </div>

                                <button
                                    onClick={handleLbFullSync}
                                    disabled={lbSyncProgress.isRunning || progress?.isRunning || !settings.listenbrainzUsername}
                                    className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    {lbSyncProgress.isRunning ? 'Syncing History...' : 'ListenBrainz Full History Sync'}
                                </button>
                            </div>

                            {lbSyncProgress.isRunning && (
                                <div className="mt-4 p-3 bg-violet-900/10 border border-violet-900/30 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-violet-400">
                                            {lbSyncProgress.phase === 'fetching'
                                                ? `Fetching: Page ${lbSyncProgress.page} (${lbSyncProgress.fetched?.toLocaleString()} listens)`
                                                : `Matching: ${lbSyncProgress.current?.toLocaleString()} / ${lbSyncProgress.total?.toLocaleString()} tracks`}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            {lbSyncProgress.phase === 'fetching' ? 'Downloading...' : 'Processing...'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-1.5 transition-all duration-300 ease-out",
                                                lbSyncProgress.phase === 'fetching' ? "bg-violet-500 animate-pulse" : "bg-emerald-500"
                                            )}
                                            style={{
                                                width: lbSyncProgress.phase === 'matching'
                                                    ? `${((lbSyncProgress.current || 0) / (lbSyncProgress.total || 1)) * 100}%`
                                                    : '100%'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {!settings.lastfmUsername && !settings.listenbrainzUsername && (
                                <p className="text-xs text-yellow-400 mt-2">
                                    ⚠️ Enter at least one username above to enable sync
                                </p>
                            )}

                            {!writeToFiles && (
                                <p className="text-xs text-zinc-500 mt-2">
                                    💡 <strong>ListenBrainz Full Sync</strong> is highly recommended for users with large history. It fetches your entire history in bulk and matches it locally.
                                </p>
                            )}
                        </div>
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
