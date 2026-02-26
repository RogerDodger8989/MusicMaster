import { useEffect } from 'react'
import { usePlayer } from '../store/player'
import { client } from '../api/client'

export function useMediaSession() {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        next,
        prev,
        seek,
        currentTime
    } = usePlayer()

    useEffect(() => {
        if (!('mediaSession' in navigator)) return

        if (currentTrack) {
            // Update metadata
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.title,
                artist: currentTrack.artist,
                album: currentTrack.album,
                artwork: [
                    {
                        src: client.getCoverUrl(currentTrack.albumId || currentTrack.id),
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            })

            // Update playback state
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

            // Set handlers
            navigator.mediaSession.setActionHandler('play', () => togglePlay())
            navigator.mediaSession.setActionHandler('pause', () => togglePlay())
            navigator.mediaSession.setActionHandler('previoustrack', () => prev())
            navigator.mediaSession.setActionHandler('nexttrack', () => next())

            try {
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    seek(Math.max(0, currentTime - (details.seekOffset || 10)))
                })
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    seek(currentTime + (details.seekOffset || 10))
                })
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime !== undefined) seek(details.seekTime)
                })
            } catch (e) {
                // Some browsers don't support these handlers
            }
        } else {
            navigator.mediaSession.metadata = null
            navigator.mediaSession.playbackState = 'none'
        }

        // Electron specific: Update Thumbar buttons
        if (window.api && window.api.player && window.api.player.updateThumbarButtons) {
            window.api.player.updateThumbarButtons(isPlaying).catch(console.error)
        }

    }, [currentTrack, isPlaying, togglePlay, next, prev, seek, currentTime])
}
