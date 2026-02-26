import { useEffect } from 'react'
import { usePlayer } from '../store/player'
import { useDJ } from '../store/dj'

/**
 * useDJSession - A hook that handles the automatic transition 
 * between thematic blocks when AI DJ is active.
 */
export function useDJSession() {
    const { queue, currentIndex, isPlaying, currentTime } = usePlayer()
    const { isActive, nextBlock, isTalking } = useDJ()

    useEffect(() => {
        if (!isActive || isTalking) return

        const remaining = queue.length - currentIndex - 1

        // Trigger next block if we are at the end (remaining 0) 
        // AND the player has naturally stopped (isPlaying false, currentTime 0)
        // OR if the queue is simply empty.
        const isAtEnd = remaining <= 0
        const isIdle = !isPlaying && (currentTime === 0 || queue.length === 0)

        if (isAtEnd && isIdle) {
            console.log('[AI DJ] Triggering next block transition...')
            nextBlock()
        }
    }, [isActive, queue.length, currentIndex, isTalking, isPlaying, currentTime, nextBlock])
}
