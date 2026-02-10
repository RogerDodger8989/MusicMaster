import { useMemo, useState, useEffect, useCallback } from 'react'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { client } from '../api/client'
import {
  ArrowLeft,
  Users,
  Heart,
  Play,
  Shuffle,
  Hash,
  ChevronUp,
  ChevronDown,
  Globe,
  MapPin,
  Calendar,
  UserCircle2,
  RefreshCw
} from 'lucide-react'
import { AlbumCard } from '../components/AlbumCard'
import { RatingStars } from '../components/RatingStars'
import { formatDuration } from '../utils/format'
import { cn } from '../utils'
import { QueueConfirmationModal } from '../components/QueueConfirmationModal'
import { useTrackSelection } from '../hooks/useTrackSelection'
import ArtistContextMenu from '../components/ArtistContextMenu'
import type { Artist } from '../types/index'

interface ArtistDetailViewProps {
  artistName: string
  onBack: () => void
  onAlbumClick: (albumId: string) => void
  onArtistClick?: (artistName: string) => void
}

export default function ArtistDetailView({
  artistName,
  onBack,
  onAlbumClick,
  onArtistClick
}: ArtistDetailViewProps) {
  const { albums, artists, tracks, rateTrack, toggleLoved, toggleArtistLoved, updateArtist } =
    useLibrary()
  const {
    playTrack,
    playAlbum,
    toggleShuffle,
    currentTrack,
    isPlaying,
    isShuffle,
    queue,
    insertToQueue
  } = usePlayer()

  const [sortBy, setSortBy] = useState<'year' | 'popularity'>('year')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isBioExpanded, setIsBioExpanded] = useState(false)
  const [artistMembers, setArtistMembers] = useState<any[]>([])
  const [appearances, setAppearances] = useState<any[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [lastfmTopTracks, setLastfmTopTracks] = useState<{ name: string; playcount: string }[]>([])
  const [artistContextMenu, setArtistContextMenu] = useState<{
    artist: Artist
    x: number
    y: number
  } | null>(null)

  // Find artist info locally
  const localArtist = useMemo(() => artists.find((a) => a.name === artistName), [artists, artistName])

  const [remoteArtist, setRemoteArtist] = useState<Artist | null>(null)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)

  // Combined artist object (local, or fallback to remote)
  const artist = localArtist || remoteArtist

  const [isSyncing, setIsSyncing] = useState(false)
  const [similarArtists, setSimilarArtists] = useState<
    { name: string; image: string; match: string }[]
  >([])

  // Fetch remote artist if not found locally
  useEffect(() => {
    if (localArtist || !artistName) return

    let mounted = true
    const fetchRemote = async () => {
      setIsLoadingRemote(true)
      console.log(`🔍 [UI] Artist not in library. Fetching remote data for: ${artistName}`)
      try {
        // 1. Search for artist
        const results = await client.searchMetadata(artistName, '')
        if (mounted && results && results.length > 0) {
          const match = results.find((r) => r.artist.toLowerCase() === artistName.toLowerCase()) || results[0]

          if (match) {
            // 2. Get details
            const details = await client.getArtistDetails(match.artistId)
            if (mounted && details) {
              // Construct a virtual artist object
              const virtualArtist: Artist = {
                id: details.id, // Use MBID as ID
                name: details.name,
                albumCount: 0,
                trackCount: 0,
                bio: details.biography || details.bio, // Handle both potential fields
                imagePath: details.image,
                musicbrainzArtistId: details.id,
                country: details.country,
                lifeSpanBegin: details.lifeSpan?.begin,
                lifeSpanEnd: details.lifeSpan?.end,
                type: details.type,
                gender: details.gender,
                website: details.website,
                loved: false
              }
              setRemoteArtist(virtualArtist)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch remote artist:', error)
      } finally {
        if (mounted) setIsLoadingRemote(false)
      }
    }

    fetchRemote()
    return () => { mounted = false }
  }, [artistName, localArtist])

  // Fetch similar artists when artistName changes
  useEffect(() => {
    let mounted = true
    const fetchSimilar = async () => {
      try {
        const similar = await client.getSimilarArtists(artistName)
        if (mounted && similar && similar.length > 0) {
          setSimilarArtists(similar.slice(0, 6))
        }
      } catch (error) {
        console.error('Failed to load similar artists:', error)
      }
    }
    fetchSimilar()
    return () => {
      mounted = false
    }
  }, [artistName])

  // Fetch Last.fm top tracks when artistName changes
  useEffect(() => {
    let mounted = true
    const fetchTopTracks = async () => {
      try {
        const topTracks = await client.getArtistTopTracks(artistName, 50)
        if (mounted && Array.isArray(topTracks)) {
          setLastfmTopTracks(topTracks)
          console.log(`[UI] Loaded ${topTracks.length} top tracks from Last.fm for "${artistName}"`)
        } else if (mounted) {
          setLastfmTopTracks([])
        }
      } catch (error) {
        console.error('Failed to load Last.fm top tracks:', error)
      }
    }
    fetchTopTracks()
    return () => {
      mounted = false
    }
  }, [artistName])

  // State for queue confirmation
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [pendingTracks, setPendingTracks] = useState<any[]>([])
  const [isPendingShuffle, setIsPendingShuffle] = useState(false)

  // Sync artist facts from MusicBrainz
  const syncArtistFacts = useCallback(async () => {
    if (!artistName || isSyncing) return

    setIsSyncing(true)
    try {
      // 1. Search for artist on MusicBrainz if we don't have an ID
      let mbArtistId = artist?.musicbrainzArtistId

      if (!mbArtistId) {
        console.log(`🔍 [UI] Searching MusicBrainz for artist: ${artistName}`)
        const results = await client.searchMetadata(artistName, '') // Search for artist name
        if (results && results.length > 0) {
          // Try to find an exact name match
          const match =
            results.find((r) => r.artist.toLowerCase() === artistName.toLowerCase()) || results[0]
          mbArtistId = match.artistId
        }
      }

      if (mbArtistId) {
        console.log(`🔍 [UI] Fetching detailed facts for MBID: ${mbArtistId}`)
        const details = await client.getArtistDetails(mbArtistId)
        if (details) {
          const facts: any = {
            musicbrainzArtistId: details.id,
            country: details.country,
            lifeSpanBegin: details.lifeSpan?.begin,
            lifeSpanEnd: details.lifeSpan?.end,
            type: details.type,
            gender: details.gender,
            website: details.website,
            bio: details.biography || details.bio
          }

          if (facts.bio) {
            console.log(`📝 [UI] Auto-discovered biography for ${artistName}`)
          }

          // Update image if missing OR if it's a local cache path (prefer high-res remote URL)
          // Also check for 'lastfm_' which might be another indicator of cached files
          const isLocal = artist?.imagePath && (
            artist.imagePath.includes('external_cache') ||
            artist.imagePath.includes('lastfm_') ||
            !artist.imagePath.startsWith('http')
          )

          if ((!artist?.imagePath || isLocal) && details.image) {
            console.log(`📸 [UI] Upgrading artist image to remote URL: ${details.image}`)
            facts.imagePath = details.image
          }

          await updateArtist(artist!.id, facts)
          console.log('✅ [UI] Artist facts synced successfully')
          // The library store should ideally be refreshed here
          // For now, we rely on the next visit or manual refresh
        }
      }
    } catch (error) {
      console.error('❌ [UI] Failed to sync artist facts:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [artistName, artist, isSyncing])

  // Auto-sync if missing facts (MBID or Image)
  useEffect(() => {
    if (artist && (!artist.musicbrainzArtistId || !artist.imagePath) && !isSyncing) {
      syncArtistFacts()
    }
  }, [artist, isSyncing, syncArtistFacts])

  const handlePlayAll = useCallback(() => {
    // Collect all tracks for this artist
    const allArtistTracks = tracks
      .filter((t) => t.artist === artistName || t.albumArtist === artistName)
      .sort((a, b) => {
        // Sort by year desc, then album, then track number
        return (
          (b.year || 0) - (a.year || 0) ||
          a.album.localeCompare(b.album) ||
          (a.trackNum || 0) - (b.trackNum || 0)
        )
      })

    if (allArtistTracks.length === 0) return

    if (queue.length > 0) {
      setPendingTracks(allArtistTracks)
      setIsPendingShuffle(false)
      setIsConfirmModalOpen(true)
    } else {
      playAlbum(allArtistTracks)
    }
  }, [tracks, artistName, queue.length, playAlbum])

  const handleShuffleAll = useCallback(() => {
    const allArtistTracks = tracks.filter(
      (t) => t.artist === artistName || t.albumArtist === artistName
    )

    if (allArtistTracks.length === 0) return

    if (queue.length > 0) {
      setPendingTracks(allArtistTracks)
      setIsPendingShuffle(true)
      setIsConfirmModalOpen(true)
    } else {
      executeShuffle(allArtistTracks)
    }
  }, [tracks, artistName, queue.length, toggleShuffle, isShuffle, playAlbum])

  const executeShuffle = (tracksToShuffle: any[]) => {
    const shuffled = [...tracksToShuffle]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    playAlbum(shuffled)
    if (!isShuffle) {
      toggleShuffle()
    }
  }

  const handleConfirmReplace = () => {
    if (isPendingShuffle) {
      executeShuffle(pendingTracks)
    } else {
      playAlbum(pendingTracks)
    }
    setIsConfirmModalOpen(false)
  }

  const handleConfirmAppend = () => {
    const tracksToAppend = [...pendingTracks]
    if (isPendingShuffle) {
      for (let i = tracksToAppend.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
          ;[tracksToAppend[i], tracksToAppend[j]] = [tracksToAppend[j], tracksToAppend[i]]
      }
    }
    insertToQueue(tracksToAppend, queue.length)
    setIsConfirmModalOpen(false)
  }

  // Fetch members and appearances if available
  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artist?.musicbrainzArtistId) return

      console.log(`[UI] Fetching members for ${artistName}. Artist has MBID: ${artist.musicbrainzArtistId}. Current Image: ${artist.imagePath}`)

      setIsLoadingMembers(true)
      try {
        const [members, details] = await Promise.all([
          client.getArtistMembers(artist.musicbrainzArtistId),
          client.getArtistDetails(artist.musicbrainzArtistId)
        ])
        setArtistMembers(members)

        // improved auto-sync for image
        if (!artist.imagePath && details.image) {
          console.log('[AutoSync] Updating artist image from MusicBrainz', details.image)
          await updateArtist(artist.id, { imagePath: details.image })
        }
      } catch (error) {
        console.error('Failed to fetch artist data:', error)
      } finally {
        setIsLoadingMembers(false)
      }
    }

    fetchArtistData()
  }, [artist?.musicbrainzArtistId, artist?.imagePath, artist?.id, updateArtist])

  // Process appearances (from other artists' albums in local library)
  useEffect(() => {
    if (!artist || !tracks.length) return

    // Find tracks where this artist appears but is not the main album artist
    const guestTracks = tracks.filter(t => {
      const isAlbumArtist = t.albumArtist === artistName
      if (isAlbumArtist) return false

      const isTrackArtist = t.artist === artistName
      // Check performers (using name or ID)
      const isPerformer = t.performers?.some(p =>
        p.name === artistName ||
        (p.id && artist.id && p.id === artist.id) ||
        (p.id && artist.musicbrainzArtistId && p.id === artist.musicbrainzArtistId)
      )

      return isTrackArtist || isPerformer
    })

    // Get unique albums from these tracks
    const appearanceAlbums = Array.from(new Set(guestTracks.map(t => t.albumId)))
      .map(id => albums.find(a => a.id === id))
      .filter(Boolean) as any[]

    setAppearances(appearanceAlbums)
  }, [tracks, albums, artistName, artist])

  // Filter and sort albums by this artist
  const artistAlbums = useMemo(() => {
    return albums
      .filter((a) => a.artist === artistName)
      .sort((a, b) => {
        let comparison = 0
        if (sortBy === 'year') {
          comparison = (b.year || 0) - (a.year || 0)
        } else {
          comparison = (b.playCount || 0) - (a.playCount || 0)
        }
        return sortOrder === 'desc' ? comparison : -comparison
      })
  }, [albums, artistName, sortBy, sortOrder])

  // Get top tracks for the artist - sorted by Last.fm global ranking
  const topTracks = useMemo(() => {
    const artistTracks = tracks.filter((t) => t.artist === artistName || t.albumArtist === artistName)

    if (lastfmTopTracks.length === 0) {
      // Fallback: sort by playcount if Last.fm data not available
      return artistTracks
        .sort((a, b) => {
          if (b.playCount !== a.playCount) return b.playCount - a.playCount
          return a.title.localeCompare(b.title)
        })
        .slice(0, 5)
    }

    // Sort by Last.fm global ranking
    return artistTracks
      .sort((a, b) => {
        const aIndex = (lastfmTopTracks || []).findIndex(t => t.name.toLowerCase() === a.title.toLowerCase())
        const bIndex = (lastfmTopTracks || []).findIndex(t => t.name.toLowerCase() === b.title.toLowerCase())

        // Both found in Last.fm list - sort by Last.fm ranking
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        // Only a found - a comes first
        if (aIndex !== -1) return -1
        // Only b found - b comes first
        if (bIndex !== -1) return 1
        // Neither found - sort by playcount
        return b.playCount - a.playCount
      })
      .slice(0, 5)
  }, [tracks, artistName, lastfmTopTracks])

  const totalTracks = useMemo(
    () => artistAlbums.reduce((acc, alb) => acc + (alb.trackCount || 0), 0),
    [artistAlbums]
  )

  // Derive top genres for the artist
  const artistGenres = useMemo(() => {
    const genreMap = new Map<string, number>()
    artistAlbums.forEach((album) => {
      if (album.genre) {
        album.genre.split(' / ').forEach((g) => {
          const clean = g.trim()
          if (clean && clean.toLowerCase() !== 'unknown') {
            genreMap.set(clean, (genreMap.get(clean) || 0) + 1)
          }
        })
      }
    })
    return Array.from(genreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre)
  }, [artistAlbums])

  const { selectedTracks, handleTrackClick, clearSelection, selectSingleTrack } =
    useTrackSelection(topTracks)

  if (isLoadingRemote) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-background">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        <p className="text-xl font-medium">Fetching artist info...</p>
      </div>
    )
  }

  if (!artistAlbums.length && !artist) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 bg-background">
        <p className="text-xl font-medium">Artist not found</p>
        <button
          onClick={onBack}
          className="mt-6 px-6 py-2.5 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-all font-semibold"
        >
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background relative" onClick={clearSelection}>
      {/* Immersive Hero Section - Now hosting most content */}
      <div className="relative h-full w-full overflow-y-auto custom-scrollbar">
        {/* Fixed Background Image Overlay */}
        <div className="absolute inset-0 h-[65vh] min-h-[500px] pointer-events-none">
          {artist?.imagePath ? (
            <div className="relative w-full h-full">
              <img
                src={
                  artist.imagePath && artist.imagePath.startsWith('http')
                    ? artist.imagePath
                    : client.getArtistImageUrl(artist.id)
                }
                alt={artistName}
                className="w-full h-full object-cover object-top grayscale-[0.1] contrast-[1.1]"
              />
              {/* Sophisticated fading layers */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
              <div className="absolute inset-0 bg-background/20" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800/50 to-background">
              <Users className="w-48 h-48 text-zinc-700/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}
        </div>

        {/* Hero Navigation & Content */}
        <div className="relative z-10 max-w-[1600px] mx-auto w-full px-12 pb-12 pointer-events-auto">
          {/* Back Button */}
          <div className="pt-4 pb-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-bold text-white/60 hover:text-white uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={10} /> Back
            </button>
          </div>

          {/* Artist Header Info */}
          <div className="mt-4 space-y-6">
            <div className="space-y-2">
              <div
                className="flex items-center gap-4"
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (artist) setArtistContextMenu({ artist, x: e.clientX, y: e.clientY })
                }}
              >
                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-none">
                  {artistName}
                </h1>
                {artist && (
                  <button
                    onClick={() => toggleArtistLoved(artist.id)}
                    className={cn(
                      'p-3 rounded-full transition-all hover:scale-110 active:scale-95 backdrop-blur-md border',
                      artist.loved
                        ? 'bg-red-500/20 border-red-500/30 text-red-500'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-red-400'
                    )}
                    title={artist.loved ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      size={24}
                      fill={artist.loved ? 'currentColor' : 'none'}
                      strokeWidth={2}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Action Bar & Stats Pills */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Primary Actions */}
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={handlePlayAll}
                  className="px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 shadow-xl shadow-primary/20 flex items-center gap-2 transition-all active:scale-95 group"
                >
                  <Play
                    size={16}
                    fill="currentColor"
                    className="group-hover:scale-110 transition-transform"
                  />
                  PLAY
                </button>
                <button
                  onClick={handleShuffleAll}
                  className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 border border-white/5 backdrop-blur-md"
                  title="Shuffle Artist"
                >
                  <Shuffle size={18} />
                </button>
              </div>

              {/* Stats & Genres Pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 bg-black/40 p-1.5 pl-4 rounded-full border border-white/5 backdrop-blur-md">
                  <div className="flex items-center gap-4 text-xs font-bold text-white/70 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{artistAlbums.length}</span>
                      <span className="opacity-40 uppercase tracking-widest text-[9px]">
                        Albums
                      </span>
                    </div>
                    <div className="w-[1px] h-3 bg-white/10" />
                    <div className="flex items-center gap-2">
                      <span className="text-white">{totalTracks}</span>
                      <span className="opacity-40 uppercase tracking-widest text-[9px]">
                        Tracks
                      </span>
                    </div>
                    {artist?.listeners && (
                      <>
                        <div className="w-[1px] h-3 bg-white/10" />
                        <div className="flex items-center gap-2">
                          <span className="text-white">
                            {Number(artist.listeners).toLocaleString()}
                          </span>
                          <span className="opacity-40 uppercase tracking-widest text-[9px]">
                            Listeners
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {artistGenres.map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-full bg-white/5 text-white/50 text-[9px] font-black uppercase tracking-widest border border-white/5 hover:text-primary transition-colors cursor-default"
                    >
                      <Hash size={8} className="inline mr-1 opacity-50" />
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Quick Facts Section */}
                <div className="flex items-center gap-2">
                  {artist?.country && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-white/60">
                      <MapPin size={10} className="text-primary" />
                      {artist.country}
                    </div>
                  )}
                  {artist?.lifeSpanBegin && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-white/60">
                      <Calendar size={10} className="text-primary" />
                      {artist.lifeSpanBegin.split('-')[0]}
                      {artist.lifeSpanEnd
                        ? ` – ${artist.lifeSpanEnd.split('-')[0]}`
                        : artist.lifeSpanBegin
                          ? ' – Present'
                          : ''}
                    </div>
                  )}
                  <button
                    onClick={syncArtistFacts}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all',
                      isSyncing && 'animate-pulse brightness-125'
                    )}
                    title="Sync Artist Facts from MusicBrainz"
                    disabled={isSyncing}
                  >
                    <RefreshCw size={10} className={cn(isSyncing && 'animate-spin')} />
                    {isSyncing ? 'Syncing...' : 'Sync Facts'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Top Tracks & Biography Grid */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-20">
            {/* Top Tracks */}
            {topTracks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-[1px] bg-primary/50" />
                  <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                    Popular Tracks
                  </h3>
                </div>

                <div className="space-y-0.5">
                  {topTracks.map((track, i) => {
                    const isCurrentTrack = currentTrack?.id === track.id
                    const isCurrentPlaying = isCurrentTrack && isPlaying
                    const isSelected = selectedTracks.includes(track.id)

                    return (
                      <div
                        key={track.id}
                        onClick={(e) => handleTrackClick(e, track.id, i)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          if (!isSelected) {
                            selectSingleTrack(track.id)
                          }
                          window.dispatchEvent(
                            new CustomEvent('show-track-context-menu', {
                              detail: { track, x: e.clientX, y: e.clientY }
                            })
                          )
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          window.dispatchEvent(
                            new CustomEvent('request-track-play', { detail: { track } })
                          )
                        }}
                        className={cn(
                          'group flex items-center gap-4 px-4 py-3 rounded-xl transition-all cursor-pointer border border-transparent select-none',
                          isSelected
                            ? 'bg-white/10'
                            : isCurrentTrack
                              ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/20'
                              : 'hover:bg-white/5 hover:border-white/5'
                        )}
                        draggable
                        onDragStart={(e) => {
                          const dragIds = isSelected ? selectedTracks : [track.id]
                          const dragTracks = tracks.filter((t) => dragIds.includes(t.id))

                          e.dataTransfer.setData(
                            'application/json',
                            JSON.stringify({
                              type: 'tracks',
                              data: dragTracks
                            })
                          )
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center relative">
                          <span
                            className={cn(
                              'text-xs font-bold transition-opacity tabular-nums',
                              isCurrentTrack
                                ? 'text-primary opacity-100'
                                : 'text-white/20 group-hover:opacity-0'
                            )}
                          >
                            {isCurrentPlaying ? (
                              <Shuffle size={12} className="animate-spin" />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              playTrack(track)
                            }}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                          >
                            <Play size={12} fill="currentColor" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'text-sm font-bold truncate transition-colors',
                              isCurrentTrack
                                ? 'text-primary'
                                : 'text-white/90 group-hover:text-white'
                            )}
                          >
                            {track.title}
                          </div>
                          <div
                            className={cn(
                              'text-[10px] font-medium truncate uppercase tracking-wider mt-0.5 transition-colors',
                              isCurrentTrack
                                ? 'text-primary/70'
                                : 'text-white/30 hover:text-primary'
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              // Find the album ID to navigate
                              const album = albums.find(
                                (a) => a.name === track.album && a.artist === track.artist
                              )
                              if (album) onAlbumClick(album.id)
                            }}
                          >
                            {track.album}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'transition-opacity duration-300',
                            track.rating > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <RatingStars
                            rating={track.rating}
                            size={10}
                            onChange={(r) => rateTrack(track.id, r)}
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLoved(track.id)
                          }}
                          className={cn(
                            'p-2 hover:scale-110 transition-all',
                            track.loved
                              ? 'text-red-500 opacity-100'
                              : 'text-white/20 opacity-0 group-hover:opacity-100'
                          )}
                        >
                          <Heart size={14} fill={track.loved ? 'currentColor' : 'none'} />
                        </button>
                        <div
                          className={cn(
                            'text-[10px] font-black tabular-nums w-10 text-right transition-colors',
                            isCurrentTrack ? 'text-primary/70' : 'text-white/40'
                          )}
                        >
                          {formatDuration(track.duration)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Biography & Facts */}
            <section className="space-y-6">
              <div className="flex items-center gap-4 opacity-40">
                <div className="w-12 h-[1px] bg-white" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                  About {artistName}
                </h3>
              </div>

              {/* Facts Panel */}
              {(artist?.country || artist?.type || artist?.gender || artist?.website) && (
                <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                  {artist.country && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                        Origin
                      </div>
                      <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                        <MapPin size={12} className="text-primary" /> {artist.country}
                      </div>
                    </div>
                  )}
                  {artist.lifeSpanBegin && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                        Activity
                      </div>
                      <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                        <Calendar size={12} className="text-primary" />
                        {artist.lifeSpanBegin.split('-')[0]}
                        {artist.lifeSpanEnd
                          ? ` – ${artist.lifeSpanEnd.split('-')[0]}`
                          : ' – Present'}
                      </div>
                    </div>
                  )}
                  {artist.type && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                        Type
                      </div>
                      <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                        <UserCircle2 size={12} className="text-primary" /> {artist.type}
                      </div>
                    </div>
                  )}
                  {artist.website && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                        Website
                      </div>
                      <a
                        href={artist.website}
                        onClick={(e) => {
                          e.preventDefault()
                          client.openExternal(artist.website!)
                        }}
                        className="text-sm font-bold text-primary hover:underline flex items-center gap-2 group"
                      >
                        <Globe size={12} className="group-hover:scale-110 transition-transform" />
                        Official Site
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="relative group/bio">
                <div
                  className={cn(
                    'text-zinc-300 leading-[1.6] text-base font-medium transition-all duration-500 ease-in-out',
                    !isBioExpanded ? 'max-h-[350px] overflow-hidden' : 'max-h-[2000px]'
                  )}
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
                  {artist?.bio ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: artist.bio }}
                      className="prose prose-invert prose-p:mb-4 prose-a:text-white/60 prose-a:underline hover:prose-a:text-white prose-p:text-sm prose-p:font-normal prose-p:leading-relaxed"
                    />
                  ) : (
                    <p className="italic opacity-50 text-sm font-normal">
                      No biography available for this artist yet.
                    </p>
                  )}
                </div>

                {artist?.bio && (
                  <div className="mt-2 flex justify-start">
                    <button
                      onClick={() => setIsBioExpanded(!isBioExpanded)}
                      className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/50 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                    >
                      {isBioExpanded ? (
                        <>
                          Show Less <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          Read More <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Bottom Fade for Truncated Bio */}
                {!isBioExpanded && artist?.bio && (
                  <div className="absolute bottom-[40px] left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                )}
              </div>
            </section>
          </div>

          {/* Discography - Organized Grid */}
          {artistAlbums.length > 0 && (
            <section className="mt-8 space-y-6">
              <div className="flex items-end justify-between border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                    Discography
                  </h3>
                  <p className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">
                    {sortBy === 'year' ? 'Chronological Order' : 'Most Popular'}
                  </p>
                </div>
                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/5 backdrop-blur-sm">
                  <button
                    onClick={() => {
                      if (sortBy === 'year') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                      else {
                        setSortBy('year')
                        setSortOrder('desc')
                      }
                    }}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2',
                      sortBy === 'year'
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-white/40 hover:text-white/60'
                    )}
                  >
                    BY YEAR
                    {sortBy === 'year' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDown size={10} strokeWidth={3} />
                      ) : (
                        <ChevronUp size={10} strokeWidth={3} />
                      ))}
                  </button>
                  <button
                    onClick={() => {
                      if (sortBy === 'popularity') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                      else {
                        setSortBy('popularity')
                        setSortOrder('desc')
                      }
                    }}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2',
                      sortBy === 'popularity'
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-white/40 hover:text-white/60'
                    )}
                  >
                    BY POPULARITY
                    {sortBy === 'popularity' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDown size={10} strokeWidth={3} />
                      ) : (
                        <ChevronUp size={10} strokeWidth={3} />
                      ))}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-8 gap-y-10">
                {artistAlbums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => onAlbumClick(album.id)}
                    className="bg-transparent p-0 hover:bg-transparent"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Member of / Group Members */}
          {artistMembers.length > 0 && (
            <section className="mt-16 space-y-6">
              <div className="flex items-center gap-4 opacity-40">
                <div className="w-12 h-[1px] bg-white" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                  {artist?.type === 'Group' || artist?.type === 'Band' ? 'Members' : 'Member Of'}
                </h3>
              </div>
              {isLoadingMembers ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 animate-pulse">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 bg-white/5 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {artistMembers.map((member, i) => (
                    <div key={`${member.mbid}-${i}`} className="group flex flex-col gap-2">
                      <button
                        onClick={async () => {
                          // Auto-add member as artist if not already in library
                          const existingArtist = artists.find(
                            (a) => a.name === member.name || a.musicbrainzArtistId === member.mbid
                          )
                          if (!existingArtist && member.mbid) {
                            try {
                              console.log(`[UI] Adding member as artist: ${member.name} (${member.mbid})`)
                              await client.getArtistDetails(member.mbid)
                            } catch (err) {
                              console.error('Failed to add member as artist:', err)
                            }
                          }
                          onArtistClick && onArtistClick(member.name)
                        }}
                        className="text-white/90 hover:text-white font-bold text-sm text-left truncate transition-colors hover:underline"
                      >
                        {member.name}
                      </button>
                      <span className="text-zinc-500 font-medium text-[10px] tracking-widest uppercase truncate">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Appearances */}
          {appearances.length > 0 && (
            <section className="mt-16 space-y-6">
              <div className="flex items-end justify-between border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                    Appears On
                  </h3>
                  <p className="text-zinc-500 font-bold text-[10px] tracking-widest uppercase">
                    Guest Contributions
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-8 gap-y-10">
                {appearances.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => onAlbumClick(album.id)}
                    className="bg-transparent p-0 hover:bg-transparent"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Related Artists */}
          {/* Related Artists (Last.fm) */}
          {/* Related Artists */}
          {similarArtists.length > 0 && (
            <section className="mt-16 space-y-6 pb-12">
              <div className="flex items-center gap-4 opacity-40">
                <div className="w-12 h-[1px] bg-white" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
                  Similarity
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {similarArtists.map((similar) => {
                  // Check if this artist exists locally
                  const localArtist = artists.find((a) => a.name === similar.name)
                  const albumCount = localArtist
                    ? albums.filter((album) => album.artist === similar.name).length
                    : 0

                  return (
                    <button
                      key={similar.name}
                      onClick={() => onArtistClick && onArtistClick(similar.name)}
                      className="group flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                    >
                      <div className="w-full aspect-square rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-all overflow-hidden">
                        {similar.image ? (
                          <img
                            src={similar.image}
                            alt={similar.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If online image fails, try local if available
                              if (localArtist) {
                                e.currentTarget.src =
                                  localArtist.imagePath && localArtist.imagePath.startsWith('http')
                                    ? localArtist.imagePath
                                    : client.getArtistImageUrl(localArtist.id)
                              } else {
                                e.currentTarget.style.display = 'none'
                              }
                            }}
                          />
                        ) : localArtist?.imagePath ? (
                          <img
                            src={
                              localArtist.imagePath.startsWith('http')
                                ? localArtist.imagePath
                                : client.getArtistImageUrl(localArtist.id)
                            }
                            alt={similar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users
                            size={32}
                            className="text-white/40 group-hover:text-primary/60 transition-colors"
                          />
                        )}
                      </div>
                      <div className="w-full text-center">
                        <div className="text-xs font-bold text-white/90 group-hover:text-white leading-tight transition-colors min-h-[2.5rem] flex items-center justify-center px-1">
                          {similar.name}
                        </div>
                        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mt-0.5">
                          {localArtist
                            ? `${albumCount} ${albumCount === 1 ? 'Album' : 'Albums'}`
                            : 'Discovery'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <QueueConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onReplace={handleConfirmReplace}
        onAppend={handleConfirmAppend}
        title="Clear Playlist?"
        message={`Your playlist is not empty. Would you like to clear it and play top tracks by "${artistName}", or just add them to the end?`}
      />

      {artistContextMenu && (
        <ArtistContextMenu
          artist={artistContextMenu.artist}
          x={artistContextMenu.x}
          y={artistContextMenu.y}
          onClose={() => setArtistContextMenu(null)}
        />
      )}
    </div>
  )
}
