import { create } from 'zustand'
import { usePlayer } from './player'
import { useLibrary } from './library'
import { client } from '../api/client'
import { djVoice } from '../services/djVoice'
import type { Track } from '../types'

export type DJTheme = 'favorites' | 'vibes' | 'discovery' | 'recently-added' | 'artist-focus'

interface DJStore {
    isActive: boolean
    currentTheme: DJTheme | null
    isTalking: boolean
    startDJ: () => Promise<void>
    stopDJ: () => void
    nextBlock: () => Promise<void>
}

export const useDJ = create<DJStore>((set, get) => ({
    isActive: false,
    currentTheme: null,
    isTalking: false,

    startDJ: async () => {
        set({ isActive: true })
        await get().nextBlock()
    },

    stopDJ: () => {
        set({ isActive: false, currentTheme: null })
        window.speechSynthesis?.cancel()
    },

    nextBlock: async () => {
        if (!get().isActive) return

        const themes: DJTheme[] = ['favorites', 'vibes', 'recently-added', 'discovery', 'artist-focus']
        const theme = themes[Math.floor(Math.random() * themes.length)]

        const player = usePlayer.getState()
        const library = useLibrary.getState()

        let blockTracks: Track[] = []
        let extraData: any = {}

        try {
            switch (theme) {
                case 'favorites':
                    const favorites = await client.getMostPlayedTracks('forever', 10)
                    // Hydrate from library to ensure we have all fields (duration, rating, loved)
                    blockTracks = favorites
                        .map(t => library.tracks.find(lt => lt.id === t.id) || t)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 5)
                    break
                case 'vibes':
                    const response = await fetch('http://localhost:3000/api/vibes')
                    const data = await response.json()
                    if (data.success && data.data.length > 0) {
                        const vibe = data.data[Math.floor(Math.random() * data.data.length)]
                        const vibeTracks = await client.getVibePlaylist(vibe.id, 10)
                        const normalize = (value?: string | null) => (value || '').toString().toLowerCase().trim()
                        const keyWithAlbum = (track: any) =>
                            `${normalize(track.title)}|${normalize(track.artist)}|${normalize(track.album)}`
                        const keyNoAlbum = (track: any) => `${normalize(track.title)}|${normalize(track.artist)}`

                        const localByKey = new Map<string, Track>()
                        const localByKeyNoAlbum = new Map<string, Track>()

                        for (const track of library.tracks) {
                            localByKey.set(keyWithAlbum(track), track)
                            localByKeyNoAlbum.set(keyNoAlbum(track), track)
                        }

                        blockTracks = vibeTracks
                            .map(t => localByKey.get(keyWithAlbum(t)) || localByKeyNoAlbum.get(keyNoAlbum(t)))
                            .filter(Boolean) as Track[]
                        blockTracks = blockTracks.sort(() => Math.random() - 0.5).slice(0, 5)
                        extraData.vibeName = vibe.name
                    }
                    break
                case 'recently-added':
                    // Better recently added: Sort by createdAt of the TRACK itself or Album
                    // We take the library tracks, sort by createdAt desc
                    blockTracks = [...library.tracks]
                        .sort((a, b) => {
                            const dateA = new Date(a.createdAt || 0).getTime()
                            const dateB = new Date(b.createdAt || 0).getTime()
                            return dateB - dateA
                        })
                        .slice(0, 50) // Take top 50 recently added
                        .sort(() => Math.random() - 0.5) // Shuffle them
                        .slice(0, 5) // Take 5
                    break
                case 'discovery':
                    blockTracks = [...library.tracks]
                        .filter(t => (t.playCount || 0) < 2)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 5)
                    break
                case 'artist-focus':
                    // Pick a random artist from the library that has at least 3 tracks
                    const artists = Array.from(new Set(library.tracks.map(t => t.artist))).filter(Boolean)
                    const randomArtist = artists[Math.floor(Math.random() * artists.length)]
                    blockTracks = library.tracks
                        .filter(t => t.artist === randomArtist)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 5)
                    extraData.artistName = randomArtist
                    break
            }

            if (blockTracks.length === 0) {
                // Fallback to random
                blockTracks = [...library.tracks].sort(() => Math.random() - 0.5).slice(0, 5)
            }

            // Tell the user what's coming
            set({ isTalking: true, currentTheme: theme })
            const intro = djVoice.generateIntro(theme, extraData)
            await djVoice.speak(intro)
            set({ isTalking: false })

            // Play the block
            player.playAlbum(blockTracks, 0)

            console.log(`[AI DJ] Starting block: ${theme} (${blockTracks.length} tracks)`)
        } catch (error) {
            console.error('[AI DJ] Error generating next block:', error)
            set({ isActive: false })
        }
    }
}))
