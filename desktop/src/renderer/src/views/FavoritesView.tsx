
import { useLibrary } from '../store/library'
import TrackList from '../components/TrackList'
import { Heart } from 'lucide-react'

export default function FavoritesView() {
    const { tracks } = useLibrary()

    // Filter for loved tracks or tracks with rating >= 4 (if we implement star rating filter later)
    // For now, let's just use the 'loved' boolean
    const favoriteTracks = tracks.filter(t => t.loved)

    return (
        <div className="h-full flex flex-col">
            <div className="p-8 pb-4">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-red-500/10 rounded-full">
                        <Heart className="w-8 h-8 text-red-500 fill-current" />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">Favorites</h1>
                </div>
                <p className="text-zinc-400 pl-[4.5rem]">
                    {favoriteTracks.length} tracks you love
                </p>
            </div>

            <div className="flex-1 overflow-hidden">
                {favoriteTracks.length > 0 ? (
                    <TrackList tracks={favoriteTracks} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                        <Heart className="w-16 h-16 opacity-20" />
                        <p>No favorites yet. Click the heart on tracks you love!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
