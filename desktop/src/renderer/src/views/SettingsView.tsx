import { useEffect, useState, useRef } from 'react'
import {
  FolderOpen,
  Trash2,
  Eye,
  EyeOff,
  Play,
  ExternalLink,
  Download,
  Database,
  RefreshCw
} from 'lucide-react'
import { useFolders } from '../store/folders'
import { useLibrary } from '../store/library'
import { useSettings, TrackPlayBehavior, ReplayGainMode } from '../store/settings'
import { useSyncStore } from '../store/sync'
import { cn } from '../lib/utils'
import MusicBrainzProgressModal from '../components/modals/MusicBrainzProgressModal'
import { client } from '../api/client'
import { FileBrowserModal } from '../components/FileBrowserModal'

export default function SettingsView() {
  const {
    folders,
    isLoading,
    loadFolders,
    addFolder,
    removeFolder,
    updateFolderWatch,
    browseFolder
  } = useFolders()
  const settings = useSettings()
  const { progress, startSync, updateProgress, completeSync } = useSyncStore()
  const [lastfmAuthToken, setLastfmAuthToken] = useState('')
  const [lastfmAuthUrl, setLastfmAuthUrl] = useState('')
  const [lastfmAuthInProgress, setLastfmAuthInProgress] = useState(false)
  const [writeToFiles, setWriteToFiles] = useState(false)
  const [isBrowserOpen, setIsBrowserOpen] = useState(false)

  // MusicBrainz Enhancement State
  const [mbCoverage, setMbCoverage] = useState<{
    totalTracks: number
    tracksWithMBID: number
    coveragePercentage: number
  } | null>(null)
  const [mbEnhanceProgress, setMbEnhanceProgress] = useState<{
    isOpen: boolean
    current: number
    total: number
    trackName?: string
    isComplete: boolean
    results?: any
    operation: 'enhance' | 'sync' | 'refresh'
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    isComplete: false,
    operation: 'enhance'
  })
  const [mbWriteToFiles, setMbWriteToFiles] = useState(true)

  // Polling Intervals
  const syncPollRef = useRef<NodeJS.Timeout | null>(null)
  const enhancePollRef = useRef<NodeJS.Timeout | null>(null)
  const fileSyncPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadFolders()
    settings.loadSettings()
  }, [])

  useEffect(() => {
    // Poll for Scrobble Sync Status if running
    if (progress?.isRunning) {
      syncPollRef.current = setInterval(async () => {
        try {
          const status = await client.getSyncStatus()
          if (status.isRunning) {
            updateProgress({
              isRunning: true,
              current: status.current,
              total: status.total,
              trackName: status.trackName,
              percentage: status.percentage,
              errors: status.errors
            })
          } else if (status.total > 0 && !status.isRunning) {
            // Finished
            updateProgress({
              isRunning: false,
              current: status.total,
              total: status.total,
              trackName: 'Complete',
              percentage: 100,
              errors: status.errors
            })
            clearInterval(syncPollRef.current!)
            completeSync()
          }
        } catch (e) {
          console.error('Sync Poll Error', e)
        }
      }, 1000)
    }

    return () => {
      if (syncPollRef.current) clearInterval(syncPollRef.current)
    }
  }, [progress?.isRunning])

  // Load MusicBrainz coverage stats
  useEffect(() => {
    loadMbCoverage()
  }, [])

  // Poll for Enhancement Progress
  useEffect(() => {
    if (
      mbEnhanceProgress.isOpen &&
      mbEnhanceProgress.operation === 'enhance' &&
      !mbEnhanceProgress.isComplete
    ) {
      enhancePollRef.current = setInterval(async () => {
        try {
          const status = await client.getEnhanceStatus()

          if (status.isRunning) {
            setMbEnhanceProgress((prev) => ({
              ...prev,
              current: status.current,
              total: status.total,
              trackName: status.trackName
            }))
          }
        } catch (e) {}
      }, 1000)
    }
    return () => {
      if (enhancePollRef.current) clearInterval(enhancePollRef.current)
    }
  }, [mbEnhanceProgress.isOpen, mbEnhanceProgress.operation, mbEnhanceProgress.isComplete])

  // Poll for File Sync Progress
  useEffect(() => {
    if (
      mbEnhanceProgress.isOpen &&
      mbEnhanceProgress.operation === 'sync' &&
      !mbEnhanceProgress.isComplete
    ) {
      fileSyncPollRef.current = setInterval(async () => {
        try {
          const status = await client.getFileSyncStatus()
          if (status.isRunning) {
            setMbEnhanceProgress((prev) => ({
              ...prev,
              current: status.current,
              total: status.total,
              trackName: status.trackPath
            }))
          }
        } catch (e) {}
      }, 1000)
    }
    return () => {
      if (fileSyncPollRef.current) clearInterval(fileSyncPollRef.current)
    }
  }, [mbEnhanceProgress.isOpen, mbEnhanceProgress.operation, mbEnhanceProgress.isComplete])

  const loadMbCoverage = async () => {
    try {
      const stats = await client.getCoverage()
      setMbCoverage(stats)
    } catch (error) {
      console.error('Failed to load MusicBrainz coverage:', error)
    }
  }

  const handleSyncPlayCounts = async () => {
    if (progress?.isRunning) {
      alert('Sync is already running!')
      return
    }

    startSync()

    try {
      await client.syncScrobble(
        settings.lastfmUsername || '',
        settings.listenbrainzUsername || '',
        writeToFiles
      )

      // Poll will update progress.
      const checkDone = setInterval(async () => {
        const status = await client.getSyncStatus()
        if (!status.isRunning) {
          clearInterval(checkDone)
          completeSync()
          if (status.errors && status.errors.length > 0) {
            alert(`✅ Synced with errors.\nDetails in console.`)
          } else {
            alert('✅ Successfully synced play counts!')
          }
          await useLibrary.getState().loadTracks()
        }
      }, 2000)
    } catch (error) {
      console.error('Failed to sync play counts:', error)
      completeSync()
      alert('❌ Failed to sync play counts: ' + error)
    }
  }

  const handleExportCSV = async () => {
    alert('CSV Export not supported in Server Mode yet.')
  }

  const handleLastFmStartAuth = async () => {
    setLastfmAuthInProgress(true)
    try {
      const result = await client.getLastFmAuthToken()
      if (result && result.token) {
        setLastfmAuthToken(result.token)
        setLastfmAuthUrl(result.authUrl)
        window.open(result.authUrl, '_blank')
      } else {
        alert('Failed to get auth token from Last.fm.')
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
      const result = await client.createLastFmSession(lastfmAuthToken)
      if (result && result.sessionKey) {
        settings.setLastfmSessionKey(result.sessionKey)
        console.log('✅ Last.fm session obtained')
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

  const handleEnhanceLibrary = async () => {
    if (mbEnhanceProgress.isOpen && !mbEnhanceProgress.isComplete) {
      alert('Enhancement is already running!')
      return
    }

    if (
      !confirm(
        'This will search MusicBrainz for all tracks without MBIDs and update your library. This may take several minutes.\n\nContinue?'
      )
    ) {
      return
    }

    setMbEnhanceProgress({
      isOpen: true,
      current: 0,
      total: 0,
      isComplete: false,
      operation: 'enhance'
    })

    try {
      await client.enhanceLibrary(mbWriteToFiles)

      // Poll for completion
      const checkDone = setInterval(async () => {
        const status = await client.getEnhanceStatus()
        if (!status.isRunning) {
          clearInterval(checkDone)
          setMbEnhanceProgress((prev) => ({
            ...prev,
            isComplete: true,
            results: {
              enhanced: status.enhanced,
              failed: status.failed,
              noMatch: status.noMatch
            }
          }))
          await loadMbCoverage()
          await useLibrary.getState().loadTracks()
        }
      }, 2000)
    } catch (error) {
      console.error('Failed to enhance library:', error)
      alert('❌ Failed to enhance library: ' + error)
      setMbEnhanceProgress((prev) => ({
        ...prev,
        isOpen: false
      }))
    }
  }

  const handleSyncToFiles = async () => {
    if (mbEnhanceProgress.isOpen && !mbEnhanceProgress.isComplete) {
      alert('Operation is already running!')
      return
    }

    if (!mbCoverage || mbCoverage.tracksWithMBID === 0) {
      alert('No tracks with MBIDs found. Please enhance your library first.')
      return
    }

    if (
      !confirm(
        `This will write MusicBrainz metadata to ${mbCoverage.tracksWithMBID} audio files. Continue?`
      )
    ) {
      return
    }

    setMbEnhanceProgress({
      isOpen: true,
      current: 0,
      total: 0,
      isComplete: false,
      operation: 'sync'
    })

    try {
      await client.syncMetadata()

      // Poll for completion
      const checkDone = setInterval(async () => {
        const status = await client.getFileSyncStatus()
        if (!status.isRunning) {
          clearInterval(checkDone)
          setMbEnhanceProgress((prev) => ({
            ...prev,
            isComplete: true,
            results: {
              success: status.success,
              failed: status.failed,
              skipped: status.skipped
            }
          }))
        }
      }, 2000)
    } catch (error) {
      console.error('Failed to sync to files:', error)
      alert('❌ Failed to sync to files: ' + error)
      setMbEnhanceProgress((prev) => ({
        ...prev,
        isOpen: false
      }))
    }
  }

  const handleAddFolder = () => {
    setIsBrowserOpen(true)
  }

  const handleFolderSelected = async (path: string) => {
    setIsBrowserOpen(false)
    try {
      if (path) {
        await addFolder(path, false)
        await loadFolders()

        // Let's find the new folder ID to trigger scan
        const updatedFolders = await client.getFolders()
        const newFolder = updatedFolders.find((f) => f.path === path)
        if (newFolder) {
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
      await client.startScan(folderId, folderPath)
      alert('Scan started')
    } catch (error) {
      console.error('Scan error:', error)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <FileBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelect={handleFolderSelected}
        title="Select Music Folder"
      />
      {/* MusicBrainz Progress Modal */}
      <MusicBrainzProgressModal
        isOpen={mbEnhanceProgress.isOpen}
        onClose={() => setMbEnhanceProgress((prev) => ({ ...prev, isOpen: false }))}
        progress={{
          current: mbEnhanceProgress.current,
          total: mbEnhanceProgress.total,
          trackName: mbEnhanceProgress.trackName
        }}
        results={mbEnhanceProgress.results}
        isComplete={mbEnhanceProgress.isComplete}
        operation={mbEnhanceProgress.operation}
      />

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
              <label className="text-sm font-medium text-zinc-400">
                On Double-Click / Play Single Track
              </label>
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
                      'px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                      settings.trackPlayBehavior === opt.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
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
                ReplayGain automatically adjusts volume for a consistent listening level across all
                tracks.
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
                      'px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                      settings.replayGainMode === opt.id
                        ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                <strong>Track Level:</strong> Normalize each track individually
                <br />
                <strong>Album Level:</strong> Normalize per album (preserves album dynamics)
                <br />
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
                  'px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                  settings.gaplessEnabled
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                )}
              >
                {settings.gaplessEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Scrobbling</h3>

          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-900/30 rounded-lg">
            <p className="text-xs text-blue-300 mb-2">
              <strong>📋 Before you start:</strong>
            </p>
            <ul className="text-xs text-blue-200 space-y-1 ml-4 list-disc">
              <li>
                <strong>ListenBrainz:</strong> Get your token from{' '}
                <a
                  href="https://listenbrainz.org/profile/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-100"
                >
                  listenbrainz.org/profile/
                </a>
              </li>
              <li>
                <strong>Last.fm:</strong> Create API key at{' '}
                <a
                  href="https://www.last.fm/api/account/create"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-100"
                >
                  last.fm/api/account/create
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-zinc-400">ListenBrainz Token</label>
                  <p className="text-xs text-zinc-600 mt-1">
                    Paste your ListenBrainz token and enable to scrobble
                  </p>
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
                <p className="text-xs text-zinc-600 mt-1">
                  Your ListenBrainz username (for play count sync)
                </p>
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
                  <p className="text-xs text-zinc-600 mt-1">
                    Paste your Last.fm API key and enable to scrobble
                  </p>
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
                <p className="text-xs text-zinc-600 mt-1">
                  Required for authentication (get it when you create your API key)
                </p>
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
                <h4 className="text-sm font-semibold text-red-400 mb-2">
                  🔐 Last.fm Authentication Required
                </h4>
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
                      <p className="text-xs text-yellow-200 font-semibold mb-2">
                        ⚠️ IMPORTANT STEPS:
                      </p>
                      <ol className="text-xs text-yellow-100 space-y-1 ml-4 list-decimal">
                        <li>Click the button below to open Last.fm</li>
                        <li>
                          Click <strong>"Yes, allow access"</strong> on Last.fm's page
                        </li>
                        <li>
                          Come back here and click <strong>"Complete Authorization"</strong>
                        </li>
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
                <p className="text-xs text-green-400">
                  ✅ Last.fm authenticated and ready to scrobble
                </p>
              </div>
            )}

            {settings.lastfmSessionKey && (
              <div>
                <label className="text-sm font-medium text-zinc-400">Last.fm Username</label>
                <p className="text-xs text-zinc-600 mt-1">
                  Your Last.fm username (for play count sync)
                </p>
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
              📊 <strong>Play Tracking:</strong> Each completed track play is recorded and
              automatically submitted to configured services.
            </p>

            {/* Play Count Sync Section */}
            <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">
                📊 Play Count Sync & Export
              </h4>
              <p className="text-xs text-zinc-400 mb-4">
                Sync play counts from Last.fm and ListenBrainz, then save the highest value to your
                database. Optionally write to files (slower).
              </p>

              {progress?.isRunning && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-300">{progress.trackName}</span>
                    <span className="text-xs text-zinc-400">
                      {progress.current}/{progress.total}
                    </span>
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
                  title="Write to files (slow, requires metaflac for FLAC)"
                />
                <label htmlFor="writeToFiles" className="text-xs text-zinc-300 cursor-pointer">
                  <strong>Write to files</strong> (slow, requires metaflac for FLAC)
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncPlayCounts}
                    disabled={progress?.isRunning}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors text-sm font-semibold"
                  >
                    {progress?.isRunning ? 'Syncing...' : 'Sync All (Online)'}
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MusicBrainz Enhancement Section */}
        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Metadata Enhancement</h3>
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Enhance your library with metadata from MusicBrainz and AcousticBrainz. This will find
              ISRC codes, release dates, and better tags.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="text-xs text-zinc-500 mb-1">Total Tracks</div>
                <div className="text-2xl font-bold text-white">{mbCoverage?.totalTracks || 0}</div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                <div className="text-xs text-zinc-500 mb-1">Matched with MusicBrainz</div>
                <div className="flex items-end gap-2">
                  <div className="text-2xl font-bold text-green-400">
                    {mbCoverage?.tracksWithMBID || 0}
                  </div>
                  <div className="text-xs text-zinc-500 mb-1">
                    ({mbCoverage?.coveragePercentage || 0}%)
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 p-2 bg-yellow-900/10 border border-yellow-900/30 rounded">
              <input
                type="checkbox"
                id="mbWriteToFiles"
                checked={mbWriteToFiles}
                onChange={(e) => setMbWriteToFiles(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
                title="Write metadata to files (during enhancement)"
              />
              <label htmlFor="mbWriteToFiles" className="text-xs text-zinc-300 cursor-pointer">
                <strong>Write metadata to files</strong> (during enhancement)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEnhanceLibrary}
                disabled={mbEnhanceProgress.isOpen}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                Enhance Library (Search & Match)
              </button>

              <button
                onClick={handleSyncToFiles}
                disabled={mbEnhanceProgress.isOpen}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
                title="Write matched metadata to files"
              >
                <RefreshCw className="w-4 h-4" />
                Sync DB to Files
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
