import React from 'react'
import { Mic, Pause, Play, Sparkles } from 'lucide-react'
import { useDJ } from '../store/dj'
import { cn } from '../utils'

/**
 * DJCard - A premium looking control card for the AI DJ.
 */
export const DJCard: React.FC = () => {
    const { isActive, startDJ, stopDJ, isTalking, currentTheme } = useDJ()

    const themeLabels: Record<string, string> = {
        'favorites': 'Dina Favoriter',
        'vibes': 'Vibes',
        'discovery': 'Upptäckter',
        'recently-added': 'Nyligen Tillagt',
        'artist-focus': 'Artistfokus'
    }

    return (
        <div className={cn(
            "relative rounded-3xl p-8 mb-12 transition-all duration-500",
            isActive
                ? "bg-gradient-to-br from-indigo-600 via-purple-700 to-cyan-600 shadow-2xl shadow-purple-500/30 ring-2 ring-white/20"
                : "bg-zinc-900 border border-white/10 hover:border-white/20"
        )}>
            {/* Animated background glow when active - now clamped to parent */}
            {isActive && (
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                    <div className="absolute -inset-24 bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-12 animate-[pulse_4s_infinite]" />
                </div>
            )}

            {/* LIVE Badge */}
            {isActive && (
                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full shadow-lg animate-pulse z-20">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Live</span>
                </div>
            )}

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    {/* Icon / Avatar */}
                    <div className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-700 relative",
                        isActive ? "bg-white text-purple-700 scale-110 rotate-3 shadow-2xl" : "bg-white/5 text-zinc-500"
                    )}>
                        {isActive && (
                            <div className="absolute inset-0 rounded-2xl bg-white animate-ping opacity-20 scale-125" />
                        )}
                        {isTalking ? (
                            <Mic className="w-10 h-10 animate-bounce" />
                        ) : (
                            <Sparkles className={cn("w-10 h-10", isActive && "animate-pulse")} />
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className={cn(
                                "text-3xl font-black tracking-tighter",
                                isActive ? "text-white" : "text-zinc-300"
                            )}>
                                AI DJ
                            </h2>
                            {isActive && currentTheme && (
                                <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                                    ON AIR: {themeLabels[currentTheme] || currentTheme}
                                </span>
                            )}
                        </div>
                        <p className={cn(
                            "text-lg",
                            isActive ? "text-white/80" : "text-zinc-500"
                        )}>
                            {isActive
                                ? (isTalking ? "DJ is talking..." : "Your personal host is curating for you.")
                                : "Let your host find perfectly matching sets for you."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {!isActive ? (
                        <button
                            onClick={startDJ}
                            className="bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-widest hover:scale-110 active:scale-95 transition-all flex items-center gap-3 shadow-xl"
                        >
                            <Play size={20} fill="currentColor" />
                            Start DJ
                        </button>
                    ) : (
                        <button
                            onClick={stopDJ}
                            className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full font-black uppercase tracking-widest border border-white/20 backdrop-blur-md transition-all flex items-center gap-3 shadow-xl"
                        >
                            <Pause size={20} fill="currentColor" />
                            Stop DJ
                        </button>
                    )}
                </div>
            </div>

            {/* Subtle background graphics */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        </div>
    )
}
