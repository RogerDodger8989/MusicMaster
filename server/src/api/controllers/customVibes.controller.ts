/**
 * Custom Vibes Controller
 * CRUD endpoints for user-created vibes
 */

import express from 'express'
import { 
  getCustomVibes, 
  getCustomVibeById, 
  createCustomVibe, 
  updateCustomVibe,
  deleteCustomVibe,
  CreateCustomVibeInput
} from '../../services/vibesService'

const router = express.Router()

/**
 * GET /api/vibes/custom
 * Get all custom vibes
 */
router.get('/', (req, res) => {
  try {
    const customVibes = getCustomVibes()
    res.json(customVibes)
  } catch (error) {
    console.error('Error fetching custom vibes:', error)
    res.status(500).json({ error: 'Failed to fetch custom vibes' })
  }
})

/**
 * GET /api/vibes/custom/:id
 * Get specific custom vibe by ID
 */
router.get('/:id', (req, res) => {
  try {
    const vibeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const vibe = getCustomVibeById(vibeId)
    
    if (!vibe) {
      return res.status(404).json({ error: 'Custom vibe not found' })
    }
    
    res.json(vibe)
  } catch (error) {
    console.error('Error fetching custom vibe:', error)
    res.status(500).json({ error: 'Failed to fetch custom vibe' })
  }
})

/**
 * POST /api/vibes/custom
 * Create a new custom vibe
 */
router.post('/', (req, res) => {
  try {
    const input: CreateCustomVibeInput = req.body
    
    // Validate required fields
    if (!input.id || !input.name || !input.emoji) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, name, emoji' 
      })
    }
    
    // Validate that at least one filter is provided
    const hasFilters = 
      input.energy_min !== undefined || 
      input.energy_max !== undefined ||
      input.danceability_min !== undefined ||
      input.danceability_max !== undefined ||
      (input.mood_filters && input.mood_filters.length > 0)
    
    if (!hasFilters) {
      return res.status(400).json({ 
        error: 'At least one filter must be provided (energy, danceability, or moods)' 
      })
    }
    
    const success = createCustomVibe(input)
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to create custom vibe' })
    }
    
    res.status(201).json({ 
      success: true,
      id: input.id,
      message: 'Custom vibe created successfully' 
    })
  } catch (error) {
    console.error('Error creating custom vibe:', error)
    res.status(500).json({ error: 'Failed to create custom vibe' })
  }
})

/**
 * PUT /api/vibes/custom/:id
 * Update an existing custom vibe
 */
router.put('/:id', (req, res) => {
  try {
    const vibeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const input = req.body
    
    // Check if vibe exists
    const existingVibe = getCustomVibeById(vibeId)
    if (!existingVibe) {
      return res.status(404).json({ error: 'Custom vibe not found' })
    }
    
    const success = updateCustomVibe(vibeId, input)
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to update custom vibe' })
    }
    
    res.json({ 
      success: true,
      message: 'Custom vibe updated successfully' 
    })
  } catch (error) {
    console.error('Error updating custom vibe:', error)
    res.status(500).json({ error: 'Failed to update custom vibe' })
  }
})

/**
 * DELETE /api/vibes/custom/:id
 * Delete a custom vibe
 */
router.delete('/:id', (req, res) => {
  try {
    const vibeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    
    // Check if vibe exists
    const existingVibe = getCustomVibeById(vibeId)
    if (!existingVibe) {
      return res.status(404).json({ error: 'Custom vibe not found' })
    }
    
    const success = deleteCustomVibe(vibeId)
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete custom vibe' })
    }
    
    res.json({ 
      success: true,
      message: 'Custom vibe deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting custom vibe:', error)
    res.status(500).json({ error: 'Failed to delete custom vibe' })
  }
})

export default router
