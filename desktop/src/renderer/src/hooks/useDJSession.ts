import { useEffect } from 'react'
import { usePlayer } from '../store/player'
import { useDJ } from '../store/dj'

/**
 * useDJSession - A hook that handles the automatic transition 
 * between thematic blocks when AI DJ is active.
 */
export function useDJSession() {
    const { queue, currentIndex } = usePlayer()
    const { isActive, nextBlock, isTalking } = useDJ()

    useEffect(() => {
        if (!isActive || isTalking) return

        // If we are on the last track of the block (or queue is empty), trigger next block
        const remaining = queue.length - currentIndex - 1

        // Spotify DJ usually transitions when 0 or 1 tracks are left in the current block
        if (remaining <= 0 && queue.length > 0) {
            console.log('[AI DJ] Current block finished. Requesting next block...')
            nextBlock()
        }
    }, [isActive, queue.length, currentIndex, isTalking, nextBlock])
}
