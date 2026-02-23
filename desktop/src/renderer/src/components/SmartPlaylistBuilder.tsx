import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X, Plus, Sparkles, Save } from 'lucide-react'
import { SmartPlaylist, PlaylistRule, RuleField, RuleOperator, useSmartPlaylists } from '../store/smartPlaylists'
import { Track } from '../types'
import { cn } from '../utils'

// ── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
    label: string
    group: string
    inputType: 'text' | 'number' | 'stars' | 'bool' | 'none' | 'days' | 'between_num' | 'select'
    operators: { value: RuleOperator; label: string }[]
    selectOptions?: { value: string; label: string }[]
}

const FIELD_DEFS: Record<RuleField, FieldDef> = {
    title: {
        label: 'Title', group: 'Metadata', inputType: 'text',
        operators: [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: "doesn't contain" }, { value: 'starts_with', label: 'starts with' }, { value: 'eq', label: 'is exactly' }]
    },
    artist: {
        label: 'Artist', group: 'Metadata', inputType: 'text',
        operators: [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: "doesn't contain" }, { value: 'eq', label: 'is exactly' }]
    },
    album: {
        label: 'Album', group: 'Metadata', inputType: 'text',
        operators: [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: "doesn't contain" }, { value: 'eq', label: 'is exactly' }]
    },
    genre: {
        label: 'Genre', group: 'Metadata', inputType: 'text',
        operators: [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: "doesn't contain" }, { value: 'eq', label: 'is exactly' }]
    },
    year: {
        label: 'Year', group: 'Metadata', inputType: 'number',
        operators: [{ value: 'eq', label: 'is' }, { value: 'gte', label: 'from' }, { value: 'lte', label: 'until' }, { value: 'between', label: 'between' }]
    },
    rating: {
        label: 'Rating', group: 'Rating & Love', inputType: 'stars',
        operators: [{ value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }, { value: 'eq', label: 'exactly' }]
    },
    loved: {
        label: 'Loved', group: 'Rating & Love', inputType: 'bool',
        operators: [{ value: 'is_true', label: 'is loved' }, { value: 'is_false', label: 'is not loved' }]
    },
    play_count: {
        label: 'Play count', group: 'Statistics', inputType: 'number',
        operators: [{ value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }, { value: 'eq', label: 'exactly' }, { value: 'never', label: 'never played' }]
    },
    last_played: {
        label: 'Last played', group: 'Statistics', inputType: 'days',
        operators: [{ value: 'in_last_days', label: 'in the last N days' }, { value: 'not_in_last_days', label: 'not in the last N days' }, { value: 'never', label: 'never' }]
    },
    created_at: {
        label: 'Date added', group: 'Statistics', inputType: 'days',
        operators: [{ value: 'in_last_days', label: 'in the last N days' }, { value: 'not_in_last_days', label: 'more than N days ago' }]
    },
    duration: {
        label: 'Duration (sec)', group: 'Audio', inputType: 'number',
        operators: [{ value: 'lte', label: 'shorter than' }, { value: 'gte', label: 'longer than' }, { value: 'between', label: 'between' }]
    },
    bitrate: {
        label: 'Bitrate (kbps)', group: 'Audio', inputType: 'number',
        operators: [{ value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }]
    },
    sample_rate: {
        label: 'Sample rate', group: 'Audio', inputType: 'number',
        operators: [{ value: 'eq', label: 'is' }, { value: 'gte', label: 'at least' }]
    },
    bit_depth: {
        label: 'Bit depth', group: 'Audio', inputType: 'number',
        operators: [{ value: 'eq', label: 'is' }]
    },
    format: {
        label: 'Format', group: 'Audio', inputType: 'none',
        operators: [{ value: 'is_flac', label: 'is FLAC' }, { value: 'is_mp3', label: 'is MP3' }]
    },
    bpm: {
        label: 'BPM', group: 'Audio', inputType: 'number',
        operators: [{ value: 'between', label: 'between' }, { value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }, { value: 'eq', label: 'exactly' }]
    },
    mood: {
        label: 'Mood', group: 'Audio', inputType: 'select',
        operators: [{ value: 'eq', label: 'is' }],
        selectOptions: [
            { value: 'energetic', label: 'Energetic' },
            { value: 'calm', label: 'Calm' },
            { value: 'dark', label: 'Dark' },
            { value: 'happy', label: 'Happy' },
            { value: 'sad', label: 'Sad' },
            { value: 'aggressive', label: 'Aggressive' },
            { value: 'acoustic', label: 'Acoustic' },
            { value: 'electronic', label: 'Electronic' },
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'party', label: 'Party' },
        ]
    },
}

const SORT_OPTIONS = [
    { value: 'title', label: 'Title (A–Z)' },
    { value: 'artist', label: 'Artist' },
    { value: 'album', label: 'Album' },
    { value: 'year', label: 'Year' },
    { value: 'rating', label: 'Rating (best first)' },
    { value: 'play_count', label: 'Most played' },
    { value: 'last_played', label: 'Last played' },
    { value: 'created_at', label: 'Recently added' },
    { value: 'duration', label: 'Duration' },
    { value: 'bpm', label: 'BPM' },
    { value: 'random', label: '🎲 Random' },
]

const GROUPS = ['Metadata', 'Rating & Love', 'Statistics', 'Audio']

// ── Sub-components ────────────────────────────────────────────────────────────

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(n)}
                    className={cn('text-lg transition-colors', (hover || value) >= n ? 'text-yellow-400' : 'text-zinc-700')}>
                    ★
                </button>
            ))}
        </div>
    )
}

function RuleRow({
    rule, onUpdate, onRemove,
}: {
    rule: PlaylistRule
    onUpdate: (r: PlaylistRule) => void
    onRemove: () => void
}) {
    const field = rule.field
    const def = FIELD_DEFS[field]
    const ops = def.operators

    // When field changes, reset operator and values
    const handleFieldChange = (f: RuleField) => {
        const newDef = FIELD_DEFS[f]
        onUpdate({ ...rule, field: f, operator: newDef.operators[0].value, value: undefined, value2: undefined })
    }

    // Group fields for dropdown
    const fieldOptions = GROUPS.flatMap((g) =>
        Object.entries(FIELD_DEFS)
            .filter(([_, d]) => d.group === g)
            .map(([key, d]) => ({ key: key as RuleField, label: d.label, group: g }))
    )

    const showInput = def.inputType !== 'none' && def.inputType !== 'bool'
        && rule.operator !== 'never' && rule.operator !== 'is_true' && rule.operator !== 'is_false'
        && rule.operator !== 'is_flac' && rule.operator !== 'is_mp3'

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Field selector */}
            <select value={field} onChange={(e) => handleFieldChange(e.target.value as RuleField)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                        {fieldOptions.filter((f) => f.group === g).map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                    </optgroup>
                ))}
            </select>

            {/* Operator selector */}
            <select value={rule.operator} onChange={(e) => onUpdate({ ...rule, operator: e.target.value as RuleOperator, value: undefined, value2: undefined })}
                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {ops.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>

            {/* Value input */}
            {showInput && (
                <>
                    {def.inputType === 'stars' && (
                        <StarInput value={Number(rule.value) || 0} onChange={(v) => onUpdate({ ...rule, value: v })} />
                    )}
                    {def.inputType === 'text' && (
                        <input type="text" value={String(rule.value ?? '')} onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                            className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-3 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600" placeholder="value" />
                    )}
                    {(def.inputType === 'number' || def.inputType === 'days') && rule.operator !== 'between' && (
                        <input type="number" value={String(rule.value ?? '')} onChange={(e) => onUpdate({ ...rule, value: Number(e.target.value) })}
                            className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-3 py-1.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                    )}
                    {rule.operator === 'between' && (
                        <>
                            <input type="number" value={String(rule.value ?? '')} onChange={(e) => onUpdate({ ...rule, value: Number(e.target.value) })}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-3 py-1.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="from" />
                            <span className="text-zinc-500 text-xs">—</span>
                            <input type="number" value={String(rule.value2 ?? '')} onChange={(e) => onUpdate({ ...rule, value2: Number(e.target.value) })}
                                className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-3 py-1.5 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="to" />
                        </>
                    )}
                    {def.inputType === 'select' && (
                        <select value={String(rule.value ?? '')} onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                            className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            {def.selectOptions?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}
                </>
            )}

            {/* Remove rule */}
            <button onClick={onRemove} className="ml-auto p-1 text-zinc-600 hover:text-red-400 transition-colors rounded">
                <X size={14} />
            </button>
        </div>
    )
}

// ── Preview panel ─────────────────────────────────────────────────────────────

function PreviewPanel({ total, tracks, loading }: { total: number; tracks: Track[]; loading: boolean }) {
    return (
        <div className="border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/40">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Live Preview</span>
                {loading
                    ? <span className="text-xs text-zinc-600 animate-pulse">Calculating…</span>
                    : <span className="text-xs font-mono font-semibold text-emerald-400">{total} tracks match</span>}
            </div>
            {tracks.length === 0 && !loading && (
                <div className="py-6 text-center text-zinc-600 text-sm">No tracks match these rules yet</div>
            )}
            {tracks.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/30 transition-colors">
                    {t.coverArtPath
                        ? <img src={`http://localhost:3000/api/cover/album/${t.id}`} className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
                        : <div className="w-7 h-7 rounded-md bg-zinc-800 flex-shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{t.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{t.artist}</p>
                    </div>
                    {t.rating ? <span className="ml-auto text-xs text-yellow-500 flex-shrink-0">{'★'.repeat(Math.round(t.rating))}</span> : null}
                </div>
            ))}
            {total > 8 && (
                <div className="px-4 py-2 text-xs text-zinc-600 text-center">…and {total - 8} more tracks</div>
            )}
        </div>
    )
}

// ── Main SmartPlaylistBuilder ─────────────────────────────────────────────────

interface Props {
    existingPlaylist?: SmartPlaylist | null
    onClose: () => void
    onSaved?: (sp: SmartPlaylist) => void
}

export default function SmartPlaylistBuilder({ existingPlaylist, onClose, onSaved }: Props) {
    const { createPlaylist, updatePlaylist } = useSmartPlaylists()

    const [name, setName] = useState(existingPlaylist?.name ?? '')
    const [description, setDescription] = useState(existingPlaylist?.description ?? '')
    const [matchMode, setMatchMode] = useState<'all' | 'any'>(existingPlaylist?.matchMode ?? 'all')
    const [rules, setRules] = useState<PlaylistRule[]>(existingPlaylist?.rules ?? [])
    const [limitCount, setLimitCount] = useState<number | ''>(existingPlaylist?.limitCount ?? '')
    const [limitRandom, setLimitRandom] = useState(existingPlaylist?.limitRandom ?? false)
    const [sortField, setSortField] = useState(existingPlaylist?.sortField ?? 'title')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(existingPlaylist?.sortOrder ?? 'asc')

    const [preview, setPreview] = useState<{ tracks: Track[]; total: number }>({ tracks: [], total: 0 })
    const [previewLoading, setPreviewLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const { previewPlaylist } = useSmartPlaylists()

    // Debounced live preview
    const refreshPreview = useCallback(async () => {
        setPreviewLoading(true)
        try {
            const result = await previewPlaylist({ matchMode, rules, limitCount: limitCount ? Number(limitCount) : undefined, limitRandom, sortField, sortOrder })
            setPreview(result)
        } catch { /* ignore */ }
        setPreviewLoading(false)
    }, [matchMode, rules, limitCount, limitRandom, sortField, sortOrder, previewPlaylist])

    useEffect(() => {
        const timer = setTimeout(refreshPreview, 500)
        return () => clearTimeout(timer)
    }, [refreshPreview])

    const addRule = () => {
        const newRule: PlaylistRule = { id: uuidv4(), field: 'artist', operator: 'contains', value: '' }
        setRules((prev) => [...prev, newRule])
    }

    const updateRule = (id: string, r: PlaylistRule) => setRules((prev) => prev.map((old) => old.id === id ? r : old))
    const removeRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))


    const handleSave = async () => {
        if (!name.trim()) return
        setSaving(true)
        const data = {
            name: name.trim(),
            description: description.trim() || undefined,
            matchMode,
            rules,
            limitCount: limitCount ? Number(limitCount) : undefined,
            limitRandom,
            sortField,
            sortOrder,
        }
        let saved: SmartPlaylist | null = null
        if (existingPlaylist) {
            const ok = await updatePlaylist(existingPlaylist.id, data)
            if (ok) saved = { ...existingPlaylist, ...data, updatedAt: new Date().toISOString() }
        } else {
            saved = await createPlaylist(data)
        }
        setSaving(false)
        if (saved && onSaved) onSaved(saved)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">
                            {existingPlaylist ? 'Edit Smart Playlist' : 'New Smart Playlist'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Name + description */}
                    <div className="space-y-3">
                        <input type="text" placeholder="Playlist name…" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-white text-base font-semibold px-4 py-2.5 rounded-xl placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                        <input type="text" placeholder="Description (optional)…" value={description} onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm px-4 py-2 rounded-xl placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
                    </div>

                    {/* Match mode */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Match</span>
                            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                                {(['all', 'any'] as const).map((m) => (
                                    <button key={m} onClick={() => setMatchMode(m)}
                                        className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                                            matchMode === m ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200')}>
                                        {m === 'all' ? 'All rules (AND)' : 'Any rule (OR)'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Rules */}
                        <div className="space-y-2 bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
                            {rules.length === 0 && (
                                <p className="text-sm text-zinc-600 text-center py-3">No rules yet — add one below to filter your tracks.</p>
                            )}
                            {rules.map((rule) => (
                                <div key={rule.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
                                    <RuleRow rule={rule} onUpdate={(r) => updateRule(rule.id, r)} onRemove={() => removeRule(rule.id)} />
                                </div>
                            ))}
                            <button onClick={addRule}
                                className="mt-1 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium px-1 py-1">
                                <Plus size={15} /> Add rule
                            </button>
                        </div>
                    </div>

                    {/* Limit & Sort */}
                    <div className="space-y-3">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Limit & Sort</span>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-400 flex-shrink-0">Max</span>
                                <input type="number" min={1} value={limitCount} onChange={(e) => setLimitCount(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="No limit"
                                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600" />
                                <span className="text-sm text-zinc-500 flex-shrink-0">tracks</span>
                            </div>
                            <label className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 cursor-pointer select-none">
                                <input type="checkbox" checked={limitRandom} onChange={(e) => setLimitRandom(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-0 focus:ring-offset-0" />
                                <span className="text-sm text-zinc-300">Random selection</span>
                            </label>
                            <div className="flex items-center gap-2 col-span-2">
                                <span className="text-sm text-zinc-400 flex-shrink-0">Sort by</span>
                                <select value={sortField} onChange={(e) => setSortField(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                {sortField !== 'random' && (
                                    <button onClick={() => setSortOrder((p) => p === 'asc' ? 'desc' : 'asc')}
                                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors font-medium">
                                        {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Live Preview */}
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Preview</span>
                        <PreviewPanel total={preview.total} tracks={preview.tracks as any} loading={previewLoading} />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 flex-shrink-0 bg-zinc-950">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={!name.trim() || saving}
                        className={cn('flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                            name.trim() && !saving
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed')}>
                        <Save size={15} />
                        {saving ? 'Saving…' : existingPlaylist ? 'Save Changes' : 'Create Playlist'}
                    </button>
                </div>
            </div>
        </div>
    )
}
