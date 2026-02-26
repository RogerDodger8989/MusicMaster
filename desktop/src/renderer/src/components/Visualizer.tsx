import React, { useEffect, useRef } from 'react'
import { getAnalyser } from '../store/player'
import { cn } from '../lib/utils'

export type VisualizerMode = 'spectrum' | 'waveform' | 'particles' | 'orbit'

interface VisualizerProps {
    mode: VisualizerMode
    className?: string
    color?: string
}

export default function Visualizer({ mode, className, color = 'rgba(59, 130, 246, 1)' }: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const requestRef = useRef<number>()

    // Particles state
    const particlesRef = useRef<{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, size: number }[]>([])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let analyser: AnalyserNode
        try {
            analyser = getAnalyser()
        } catch (e) {
            console.error("Failed to get analyser", e)
            return
        }

        // Set fftSize depending on mode
        analyser.fftSize = mode === 'waveform' ? 2048 : 256
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const draw = () => {
            requestRef.current = requestAnimationFrame(draw)

            const width = canvas.clientWidth
            const height = canvas.clientHeight
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width
                canvas.height = height
            }

            ctx.clearRect(0, 0, width, height)

            if (mode === 'spectrum') {
                analyser.getByteFrequencyData(dataArray)

                // We only show the lower half of frequencies as they look better
                const showBins = Math.floor(bufferLength * 0.7)
                const barWidth = (width / showBins) - 1

                let x = 0
                for (let i = 0; i < showBins; i++) {
                    const rawValue = dataArray[i]
                    // Exponential smoothing
                    const value = Math.pow(rawValue / 255, 1.5) * 255

                    const barHeight = (value / 255) * height

                    // Draw main bar
                    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
                    gradient.addColorStop(0, `${color.replace('rgb', 'rgba').replace(')', ', 0.3)')}`)
                    gradient.addColorStop(1, color)

                    ctx.fillStyle = gradient

                    // Add rounded caps
                    ctx.beginPath()
                    ctx.roundRect(x, height - barHeight, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0])
                    ctx.fill()

                    // Add subtle reflection
                    ctx.globalAlpha = 0.2
                    ctx.beginPath()
                    ctx.roundRect(x, height, barWidth, barHeight * 0.3, [0, 0, barWidth / 2, barWidth / 2])
                    ctx.fill()
                    ctx.globalAlpha = 1.0

                    x += barWidth + 1
                }
            } else if (mode === 'waveform') {
                analyser.getByteTimeDomainData(dataArray)

                ctx.lineWidth = 3
                ctx.strokeStyle = color
                ctx.beginPath()

                const sliceWidth = width / bufferLength
                let x = 0

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0
                    const y = (v * height) / 2

                    if (i === 0) {
                        ctx.moveTo(x, y)
                    } else {
                        ctx.lineTo(x, y)
                    }

                    x += sliceWidth
                }

                ctx.lineTo(width, height / 2)
                ctx.stroke()

                // Glow effect
                ctx.shadowBlur = 15
                ctx.shadowColor = color
                ctx.stroke()
                ctx.shadowBlur = 0

            } else if (mode === 'orbit') {
                analyser.getByteFrequencyData(dataArray)
                const centerX = width / 2
                const centerY = height / 2
                const baseRadius = Math.min(width, height) * 0.2

                ctx.beginPath()

                // Smooth out the data a bit
                const showBins = Math.floor(bufferLength * 0.5)
                for (let i = 0; i <= showBins; i++) {
                    // Circular array access for connecting end to start
                    const idx = i === showBins ? 0 : i
                    const value = dataArray[idx]

                    const angle = (i / showBins) * Math.PI * 2
                    const radius = baseRadius + (value / 255) * baseRadius * 1.5

                    const x = centerX + Math.cos(angle) * radius
                    const y = centerY + Math.sin(angle) * radius

                    if (i === 0) {
                        ctx.moveTo(x, y)
                    } else {
                        ctx.lineTo(x, y)
                    }
                }

                ctx.closePath()
                ctx.lineWidth = 4
                ctx.strokeStyle = color
                ctx.fillStyle = `${color.replace('rgb', 'rgba').replace(')', ', 0.1)')}`

                // Glow effect
                ctx.shadowBlur = 20
                ctx.shadowColor = color

                ctx.fill()
                ctx.stroke()
                ctx.shadowBlur = 0
            } else if (mode === 'particles') {
                analyser.getByteFrequencyData(dataArray)

                // Calculate average bass energy
                let bassSum = 0
                for (let i = 0; i < 10; i++) {
                    bassSum += dataArray[i]
                }
                const bassAvg = bassSum / 10

                // Add new particles on beat
                if (bassAvg > 200 && Math.random() > 0.5) {
                    for (let i = 0; i < 3; i++) {
                        particlesRef.current.push({
                            x: width / 2,
                            y: height / 2,
                            vx: (Math.random() - 0.5) * 10,
                            vy: (Math.random() - 0.5) * 10,
                            life: 0,
                            maxLife: 50 + Math.random() * 50,
                            size: 2 + Math.random() * 6
                        })
                    }
                }

                // Update and draw particles
                ctx.fillStyle = color

                const nextParticles = []
                for (const p of particlesRef.current) {
                    p.x += p.vx
                    p.y += p.vy
                    p.life++

                    const alpha = 1 - (p.life / p.maxLife)

                    if (p.life < p.maxLife) {
                        ctx.globalAlpha = alpha
                        ctx.beginPath()
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                        ctx.fill()

                        // Subtle glow
                        ctx.shadowBlur = 10
                        ctx.shadowColor = color
                        ctx.fill()
                        ctx.shadowBlur = 0

                        nextParticles.push(p)
                    }
                }
                ctx.globalAlpha = 1
                particlesRef.current = nextParticles
            }
        }

        draw()

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current)
        }
    }, [mode, color])

    return <canvas ref={canvasRef} className={cn('w-full h-full block', className)} />
}
