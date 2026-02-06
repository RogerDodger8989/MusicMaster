import { useState } from 'react'
import { Play, ListEnd, ListPlus, X } from 'lucide-react'
import { TrackPlayBehavior } from '../../store/settings'
import { cn } from '../../lib/utils'

interface TrackPlayOptionModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (option: TrackPlayBehavior, remember: boolean) => void
    trackTitle: string
}

export function TrackPlayOptionModal({ isOpen, onClose, onSelect, trackTitle }: TrackPlayOptionModalProps) {
    const [remember, setRemember] = useState(false)

    if (!isOpen) return null

    const options = [
        {
            id: 'play_next',
            label: 'Play Next',
            icon: ListPlus,
            description: 'Insert after the current track',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10 hover:bg-blue-500/20'
        },
        {
            id: 'add_last',
            label: 'Add to Queue',
            icon: ListEnd,
            description: 'Add to the end of the queue',
            color: 'text-green-500',
            bg: 'bg-green-500/10 hover:bg-green-500/20'
        },
        {
            id: 'replace',
            label: 'Play Now',
            icon: Play,
            description: 'Clear queue and play only this',
            color: 'text-primary',
            bg: 'bg-primary/10 hover:bg-primary/20'
        }
    ] as const

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[400px] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <h3 className="font-bold text-white">Play Track</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="text-center space-y-1">
                        <p className="text-zinc-400 text-sm">How would you like to play</p>
                        <p className="text-white font-bold truncate px-4">{trackTitle}</p>
                    </div>

                    <div className="space-y-3">
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onSelect(opt.id as TrackPlayBehavior, remember)}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-lg border border-transparent transition-all group text-left",
                                    opt.bg
                                )}
                            >
                                <div className={cn("p-2 rounded-full bg-black/20", opt.color)}>
                                    <opt.icon size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-white group-hover:text-white/90">{opt.label}</div>
                                    <div className="text-xs text-zinc-400 group-hover:text-zinc-300">{opt.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="remember"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-primary focus:ring-primary/50"
                        />
                        <label htmlFor="remember" className="text-sm text-zinc-400 cursor-pointer select-none">
                            Don't ask again (save setting)
                        </label>
                    </div>
                </div>
            </div>
        </div>
    )
}
