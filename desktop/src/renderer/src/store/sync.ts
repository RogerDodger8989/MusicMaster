import { create } from 'zustand'

export interface SyncProgress {
    isRunning: boolean
    current: number
    total: number
    trackName: string
    percentage: number
    errors: string[]
}

interface SyncStore {
    progress: SyncProgress | null
    startSync: () => void
    updateProgress: (progress: SyncProgress) => void
    completeSync: () => void
    cancelSync: () => void
}

export const useSyncStore = create<SyncStore>((set) => ({
    progress: null,
    
    startSync: () => set({ 
        progress: { 
            isRunning: true, 
            current: 0, 
            total: 0, 
            trackName: 'Starting...', 
            percentage: 0,
            errors: []
        } 
    }),
    
    updateProgress: (progress) => set({ progress: { ...progress, isRunning: true } }),
    
    completeSync: () => set({ progress: null }),
    
    cancelSync: () => set({ progress: null })
}))
