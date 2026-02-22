import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

interface PageHeaderProps {
    /** Lucide icon component */
    icon: LucideIcon
    /** Icon accent color class, e.g. 'text-blue-400' */
    iconColor?: string
    title: string
    /** Short subtitle / description shown below the title */
    subtitle?: string
    /** Number shown as a small badge next to the title */
    count?: number
    /** Extra content rendered to the right (search bar, buttons, etc.) */
    children?: ReactNode
}

/**
 * Shared page header for all list views.
 * Renders a sticky top bar with icon, title, optional subtitle & count, plus a right-side slot for tools.
 */
export function PageHeader({
    icon: Icon,
    iconColor = 'text-zinc-400',
    title,
    subtitle,
    count,
    children
}: PageHeaderProps) {
    return (
        <div className="flex-shrink-0 bg-zinc-950 border-b border-zinc-800/70 z-20 px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Left side: icon + title + count */}
                <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white leading-none">{title}</h1>
                            {count !== undefined && (
                                <span className="text-xs font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-md tabular-nums">
                                    {count}
                                </span>
                            )}
                        </div>
                        {subtitle && (
                            <p className="text-sm text-zinc-500 mt-1 truncate">{subtitle}</p>
                        )}
                    </div>
                </div>

                {/* Right side: toolbar slot */}
                {children && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {children}
                    </div>
                )}
            </div>
        </div>
    )
}
