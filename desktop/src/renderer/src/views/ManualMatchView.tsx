import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigation } from '../store/navigation'
import { MatchSelectionModal } from '../components/modals/MatchSelectionModal'

/**
 * Manual Match View
 * Standalone view for manually matching tracks with MusicBrainz
 * Can be accessed from Settings or Track context menu
 */
export default function ManualMatchView() {
  const { goBack } = useNavigation()
  const [tracks, setTracks] = useState<any[]>([])
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Load all tracks without MBIDs
    loadTracksWithoutMBID()
  }, [])

  const loadTracksWithoutMBID = async () => {
    try {
      const allTracks = await window.api.tracks.getAll()
      // Filter tracks without MBID (you may need to add this field to track type)
      const unmatched = allTracks.filter((t) => !t.mbid)
      setTracks(unmatched)
    } catch (error) {
      console.error('Failed to load tracks:', error)
    }
  }

  const handleSelectTrack = async (track: any) => {
    setSelectedTrack(track)
    setLoading(true)
    setShowModal(true)

    try {
      const result = await window.api.musicbrainz.getCandidates(track.id)
      setCandidates(result.candidates)
    } catch (error) {
      console.error('Failed to get candidates:', error)
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  const handleApplyCandidate = async (candidate: any) => {
    if (!selectedTrack) return

    try {
      await window.api.musicbrainz.applyCandidate(selectedTrack.id, candidate, true)

      // Remove track from list
      setTracks((prev) => prev.filter((t) => t.id !== selectedTrack.id))

      // Close modal
      setShowModal(false)
      setSelectedTrack(null)
      setCandidates([])
    } catch (error) {
      console.error('Failed to apply candidate:', error)
      alert('Failed to apply metadata. Check console for details.')
    }
  }

  const handleSkip = () => {
    setShowModal(false)
    setSelectedTrack(null)
    setCandidates([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <button
          onClick={() => goBack()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-3xl font-bold">Manual MusicBrainz Matching</h1>
        <p className="text-gray-400 mt-2">{tracks.length} tracks need matching</p>
      </div>

      {/* Track List */}
      <div className="max-w-6xl mx-auto space-y-2">
        {tracks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">All tracks have been matched! 🎉</p>
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              onClick={() => handleSelectTrack(track)}
              className="p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors border border-gray-700 hover:border-blue-500"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{track.title}</h3>
                  <p className="text-sm text-gray-400 truncate">
                    {track.artist} • {track.album}
                  </p>
                </div>
                <div className="text-sm text-gray-500 ml-4">
                  {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Match Selection Modal */}
      {showModal && selectedTrack && (
        <MatchSelectionModal
          trackInfo={{
            id: selectedTrack.id,
            title: selectedTrack.title,
            artist: selectedTrack.artist,
            album: selectedTrack.album,
            duration: selectedTrack.duration
          }}
          candidates={loading ? [] : candidates}
          onSelect={handleApplyCandidate}
          onSkip={handleSkip}
          onClose={handleSkip}
        />
      )}
    </div>
  )
}
