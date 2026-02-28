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
  jumpTo: (index: number, isForward?: boolean) => void
}

export const useNavigation = create<NavigationStore>((set, get) => ({
  current: { view: 'home' },
  history: [],
  future: [],

  navigateTo: (view, params) => {
    const { current, history } = get()

    console.log('[Navigation] navigateTo called:', view, params)
    console.log('[Navigation] Current:', current.view, 'History length:', history.length)

    // Don't navigate to the same exact state
    if (current.view === view && JSON.stringify(current.params) === JSON.stringify(params)) {
      console.log('[Navigation] Same view/params - not navigating')
      return
    }

    console.log('[Navigation] Adding to history:', current.view)
    
    set({
      history: [...history, current],
      current: { view, params },
      future: [] // Clear future when navigating to a new page
    })
  },

  goBack: () => {
    const { history, current, future } = get()
    console.log('[Navigation] goBack called. History length:', history.length)
    if (history.length === 0) {
      console.log('[Navigation] Cannot go back - no history')
      return
    }

    const previous = history[history.length - 1]
    const newHistory = history.slice(0, -1)

    console.log('[Navigation] Going back from', current.view, 'to', previous.view)
    
    set({
      history: newHistory,
      current: previous,
      future: [current, ...future]
    })
  },

  goForward: () => {
    const { history, current, future } = get()
    console.log('[Navigation] goForward called. Future length:', future.length)
    if (future.length === 0) {
      console.log('[Navigation] Cannot go forward - no future')
      return
    }

    const next = future[0]
    const newFuture = future.slice(1)

    console.log('[Navigation] Going forward from', current.view, 'to', next.view)

    set({
      history: [...history, current],
      current: next,
      future: newFuture
    })
  },

  canGoBack: () => get().history.length > 0,
  canGoForward: () => get().future.length > 0,

  jumpTo: (index, isForward = false) => {
    const { history, current, future } = get()

    if (isForward) {
      if (index < 0 || index >= future.length) return
      const target = future[index]
      const newHistory = [...history, current, ...future.slice(0, index)]
      const newFuture = future.slice(index + 1)
      set({ history: newHistory, current: target, future: newFuture })
    } else {
      if (index < 0 || index >= history.length) return
      const target = history[index]
      const newHistory = history.slice(0, index)
      const newFuture = [...history.slice(index + 1), current, ...future]
      set({ history: newHistory, current: target, future: newFuture })
    }
  }
}))
