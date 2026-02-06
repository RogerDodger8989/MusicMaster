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

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
        if (readOnly) return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const width = rect.width

        // Check if hovering over first half or full star
        const isHalf = x < width / 2
        setHoverRating(index + (isHalf ? 0.5 : 1))
    }

    const handleClick = () => {
        if (readOnly || !onChange || hoverRating === null) return
        onChange(hoverRating)
    }

    return (
        <div
            className={cn('flex items-center gap-0.5', readOnly ? 'cursor-default' : 'cursor-pointer', className)}
            onMouseLeave={() => setHoverRating(null)}
        >
            {Array.from({ length: maxRating }).map((_, i) => {
                const starValue = i + 1
                const isFull = currentRating >= starValue
                const isHalf = currentRating >= starValue - 0.5 && !isFull

                return (
                    <div
                        key={i}
                        className="relative"
                        onMouseMove={(e) => handleMouseMove(e, i)}
                        onClick={handleClick}
                        style={{ width: size, height: size }}
                    >
                        {/* Empty Star (Background) */}
                        <Star
                            size={size}
                            className="text-muted-foreground/30 absolute inset-0"
                            strokeWidth={1.5}
                        />

                        {/* Filled/Half Star (Foreground) */}
                        {(isFull || isHalf) && (
                            <div className={cn("absolute inset-0 overflow-hidden", isHalf ? "w-[50%]" : "w-full")}>
                                <Star
                                    size={size}
                                    className="fill-yellow-500 text-yellow-500"
                                    strokeWidth={1.5}
                                />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
