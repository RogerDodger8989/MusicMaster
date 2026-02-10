import { Request, Response } from 'express'
import { backgroundEnricher } from '../../services/enricher'
import { getDatabase } from '../../database'

/**
 * Enrich multiple artists immediately (triggered by frontend)
 * POST /api/enrich/artists
 * Body: { artistIds: string[] }
 */
export const enrichArtists = async (req: Request, res: Response) => {
    try {
        const { artistIds } = req.body

        if (!Array.isArray(artistIds) || artistIds.length === 0) {
            return res.status(400).json({ error: 'artistIds must be a non-empty array' })
        }

        // Limit to 50 artists per request to prevent abuse
        const idsToProcess = artistIds.slice(0, 50)

        console.log(`[Enrich API] Received request to enrich ${idsToProcess.length} artists`)

        // Get artist names from database
        const db = getDatabase()
        const placeholders = idsToProcess.map(() => '?').join(',')
        const artists = db.prepare(`
      SELECT id, name 
      FROM artists 
      WHERE id IN (${placeholders})
    `).all(...idsToProcess) as { id: string; name: string }[]

        // Start enrichment for each artist (fire and forget, but track promises)
        const enrichmentPromises = artists.map(artist =>
            backgroundEnricher.enrichArtistById(artist.id, artist.name)
                .then(() => ({ id: artist.id, status: 'success' }))
                .catch((error: Error) => ({ id: artist.id, status: 'error' as const, error: error.message }))
        )

        // Don't wait for completion, return immediately
        res.json({
            message: `Enrichment started for ${artists.length} artists`,
            artistCount: artists.length
        })

        // Process enrichments in background
        Promise.all(enrichmentPromises).then(results => {
            const successful = results.filter(r => r.status === 'success').length
            const failed = results.filter(r => r.status === 'error').length
            console.log(`[Enrich API] Completed: ${successful} successful, ${failed} failed`)
        })

    } catch (error) {
        console.error('[Enrich API] Error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}
