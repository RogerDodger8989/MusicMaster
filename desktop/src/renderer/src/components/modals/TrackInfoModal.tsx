import { useEffect, useState } from 'react'
import { X, Copy, ExternalLink, HardDrive } from 'lucide-react'
import { client } from '../../api/client'
import { Track } from '../../types'
import { useDraggable } from '../../hooks/useDraggable'
import { cn } from '../../lib/utils'

interface TrackInfoModalProps {
    track: Track
    onClose: () => void
}

export default function TrackInfoModal({ track, onClose }: TrackInfoModalProps) {
    const [info, setInfo] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { position, handleMouseDown } = useDraggable()

    // Custom drag handler to prevent text selection (blue overlay)
    const onDragStart = (e: React.MouseEvent) => {
        // Prevent highlight selection
        e.preventDefault()
        handleMouseDown(e)
    }

    useEffect(() => {
        async function fetchInfo() {
            try {
                setLoading(true)
                const data = await client.getTrackInfo(track.id)
                setInfo(data)
            } catch (err) {
                setError('Failed to load track information.')
            } finally {
                setLoading(false)
            }
        }
        fetchInfo()
    }, [track.id])



    // Format helpers
    const formatDuration = (ms: number) => {
        if (!ms) return ''
        const sec = Math.floor(ms / 1000)
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const formatSize = (bytes: number) => {
        if (!bytes) return ''
        if (bytes < 1024) return bytes + ' B'
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
        else return (bytes / 1048576).toFixed(2) + ' MB'
    }

    const openPath = async () => {
        if (info && info.path && (window as any).api?.util?.showItemInFolder) {
            (window as any).api.util.showItemInFolder(info.path)
        } else if (info && info.path) {
            await client.showItemInFolder(info.path)
        }
    }

    const copyPath = () => {
        navigator.clipboard.writeText(info.path)
    }

    return (
        // Fixed container over the whole screen with strictly NO background blurring/dimming (pointer-events-none)
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
            <div
                className="pointer-events-auto absolute bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col w-[500px] overflow-hidden"
                style={{ left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)` }}
            >
                {/* Header - Draggable Area */}
                <div
                    className="px-4 py-3 bg-zinc-800/80 border-b border-zinc-700/50 flex justify-between items-center cursor-move select-none"
                    onMouseDown={onDragStart}
                >
                    <div className="flex items-center gap-2 text-zinc-100 font-medium tracking-wide">
                        <HardDrive size={16} className="text-blue-400" />
                        File info - {track.title}
                    </div>
                    {/* Prevent generic drag handler from firing on the close button */}
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white transition-colors hover:bg-zinc-700 rounded-md p-1"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 max-h-[70vh]">
                    {loading ? (
                        <div className="text-zinc-400 text-sm text-center py-10">Loading track metadata...</div>
                    ) : error ? (
                        <div className="text-red-400 text-sm text-center py-10">{error}</div>
                    ) : info ? (
                        <div className="space-y-4">

                            {/* Path Container */}
                            <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3">
                                <div className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">Path</div>
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 text-sm text-zinc-200 font-mono break-all whitespace-pre-wrap select-text">
                                        {info.path}
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button onClick={copyPath} title="Copy Path" className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                                            <Copy size={14} />
                                        </button>
                                        <button onClick={openPath} title="Open in Explorer" className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
                                            <ExternalLink size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <InfoField label="Title" value={track.title} />
                                <InfoField label="Artist" value={info.artist} />
                                <InfoField label="Album Artist" value={info.albumArtist} />
                                <InfoField label="Album" value={track.album} />

                                <div className="col-span-2 border-t border-zinc-800 my-1" />

                                <InfoField label="Release Year" value={info.releaseYear} />
                                <InfoField label="Disc" value={info.discTotal ? `${info.disc || '-'} / ${info.discTotal}` : info.disc} />
                                <InfoField label="Track" value={info.trackTotal ? `${info.trackNum || '-'} / ${info.trackTotal}` : info.trackNum} />
                                <InfoField label="Duration" value={info.duration ? formatDuration(info.duration) : '-'} />
                                <InfoField label="Genres" value={info.genres} className="col-span-2" />

                                <div className="col-span-2 border-t border-zinc-800 my-1" />

                                <InfoField label="Codec" value={info.codec ? info.codec.toUpperCase() : '-'} />
                                <InfoField label="Bitrate" value={info.bitrate ? `${Math.round(info.bitrate / 1000)} kbps` : '-'} />
                                <InfoField label="Sample Rate" value={info.sampleRate ? `${info.sampleRate} Hz` : '-'} />
                                <InfoField label="Bit Depth" value={info.bitDepth ? `${info.bitDepth} bit` : '-'} />
                                <InfoField label="Channels" value={info.channels} />
                                <InfoField label="Size" value={formatSize(info.size)} />

                                <div className="col-span-2 border-t border-zinc-800 my-1" />

                                <InfoField label="Composer" value={info.composer} className="col-span-2" />
                                <InfoField label="Lyricist" value={info.lyricist} className="col-span-2" />
                                <InfoField label="Producer" value={info.producer} className="col-span-2" />
                                <InfoField label="Compilation" value={info.isCompilation ? 'Yes' : 'No'} />
                                <InfoField label="ISRC" value={info.isrc} />
                                <InfoField label="Record Label" value={info.recordLabel} />
                                <InfoField label="Media" value={info.media} />
                                <InfoField label="Release Country" value={info.releaseCountry} />
                                <InfoField label="Release Status" value={info.releaseStatus} />
                                <InfoField label="Release Type" value={info.releaseType} />

                                <InfoField
                                    label="MusicBrainz ID"
                                    value={info.musicbrainzId}
                                    className="col-span-2"
                                    valueClass="font-mono text-xs"
                                />

                                <div className="col-span-2 border-t border-zinc-800 my-1" />

                                <InfoField label="Rating" value={info.rating > 0 ? `${info.rating} / 5` : 'Unrated'} />
                                <InfoField label="Playcount" value={info.playcount} />
                                <InfoField label="Loved" value={info.favorites ? 'Yes' : 'No'} />
                                <InfoField label="Modified" value={info.modified ? new Date(info.modified).toLocaleString('sv-SE') : '-'} />
                            </div>

                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function InfoField({ label, value, className, valueClass }: { label: string, value: any, className?: string, valueClass?: string }) {
    if (value === undefined || value === null || value === '') return null
    return (
        <div className={cn("flex flex-col gap-0.5", className)}>
            <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</span>
            <span className={cn("text-sm text-zinc-200 select-text", valueClass)}>{String(value)}</span>
        </div>
    )
}
