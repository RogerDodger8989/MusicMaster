import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'

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
 * Open a native Windows folder browser dialog via PowerShell
 */
export const browseNative = async (req: Request, res: Response) => {
    if (process.platform !== 'win32') {
        return res.status(400).json({ error: 'Native browsing only supported on Windows' })
    }

    const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$browser = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$browser.Description = "Select a music folder"',
        '$show = $browser.ShowDialog()',
        'if ($show -eq "OK") { Write-Host $browser.SelectedPath }'
    ].join('; ')

    exec(`powershell -Command "${script}"`, (error, stdout) => {
        if (error) {
            console.error('browseNative error:', error)
            return res.status(500).json({ error: 'Failed to open native dialog' })
        }
        const selectedPath = stdout.trim()
        res.json({ path: selectedPath || null })
    })
}
