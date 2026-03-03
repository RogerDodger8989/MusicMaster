import { useState, useEffect, useRef } from 'react'
import { Cast, Monitor, Speaker, X, Check, Loader2 } from 'lucide-react'
import { useCastStore } from '../store/cast'
import { cn } from '../lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

export function CastMenu() {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const { devices, activeDevice, castState, startDiscovery, connectToDevice, disconnect } = useCastStore()

    useEffect(() => {
        if (isOpen) {
            startDiscovery()
        }
    }, [isOpen, startDiscovery])

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const isConnected = activeDevice !== null
    const isConnecting = castState === 'connecting'

    return (
        <div className="relative flex items-center" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-2 rounded-full transition-all group",
                    isOpen ? "bg-white/10" : "hover:bg-white/5",
                    isConnected ? "text-blue-400 hover:text-blue-300" : "text-zinc-400 hover:text-white",
                    isConnecting && "animate-pulse text-blue-400"
                )}
                title={isConnected ? `Casting to ${activeDevice.name}` : "Cast to Device"}
            >
                <Cast className="w-4 h-4" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-4 w-72 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[400px]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                            <h3 className="text-sm font-semibold text-white">Cast to Device</h3>
                            {devices.length === 0 && !isConnected ? (
                                <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                            ) : null}
                        </div>

                        {/* Device List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* Local Computer Option */}
                            <button
                                onClick={() => {
                                    disconnect()
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left",
                                    !isConnected ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/5 text-zinc-300 hover:text-white"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 opacity-80" />
                                    <span className="text-sm font-medium">This Computer</span>
                                </div>
                                {!isConnected && <Check className="w-4 h-4 text-blue-400" />}
                            </button>

                            <div className="my-2 h-px w-full bg-white/5" />

                            {/* Discovered Devices */}
                            <div className="space-y-1">
                                {devices.length > 0 ? (
                                    devices.map(device => {
                                        const isActive = activeDevice?.id === device.id

                                        return (
                                            <button
                                                key={device.id}
                                                onClick={() => {
                                                    connectToDevice(device)
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left",
                                                    isActive ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/5 text-zinc-300 hover:text-white"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 truncate">
                                                    {device.type === 'chromecast' ? (
                                                        <Cast className="w-5 h-5 opacity-80 shrink-0" />
                                                    ) : (
                                                        <Speaker className="w-5 h-5 opacity-80 shrink-0" />
                                                    )}
                                                    <span className="text-sm font-medium truncate">{device.name}</span>
                                                </div>
                                                {isActive && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="text-xs text-center text-zinc-500 py-4 px-2">
                                        Looking for Chromecast and Sonos devices on your network...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Active Device Footer */}
                        {isConnected && (
                            <div className="p-3 border-t border-white/5 bg-zinc-800/50">
                                <button
                                    onClick={() => {
                                        disconnect()
                                        setIsOpen(false)
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-sm font-medium"
                                >
                                    <X className="w-4 h-4" />
                                    Stop Casting
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
