/**
 * Scrobble Service - Handles automatic submission of plays to Server
 */

import { client } from '../api/client'

export class ScrobbleService {
  private isRunning = false

  /**
   * Start the scrobble service
   */
  start() {
    if (this.isRunning) return
    this.isRunning = true
    console.log('🎵 Scrobble Service started')
  }

  /**
   * Stop the scrobble service
   */
  stop() {
    this.isRunning = false
    console.log('🎵 Scrobble Service stopped')
  }

  /**
   * Submit a scrobble
   */
  async scrobble(
    artist: string,
    track: string,
    album?: string,
    duration?: number,
    timestamp?: number
  ) {
    if (!this.isRunning) return

    try {
      console.log(`📤 Scrobbling: ${artist} - ${track}`)
      await client.scrobble(artist, track, album, duration, timestamp)
      console.log(`✅ Scrobble submitted`)
    } catch (error) {
      console.error('Failed to scrobble:', error)
    }
  }

  /**
   * Update Now Playing
   */
  async updateNowPlaying(artist: string, track: string, album?: string, duration?: number) {
    if (!this.isRunning) return

    try {
      await client.updateNowPlaying(artist, track, album, duration)
    } catch (error) {
      console.error('Failed to update now playing:', error)
    }
  }

  /**
   * Get service status
   */
  isActive(): boolean {
    return this.isRunning
  }
}

export const scrobbleService = new ScrobbleService()
