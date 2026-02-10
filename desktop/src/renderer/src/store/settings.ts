import { create } from 'zustand'
import { SortField, SortOrder, ViewMode } from '../types'
import { client } from '../api/client'

export type TrackPlayBehavior = 'ask' | 'play_next' | 'add_last' | 'replace'
export type ReplayGainMode = 'track' | 'album' | 'off'

interface SettingsStore {
  viewMode: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  visibleSections: string[]
  trackPlayBehavior: TrackPlayBehavior
  replayGainMode: ReplayGainMode
  gaplessEnabled: boolean
  lastfmApiKey: string
  lastfmApiSecret: string
  lastfmSessionKey: string
  lastfmUsername: string
  listenbrainzToken: string
  listenbrainzUsername: string
  lastfmEnabled: boolean
  listenbrainzEnabled: boolean
  showWaveform: boolean

  // Actions
  setViewMode: (mode: ViewMode) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  toggleSection: (section: string) => void
  setTrackPlayBehavior: (behavior: TrackPlayBehavior) => void
  setReplayGainMode: (mode: ReplayGainMode) => void
  setGaplessEnabled: (enabled: boolean) => void
  setLastfmApiKey: (key: string) => void
  setLastfmApiSecret: (secret: string) => void
  setLastfmSessionKey: (key: string) => void
  setLastfmUsername: (username: string) => void
  setListenbrainzToken: (token: string) => void
  setListenbrainzUsername: (username: string) => void
  setLastfmEnabled: (enabled: boolean) => void
  setListenbrainzEnabled: (enabled: boolean) => void
  setShowWaveform: (enabled: boolean) => void

  // Persistence
  loadSettings: () => Promise<void>
}

export const useSettings = create<SettingsStore>((set, get) => ({
  viewMode: 'grid',
  sortField: 'title',
  sortOrder: 'asc',
  visibleSections: ['recently_added', 'recently_played'],
  trackPlayBehavior: 'ask',
  replayGainMode: 'track',
  gaplessEnabled: true,
  lastfmApiKey: '',
  lastfmApiSecret: '',
  lastfmSessionKey: '',
  lastfmUsername: '',
  listenbrainzToken: '',
  listenbrainzUsername: '',
  lastfmEnabled: false,
  listenbrainzEnabled: false,
  showWaveform: false,

  setViewMode: (viewMode) => {
    set({ viewMode })
    client.saveSetting('viewMode', viewMode)
  },
  setSortField: (sortField) => {
    set({ sortField })
    client.saveSetting('sortField', sortField)
  },
  setSortOrder: (sortOrder) => {
    set({ sortOrder })
    client.saveSetting('sortOrder', sortOrder)
  },
  toggleSection: (section) => {
    const current = get().visibleSections
    let updated: string[] = []
    if (current.includes(section)) {
      updated = current.filter((s) => s !== section)
    } else {
      updated = [...current, section]
    }
    set({ visibleSections: updated })
    client.saveSetting('visibleSections', updated)
  },
  setTrackPlayBehavior: (behavior) => {
    set({ trackPlayBehavior: behavior })
    client.saveSetting('trackPlayBehavior', behavior)
  },
  setReplayGainMode: (mode) => {
    set({ replayGainMode: mode })
    client.saveSetting('replayGainMode', mode)
  },
  setGaplessEnabled: (enabled) => {
    set({ gaplessEnabled: enabled })
    client.saveSetting('gaplessEnabled', enabled)
  },
  setLastfmApiKey: (key) => {
    set({ lastfmApiKey: key })
    client.saveSetting('lastfmApiKey', key)
    // client.scrobble.updateLastFmKey(key) // Handled by saveSetting in backend?
  },
  setLastfmApiSecret: (secret) => {
    set({ lastfmApiSecret: secret })
    client.saveSetting('lastfmApiSecret', secret)
  },
  setLastfmSessionKey: (key: string) => {
    set({ lastfmSessionKey: key })
    client.saveSetting('lastfmSessionKey', key)
  },
  setLastfmUsername: (username: string) => {
    set({ lastfmUsername: username })
    client.saveSetting('lastfmUsername', username)
  },
  setListenbrainzToken: (token: string) => {
    set({ listenbrainzToken: token })
    client.saveSetting('listenbrainzToken', token)
  },
  setListenbrainzUsername: (username: string) => {
    set({ listenbrainzUsername: username })
    client.saveSetting('listenbrainzUsername', username)
  },
  setLastfmEnabled: (enabled) => {
    set({ lastfmEnabled: enabled })
    client.saveSetting('lastfmEnabled', enabled)
  },
  setListenbrainzEnabled: (enabled) => {
    set({ listenbrainzEnabled: enabled })
    client.saveSetting('listenbrainzEnabled', enabled)
  },
  setShowWaveform: (enabled) => {
    set({ showWaveform: enabled })
    client.saveSetting('showWaveform', enabled)
  },

  loadSettings: async () => {
    try {
      const settings = await client.getSettings()
      if (settings && Object.keys(settings).length > 0) {
        set(settings)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }
}))
