import { Star } from 'lucide-react'
import { cn } from '../utils'
import { useState } from 'react'

interface RatingStarsProps {
  rating: number // 0-5
  maxRating?: number
  size?: number
  readOnly?: boolean
  onChange?: (rating: number) => void
  className?: string
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 16,
  readOnly = false,
  onChange,
  className
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  const currentRating = hoverRating !== null ? hoverRating : rating

  const handleMouseMove = (_e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (readOnly) return

    // Strict integer rating - no halves
    setHoverRating(index + 1)
  }

  const handleClick = () => {
    if (readOnly || !onChange || hoverRating === null) return
    onChange(hoverRating)
  }

  const handleZeroClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (readOnly || !onChange) return
    onChange(0)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 relative',
        readOnly ? 'cursor-default' : 'cursor-pointer',
        className
      )}
      onMouseLeave={() => setHoverRating(null)}
    >
      {/* Invisible Hit Area for 0 Stars (Left of first star) */}
      {!readOnly && (
        <div
          className="absolute -left-3 top-0 bottom-0 w-3 z-10"
          onClick={handleZeroClick}
          onMouseEnter={() => setHoverRating(0)}
          title="Clear Rating"
        />
      )}

      {Array.from({ length: maxRating }).map((_, i) => {
        const starValue = i + 1
        const isFull = currentRating >= starValue
        const isHalf = currentRating >= starValue - 0.5 && !isFull

        return (
          <div
            key={i}
            className="relative transition-transform duration-150 hover:scale-125"
            onMouseMove={(e) => handleMouseMove(e, i)}
            onClick={handleClick}
            style={{ width: size, height: size }}
          >
            {/* Empty Star (Background) */}
            <Star
              size={size}
              className="text-muted-foreground/30 absolute inset-0 transition-colors"
              strokeWidth={1.5}
            />

            {/* Filled/Half Star (Foreground) */}
            {(isFull || isHalf) && (
              <div
                className={cn('absolute inset-0 overflow-hidden transition-all duration-300', isHalf ? 'w-[50%]' : 'w-full')}
              >
                <Star size={size} className="fill-yellow-500 text-yellow-500 transition-colors" strokeWidth={1.5} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
