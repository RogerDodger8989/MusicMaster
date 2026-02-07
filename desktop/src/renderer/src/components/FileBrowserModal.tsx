import React, { useState, useEffect } from 'react'
import { client } from '../api/client'

interface FileSystemNode {
    name: string
    path: string
    isDirectory: boolean
    isDrive?: boolean
}

interface FileBrowserModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (path: string) => void
    title?: string
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({ isOpen, onClose, onSelect, title = "Select Folder" }) => {
    const [currentPath, setCurrentPath] = useState<string>('')
    const [nodes, setNodes] = useState<FileSystemNode[]>([])
    const [drives, setDrives] = useState<FileSystemNode[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initial load: get drives
    useEffect(() => {
        if (isOpen) {
            loadDrives()
        }
    }, [isOpen])

    const loadDrives = async () => {
        try {
            setLoading(true)
            setError(null)
            const driveList = await client.getDrives()
            setDrives(driveList)
            // If we have drives, show them initially. 
            // If currentPath is empty, we show drives.
            if (!currentPath) {
                setNodes([])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load drives')
        } finally {
            setLoading(false)
        }
    }

    const loadDirectory = async (path: string) => {
        try {
            setLoading(true)
            setError(null)
            const items = await client.getDirectory(path)
            setNodes(items)
            setCurrentPath(path)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load directory')
            // Don't change path on error, easier to recover
        } finally {
            setLoading(false)
        }
    }

    const handleNodeClick = (node: FileSystemNode) => {
        if (node.isDirectory) {
            loadDirectory(node.path)
        }
    }

    const handleUpClick = () => {
        // Simple parent resolution for Windows backward slashes or Unix forward slashes
        // This is a bit naive but works for general cases
        const separator = currentPath.includes('\\') ? '\\' : '/'
        const parentPath = currentPath.split(separator).slice(0, -1).join(separator) || separator

        // If we are at a root drive like "C:\" (win) or "/" (nix), going up means showing drives again
        if (drives.some(d => d.path === currentPath) || currentPath === parentPath || currentPath.length <= 3) {
            setCurrentPath('')
            setNodes([])
        } else {
            loadDirectory(parentPath)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
                </div>

                {/* Navigation Bar */}
                <div className="px-4 py-3 bg-zinc-800 border-b border-zinc-700 flex gap-2 items-center text-sm">
                    <button
                        onClick={() => { setCurrentPath(''); setNodes([]) }}
                        className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                        title="My Computer"
                    >
                        <span className="text-lg">💻</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-600 mx-1"></div>
                    <div className="flex-1 flex items-center overflow-hidden">
                        {currentPath ? (
                            <div className="flex items-center text-zinc-300 font-medium">
                                <span className="mr-2 text-zinc-500">Path:</span>
                                <span className="font-mono truncate select-all cursor-text bg-zinc-900/50 px-2 py-1 rounded border border-zinc-700 w-full">
                                    {currentPath}
                                </span>
                            </div>
                        ) : (
                            <span className="text-zinc-500 italic">Select a drive...</span>
                        )}
                    </div>
                    {currentPath && (
                        <button onClick={handleUpClick} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-300 transition-colors" title="Up one level">
                            ⬆
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-zinc-900 min-h-[300px]">
                    {loading && (
                        <div className="flex justify-center items-center h-full text-zinc-500 gap-2">
                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            Loading...
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
                            <span className="text-3xl mb-2">⚠️</span>
                            <p>{error}</p>
                            <button onClick={() => currentPath ? loadDirectory(currentPath) : loadDrives()} className="mt-4 px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-white text-sm">
                                Try Again
                            </button>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="flex flex-col text-sm border-t border-zinc-800">
                            {/* Header Row */}
                            <div className="flex items-center px-4 py-2 bg-zinc-800/50 text-zinc-500 text-xs uppercase font-semibold">
                                <span className="flex-1">Name</span>
                                <span className="w-24">Type</span>
                            </div>

                            {/* Drives List (Root) */}
                            {currentPath === '' && drives.map(drive => (
                                <button
                                    key={drive.name}
                                    onClick={() => handleNodeClick(drive)}
                                    className="flex items-center px-4 py-3 hover:bg-blue-600/20 border-b border-zinc-800/50 transition-colors text-left group"
                                >
                                    <span className="text-lg mr-3">💾</span>
                                    <span className="flex-1 font-medium text-zinc-200 group-hover:text-white">{drive.name}</span>
                                    <span className="text-xs text-zinc-500 w-24">Local Disk</span>
                                </button>
                            ))}

                            {/* Folder List */}
                            {currentPath !== '' && (
                                <>
                                    {nodes.length === 0 && (
                                        <div className="p-8 text-center text-zinc-500 italic">
                                            This folder is empty
                                        </div>
                                    )}
                                    {nodes.map(node => (
                                        <button
                                            key={node.path}
                                            onClick={() => handleNodeClick(node)}
                                            onDoubleClick={() => onSelect(node.path)} // Allow double click to drill down is default, but maybe explicit select?
                                            // Actually double click on folder usually enters it. 
                                            // Let's add single click selection style?
                                            className={`flex items-center px-4 py-2 hover:bg-blue-600/20 border-b border-zinc-800/50 transition-colors text-left group ${currentPath === node.path ? 'bg-blue-600/30' : ''
                                                }`}
                                        >
                                            <span className="text-yellow-500 text-lg mr-3">📁</span>
                                            <span className="flex-1 text-zinc-300 group-hover:text-white truncate">
                                                {node.name}
                                            </span>
                                            <span className="text-xs text-zinc-500 w-24">Folder</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-700 flex justify-end gap-3 bg-zinc-900 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSelect(currentPath)}
                        disabled={!currentPath}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPath
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            }`}
                    >
                        Select This Folder
                    </button>
                </div>
            </div>
        </div>
    )
}
