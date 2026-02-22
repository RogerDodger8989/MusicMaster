
import { useLibrary } from '../store/library'
import TrackList from '../components/TrackList'
import { Heart } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'

export default function FavoritesView() {
    const { tracks } = useLibrary()
    const favoriteTracks = tracks.filter(t => t.loved)

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            <PageHeader
                icon={Heart}
                iconColor="text-red-400"
                title="Favorites"
                subtitle="Tracks you've loved"
                count={favoriteTracks.length}
            />

            <div className="flex-1 overflow-hidden">
                {favoriteTracks.length > 0 ? (
                    <TrackList tracks={favoriteTracks} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                        <Heart className="w-16 h-16 opacity-20" />
                        <p className="text-sm">No favorites yet. Click the heart on tracks you love!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
