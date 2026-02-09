/**
 * Vibes Controller - API endpoints for mood-based playlists
 */

import { Router, Request, Response } from 'express'
import { getAllVibes, getVibeDefinition, getVibePlaylist } from '../../services/vibesService'

const router = Router()

/**
 * GET /api/vibes
 * Get all available vibes
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const vibes = getAllVibes()
    res.json({
      success: true,
      data: vibes
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    })
  }
})

/**
 * GET /api/vibes/:vibeId
 * Get playlist for a specific vibe
 */
router.get('/:vibeId', (req: Request, res: Response) => {
  try {
    const vibeId = Array.isArray(req.params.vibeId) ? req.params.vibeId[0] : req.params.vibeId
    const limit = parseInt(req.query.limit as string) || 50

    const vibe = getVibeDefinition(vibeId)
    if (!vibe) {
      return res.status(404).json({
        success: false,
        error: `Vibe "${vibeId}" not found`
      })
    }

    const tracks = getVibePlaylist(vibeId, limit)

    res.json({
      success: true,
      vibe: vibe,
      tracks: tracks,
      count: tracks.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    })
  }
})

export default router
