import { useState, useEffect } from 'react'
import { X, Check, Save, Disc, User, Calendar, Music, Building2, Barcode, Flag, Info, Hash } from 'lucide-react'
import { Track } from '../types'
import { cn } from '../lib/utils'
import { useDraggable } from '../hooks/useDraggable'

interface TagConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    track: Track
    candidate: any // ScoredCandidate from IPC
    type?: 'track' | 'album'
    onConfirm: (trackId: string, candidate: any, selectedFields: string[]) => Promise<void>
}

interface MetadataField {
    key: string
    label: string
    icon?: React.ElementType
    currentValue: string | number | undefined
    newValue: string | number | undefined
}

export default function TagConfirmationModal({
    isOpen,
    onClose,
    track,
    candidate,
    type = 'track',
    onConfirm
}: TagConfirmationModalProps) {
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
    const [isSaving, setIsSaving] = useState(false)

    const { position, handleMouseDown } = useDraggable()

    // Initialize selected fields - select all differences by default
    useEffect(() => {
        if (isOpen && track && candidate) {
            const fields = new Set<string>()

            // Compare and select if different (or new is populated and old is empty)
            // Title
            if (candidate.title && candidate.title !== track.title) fields.add('title')
            // Artist
            if (candidate.artistName && candidate.artistName !== track.artist) fields.add('artist')
            // Album
            if (candidate.albumName && candidate.albumName !== track.album) fields.add('album')
            // Year / Date
            const currentYear = track.year || (track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined)
            if (candidate.year && candidate.year !== currentYear) fields.add('year')
            // Track Num
            const candTrackNum = candidate.tracks?.find((t: any) => t.title === candidate.title)?.position
            if (candTrackNum && candTrackNum !== track.trackNum) fields.add('trackNum')

            // Always select these if available as they are usually new
            if (candidate.releaseMbid) fields.add('mbids')
            if (candidate.label) fields.add('label')

            setSelectedFields(fields)
        }
    }, [isOpen, track, candidate])

    if (!isOpen || !track || !candidate) return null

    const toggleField = (key: string) => {
        const newSelected = new Set(selectedFields)
        if (newSelected.has(key)) {
            newSelected.delete(key)
        } else {
            newSelected.add(key)
        }
        setSelectedFields(newSelected)
    }

    const handleConfirm = async () => {
        setIsSaving(true)
        try {
            await onConfirm(track.id, candidate, Array.from(selectedFields))
            onClose()
        } catch (error) {
            console.error('Failed to confirm tags:', error)
        } finally {
            setIsSaving(false)
        }
    }

    // Helper to render a field row
    const renderField = (field: MetadataField) => {
        const isSelected = selectedFields.has(field.key)
        const isDifferent = String(field.currentValue) !== String(field.newValue)
        const hasValue = field.newValue !== undefined && field.newValue !== '' && field.newValue !== 0

        if (!hasValue && !field.currentValue) return null // Skip empty fields

        const Icon = field.icon || Music

        return (
            <div
                key={field.key}
                className={cn(
                    "grid grid-cols-12 gap-4 p-3 rounded-lg border cursor-pointer transition-colors",
                    isSelected
                        ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                        : "bg-zinc-950/50 border-zinc-900 hover:bg-zinc-900",
                    !hasValue && "opacity-50"
                )}
                onClick={() => toggleField(field.key)}
            >
                <div className="col-span-1 flex items-center justify-center">
                    <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-zinc-700 bg-zinc-950"
                    )}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                </div>

                <div className="col-span-4 flex items-center gap-3 text-zinc-400">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{field.label}</span>
                </div>

                <div className="col-span-7 grid grid-cols-2 gap-4">
                    {/* Current Value */}
                    <div className="text-sm text-zinc-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {field.currentValue || <span className="text-zinc-700 italic">Empty</span>}
                    </div>
                    {/* New Value */}
                    <div className={cn(
                        "text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap",
                        isDifferent ? "text-green-400" : "text-zinc-300"
                    )}>
                        {field.newValue || <span className="text-zinc-700 italic">Empty</span>}
                    </div>
                </div>
            </div>
        )
    }

    // Prepare fields
    const currentYear = track.year || (track.releaseDate ? new Date(track.releaseDate).getFullYear() : undefined)
    const candidateTrack = candidate.tracks?.find((t: any) =>
        t.title.toLowerCase() === track.title.toLowerCase() // Simple fuzzy match for display
    ) || candidate.tracks?.[0] // Fallback

    const fields: MetadataField[] = [
        { key: 'title', label: 'Title', icon: Music, currentValue: track.title, newValue: candidateTrack?.title || candidate.title },
        { key: 'artist', label: 'Artist', icon: User, currentValue: track.artist, newValue: candidate.artistName },
        { key: 'album', label: 'Album', icon: Disc, currentValue: track.album, newValue: candidate.albumName },
        { key: 'year', label: 'Year', icon: Calendar, currentValue: currentYear, newValue: candidate.year },
        { key: 'trackNum', label: 'Track #', icon: Hash, currentValue: track.trackNum, newValue: candidateTrack?.position },
        { key: 'label', label: 'Label', icon: Building2, currentValue: undefined, newValue: candidate.label }, // Usually missing in local
        { key: 'country', label: 'Country', icon: Flag, currentValue: undefined, newValue: candidate.country },
        { key: 'mbids', label: 'MusicBrainz IDs', icon: Barcode, currentValue: track.musicbrainzTrackId ? 'Present' : 'Missing', newValue: 'Update ID' },
    ]


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-in fade-in duration-200">
            <div
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div
                    className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <Save className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {type === 'track' ? 'Review Metadata Changes' : 'Confirm Album Metadata'}
                            </h2>
                            <p className="text-xs text-zinc-400">
                                {type === 'track'
                                    ? 'Select which tags to apply to your file'
                                    : `Apply MusicBrainz IDs to all matching tracks in "${track.album}"`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Headers */}
                    <div className="grid grid-cols-12 gap-4 px-3 pb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        <div className="col-span-1"></div>
                        <div className="col-span-4">Field</div>
                        <div className="col-span-7 grid grid-cols-2 gap-4">
                            <div>Current</div>
                            <div>New (MusicBrainz)</div>
                        </div>
                    </div>

                    {fields.map(renderField)}

                    {/* Confidence Warning */}
                    {candidate.confidence && (
                        <div className={cn(
                            "mt-4 p-3 rounded border text-sm flex items-center gap-2",
                            candidate.confidence === 'HIGH' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                                candidate.confidence === 'MEDIUM' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                                    "bg-red-500/10 border-red-500/20 text-red-400"
                        )}>
                            <Info className="w-4 h-4" />
                            <span>Match Confidence: <strong>{candidate.confidence}</strong></span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving || selectedFields.size === 0}
                        className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Applying...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                {type === 'track' ? 'Apply Changes' : 'Apply to Album'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

