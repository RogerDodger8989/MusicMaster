import { create } from 'zustand'

export interface ViewState {
    view: string
    params?: any
}

interface NavigationStore {
    current: ViewState
    history: ViewState[]
    future: ViewState[]

    // Actions
    navigateTo: (view: string, params?: any) => void
    goBack: () => void
    goForward: () => void
    canGoBack: () => boolean
    canGoForward: () => boolean
}

export const useNavigation = create<NavigationStore>((set, get) => ({
    current: { view: 'home' },
    history: [],
    future: [],

    navigateTo: (view, params) => {
        const { current, history } = get()

        // Don't navigate to the same exact state
        if (current.view === view && JSON.stringify(current.params) === JSON.stringify(params)) {
            return
        }

        set({
            history: [...history, current],
            current: { view, params },
            future: [] // Clear future when navigating to a new page
        })
    },

    goBack: () => {
        const { history, current, future } = get()
        if (history.length === 0) return

        const previous = history[history.length - 1]
        const newHistory = history.slice(0, -1)

        set({
            history: newHistory,
            current: previous,
            future: [current, ...future]
        })
    },

    goForward: () => {
        const { history, current, future } = get()
        if (future.length === 0) return

        const next = future[0]
        const newFuture = future.slice(1)

        set({
            history: [...history, current],
            current: next,
            future: newFuture
        })
    },

    canGoBack: () => get().history.length > 0,
    canGoForward: () => get().future.length > 0
}))
