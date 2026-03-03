import { AlertCircle, AlertTriangle, Check, X } from 'lucide-react'
import { useDraggable } from '../../hooks/useDraggable'
import { cn } from '../../lib/utils'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm?: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDangerous?: boolean
    hideCancel?: boolean
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDangerous = false,
    hideCancel = false
}: ConfirmModalProps) {
    const { position, handleMouseDown } = useDraggable()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" onClick={onClose}>
            <div
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`
                }}
                className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Draggable Area */}
                <div
                    className="cursor-move select-none p-6 pb-4 flex items-start gap-4"
                    onMouseDown={handleMouseDown}
                >
                    <div className={cn(
                        "p-3 rounded-full flex-shrink-0",
                        isDangerous ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                    )}>
                        {isDangerous ? <AlertTriangle size={24} /> : <AlertCircle size={24} />}
                    </div>
                    <div className="flex-1 space-y-1">
                        <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-line">{message}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end gap-3">
                    {!hideCancel && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onConfirm?.()
                            onClose()
                        }}
                        className={cn(
                            "px-6 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
                            isDangerous
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                    >
                        {!hideCancel && <Check className="w-4 h-4" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
