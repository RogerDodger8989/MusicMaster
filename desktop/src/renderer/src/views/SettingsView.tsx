import { useEffect, useState, useRef } from 'react'
import {
  FolderOpen,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Download,
  Database,
  RefreshCw,
  Zap,
  Play,
  Keyboard,
  Wand2
} from 'lucide-react'
import { useFolders } from '../store/folders'
import { useLibrary } from '../store/library'
import { useSettings, TrackPlayBehavior, ReplayGainMode, AutoDjRatingFilter, AutoDjTriggerAt, AutoDjAddCount } from '../store/settings'
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
    scanFolder
  } = useFolders()
  const settings = useSettings()
  const { progress, startSync, updateProgress, completeSync } = useSyncStore()
  const [lastfmAuthToken, setLastfmAuthToken] = useState('')
  const [lastfmAuthUrl, setLastfmAuthUrl] = useState('')
  const [lastfmAuthInProgress, setLastfmAuthInProgress] = useState(false)
  const [writeToFiles, setWriteToFiles] = useState(false)
  const [isBrowserOpen, setIsBrowserOpen] = useState(false)
  const [isListenBrainzImporting, setIsListenBrainzImporting] = useState(false)
  const [listenBrainzImportResult, setListenBrainzImportResult] = useState<{
    filePath?: string
    totalListens?: number
    matchedTracks?: number
    updatedTracks?: number
    matchedByMbid?: number
    matchedByText?: number
  } | null>(null)

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

  // Enrichment coverage state
  const [enrichmentCoverage, setEnrichmentCoverage] = useState<{
    totalTracks: number
    enrichedTracks: number
    coveragePercentage: number
  } | null>(null)
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')

  const enrichmentPollRef = useRef<NodeJS.Timeout | null>(null)
  const syncPollRef = useRef<NodeJS.Timeout | null>(null)
  const enhancePollRef = useRef<NodeJS.Timeout | null>(null)
  const fileSyncPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadFolders()
    settings.loadSettings()
  }, [])

  // Poll enrichment status every 3 seconds
  useEffect(() => {
    const fetchEnrichmentStatus = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/enrichment/status')
        const data = await response.json()

        if (data.coverage) {
          setEnrichmentCoverage(data.coverage)
        }

        if (data.status?.status) {
          setEnrichmentStatus(data.status.status === 'in_progress' ? 'running' :
            data.status.status === 'completed' ? 'completed' :
              data.status.status === 'error' ? 'error' : 'idle')
        }
      } catch (error) {
        console.error('Failed to fetch enrichment status:', error)
      }
    }

    // Initial fetch
    fetchEnrichmentStatus()

    // Poll every 3 seconds
    enrichmentPollRef.current = setInterval(fetchEnrichmentStatus, 3000)

    return () => {
      if (enrichmentPollRef.current) {
        clearInterval(enrichmentPollRef.current)
      }
    }
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
        } catch (e) { }
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
        } catch (e) { }
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

  const handleImportListenBrainzJSON = async () => {
    if (!window.api?.scrobble?.importListenBrainzJSON) {
      alert('ListenBrainz JSON import is only available in the desktop app.')
      return
    }

    if (isListenBrainzImporting) return

    setIsListenBrainzImporting(true)
    setListenBrainzImportResult(null)

    try {
      const result = await window.api.scrobble.importListenBrainzJSON()
      if (result?.canceled) {
        setIsListenBrainzImporting(false)
        return
      }

      setListenBrainzImportResult({
        filePath: result.filePath,
        totalListens: result.totalListens,
        matchedTracks: result.matchedTracks,
        updatedTracks: result.updatedTracks,
        matchedByMbid: result.matchedByMbid,
        matchedByText: result.matchedByText
      })
      await useLibrary.getState().loadTracks()
    } catch (error) {
      console.error('ListenBrainz JSON import failed:', error)
      alert(`❌ Failed to import ListenBrainz JSON: ${error}`)
    } finally {
      setIsListenBrainzImporting(false)
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
        await addFolder(path, true)
        await loadFolders()
      }
    } catch (error) {
      console.error('handleAddFolder error:', error)
      alert(`Error adding folder: ${error}`)
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
                    onClick={() => scanFolder(folder.id)}
                    className={cn(
                      'p-2 rounded-lg hover:bg-zinc-800 transition-colors text-blue-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500'
                    )}
                    title="Scan folder now"
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
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-zinc-400">Show Waveforms in Player</label>
              <p className="text-[11px] text-zinc-600 mt-1">
                Displays a visual waveform of the current track behind the progress bar.
              </p>
            </div>
            <button
              onClick={() => settings.setShowWaveform(!settings.showWaveform)}
              className={cn(
                'px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                settings.showWaveform
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
              )}
            >
              {settings.showWaveform ? 'On' : 'Off'}
            </button>
          </div>
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

        {/* Auto-DJ */}
        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Wand2 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Auto-DJ</h3>
              <p className="text-[11px] text-zinc-500">Automatically fills the queue with similar music based on mood, BPM and genre.</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-400">Song Filter</label>
                <p className="text-[11px] text-zinc-600 mt-1">Which songs may Auto-DJ add to the queue?</p>
              </div>
              <div className="flex gap-2">
                {([
                  { value: 'rated' as AutoDjRatingFilter, label: 'Rated only' },
                  { value: 'unrated' as AutoDjRatingFilter, label: 'Unrated only' },
                  { value: 'both' as AutoDjRatingFilter, label: 'Both' }
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => settings.setAutoDjRatingFilter(opt.value)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                      settings.autoDjRatingFilter === opt.value
                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-400">Trigger when X songs left</label>
                <p className="text-[11px] text-zinc-600 mt-1">Auto-DJ fills up the queue when this many songs remain.</p>
              </div>
              <div className="flex gap-2">
                {([1, 3, 5] as AutoDjTriggerAt[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => settings.setAutoDjTriggerAt(n)}
                    className={cn(
                      'w-10 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                      settings.autoDjTriggerAt === n
                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-400">Songs to add per trigger</label>
                <p className="text-[11px] text-zinc-600 mt-1">How many similar songs to add each time Auto-DJ triggers.</p>
              </div>
              <div className="flex gap-2">
                {([1, 3, 5, 10, 20] as AutoDjAddCount[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => settings.setAutoDjAddCount(n)}
                    className={cn(
                      'w-10 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                      settings.autoDjAddCount === n
                        ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Keyboard className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'Space', desc: 'Play / Pause' },
              { key: '← / →', desc: 'Seek 5s Back / Forward' },
              { key: 'Backspace', desc: 'Go Back' },
              { key: 'Escape', desc: 'Close Modal / Cancel' },
              { key: 'Enter', desc: 'Confirm Dialog' },
              { key: 'Del', desc: 'Delete from Queue' },
              { key: 'Shift + Enter', desc: 'Edit Selected Tracks' }
            ].map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                <span className="text-xs text-zinc-400">{shortcut.desc}</span>
                <kbd className="px-2 py-1 bg-zinc-800 text-zinc-200 text-[10px] font-mono rounded border border-zinc-700 shadow-sm min-w-[2.5rem] text-center">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-4">
            Shortcuts are global but won't trigger if you are typing in a text field.
          </p>
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
                <button
                  onClick={handleImportListenBrainzJSON}
                  disabled={isListenBrainzImporting}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  {isListenBrainzImporting ? 'Importing JSON...' : 'Import ListenBrainz JSON'}
                </button>
                {listenBrainzImportResult && (
                  <div className="text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                    <div className="text-zinc-300 font-semibold mb-1">✅ Import complete</div>
                    <div>Listens: {listenBrainzImportResult.totalListens || 0}</div>
                    <div>Matched tracks: {listenBrainzImportResult.matchedTracks || 0}</div>
                    <div>Updated tracks: {listenBrainzImportResult.updatedTracks || 0}</div>
                    <div>
                      Matches: {listenBrainzImportResult.matchedByMbid || 0} MBID /{' '}
                      {listenBrainzImportResult.matchedByText || 0} text
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Phase 9: Automated Enrichment Status */}
        <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Automated Enrichment (Phase 9)
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Automatically enriches tracks with mood, energy, BPM, and key data from AcousticBrainz.
              Runs automatically after scans and on server startup if coverage is incomplete.
            </p>

            {enrichmentCoverage && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Total Tracks</div>
                  <div className="text-2xl font-bold text-white">{enrichmentCoverage.totalTracks}</div>
                </div>
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Enriched</div>
                  <div className="text-2xl font-bold text-green-400">{enrichmentCoverage.enrichedTracks}</div>
                </div>
                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Coverage</div>
                  <div className="text-2xl font-bold text-blue-400">{enrichmentCoverage.coveragePercentage}%</div>
                </div>
              </div>
            )}

            {enrichmentStatus === 'running' && (
              <div className="p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-yellow-400 font-semibold">Enrichment in progress...</p>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Fetching mood, energy, and BPM data from AcousticBrainz
                </p>
              </div>
            )}

            {enrichmentStatus === 'completed' && enrichmentCoverage?.coveragePercentage === 100 && (
              <div className="p-4 bg-green-900/10 border border-green-900/30 rounded-lg">
                <p className="text-sm text-green-400 font-semibold">✅ All tracks enriched!</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Your library has complete mood, energy, and BPM metadata
                </p>
              </div>
            )}

            <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>💡 How it works:</strong>
              </p>
              <ul className="text-xs text-blue-200 space-y-1 ml-4 list-disc mt-2">
                <li>Runs automatically after folder scans</li>
                <li>Auto-starts on server boot if coverage &lt; 100%</li>
                <li>Groups tracks by album to reduce API requests (100k+ → ~7k)</li>
                <li>Rate-limited: 1.1s delay between requests (API compliance)</li>
                <li>Fetches: BPM, key, energy, danceability, mood (acoustic/aggressive/electronic/happy/sad/relaxed/party)</li>
              </ul>
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
