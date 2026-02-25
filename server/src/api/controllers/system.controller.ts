import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec, spawn } from 'child_process'

interface FileSystemNode {
    name: string
    path: string
    isDirectory: boolean
    isDrive?: boolean
}

/**
 * List drives on Windows (or root on Linux/Mac)
 */
export const listDrives = async (req: Request, res: Response) => {
    try {
        if (process.platform === 'win32') {
            const drives: FileSystemNode[] = []
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

            for (const letter of letters) {
                const drivePath = `${letter}:\\`
                try {
                    if (fs.existsSync(drivePath)) {
                        drives.push({
                            name: `${letter}:`,
                            path: drivePath,
                            isDirectory: true,
                            isDrive: true
                        })
                    }
                } catch (e) {
                    // Skip drives that aren't ready (e.g. empty DVD drives)
                }
            }
            res.json(drives)
        } else {
            // Linux/Mac
            res.json([{
                name: 'Root',
                path: '/',
                isDirectory: true,
                isDrive: true
            }])
        }
    } catch (error) {
        console.error('Failed to list drives:', error)
        res.status(500).json({ error: 'Failed to list drives' })
    }
}

/**
 * List contents of a directory
 */
export const listDirectory = async (req: Request, res: Response) => {
    try {
        const dirPath = req.query.path as string
        if (!dirPath) {
            return res.status(400).json({ error: 'Path is required' })
        }

        if (!fs.existsSync(dirPath)) {
            return res.status(404).json({ error: 'Path not found' })
        }

        const items = fs.readdirSync(dirPath, { withFileTypes: true })

        const nodes: FileSystemNode[] = items
            .filter(item => item.isDirectory()) // Only list directories for browsing
            .map(item => ({
                name: item.name,
                path: path.join(dirPath, item.name),
                isDirectory: true
            }))

        res.json(nodes)
    } catch (error) {
        console.error(`Failed to list directory ${req.query.path}:`, error)
        res.status(500).json({ error: 'Failed to access directory' })
    }
}

/**
 * Open a file in the OS file explorer (highlight the file)
 */
export const showInFolder = async (req: Request, res: Response) => {
    try {
        const filePath = req.query.path as string
        if (!filePath) {
            return res.status(400).json({ error: 'Path is required' })
        }

        const platform = process.platform
        let command: string

        if (platform === 'win32') {
            command = `explorer /select,"${filePath.replace(/\//g, '\\')}"`
        } else if (platform === 'darwin') {
            command = `open -R "${filePath}"`
        } else {
            const dir = path.dirname(filePath)
            command = `xdg-open "${dir}"`
        }

        exec(command, (error) => {
            if (error) {
                console.error('showInFolder error:', error.message)
            }
        })

        res.json({ ok: true })
    } catch (error) {
        console.error('Failed to show file in folder:', error)
        res.status(500).json({ error: 'Failed to open file in folder' })
    }
}

/**
 * Open a native Windows browser dialog via PowerShell
 */
export const browseNative = async (req: Request, res: Response) => {
    if (process.platform !== 'win32') {
        return res.status(400).json({ error: 'Native browsing only supported on Windows' })
    }

    const type = req.query.type as string || 'folder'
    let script = ''

    if (type === 'file') {
        script = `
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.OpenFileDialog
            $dialog.Filter = "Image Files (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp|All Files (*.*)|*.*"
            $dialog.Title = "Select Artwork"
            if ($dialog.ShowDialog() -eq 'OK') { Write-Host $dialog.FileName }
        `.trim()
    } else {
        script = `
            Add-Type -AssemblyName System.Windows.Forms
            $browser = New-Object System.Windows.Forms.FolderBrowserDialog
            $browser.Description = "Select a music folder"
            if ($browser.ShowDialog() -eq 'OK') { Write-Host $browser.SelectedPath }
        `.trim()
    }

    console.log(`📂 Opening native ${type} dialog...`)

    const ps = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-Command', script
    ])

    let stdout = ''
    let stderr = ''

    ps.stdout.on('data', (data) => {
        stdout += data.toString()
    })

    ps.stderr.on('data', (data) => {
        stderr += data.toString()
    })

    ps.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ browseNative error (code ${code}):`, stderr)
            return res.status(500).json({ error: 'Failed' })
        }
        const selectedPath = stdout.trim()
        console.log(`✅ Selected path: ${selectedPath || 'None'}`)
        res.json({ path: selectedPath || null })
    })
}
