import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'
import type { Track } from '../types'

/**
 * useRadio – starts a Radio session powered by AutoDJ.
 *
 * Picks the best "seed" track from a given list (highest rating,
 * then most played, then first track), plays it, and enables AutoDJ
 * so the queue fills automatically with similar songs.
 */
export function useRadio() {
    const { playTrack } = usePlayer()
    const { setAutoDjEnabled } = useSettings()

    const startRadio = (tracks: Track[]) => {
        if (!tracks.length) return

        // Pick seed: best rating → most played → first track
        const seed = [...tracks].sort((a, b) => {
            const ratingDiff = (b.rating || 0) - (a.rating || 0)
            if (ratingDiff !== 0) return ratingDiff
            return (b.playCount || 0) - (a.playCount || 0)
        })[0]

        playTrack(seed)
        setAutoDjEnabled(true)

        console.log(`[Radio] Started with seed: "${seed.title}" by ${seed.artist}`)
    }

    return { startRadio }
}
