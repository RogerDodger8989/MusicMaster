/**
 * Waveform Generator - Creates PNG waveform visualizations
 */

import { createCanvas } from 'canvas'
import * as fs from 'fs'
import * as path from 'path'

export interface WaveformOptions {
    width: number
    height: number
    waveColor: string
    backgroundColor: string
}

const DEFAULT_OPTIONS: WaveformOptions = {
    width: 800,
    height: 100,
    waveColor: '#3b82f6', // Blue
    backgroundColor: 'transparent'
}

/**
 * Generate waveform PNG from audio samples
 * @param samples - Audio samples (Float32Array)
 * @param outputPath - Where to save the PNG
 * @param options - Customization options
 */
export async function generateWaveform(
    samples: Float32Array,
    outputPath: string,
    options: Partial<WaveformOptions> = {}
): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // Create canvas
    const canvas = createCanvas(opts.width, opts.height)
    const ctx = canvas.getContext('2d')

    // Background
    if (opts.backgroundColor !== 'transparent') {
        ctx.fillStyle = opts.backgroundColor
        ctx.fillRect(0, 0, opts.width, opts.height)
    }

    // Downsample audio to match canvas width
    const samplesPerPixel = Math.floor(samples.length / opts.width)
    const waveformData: { min: number; max: number }[] = []

    for (let i = 0; i < opts.width; i++) {
        const start = i * samplesPerPixel
        const end = start + samplesPerPixel

        let min = 1
        let max = -1

        for (let j = start; j < end && j < samples.length; j++) {
            const value = samples[j]
            if (value < min) min = value
            if (value > max) max = value
        }

        waveformData.push({ min, max })
    }

    // Draw waveform
    ctx.fillStyle = opts.waveColor
    ctx.strokeStyle = opts.waveColor
    ctx.lineWidth = 1

    const centerY = opts.height / 2
    const amplitudeScale = opts.height / 2

    for (let i = 0; i < waveformData.length; i++) {
        const { min, max } = waveformData[i]

        const yMin = centerY + (min * amplitudeScale)
        const yMax = centerY + (max * amplitudeScale)
        const barHeight = yMax - yMin

        // Draw vertical bar
        ctx.fillRect(i, yMin, 1, Math.max(barHeight, 1))
    }

    // Save to file
    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync(outputPath, buffer)
}

/**
 * Generate waveform with gradient (more aesthetic)
 */
export async function generateGradientWaveform(
    samples: Float32Array,
    outputPath: string
): Promise<void> {
    const width = 800
    const height = 100

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#60a5fa')    // Light blue
    gradient.addColorStop(0.5, '#3b82f6')  // Blue
    gradient.addColorStop(1, '#2563eb')    // Dark blue

    // Downsample
    const samplesPerPixel = Math.floor(samples.length / width)
    const centerY = height / 2
    const amplitudeScale = height / 2

    ctx.fillStyle = gradient

    for (let i = 0; i < width; i++) {
        const start = i * samplesPerPixel
        const end = start + samplesPerPixel

        let rms = 0
        for (let j = start; j < end && j < samples.length; j++) {
            rms += samples[j] * samples[j]
        }
        rms = Math.sqrt(rms / samplesPerPixel)

        const barHeight = rms * amplitudeScale * 2
        const yPos = centerY - (barHeight / 2)

        ctx.fillRect(i, yPos, 1, Math.max(barHeight, 1))
    }

    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync(outputPath, buffer)
}
