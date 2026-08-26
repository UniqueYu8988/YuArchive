import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Music2, Pause, Play, Sparkles } from 'lucide-react'
import type { MusicItem } from '../types'
import { assetVersion } from '../data/siteConfig'

function toMediaUrl(path?: string) {
  if (!path) return ''
  if (/^(?:blob:|data:|https?:)/i.test(path)) return path
  const encodedPath = `/${encodeURIComponent(path).replace(/%2F/g, '/')}`
  return assetVersion ? `${encodedPath}?v=${encodeURIComponent(assetVersion)}` : encodedPath
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function firstTrack(content: string) {
  return content
    .split('\n')
    .map(line => line.trim())
    .find(line => /^(?:[-*+]|\d+\.)\s+/.test(line))
    ?.replace(/^(?:[-*+]|\d+\.)\s+/, '')
    .trim() ?? ''
}

export function MusicAlbumCard({
  item,
  active = true,
  onSelect,
}: {
  item: MusicItem
  active?: boolean
  onSelect?: () => void
}) {
  return (
    <button type="button" onClick={onSelect} className={`music-album-card${active ? ' is-active' : ''}`}>
      <div className="music-album-card__cover">
        {item.cover ? <img src={toMediaUrl(item.cover)} alt={item.title} loading="lazy" /> : <Music2 size={28} />}
        <div className="music-library-card__overlay">{item.title}</div>
      </div>
    </button>
  )
}

export default function MusicAlbumFeature({
  item,
  allowExternalLink = true,
}: {
  item: MusicItem
  allowExternalLink?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioUrl = toMediaUrl(item.audio)
  const hasAudio = Boolean(audioUrl)
  const featuredTrack = useMemo(() => item.track_title || firstTrack(item.content), [item.content, item.track_title])
  const directUrl = item.url?.trim() || ''
  const actionUrl = directUrl || `https://open.spotify.com/search/${encodeURIComponent(item.title)}`
  const actionLabel = directUrl ? 'Open Link' : 'Spotify Search'
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    audio.load()
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [audioUrl, item.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const loaded = () => setDuration(audio.duration || 0)
    const time = () => setCurrentTime(audio.currentTime || 0)
    const ended = () => { setIsPlaying(false); setCurrentTime(0) }
    const paused = () => setIsPlaying(false)
    const played = () => setIsPlaying(true)
    audio.addEventListener('loadedmetadata', loaded)
    audio.addEventListener('timeupdate', time)
    audio.addEventListener('ended', ended)
    audio.addEventListener('pause', paused)
    audio.addEventListener('play', played)
    return () => {
      audio.removeEventListener('loadedmetadata', loaded)
      audio.removeEventListener('timeupdate', time)
      audio.removeEventListener('ended', ended)
      audio.removeEventListener('pause', paused)
      audio.removeEventListener('play', played)
    }
  }, [audioUrl])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || !hasAudio) return
    if (isPlaying) return audio.pause()
    try { await audio.play() } catch { setIsPlaying(false) }
  }

  const seek = (next: number) => {
    if (!audioRef.current || !Number.isFinite(next)) return
    audioRef.current.currentTime = next
    setCurrentTime(next)
  }

  return (
    <section className="music-album-feature">
      <div className="music-album-feature__layout">
        <div className="music-album-feature__artwork">
          <div className="music-album-feature__cover">
            {item.cover ? <img src={toMediaUrl(item.cover)} alt={item.title} loading="lazy" /> : <Music2 size={44} />}
          </div>
        </div>

        <div className="music-album-feature__body">
          <div className="music-album-feature__badges">
            <span><Sparkles size={13} />Featured Album</span>
            <span className={hasAudio ? 'is-ready' : ''}>
              <i className={hasAudio ? (isPlaying ? 'music-status-dot is-live' : 'music-status-dot') : 'music-status-dot is-muted'} />
              {hasAudio ? 'Preview Ready' : 'Archive Only'}
            </span>
          </div>

          <h2>{item.title}</h2>
          {item.description ? <p>{item.description}</p> : null}

          {featuredTrack ? (
            <div className="music-album-feature__track">
              <small>Now Playing</small>
              <strong>{featuredTrack}</strong>
              <input
                className="music-progress"
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={event => seek(Number(event.target.value))}
                disabled={!hasAudio}
                style={{
                  opacity: hasAudio ? 1 : 0.45,
                  background: `linear-gradient(90deg, var(--music-progress-fill, #1DB954) 0%, var(--music-progress-fill, #1DB954) ${progressPercent}%, var(--music-progress-track, rgba(255,255,255,0.12)) ${progressPercent}%, var(--music-progress-track, rgba(255,255,255,0.12)) 100%)`,
                }}
              />
              <div><span>{formatTime(currentTime)}</span><span>{hasAudio ? formatTime(duration) : '未添加试听'}</span></div>
            </div>
          ) : null}

          <audio ref={audioRef} preload="none">{audioUrl ? <source src={audioUrl} /> : null}</audio>
          <div className="music-album-feature__actions">
            <button type="button" onClick={togglePlayback} disabled={!hasAudio} className={hasAudio ? (isPlaying ? 'music-play-button is-playing' : 'music-play-button') : 'music-play-button is-disabled'}>
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {hasAudio ? (isPlaying ? 'Pause Preview' : 'Play Preview') : 'No Preview'}
            </button>
            {allowExternalLink ? (
              <a href={actionUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />{actionLabel}</a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
