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
            exec('wmic logicaldisk get name', (error, stdout, stderr) => {
                if (error) {
                    console.error('Disk read error:', error)
                    return res.status(500).json({ error: 'Generic disk read error' })
                }
                const drives = stdout.split('\r\r\n')
                    .filter(value => /[A-Za-z]:/.test(value))
                    .map(value => value.trim())
                    .map(drive => ({
                        name: drive,
                        path: drive + '\\',
                        isDirectory: true,
                        isDrive: true
                    }))
                res.json(drives)
            })
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
