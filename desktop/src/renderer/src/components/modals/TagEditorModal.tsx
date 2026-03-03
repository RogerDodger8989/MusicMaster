import { useState, useEffect } from 'react'
import { X, Save, Music, Image as ImageIcon, CheckSquare, ExternalLink, Settings2, Trash2, Star, Heart, ChevronLeft, ChevronRight, RotateCcw, Wand2, Copy, Check, HardDrive } from 'lucide-react'
import { client } from '../../api/client'
import { useLibrary } from '../../store/library'
import type { Track } from '../../types'
import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { useDraggable } from '../../hooks/useDraggable'
import TaggingModal from '../TaggingModal'

interface TagEditorModalProps {
    tracks: Track[]
    context?: 'track' | 'album'
    initialTrackIndex?: number
    onClose: () => void
}

type Tab = 'tags' | 'extended' | 'artwork' | 'lyrics' | 'info'

export default function TagEditorModal({ tracks, context, initialTrackIndex = 0, onClose }: TagEditorModalProps) {
    const { albums, initialize } = useLibrary()
    const [editedTracks, setEditedTracks] = useState<Track[]>([])
    const [activeTab, setActiveTab] = useState<Tab>('tags')
    const [isSaving, setIsSaving] = useState(false)

    // Helper to resolve album ID from store if missing in track
    const getResolvedAlbumId = (track: Track) => {
        if (!track) return ''
        if (track.albumId) return track.albumId
        const album = albums.find(
            (a) =>
                a.name === track.album &&
                a.artist === (track.albumArtist || track.artist)
        )
        return album?.id || ''
    }
    const { position, handleMouseDown } = useDraggable()
    const [currentIndex, setCurrentIndex] = useState(initialTrackIndex)
    const [initialFields, setInitialFields] = useState<Record<string, string>>({})

    const onDragStart = (e: React.MouseEvent) => {
        // Only drag from header, and don't drag if clicking buttons
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        handleMouseDown(e)
    }

    // Field states
    const [fields, setFields] = useState<Record<string, string>>({})
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({})
    const [artworkSettings, setArtworkSettings] = useState({
        embed: true,
        saveToFile: false,
        fileName: 'cover'
    })
    const [pendingArtwork, setPendingArtwork] = useState<{
        front?: { data: string; type: string };
        back?: { data: string; type: string };
    }>({})

    const [showTaggingModal, setShowTaggingModal] = useState(false)
    const [showSuccessToast, setShowSuccessToast] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    const isMulti = tracks.length > 1
    const isAlbumContext = context === 'album'

    const [trackInfo, setTrackInfo] = useState<any>(null)
    const [infoLoading, setInfoLoading] = useState(false)
    const [infoError, setInfoError] = useState<string | null>(null)

    useEffect(() => {
        if (activeTab === 'info') {
            const fetchInfo = async () => {
                try {
                    setInfoLoading(true)
                    const data = await client.getTrackInfo(tracks[currentIndex].id)
                    setTrackInfo(data)
                } catch (err) {
                    setInfoError('Failed to load track information.')
                } finally {
                    setInfoLoading(false)
                }
            }
            fetchInfo()
        }
    }, [activeTab, currentIndex, tracks])

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
        if (trackInfo && trackInfo.path && (window as any).api?.util?.showItemInFolder) {
            (window as any).api.util.showItemInFolder(trackInfo.path)
        } else if (trackInfo && trackInfo.path) {
            await client.showItemInFolder(trackInfo.path)
        }
    }

    const copyPath = () => {
        if (trackInfo?.path) {
            navigator.clipboard.writeText(trackInfo.path)
        }
    }

    // Initialize fields
    useEffect(() => {
        const initialFieldsObj: Record<string, string> = {}
        const initialSelected: Record<string, boolean> = {}

        const allKeys = [
            'title', 'artist', 'album', 'albumArtist', 'genre', 'year',
            'trackNum', 'trackTotal', 'discNum', 'discTotal',
            'composer', 'publisher', 'conductor', 'grouping', 'lyricist', 'arranger',
            'comment', 'lyrics', 'bpm', 'tempo', 'mood', 'occasion', 'keywords', 'language',
            'originalArtist', 'originalAlbum', 'originalYear', 'albumRating', 'rating', 'loved',
            // Utgivningsfält
            'catalogNumber', 'barcode', 'isrc', 'media', 'script',
            'releaseCountry', 'releaseStatus', 'releaseType',
            // Sortering
            'artistSortOrder', 'albumArtistSortOrder',
            // MusicBrainz IDs
            'musicbrainzTrackId', 'musicbrainzAlbumId', 'musicbrainzArtistId',
            'musicbrainzReleaseGroupId', 'musicbrainzRecordingId',
            // Custom-fält
            'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
            'custom6', 'custom7', 'custom8', 'custom9', 'custom10',
            'custom11', 'custom12', 'custom13', 'custom14', 'custom15',
            'custom16', 'custom17', 'custom18', 'custom19', 'custom20',
        ]

        const currentTracks = isMulti ? tracks : [tracks[currentIndex]]

        allKeys.forEach(key => {
            const values = currentTracks.map(t => {
                const val = (t as any)[key]
                if (key === 'loved') return val ? '1' : '0'
                return String(val || '')
            })
            const uniqueValues = Array.from(new Set(values))

            if (uniqueValues.length === 1) {
                initialFieldsObj[key] = uniqueValues[0]
            } else {
                initialFieldsObj[key] = '<mixed values>'
            }

            initialSelected[key] = !isMulti
        })

        setFields(initialFieldsObj)
        setInitialFields({ ...initialFieldsObj })
        setSelectedFields(initialSelected)
        setEditedTracks(tracks) // Initialize editedTracks with the original tracks
    }, [tracks, isMulti, currentIndex])

    const handleFieldChange = (key: string, value: string) => {
        setFields(prev => ({ ...prev, [key]: value }))
        if (isMulti) {
            setSelectedFields(prev => ({ ...prev, [key]: true }))
        }
    }

    const toggleFieldSelection = (key: string) => {
        setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const metadata: any = {}
            Object.keys(selectedFields).forEach(key => {
                if (selectedFields[key]) {
                    let value = fields[key]
                    if (value === '<mixed values>') return // Don't save mixed values string

                    // Type conversion
                    if (['year', 'trackNum', 'trackTotal', 'discNum', 'discTotal', 'bpm'].includes(key)) {
                        metadata[key] = value ? parseInt(value, 10) : null
                    } else {
                        metadata[key] = value || null
                    }
                }
            })

            const options = {
                metadata,
                artwork: {
                    ...artworkSettings,
                    pending: pendingArtwork
                }
            }

            if (isMulti) {
                const trackIds = tracks.map(t => t.id)
                await client.bulkUpdateTracks(trackIds, options)
            } else {
                await client.updateTrack(tracks[0].id, options)
            }

            await initialize()
            onClose()
        } catch (error) {
            console.error('Failed to save tags:', error)
            alert('Failed to save tags. See console for details.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleUndo = () => {
        setFields({ ...initialFields })
    }

    const handleAutoTag = async () => {
        const track = isMulti ? tracks[0] : tracks[currentIndex]
        if (!track.title || !track.artist) {
            alert("A Title and an Artist are required to search MusicBrainz.")
            return
        }

        setShowTaggingModal(true)
    }

    const handleTaggingSave = async (_id: string, metadata: any, type: 'track' | 'album') => {
        // Map the results from MusicBrainz to the tag editor form instead of saving to DB
        const newFields = { ...fields }
        const newSelected = { ...selectedFields }

        const mapField = (key: string, value: any) => {
            if (value && String(value).trim() !== '') {
                newFields[key] = String(value)
                newSelected[key] = true
            }
        }

        if (type === 'track') {
            mapField('title', metadata.title)
            mapField('trackNum', metadata.trackNum)
        }

        if (type === 'album') {
            mapField('album', metadata.title) // MB API returns album title here
        } else {
            mapField('album', metadata.album)
        }

        mapField('artist', metadata.artist)
        mapField('albumArtist', metadata.albumArtist || metadata.artist) // Falback to artist if no album artist
        mapField('year', metadata.year || metadata.releaseDate?.substring(0, 4))
        mapField('genre', metadata.genre)
        mapField('trackTotal', metadata.trackCount)
        mapField('discNum', metadata.discNum)
        mapField('discTotal', metadata.discCount)
        mapField('publisher', metadata.label)
        mapField('composer', metadata.composer)
        mapField('lyricist', metadata.lyricist)
        mapField('arranger', metadata.arranger)
        mapField('conductor', metadata.conductor)
        mapField('grouping', metadata.grouping)
        mapField('mixer', metadata.mixer)
        // Utgivning
        mapField('catalogNumber', metadata.catalogNumber)
        mapField('barcode', metadata.barcode)
        mapField('isrc', metadata.isrc)
        mapField('media', metadata.media)
        mapField('script', metadata.script)
        mapField('language', metadata.language)
        mapField('releaseCountry', metadata.country)
        mapField('releaseStatus', metadata.releaseStatus)
        mapField('releaseType', metadata.releaseType)
        // Sortering
        mapField('artistSortOrder', metadata.artistSortOrder)
        mapField('albumArtistSortOrder', metadata.albumArtistSortOrder)
        // Totaler
        mapField('trackTotal', metadata.trackCount || metadata.totalTracks)
        mapField('discNum', metadata.discNum)
        mapField('discTotal', metadata.discCount)
        // MusicBrainz IDs
        if (type === 'track') {
            mapField('musicbrainzTrackId', metadata.id)
            mapField('musicbrainzRecordingId', metadata.id)
            if (metadata.albumId) mapField('musicbrainzAlbumId', metadata.albumId)
        } else {
            mapField('musicbrainzAlbumId', metadata.id)
        }
        if (metadata.artistId) mapField('musicbrainzArtistId', metadata.artistId)
        if (metadata.releaseGroupId) mapField('musicbrainzReleaseGroupId', metadata.releaseGroupId)
        if (metadata.artistMbid) mapField('musicbrainzArtistId', metadata.artistMbid)

        setFields(newFields)
        if (isMulti) {
            setSelectedFields(newSelected)
        }
        setShowTaggingModal(false)
        setShowSuccessToast(true)
        setTimeout(() => setShowSuccessToast(false), 4000)

        // If it got artwork, parse it into pending
        if (metadata.coverArt) {
            try {
                // Fetch the image to get a data URL so we can preview it
                const res = await fetch(metadata.coverArt)
                const blob = await res.blob()
                const reader = new FileReader()
                reader.onloadend = () => {
                    setPendingArtwork(prev => ({
                        ...prev,
                        front: { data: reader.result as string, type: blob.type }
                    }))
                }
                reader.readAsDataURL(blob)
            } catch (e) {
                console.error("Failed to load cover art from MusicBrainz", e)
            }
        }
    }

    const goToPrevious = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
    }

    const goToNext = () => {
        if (currentIndex < tracks.length - 1) setCurrentIndex(currentIndex + 1)
    }

    const renderRating = (key: 'rating' | 'albumRating', label: string) => {
        const rating = parseInt(fields[key] || '0', 10)
        return (
            <div className="flex flex-col gap-1 mb-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">{label}</label>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => handleFieldChange(key, star.toString())}
                            className={cn(
                                "transition-colors",
                                star <= rating ? "text-yellow-500" : "text-zinc-700 hover:text-zinc-500"
                            )}
                        >
                            <Star size={18} fill={star <= rating ? "currentColor" : "none"} />
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    const renderField = (label: string, key: string, type: string = 'text', placeholder: string = '', mbType?: 'recording' | 'release' | 'artist', width?: string, labelWidth: string = "w-28") => {
        const isSelected = selectedFields[key]
        const value = fields[key]
        const isMixed = value === '<mixed values>'

        const openMB = () => {
            if (!value || isMixed) return
            let url = ''

            // Check if it's already a valid MBID format (8-4-4-4-12)
            const mbidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (mbidRegex.test(value)) {
                url = `https://musicbrainz.org/${mbType}/${value}`
            } else {
                // Search instead
                url = `https://musicbrainz.org/search?query=${encodeURIComponent(value)}&type=${mbType}&method=indexed`
            }
            window.open(url, '_blank')
        }

        return (
            <div key={key} className={cn("flex items-center gap-3 mb-2 last:mb-0", width)}>
                {label && (
                    <div className={cn("flex items-center gap-2 flex-shrink-0", labelWidth)}>
                        {isMulti && (
                            <button
                                onClick={() => toggleFieldSelection(key)}
                                className={cn(
                                    "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors",
                                    isSelected ? "bg-blue-600 border-blue-600" : "bg-zinc-800 border-zinc-700"
                                )}
                            >
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                            </button>
                        )}
                        <label className={cn(
                            "text-[9px] font-black uppercase tracking-widest transition-colors",
                            !isSelected && isMulti ? "text-zinc-300" : "text-zinc-300"
                        )}>
                            {label}
                        </label>
                    </div>
                )}
                <div className="flex-1 flex gap-2">
                    <input
                        type={type}
                        value={isMixed ? '' : (value || '')}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        disabled={!isSelected && isMulti}
                        placeholder={isMixed ? 'Mixed values' : placeholder}
                        className={cn(
                            "w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-zinc-600",
                            isMixed && "italic text-zinc-400 placeholder:text-zinc-400",
                            !isSelected && isMulti && "text-zinc-400 bg-zinc-900/80 border-zinc-800 cursor-not-allowed"
                        )}
                        onFocus={() => {
                            if (isMixed) {
                                setFields(prev => ({ ...prev, [key]: '' }))
                                setSelectedFields(prev => ({ ...prev, [key]: true }))
                            }
                        }}
                    />
                    {mbType && value && !isMixed && (
                        <div className="flex gap-1 flex-shrink-0">
                            <button
                                onClick={() => {
                                    const mbid = key === 'title' ? fields['musicbrainzTrackId'] : key === 'artist' ? fields['musicbrainzArtistId'] : key === 'album' ? fields['musicbrainzAlbumId'] : undefined
                                    if (mbid) {
                                        navigator.clipboard.writeText(mbid)
                                        setCopiedField(key)
                                        setTimeout(() => setCopiedField(null), 2000)
                                    } else {
                                        alert("No MusicBrainz ID available for this field.")
                                    }
                                }}
                                title="Copy MusicBrainz ID"
                                className="w-7 flex-shrink-0 flex items-center justify-center bg-zinc-800/50 border border-zinc-700/50 rounded hover:bg-zinc-700 hover:text-emerald-400 transition-colors text-zinc-500"
                            >
                                {copiedField === key ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                            <button
                                onClick={openMB}
                                title={`Search on MusicBrainz`}
                                disabled={!value || isMixed}
                                className="w-7 flex-shrink-0 flex items-center justify-center bg-zinc-800/50 border border-zinc-700/50 rounded hover:bg-zinc-700 hover:text-blue-400 transition-colors disabled:opacity-30 disabled:hover:bg-zinc-800/50 disabled:hover:text-zinc-500 text-zinc-500"
                            >
                                <ExternalLink size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const handleArtworkUpload = async (type: 'front' | 'back') => {
        try {
            console.log(`🖼️ Uploading ${type} artwork via native dialog...`)
            const { path: filePath } = await client.browseNative('file')
            console.log(`📄 Native dialog result: ${filePath}`)
            if (!filePath) return

            // Convert file to base64 for preview
            const response = await fetch(`file://${filePath}`)
            const blob = await response.blob()
            const reader = new FileReader()
            reader.onloadend = () => {
                setPendingArtwork(prev => ({
                    ...prev,
                    [type]: { data: reader.result as string, type: blob.type }
                }))
            }
            reader.readAsDataURL(blob)
        } catch (err) {
            console.error('Failed to upload artwork:', err)
        }
    }

    const handlePaste = (e: React.ClipboardEvent, type: 'front' | 'back') => {
        const item = e.clipboardData.items[0]
        if (item?.type.includes('image')) {
            const blob = item.getAsFile()
            if (blob) {
                const reader = new FileReader()
                reader.onloadend = () => {
                    setPendingArtwork(prev => ({
                        ...prev,
                        [type]: { data: reader.result as string, type: blob.type }
                    }))
                }
                reader.readAsDataURL(blob)
            }
        }
    }

    const handleDrop = (e: React.DragEvent, type: 'front' | 'back') => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file?.type.includes('image')) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setPendingArtwork(prev => ({
                    ...prev,
                    [type]: { data: reader.result as string, type: file.type }
                }))
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none">
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] pointer-events-auto absolute"
                style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 cursor-move select-none"
                    onMouseDown={onDragStart}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                            <Music className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {isAlbumContext ? `Edit Album Info` : isMulti ? `Edit Tags (${tracks.length} tracks)` : 'Edit Tag Info'}
                            </h2>
                            {!isMulti && !isAlbumContext && (
                                <p className="text-xs text-zinc-500 font-medium truncate max-w-[400px]">
                                    {tracks[0].title} - {tracks[0].artist}
                                </p>
                            )}
                            {isAlbumContext && (
                                <p className="text-xs text-zinc-500 font-medium truncate max-w-[400px]">
                                    {tracks[0].album} - {tracks[0].albumArtist || tracks[0].artist}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {showSuccessToast && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-center gap-3 shrink-0"
                    >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-100">
                            MusicBrainz tags applied! Review and click Save Changes.
                        </span>
                    </motion.div>
                )}

                {/* Tabs */}
                <div className="flex px-6 border-b border-zinc-800 bg-zinc-900/30">
                    <button
                        onClick={() => setActiveTab('tags')}
                        className={cn(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                            activeTab === 'tags' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Tags
                        {activeTab === 'tags' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('extended')}
                        className={cn(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                            activeTab === 'extended' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Extended
                        {activeTab === 'extended' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('artwork')}
                        className={cn(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                            activeTab === 'artwork' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Artwork
                        {activeTab === 'artwork' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('info')}
                        className={cn(
                            "px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                            activeTab === 'info' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        File Info
                        {activeTab === 'info' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-zinc-900/20">
                    {activeTab === 'tags' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-8">
                            {/* Left Column: Artwork & Ratings */}
                            <div className="w-48 flex flex-shrink-0 flex-col gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Artwork</label>
                                    <div className="w-48 h-48 bg-zinc-800 rounded-lg border border-zinc-800 overflow-hidden shadow-xl ring-1 ring-white/5 group relative">
                                        {pendingArtwork.front ? (
                                            <img src={pendingArtwork.front.data} className="w-full h-full object-cover" alt="Front Preview" />
                                        ) : editedTracks[currentIndex] ? (
                                            <img src={client.getCoverUrl(getResolvedAlbumId(editedTracks[currentIndex]))} className="w-full h-full object-cover" alt="Front Cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50">
                                                <ImageIcon size={40} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                            <button onClick={() => setActiveTab('artwork')} className="px-3 py-1.5 bg-blue-600 text-[10px] font-bold text-white rounded-full shadow-lg">Change</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                                    {renderRating('rating' as any, 'Song Rating')}
                                    {renderRating('albumRating' as any, 'Album Rating')}

                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Loved</label>
                                        <button
                                            onClick={() => handleFieldChange('loved', fields['loved'] === '1' ? '0' : '1')}
                                            className={cn(
                                                "p-2 rounded-full transition-all",
                                                fields['loved'] === '1' ? "bg-red-500/10 text-red-500" : "text-zinc-700 hover:text-zinc-500"
                                            )}
                                        >
                                            <Heart className="w-5 h-5" fill={fields['loved'] === '1' ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4">
                                    <button
                                        onClick={handleAutoTag}
                                        disabled={isSaving}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-700 transition-all group disabled:opacity-50"
                                        title="Lookup info from MusicBrainz. This is a safe preview - no changes are made unless you click 'Save Changes'."
                                    >
                                        <Wand2 size={12} className="group-hover:text-blue-400 transition-colors" />
                                        Auto-Tag
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Main Fields */}
                            <div className="flex-1 space-y-6">
                                <section className="grid grid-cols-2 gap-x-6 gap-y-1">
                                    <div className="col-span-2">
                                        {renderField('Title', 'title', 'text', '', 'recording', 'w-full', 'w-24')}
                                    </div>
                                    <div className="col-span-2">
                                        {renderField('Artist', 'artist', 'text', '', 'artist', 'w-full', 'w-24')}
                                    </div>
                                    <div className="col-span-2">
                                        {renderField('Album', 'album', 'text', '', 'release', 'w-full', 'w-24')}
                                    </div>
                                    <div className="col-span-2">
                                        {renderField('Album Artist', 'albumArtist', 'text', '', 'artist', 'w-full', 'w-24')}
                                    </div>
                                </section>

                                <div className="h-px bg-zinc-800/50" />

                                <section className="grid grid-cols-2 gap-x-6 gap-y-1">
                                    <div className="col-span-2">
                                        {renderField('Genre', 'genre', 'text', '', undefined, 'w-full', 'w-24')}
                                    </div>
                                    <div className="col-span-2">
                                        {renderField('Year', 'year', 'number', '', undefined, 'w-full', 'w-24')}
                                    </div>

                                    <div className="flex items-center gap-3 mb-2 last:mb-0">
                                        <div className="w-24 flex items-center gap-2 flex-shrink-0">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Track #</label>
                                        </div>
                                        <div className="flex-1 flex items-center gap-2">
                                            {renderField('', 'trackNum', 'number', '#', undefined, 'mb-0', 'w-0')}
                                            <span className="text-[9px] font-black text-zinc-700">of</span>
                                            {renderField('', 'trackTotal', 'number', 'Total', undefined, 'mb-0', 'w-0')}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mb-2 last:mb-0">
                                        <div className="w-24 flex items-center gap-2 flex-shrink-0">
                                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Disc #</label>
                                        </div>
                                        <div className="flex-1 flex items-center gap-2">
                                            {renderField('', 'discNum', 'number', '#', undefined, 'mb-0', 'w-0')}
                                            <span className="text-[9px] font-black text-zinc-700">of</span>
                                            {renderField('', 'discTotal', 'number', 'Total', undefined, 'mb-0', 'w-0')}
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-zinc-800/50" />

                                <section className="grid grid-cols-2 gap-x-6 gap-y-1">
                                    {renderField('Composer', 'composer', 'text', '', 'artist', 'w-full', 'w-24')}
                                    {renderField('Publisher', 'publisher', 'text', '', undefined, 'w-full', 'w-24')}
                                    {renderField('Conductor', 'conductor', 'text', '', undefined, 'w-full', 'w-24')}
                                    {renderField('Grouping', 'grouping', 'text', '', undefined, 'w-full', 'w-24')}
                                </section>

                                <div className="h-px bg-zinc-800/50" />

                                <section>
                                    <div className="flex items-center gap-2 mb-2">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Comment</label>
                                    </div>
                                    <textarea
                                        value={fields['comment']}
                                        onChange={(e) => handleFieldChange('comment', e.target.value)}
                                        disabled={!selectedFields['comment'] && isMulti}
                                        className="w-full bg-zinc-800/30 border border-zinc-800 rounded px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-none"
                                        placeholder="Add comment..."
                                    />
                                </section>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'extended' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <section>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    Original Information
                                    <div className="h-px flex-1 bg-zinc-800" />
                                </h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                    {renderField('Orig. Artist', 'originalArtist', 'text', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Orig. Album', 'originalAlbum', 'text', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Orig. Year', 'originalYear', 'number', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Tempo', 'tempo', 'text', '', undefined, 'w-full', 'w-32')}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    Categorization
                                    <div className="h-px flex-1 bg-zinc-800" />
                                </h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                    {renderField('Mood', 'mood', 'text', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Occasion', 'occasion', 'text', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Keywords', 'keywords', 'text', '', undefined, 'w-full', 'w-32')}
                                    {renderField('Language', 'language', 'text', '', undefined, 'w-full', 'w-32')}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    Custom Fields
                                    <div className="h-px flex-1 bg-zinc-800" />
                                </h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-1 h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        renderField(`Custom ${i + 1}`, `custom${i + 1}`, 'text', '', undefined, 'w-full', 'w-32')
                                    ))}
                                </div>
                            </section>

                            <section className="pt-4 mt-4 border-t border-zinc-800">
                                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Lyrics</h3>
                                <textarea
                                    value={fields['lyrics']}
                                    onChange={(e) => handleFieldChange('lyrics', e.target.value)}
                                    disabled={!selectedFields['lyrics'] && isMulti}
                                    className="w-full bg-zinc-800/30 border border-zinc-800 rounded px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[120px] font-mono"
                                    placeholder="Enter lyrics..."
                                />
                            </section>
                        </motion.div>
                    )}

                    {activeTab === 'artwork' && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex flex-col gap-8"
                        >
                            <div className="flex justify-center gap-8">
                                <div className="flex flex-col items-center gap-3">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Front Cover</span>
                                    <div
                                        onClick={() => handleArtworkUpload('front')}
                                        onPaste={(e) => handlePaste(e, 'front')}
                                        onDrop={(e) => handleDrop(e, 'front')}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="w-48 h-48 bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 group hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden shadow-lg"
                                    >
                                        {pendingArtwork.front ? (
                                            <>
                                                <img src={pendingArtwork.front.data} className="w-full h-full object-cover" alt="Front Preview" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Trash2 className="text-white hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); setPendingArtwork(p => ({ ...p, front: undefined })) }} />
                                                </div>
                                            </>
                                        ) : editedTracks[currentIndex] ? (
                                            <img
                                                src={client.getCoverUrl(getResolvedAlbumId(editedTracks[currentIndex]))}
                                                className="w-full h-full object-cover"
                                                alt="Current Front Cover"
                                            />
                                        ) : (
                                            <>
                                                <ImageIcon className="w-10 h-10 text-zinc-600 group-hover:text-blue-500 transition-colors" />
                                                <p className="text-[10px] text-zinc-500 text-center px-4 group-hover:text-blue-400">Click, Paste or Drop Front</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Back Cover</span>
                                    <div
                                        onClick={() => handleArtworkUpload('back')}
                                        onPaste={(e) => handlePaste(e, 'back')}
                                        onDrop={(e) => handleDrop(e, 'back')}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="w-48 h-48 bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 group hover:border-emerald-500 transition-colors cursor-pointer relative overflow-hidden shadow-lg"
                                    >
                                        {pendingArtwork.back ? (
                                            <>
                                                <img src={pendingArtwork.back.data} className="w-full h-full object-cover" alt="Back Preview" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Trash2 className="text-white hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); setPendingArtwork(p => ({ ...p, back: undefined })) }} />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="w-10 h-10 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                                                <p className="text-[10px] text-zinc-500 text-center px-4 group-hover:text-emerald-400">Click, Paste or Drop Back</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-6 space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Settings2 className="w-4 h-4 text-zinc-500" />
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Saving Options</span>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div
                                                onClick={() => setArtworkSettings(s => ({ ...s, embed: !s.embed }))}
                                                className={cn(
                                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-inner",
                                                    artworkSettings.embed ? "bg-blue-600 border-blue-600" : "bg-zinc-900 border-zinc-700 group-hover:border-zinc-500"
                                                )}
                                            >
                                                {artworkSettings.embed && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-300">Embed in files</span>
                                                <span className="text-[10px] text-zinc-500">Store image directly in track metadata</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div
                                                onClick={() => setArtworkSettings(s => ({ ...s, saveToFile: !s.saveToFile }))}
                                                className={cn(
                                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-inner",
                                                    artworkSettings.saveToFile ? "bg-emerald-600 border-emerald-600" : "bg-zinc-900 border-zinc-700 group-hover:border-zinc-500"
                                                )}
                                            >
                                                {artworkSettings.saveToFile && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-300">Save to folder</span>
                                                <span className="text-[10px] text-zinc-500">Save as separate file in track directory</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className={cn("space-y-2 transition-opacity", !artworkSettings.saveToFile && "opacity-30 pointer-events-none")}>
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Standard Filename</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={artworkSettings.fileName}
                                                onChange={(e) => setArtworkSettings(s => ({ ...s, fileName: e.target.value }))}
                                                className="bg-zinc-900/50 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                                                placeholder="e.g. cover"
                                            />
                                            <div className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-[10px] text-zinc-500 flex items-center">
                                                .jpg
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    )}

                    {activeTab === 'info' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 max-h-full pr-4 custom-scrollbar">
                            {infoLoading ? (
                                <div className="text-zinc-400 text-sm py-10 flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-500 rounded-full animate-spin" />
                                    Loading file information...
                                </div>
                            ) : infoError ? (
                                <div className="text-red-400 text-sm text-center py-10">{infoError}</div>
                            ) : trackInfo ? (
                                <div className="space-y-6">
                                    {/* Path Container */}
                                    <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-4 shadow-inner">
                                        <div className="flex items-center gap-2 mb-2">
                                            <HardDrive size={14} className="text-zinc-500" />
                                            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">File Location</div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1 text-xs text-zinc-300 font-mono break-all whitespace-pre-wrap select-text leading-relaxed">
                                                {trackInfo.path}
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button onClick={copyPath} title="Copy Path" className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors border border-zinc-800 hover:border-zinc-700">
                                                    <Copy size={14} />
                                                </button>
                                                <button onClick={openPath} title="Open in Explorer" className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors border border-zinc-800 hover:border-zinc-700">
                                                    <ExternalLink size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Data Grid */}
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 bg-zinc-800/20 p-6 rounded-xl border border-zinc-800/50">
                                        <InfoField label="Title" value={tracks[currentIndex].title} />
                                        <InfoField label="Artist" value={trackInfo.artist} />
                                        <InfoField label="Album Artist" value={trackInfo.albumArtist} />
                                        <InfoField label="Album" value={tracks[currentIndex].album} />

                                        <div className="col-span-2 h-px bg-zinc-800/50 my-1" />

                                        <InfoField label="Release Year" value={trackInfo.releaseYear} />
                                        <InfoField label="Disc" value={trackInfo.discTotal ? `${trackInfo.disc || '-'} / ${trackInfo.discTotal}` : trackInfo.disc} />
                                        <InfoField label="Track" value={trackInfo.trackTotal ? `${trackInfo.trackNum || '-'} / ${trackInfo.trackTotal}` : trackInfo.trackNum} />
                                        <InfoField label="Duration" value={trackInfo.duration ? formatDuration(trackInfo.duration) : '-'} />
                                        <InfoField label="Genres" value={trackInfo.genres} className="col-span-2" />

                                        <div className="col-span-2 h-px bg-zinc-800/50 my-1" />

                                        <InfoField label="Codec" value={trackInfo.codec ? trackInfo.codec.toUpperCase() : '-'} />
                                        <InfoField label="Bitrate" value={trackInfo.bitrate ? `${Math.round(trackInfo.bitrate / 1000)} kbps` : '-'} />
                                        <InfoField label="Sample Rate" value={trackInfo.sampleRate ? `${trackInfo.sampleRate} Hz` : '-'} />
                                        <InfoField label="Bit Depth" value={trackInfo.bitDepth ? `${trackInfo.bitDepth} bit` : '-'} />
                                        <InfoField label="Channels" value={trackInfo.channels} />
                                        <InfoField label="Size" value={formatSize(trackInfo.size)} />

                                        <div className="col-span-2 h-px bg-zinc-800/50 my-1" />

                                        <InfoField label="Composer" value={trackInfo.composer} className="col-span-2" />
                                        <InfoField label="Lyricist" value={trackInfo.lyricist} className="col-span-2" />
                                        <InfoField label="Producer" value={trackInfo.producer} className="col-span-2" />
                                        <InfoField label="Compilation" value={trackInfo.isCompilation ? 'Yes' : 'No'} />
                                        <InfoField label="ISRC" value={trackInfo.isrc} />
                                        <InfoField label="Record Label" value={trackInfo.recordLabel} />
                                        <InfoField label="Media" value={trackInfo.media} />
                                        <InfoField label="Release Country" value={trackInfo.releaseCountry} />
                                        <InfoField label="Release Status" value={trackInfo.releaseStatus} />
                                        <InfoField label="Release Type" value={trackInfo.releaseType} />

                                        <InfoField
                                            label="MusicBrainz ID"
                                            value={trackInfo.musicbrainzId}
                                            className="col-span-2"
                                            valueClass="font-mono text-[10px]"
                                        />

                                        <div className="col-span-2 h-px bg-zinc-800/50 my-1" />

                                        <InfoField label="Rating" value={trackInfo.rating > 0 ? `${trackInfo.rating} / 5` : 'Unrated'} />
                                        <InfoField label="Playcount" value={trackInfo.playcount} />
                                        <InfoField label="Loved" value={trackInfo.favorites ? 'Yes' : 'No'} />
                                        <InfoField label="Modified" value={trackInfo.modified ? new Date(trackInfo.modified).toLocaleString('sv-SE') : '-'} />
                                    </div>
                                </div>
                            ) : null}
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                            <button
                                onClick={goToPrevious}
                                disabled={currentIndex === 0 || isMulti}
                                className="p-2 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-zinc-400 transition-all"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={goToNext}
                                disabled={currentIndex === tracks.length - 1 || isMulti}
                                className="p-2 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-zinc-400 transition-all"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <div className="h-6 w-px bg-zinc-800" />
                        <div className="flex items-center gap-2 text-zinc-500">
                            {isMulti ? (
                                <>
                                    <CheckSquare className="w-4 h-4 text-blue-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                        {Object.keys(selectedFields).filter(key =>
                                            selectedFields[key] && !key.startsWith('musicbrainz') && key !== 'trackTotal' && key !== 'discTotal'
                                        ).length} fields to update / {tracks.length} files to update
                                    </span>
                                </>
                            ) : (
                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                    Track {currentIndex + 1} of {tracks.length}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-all"
                        >
                            <RotateCcw size={14} />
                            Undo
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={cn(
                                "px-8 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-blue-900/20 hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2",
                                isSaving && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {showTaggingModal && (
                <TaggingModal
                    isOpen={showTaggingModal}
                    onClose={() => setShowTaggingModal(false)}
                    item={isMulti ? tracks[0] : tracks[currentIndex]}
                    itemType={isAlbumContext || isMulti ? 'album' : 'track'}
                    onSave={handleTaggingSave}
                />
            )}
        </div>
    )
}

function InfoField({ label, value, className, valueClass }: { label: string, value: any, className?: string, valueClass?: string }) {
    if (value === undefined || value === null || value === '') return null
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
            <span className={cn("text-[11px] text-zinc-300 select-text font-medium leading-relaxed", valueClass)}>{String(value)}</span>
        </div>
    )
}
