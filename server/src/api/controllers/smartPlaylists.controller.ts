import { Request, Response } from 'express'
import {
    ensureSmartPlaylistsTable,
    getAllSmartPlaylists,
    getSmartPlaylistById,
    createSmartPlaylist,
    updateSmartPlaylist,
    deleteSmartPlaylist,
    resolveSmartPlaylistTracks,
    SmartPlaylist,
} from '../../database/smartPlaylists'
import { getDatabase } from '../../database'

// Ensure table exists on first import
ensureSmartPlaylistsTable()

function dbTrackToTrack(t: any) {
    return {
        id: t.id,
        title: t.title || '',
        artist: t.artist || '',
        album: t.album || '',
        albumArtist: t.album_artist || undefined,
        year: t.year || undefined,
        genre: t.genre || undefined,
        trackNum: t.track_num || undefined,
        discNum: t.disc_num || undefined,
        duration: t.duration || 0,
        bitrate: t.bitrate || undefined,
        sampleRate: t.sample_rate || undefined,
        bitDepth: t.bit_depth || undefined,
        format: t.format || 'flac',
        filePath: t.file_path,
        coverArtPath: t.cover_art_path || undefined,
        rating: t.rating || 0,
        loved: !!t.loved,
        playCount: t.play_count || 0,
        lastPlayed: t.last_played || undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        mood: t.mood || undefined,
    }
}

export const getAll = (_req: Request, res: Response) => {
    try {
        const playlists = getAllSmartPlaylists()
        res.json(playlists)
    } catch (err) {
        console.error('getAll smart playlists error:', err)
        res.status(500).json({ error: 'Failed to get smart playlists' })
    }
}

export const getById = (req: Request, res: Response) => {
    try {
        const sp = getSmartPlaylistById(req.params.id as string)
        if (!sp) return res.status(404).json({ error: 'Not found' })
        res.json(sp)
    } catch (err) {
        res.status(500).json({ error: 'Failed to get smart playlist' })
    }
}

export const create = (req: Request, res: Response) => {
    try {
        const { name, description, matchMode, rules, limitCount, limitRandom, sortField, sortOrder } = req.body
        if (!name) return res.status(400).json({ error: 'Name is required' })

        const sp = createSmartPlaylist({
            name,
            description,
            matchMode: matchMode || 'all',
            rules: rules || [],
            limitCount: limitCount || undefined,
            limitRandom: !!limitRandom,
            sortField: sortField || 'title',
            sortOrder: sortOrder || 'asc',
        })
        res.status(201).json(sp)
    } catch (err) {
        console.error('create smart playlist error:', err)
        res.status(500).json({ error: 'Failed to create smart playlist' })
    }
}

export const update = (req: Request, res: Response) => {
    try {
        const ok = updateSmartPlaylist(req.params.id as string, req.body)
        if (!ok) return res.status(404).json({ error: 'Not found' })
        const updated = getSmartPlaylistById(req.params.id as string)
        res.json(updated)
    } catch (err) {
        res.status(500).json({ error: 'Failed to update smart playlist' })
    }
}

export const remove = (req: Request, res: Response) => {
    try {
        const ok = deleteSmartPlaylist(req.params.id as string)
        if (!ok) return res.status(404).json({ error: 'Not found' })
        res.json({ ok: true })
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete smart playlist' })
    }
}

export const resolve = (req: Request, res: Response) => {
    try {
        const sp = getSmartPlaylistById(req.params.id as string)
        if (!sp) return res.status(404).json({ error: 'Not found' })
        const rawTracks = resolveSmartPlaylistTracks(sp)
        const tracks = rawTracks.map(dbTrackToTrack)
        res.json({ tracks, total: tracks.length })
    } catch (err) {
        console.error('resolve smart playlist error:', err)
        res.status(500).json({ error: 'Failed to resolve smart playlist' })
    }
}

export const preview = (req: Request, res: Response) => {
    try {
        const { matchMode, rules, limitCount, limitRandom, sortField, sortOrder } = req.body
        const tempSp: SmartPlaylist = {
            id: 'preview',
            name: 'preview',
            matchMode: matchMode || 'all',
            rules: rules || [],
            limitCount: limitCount || undefined,
            limitRandom: !!limitRandom,
            sortField: sortField || 'title',
            sortOrder: sortOrder || 'asc',
            createdAt: '',
            updatedAt: '',
        }
        const rawTracks = resolveSmartPlaylistTracks(tempSp)
        const tracks = rawTracks.slice(0, 10).map(dbTrackToTrack)
        res.json({ tracks, total: rawTracks.length })
    } catch (err) {
        console.error('preview smart playlist error:', err)
        res.status(500).json({ error: 'Failed to preview', detail: String(err) })
    }
}
