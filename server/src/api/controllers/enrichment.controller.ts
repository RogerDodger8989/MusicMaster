import { Request, Response } from 'express'
import {
  startEnrichmentWorker,
  getEnrichmentStatus,
  getEnrichmentHistory,
  getEnrichmentCoverage,
  EnrichmentProgress
} from '../../services/enrichmentWorker'

/**
 * Start background enrichment worker
 * POST /enrichment/start
 */
export async function startEnrichment(req: Request, res: Response): Promise<void> {
  try {
    // Don't await - start in background
    startEnrichmentWorker((progress: EnrichmentProgress) => {
      // Could emit WebSocket update here
      console.log('Enrichment progress:', progress)
    }).catch((err: Error) => {
      console.error('Background enrichment error:', err)
    })
    
    res.json({
      success: true,
      message: 'Enrichment worker started in background'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    })
  }
}

/**
 * Get current enrichment status
 * GET /enrichment/status
 */
export function getStatus(req: Request, res: Response): void {
  try {
    const status = getEnrichmentStatus()
    const coverage = getEnrichmentCoverage()
    
    res.json({
      status,
      coverage
    })
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message
    })
  }
}

/**
 * Get enrichment history
 * GET /enrichment/history?limit=50
 */
export function getHistory(req: Request, res: Response): void {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const history = getEnrichmentHistory(limit)
    
    res.json({
      entries: history,
      count: history.length
    })
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message
    })
  }
}

/**
 * Get enrichment coverage stats
 * GET /enrichment/coverage
 */
export function getCoverage(req: Request, res: Response): void {
  try {
    const coverage = getEnrichmentCoverage()
    res.json(coverage)
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message
    })
  }
}
