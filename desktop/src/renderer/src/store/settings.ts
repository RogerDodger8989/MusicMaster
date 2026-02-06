import { create } from 'zustand'
import { SortField, SortOrder, ViewMode } from '../types'

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
    lastfmSessionKey: string
    listenbrainzToken: string
    lastfmEnabled: boolean
    listenbrainzEnabled: boolean

    // Actions
    setViewMode: (mode: ViewMode) => void
    setSortField: (field: SortField) => void
    setSortOrder: (order: SortOrder) => void
    toggleSection: (section: string) => void
    setTrackPlayBehavior: (behavior: TrackPlayBehavior) => void
    setReplayGainMode: (mode: ReplayGainMode) => void
    setGaplessEnabled: (enabled: boolean) => void
    setLastfmApiKey: (key: string) => void
    setLastfmSessionKey: (key: string) => void
    setListenbrainzToken: (token: string) => void
    setLastfmEnabled: (enabled: boolean) => void
    setListenbrainzEnabled: (enabled: boolean) => void

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
    lastfmSessionKey: '',
    listenbrainzToken: '',
    lastfmEnabled: false,
    listenbrainzEnabled: false,

    setViewMode: (viewMode) => {
        set({ viewMode })
        window.api.settings.save('viewMode', viewMode)
    },
    setSortField: (sortField) => {
        set({ sortField })
        window.api.settings.save('sortField', sortField)
    },
    setSortOrder: (sortOrder) => {
        set({ sortOrder })
        window.api.settings.save('sortOrder', sortOrder)
    },
    toggleSection: (section) => {
        const current = get().visibleSections
        let updated: string[] = []
        if (current.includes(section)) {
            updated = current.filter(s => s !== section)
        } else {
            updated = [...current, section]
        }
        set({ visibleSections: updated })
        window.api.settings.save('visibleSections', updated)
    },
    setTrackPlayBehavior: (behavior) => {
        set({ trackPlayBehavior: behavior })
        window.api.settings.save('trackPlayBehavior', behavior)
    },
    setReplayGainMode: (mode) => {
        set({ replayGainMode: mode })
        window.api.settings.save('replayGainMode', mode)
    },
    setGaplessEnabled: (enabled) => {
        set({ gaplessEnabled: enabled })
        window.api.settings.save('gaplessEnabled', enabled)
    },
    setLastfmApiKey: (key) => {
        set({ lastfmApiKey: key })
        window.api.settings.save('lastfmApiKey', key)
        window.api.scrobble.updateLastFmKey(key).catch(err => {
            console.error('Failed to update Last.fm key in service:', err)
        })
    },
    setLastfmSessionKey: (key: string) => {
        set({ lastfmSessionKey: key })
        window.api.settings.save('lastfmSessionKey', key)
    },
    setListenbrainzToken: (token: string) => {
        set({ listenbrainzToken: token })
        window.api.settings.save('listenbrainzToken', token)
        window.api.scrobble.updateListenBrainzToken(token).catch(err => {
            console.error('Failed to update ListenBrainz token in service:', err)
        })
    },
    setLastfmEnabled: (enabled) => {
        set({ lastfmEnabled: enabled })
        window.api.settings.save('lastfmEnabled', enabled)
    },
    setListenbrainzEnabled: (enabled) => {
        set({ listenbrainzEnabled: enabled })
        window.api.settings.save('listenbrainzEnabled', enabled)
    },

    loadSettings: async () => {
        try {
            const settings = await window.api.settings.getAll()
            if (settings && Object.keys(settings).length > 0) {
                set(settings)
            }
        } catch (error) {
            console.error('Failed to load settings:', error)
        }
    }
}))
