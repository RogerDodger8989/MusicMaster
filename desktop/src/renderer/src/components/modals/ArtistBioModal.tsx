import { X, User } from 'lucide-react'
import { useDraggable } from '../../hooks/useDraggable'
import { client } from '../../api/client'

interface ArtistBioModalProps {
    artistName: string
    bio: string
    isOpen: boolean
    onClose: () => void
}

export function ArtistBioModal({
    artistName,
    bio,
    isOpen,
    onClose
}: ArtistBioModalProps) {
    if (!isOpen) return null

    const { position, handleMouseDown } = useDraggable()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                className="pointer-events-auto relative w-[600px] max-w-[90vw] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-4 border-b border-zinc-800 cursor-move shrink-0"
                    onMouseDown={handleMouseDown}
                >
                    <h3 className="font-bold text-white flex items-center gap-2 truncate pr-4">
                        <User size={16} className="text-primary flex-shrink-0" />
                        <span className="truncate">{artistName}</span>
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white flex-shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div
                    className="p-6 overflow-y-auto custom-scrollbar"
                    onClick={(e) => {
                        const target = e.target as HTMLElement
                        const anchor = target.closest('a')
                        if (anchor) {
                            e.preventDefault()
                            const url = anchor.href
                            client.openExternal(url)
                        }
                    }}
                >
                    <div
                        dangerouslySetInnerHTML={{ __html: bio }}
                        className="prose prose-invert prose-p:mb-4 prose-a:text-primary/70 prose-a:underline hover:prose-a:text-primary prose-p:text-sm prose-p:font-normal prose-p:leading-relaxed prose-headings:text-white prose-headings:mt-6 prose-headings:mb-2 prose-headings:text-base prose-headings:font-bold"
                    />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
