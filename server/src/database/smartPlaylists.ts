import { getDatabase } from './index'
import { v4 as uuidv4 } from 'uuid'

export type RuleField =
    | 'title' | 'artist' | 'album' | 'genre' | 'year'
    | 'rating' | 'loved' | 'play_count' | 'last_played' | 'created_at'
    | 'duration' | 'format' | 'bitrate' | 'bit_depth' | 'sample_rate'
    | 'bpm' | 'mood'

export type RuleOperator =
    | 'eq' | 'neq'
    | 'contains' | 'not_contains' | 'starts_with'
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'between'
    | 'is_true' | 'is_false'
    | 'in_last_days' | 'not_in_last_days' | 'never'
    | 'is_flac' | 'is_mp3'

export interface PlaylistRule {
    id: string
    field: RuleField
    operator: RuleOperator
    value?: string | number
    value2?: string | number  // for 'between'
}

export interface SmartPlaylist {
    id: string
    name: string
    description?: string
    matchMode: 'all' | 'any'  // AND / OR
    rules: PlaylistRule[]
    limitCount?: number
    limitRandom: boolean
    sortField: string
    sortOrder: 'asc' | 'desc'
    trackCount?: number
    createdAt: string
    updatedAt: string
}

interface DbSmartPlaylist {
    id: string
    name: string
    description: string | null
    match_mode: string
    rules: string
    limit_count: number | null
    limit_random: number
    sort_field: string
    sort_order: string
    created_at: string
    updated_at: string
}

function dbToSmartPlaylist(row: DbSmartPlaylist): SmartPlaylist {
    return {
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        matchMode: (row.match_mode as 'all' | 'any') || 'all',
        rules: JSON.parse(row.rules || '[]'),
        limitCount: row.limit_count || undefined,
        limitRandom: !!row.limit_random,
        sortField: row.sort_field || 'title',
        sortOrder: (row.sort_order as 'asc' | 'desc') || 'asc',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function buildWhereClause(
    rules: PlaylistRule[],
    matchMode: 'all' | 'any'
): { sql: string; params: any[] } {
    if (!rules.length) return { sql: '1=1', params: [] }

    const parts: string[] = []
    const params: any[] = []

    for (const rule of rules) {
        const col = fieldToColumn(rule.field)
        if (!col) continue

        switch (rule.operator) {
            case 'eq':
                parts.push(`${col} = ?`)
                params.push(rule.value)
                break
            case 'neq':
                parts.push(`${col} != ?`)
                params.push(rule.value)
                break
            case 'contains':
                parts.push(`${col} LIKE ?`)
                params.push(`%${rule.value}%`)
                break
            case 'not_contains':
                parts.push(`(${col} NOT LIKE ? OR ${col} IS NULL)`)
                params.push(`%${rule.value}%`)
                break
            case 'starts_with':
                parts.push(`${col} LIKE ?`)
                params.push(`${rule.value}%`)
                break
            case 'gt':
                parts.push(`${col} > ?`)
                params.push(rule.value)
                break
            case 'gte':
                parts.push(`${col} >= ?`)
                params.push(rule.value)
                break
            case 'lt':
                parts.push(`${col} < ?`)
                params.push(rule.value)
                break
            case 'lte':
                parts.push(`${col} <= ?`)
                params.push(rule.value)
                break
            case 'between':
                parts.push(`${col} BETWEEN ? AND ?`)
                params.push(rule.value, rule.value2)
                break
            case 'is_true':
                parts.push(`${col} = 1`)
                break
            case 'is_false':
                parts.push(`(${col} = 0 OR ${col} IS NULL)`)
                break
            case 'in_last_days':
                parts.push(`${col} >= datetime('now', ? || ' days')`)
                params.push(`-${rule.value}`)
                break
            case 'not_in_last_days':
                parts.push(`(${col} < datetime('now', ? || ' days') OR ${col} IS NULL)`)
                params.push(`-${rule.value}`)
                break
            case 'never':
                parts.push(`${col} IS NULL`)
                break
            case 'is_flac':
                parts.push(`t.format = 'flac'`)
                break
            case 'is_mp3':
                parts.push(`t.format = 'mp3'`)
                break
        }
    }

    if (!parts.length) return { sql: '1=1', params: [] }
    const joiner = matchMode === 'any' ? ' OR ' : ' AND '
    return { sql: parts.join(joiner), params }
}

function fieldToColumn(field: RuleField): string | null {
    const map: Record<RuleField, string> = {
        title: 't.title',
        artist: 't.artist',
        album: 't.album',
        genre: 't.genre',
        year: 't.year',
        rating: 't.rating',
        loved: 't.loved',
        play_count: 't.play_count',
        last_played: 't.last_played',
        created_at: 't.created_at',
        duration: 't.duration',
        format: 't.format',
        bitrate: 't.bitrate',
        bit_depth: 't.bit_depth',
        sample_rate: 't.sample_rate',
        bpm: 'ab.bpm',
        mood: 'ab.mood_category',
    }
    return map[field] ?? null
}

function sortFieldToColumn(field: string): string {
    const map: Record<string, string> = {
        title: 't.title',
        artist: 't.artist',
        album: 't.album',
        year: 't.year',
        rating: 't.rating',
        play_count: 't.play_count',
        last_played: 't.last_played',
        created_at: 't.created_at',
        duration: 't.duration',
        bpm: 'ab.bpm',
        random: 'RANDOM()',
    }
    return map[field] ?? 't.title'
}

// ── Ensure table exists ─────────────────────────────────────────────────────
export function ensureSmartPlaylistsTable(): void {
    const db = getDatabase()
    db.exec(`
    CREATE TABLE IF NOT EXISTS smart_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      match_mode TEXT NOT NULL DEFAULT 'all',
      rules TEXT NOT NULL DEFAULT '[]',
      limit_count INTEGER,
      limit_random INTEGER NOT NULL DEFAULT 0,
      sort_field TEXT NOT NULL DEFAULT 'title',
      sort_order TEXT NOT NULL DEFAULT 'asc',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export function getAllSmartPlaylists(): SmartPlaylist[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM smart_playlists ORDER BY name ASC').all() as DbSmartPlaylist[]
    // Add resolved track count for each
    return rows.map((row) => {
        const sp = dbToSmartPlaylist(row)
        try {
            const resolved = resolveSmartPlaylistTracks(sp)
            sp.trackCount = resolved.length
        } catch {
            sp.trackCount = 0
        }
        return sp
    })
}

export function getSmartPlaylistById(id: string): SmartPlaylist | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM smart_playlists WHERE id = ?').get(id) as DbSmartPlaylist | undefined
    return row ? dbToSmartPlaylist(row) : null
}

export function createSmartPlaylist(data: Omit<SmartPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'trackCount'>): SmartPlaylist {
    const db = getDatabase()
    const id = uuidv4()
    const now = new Date().toISOString()
    db.prepare(`
    INSERT INTO smart_playlists (id, name, description, match_mode, rules, limit_count, limit_random, sort_field, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        id, data.name, data.description ?? null,
        data.matchMode, JSON.stringify(data.rules),
        data.limitCount ?? null, data.limitRandom ? 1 : 0,
        data.sortField, data.sortOrder,
        now, now
    )
    return { ...data, id, createdAt: now, updatedAt: now }
}

export function updateSmartPlaylist(id: string, data: Partial<Omit<SmartPlaylist, 'id' | 'createdAt' | 'updatedAt' | 'trackCount'>>): boolean {
    const db = getDatabase()
    const now = new Date().toISOString()
    const existing = getSmartPlaylistById(id)
    if (!existing) return false

    const merged = { ...existing, ...data }
    db.prepare(`
    UPDATE smart_playlists SET
      name = ?, description = ?, match_mode = ?, rules = ?,
      limit_count = ?, limit_random = ?, sort_field = ?, sort_order = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
        merged.name, merged.description ?? null,
        merged.matchMode, JSON.stringify(merged.rules),
        merged.limitCount ?? null, merged.limitRandom ? 1 : 0,
        merged.sortField, merged.sortOrder,
        now, id
    )
    return true
}

export function deleteSmartPlaylist(id: string): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM smart_playlists WHERE id = ?').run(id)
    return result.changes > 0
}

// ── Resolve logic — builds dynamic SQL from rules ────────────────────────────
export function resolveSmartPlaylistTracks(sp: SmartPlaylist): any[] {
    const db = getDatabase()
    const { sql: where, params } = buildWhereClause(sp.rules, sp.matchMode)

    const needsBpm = sp.rules.some((r) => r.field === 'bpm' || r.field === 'mood') || sp.sortField === 'bpm'
    const joinClause = needsBpm
        ? 'LEFT JOIN acousticbrainz_data ab ON ab.track_id = t.id'
        : 'LEFT JOIN acousticbrainz_data ab ON ab.track_id = t.id'

    const sortCol = sp.limitRandom ? 'RANDOM()' : `${sortFieldToColumn(sp.sortField)} ${sp.sortOrder.toUpperCase()}`
    const limitClause = sp.limitCount ? `LIMIT ${sp.limitCount}` : ''

    const query = `
    SELECT t.* FROM tracks t
    ${joinClause}
    WHERE ${where}
    ORDER BY ${sortCol}
    ${limitClause}
  `

    return db.prepare(query).all(...params)
}
