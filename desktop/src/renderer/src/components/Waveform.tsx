import { useEffect, useState, useRef } from 'react'
import { client } from '../api/client'

interface WaveformProps {
    trackId: string
    currentTime: number
    duration: number
    energy?: number
}

export function Waveform({ trackId, currentTime, duration, energy }: WaveformProps) {
    const [imageSrc, setImageSrc] = useState('')
    const [imageLoaded, setImageLoaded] = useState(false)
    const [useProcedural, setUseProcedural] = useState(false)
    const [analysisComplete, setAnalysisComplete] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const waveformDataRef = useRef<number[]>([])
    const audioContextRef = useRef<AudioContext | null>(null)

    // Analyze the actual audio file to get a static waveform
    const analyzeAudioFile = async (trackId: string, barCount: number) => {
        try {
            const audioPath = client.getAudioUrl(trackId)

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext()
            }

            const response = await fetch(audioPath)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

            const channelData = audioBuffer.getChannelData(0)
            const samplesPerBar = Math.floor(channelData.length / barCount)
            const peaks: number[] = []
            let globalMax = 0

            for (let i = 0; i < barCount; i++) {
                const start = i * samplesPerBar
                const end = start + samplesPerBar
                let sum = 0

                for (let j = start; j < end; j++) {
                    sum += Math.abs(channelData[j])
                }

                const avg = sum / samplesPerBar
                if (avg > globalMax) globalMax = avg
                peaks.push(avg)
            }

            // Normalize so the highest peak is exactly 1.0
            // This ensures dynamic variation rather than a solid brick wall
            if (globalMax > 0) {
                for (let i = 0; i < peaks.length; i++) {
                    peaks[i] = peaks[i] / globalMax
                }
            }

            return peaks
        } catch (error) {
            console.error('Failed to analyze audio:', error)
            return null
        }
    }

    useEffect(() => {
        const src = client.getWaveformUrl(trackId)
        setImageSrc(src)
        setImageLoaded(false)
        setUseProcedural(false)
        setAnalysisComplete(false)
        waveformDataRef.current = []
    }, [trackId, energy])

    // Analyze audio when switching to procedural mode
    useEffect(() => {
        if (!useProcedural) return

        const barWidth = 3
        const barGap = 1
        const barCount = Math.floor(800 / (barWidth + barGap))

        analyzeAudioFile(trackId, barCount).then(peaks => {
            if (peaks) {
                waveformDataRef.current = peaks
                setAnalysisComplete(true)
            }
        })
    }, [useProcedural, trackId])

    useEffect(() => {
        if (!canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const playedPercentage = (currentTime / (duration || 1)) * 100
        const playedWidth = (canvas.width * Math.max(0, Math.min(100, playedPercentage))) / 100

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#09090b'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (useProcedural) {
            const barWidth = 3
            const barGap = 1
            const barCount = Math.floor(canvas.width / (barWidth + barGap))

            // Use the actual audio analysis data (static, not animated)
            const heights = waveformDataRef.current

            if (heights.length === 0) {
                // Still analyzing, show loading state
                return
            }

            for (let index = 0; index < Math.min(barCount, heights.length); index++) {
                const x = index * (barWidth + barGap)
                const normalizedHeight = heights[index] || 0
                // Lower multiplier to make the waveform peak height look nicer (was 0.85)
                const barHeight = Math.max(2, normalizedHeight * canvas.height * 0.65)
                const y = (canvas.height - barHeight) / 2
                const centerX = x + barWidth / 2

                if (centerX <= playedWidth) {
                    const grad = ctx.createLinearGradient(x, 0, x + barWidth, 0)
                    grad.addColorStop(0, '#2563eb')
                    grad.addColorStop(1, '#60a5fa')
                    ctx.fillStyle = grad
                    ctx.globalAlpha = 0.95
                } else {
                    ctx.fillStyle = '#9ca3af'
                    ctx.globalAlpha = 0.25
                }

                ctx.fillRect(x, y, barWidth, barHeight)
            }

            ctx.globalAlpha = 1
            ctx.fillStyle = 'white'
            ctx.shadowColor = 'rgba(255,255,255,0.6)'
            ctx.shadowBlur = 8
            ctx.fillRect(Math.max(0, playedWidth - 1), canvas.height * 0.2, 2, canvas.height * 0.6)
            ctx.shadowBlur = 0
            return
        }

        // Create a temporary image to draw from
        const img = new Image()
        img.src = imageSrc
        img.onload = () => {
            // Draw unplayed waveform (gray)
            ctx.globalAlpha = 0.2
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

            // Draw played portion (blue with mask)
            ctx.globalAlpha = 1

            // Create gradient for played portion
            const grad = ctx.createLinearGradient(0, 0, playedWidth, 0)
            grad.addColorStop(0, '#2563eb') // blue-600
            grad.addColorStop(0.5, '#3b82f6') // blue-500
            grad.addColorStop(1, '#60a5fa') // blue-400

            ctx.fillStyle = grad
            ctx.globalCompositeOperation = 'source-atop'
            ctx.fillRect(0, 0, playedWidth, canvas.height)
            ctx.globalCompositeOperation = 'source-over'

            // Draw progress line (white dot)
            ctx.fillStyle = 'white'
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.arc(playedWidth, canvas.height / 2, 5, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
        }
    }, [imageLoaded, imageSrc, currentTime, duration, useProcedural, analysisComplete])

    const handleImageLoad = () => {
        setImageLoaded(true)
        setUseProcedural(false)
    }

    const handleImageError = () => {
        console.warn('Failed to load waveform for track:', trackId)
        setUseProcedural(true)
    }

    return (
        <>
            {/* Hidden image for loading */}
            <img
                src={imageSrc}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{ display: 'none' }}
                alt="waveform"
            />
            {/* Canvas for rendering */}
            <canvas
                ref={canvasRef}
                width={800}
                height={40}
                className="w-full h-10"
                style={{ display: imageLoaded || useProcedural ? 'block' : 'none' }}
            />
        </>
    )
}
