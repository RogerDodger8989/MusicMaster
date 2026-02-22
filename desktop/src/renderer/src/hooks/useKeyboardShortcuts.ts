import { useEffect } from 'react'

interface KeyboardShortcutsConfig {
  onSpacePress?: () => void // Play/Pause
  onBackspacePress?: () => void // Go Back
  onEscapePress?: () => void // Cancel/Close
  onEnterPress?: () => void // Confirm
  onDeletePress?: () => void // Delete
  onShiftEnterPress?: () => void // Edit selected
  onArrowLeftPress?: () => void // Seek back
  onArrowRightPress?: () => void // Seek forward
  enabled?: boolean
}

/**
 * Global keyboard shortcuts hook for MusicMaster
 *
 * Shortcuts:
 * - Space: Play/Pause
 * - Backspace: Navigate Back
 * - Escape: Cancel/Close
 * - Enter: Confirm dialog
 * - Delete: Delete from queue (if track selected)
 * - Shift+Enter: Edit selected tracks
 */
export function useKeyboardShortcuts({
  onSpacePress,
  onBackspacePress,
  onEscapePress,
  onEnterPress,
  onDeletePress,
  onShiftEnterPress,
  onArrowLeftPress,
  onArrowRightPress,
  enabled = true
}: KeyboardShortcutsConfig) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Allow Delete even in inputs (for special handling)
      if (isInput && e.key !== 'Delete' && e.key !== 'Escape') {
        return
      }

      switch (e.key) {
        case ' ':
          if (isInput) return // Don't intercept space in inputs
          e.preventDefault()
          onSpacePress?.()
          break
        case 'Backspace':
          if (isInput) return // Allow normal backspace in inputs
          e.preventDefault()
          onBackspacePress?.()
          break
        case 'Escape':
          e.preventDefault()
          onEscapePress?.()
          break
        case 'Enter':
          if (e.shiftKey) {
            e.preventDefault()
            onShiftEnterPress?.()
          } else if (!isInput) {
            e.preventDefault()
            onEnterPress?.()
          }
          break
          if (!isInput) {
            e.preventDefault()
            onDeletePress?.()
          }
          break
        case 'ArrowLeft':
          if (isInput) return
          e.preventDefault()
          onArrowLeftPress?.()
          break
        case 'ArrowRight':
          if (isInput) return
          e.preventDefault()
          onArrowRightPress?.()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    enabled,
    onSpacePress,
    onBackspacePress,
    onEscapePress,
    onEnterPress,
    onDeletePress,
    onShiftEnterPress,
    onArrowLeftPress,
    onArrowRightPress
  ])
}
