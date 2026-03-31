import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Music2, Pause, Play, Sparkles } from 'lucide-react'
import type { MusicCategory, MusicItem } from '../types'
import { siteUi } from '../data/siteConfig'

function toImageUrl(imagePath?: string): string {
  if (!imagePath) return ''
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function extractTracks(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^(?:[-*+]|\d+\.)\s+/.test(line))
    .map(line => line.replace(/^(?:[-*+]|\d+\.)\s+/, '').trim())
}

function AlbumCard({
  item,
  active,
  onSelect,
}: {
  item: MusicItem
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        border: active ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.06)',
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
        borderRadius: '22px',
        padding: '0.95rem',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.24s ease',
        boxShadow: active ? '0 16px 36px rgba(0,0,0,0.08)' : '0 8px 20px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          borderRadius: '18px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)',
          position: 'relative',
        }}
      >
        {item.cover ? (
          <img
            src={toImageUrl(item.cover)}
            alt={item.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <Music2 size={28} />
          </div>
        )}

        <div
          className="music-library-card__overlay"
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            padding: '0.85rem 0.9rem 0.8rem',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.72) 100%)',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 700,
            lineHeight: 1.25,
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.22s ease',
            pointerEvents: 'none',
          }}
        >
          {item.title}
        </div>
      </div>
    </button>
  )
}

interface Props {
  data: MusicCategory
}

export default function MusicPage({ data }: Props) {
  const hasData = data.items.length > 0 && data.total_count > 0
  const [selectedId, setSelectedId] = useState<string | null>(data.items[0]?.id ?? null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!data.items.length) {
      setSelectedId(null)
      return
    }

    setSelectedId(current =>
      current && data.items.some(item => item.id === current) ? current : data.items[0].id
    )
  }, [data.items])

  const selectedItem = useMemo(
    () => data.items.find(item => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId]
  )

  const tracks = useMemo(() => (selectedItem ? extractTracks(selectedItem.content) : []), [selectedItem])
  const featuredTrack = selectedItem?.track_title || tracks[0] || ''
  const audioUrl = selectedItem?.audio ? toImageUrl(selectedItem.audio) : ''
  const hasAudio = Boolean(audioUrl)
  const directUrl = selectedItem?.url?.trim() || ''
  const albumActionUrl = directUrl || `https://open.spotify.com/search/${encodeURIComponent(selectedItem?.title || '')}`
  const albumActionLabel = directUrl ? 'Open Link' : 'Spotify Search'
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
  }, [audioUrl, selectedId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => setDuration(audio.duration || 0)
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [audioUrl])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || !hasAudio) return

    if (isPlaying) {
      audio.pause()
      return
    }

    try {
      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }

  const handleSeek = (nextValue: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(nextValue)) return
    audio.currentTime = nextValue
    setCurrentTime(nextValue)
  }

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '1460px', paddingTop: '0.9rem' }}>
        {hasData && selectedItem ? (
          <div
            className="animate-fade-up"
            style={{
              display: 'grid',
              gap: '1.5rem',
            }}
          >
            <div className="md:grid md:grid-cols-[250px_1fr] md:gap-6" style={{ display: 'grid', gap: '1.5rem' }}>
              <aside
                style={{
                  position: 'sticky',
                  top: '88px',
                }}
              >
                <div
                  style={{
                    padding: '0.2rem 1.1rem 1rem',
                    marginBottom: '0.45rem',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.45rem',
                    }}
                  >
                    {data.display_name}
                  </div>
                  <h1
                    style={{
                      fontSize: '2rem',
                      lineHeight: 1,
                      letterSpacing: '-0.05em',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    律动共鸣
                  </h1>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.86rem',
                      marginTop: '0.55rem',
                    }}
                  >
                    共收录 <strong style={{ color: 'var(--text-primary)' }}>{data.total_count}</strong> 张声音切片
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: '24px',
                    border: '1px solid var(--glass-border)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
                    padding: '1.1rem',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.05)',
                  }}
                >
                  <div
                    style={{
                      padding: '0.9rem',
                      borderRadius: '18px',
                      background: 'rgba(255,255,255,0.04)',
                      marginBottom: '1rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.16em',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.45rem',
                      }}
                    >
                      {siteUi.current_album}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {selectedItem.title}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.38rem' }}>
                    {tracks.length > 0 ? (
                      tracks.map((track, index) => {
                        const active = track === featuredTrack || (!featuredTrack && index === 0)
                        return (
                          <a
                            key={`${selectedItem.id}_${index}`}
                            href={directUrl || `https://open.spotify.com/search/${encodeURIComponent(track)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="music-track-link"
                            style={{
                              textAlign: 'left',
                              borderRadius: '14px',
                              padding: '0.76rem 0.82rem',
                              cursor: 'pointer',
                              background: active ? 'rgba(29,185,84,0.12)' : 'transparent',
                              color: active ? '#149244' : 'var(--text-secondary)',
                              fontSize: '0.84rem',
                              transition: 'all 0.22s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              textDecoration: 'none',
                            }}
                          >
                            <Music2 size={14} />
                            <span
                              className="music-track-link__label"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textDecoration: active ? 'none' : undefined,
                              }}
                            >
                              {track}
                            </span>
                            <span
                              className="music-track-link__arrow"
                              style={{
                                marginLeft: 'auto',
                                color: '#1DB954',
                                opacity: active ? 1 : 0,
                                transform: active ? 'translateX(0)' : 'translateX(-6px)',
                                transition: 'all 0.22s ease',
                                fontSize: '0.8rem',
                              }}
                            >
                              ↗
                            </span>
                          </a>
                        )
                      })
                    ) : (
                      <div
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          padding: '0.6rem 0.2rem',
                        }}
                      >
                        这张音册暂时还没有可展示的单曲列表。
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              <main style={{ minWidth: 0 }}>
                <section
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '30px',
                    border: '1px solid var(--glass-border)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.07)',
                    padding: '1.6rem',
                  }}
                >
                  <div
                    key={selectedItem.id}
                    className="music-feature-panel md:grid md:grid-cols-[300px_1fr] md:gap-8"
                    style={{ display: 'grid', gap: '1.5rem' }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        minHeight: '300px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedItem.cover && (
                        <>
                          <img
                            src={toImageUrl(selectedItem.cover)}
                            alt=""
                            aria-hidden
                            style={{
                              position: 'absolute',
                              inset: '8% 6% 10% 6%',
                              width: '88%',
                              height: '82%',
                              objectFit: 'cover',
                              filter: 'blur(34px) saturate(1.05)',
                              opacity: 0.26,
                              transform: 'scale(1.08)',
                              borderRadius: '28px',
                            }}
                          />
                        </>
                      )}

                      <div
                        style={{
                          position: 'relative',
                          width: 'min(100%, 290px)',
                          zIndex: 1,
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: '1 / 1',
                            borderRadius: '28px',
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 28px 52px rgba(0,0,0,0.16)',
                          }}
                        >
                          {selectedItem.cover ? (
                            <img
                              src={toImageUrl(selectedItem.cover)}
                              alt={selectedItem.title}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <Music2 size={44} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.65rem',
                          alignItems: 'center',
                          marginBottom: '0.95rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.48rem',
                            padding: '0.4rem 0.78rem',
                            borderRadius: '999px',
                            background: 'rgba(29,185,84,0.1)',
                            color: '#149244',
                            fontSize: '0.7rem',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            width: 'fit-content',
                          }}
                        >
                          <Sparkles size={13} />
                          Featured Album
                        </div>

                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.42rem',
                            padding: '0.38rem 0.72rem',
                            borderRadius: '999px',
                            background: hasAudio ? 'rgba(29,185,84,0.08)' : 'rgba(255,255,255,0.04)',
                            color: hasAudio ? '#149244' : 'var(--text-secondary)',
                            fontSize: '0.68rem',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            width: 'fit-content',
                          }}
                        >
                          <span
                            style={{
                              width: '0.44rem',
                              height: '0.44rem',
                              borderRadius: '999px',
                              background: hasAudio ? '#1DB954' : 'rgba(255,255,255,0.32)',
                              boxShadow: hasAudio ? '0 0 0 4px rgba(29,185,84,0.1)' : 'none',
                            }}
                          />
                          {hasAudio ? 'Preview Ready' : 'Archive Only'}
                        </div>
                      </div>

                      <h2
                        style={{
                          fontSize: 'clamp(2.4rem, 5vw, 4.8rem)',
                          lineHeight: 0.94,
                          letterSpacing: '-0.065em',
                          color: 'var(--text-primary)',
                          fontWeight: 800,
                          marginBottom: '1rem',
                        }}
                      >
                        {selectedItem.title}
                      </h2>

                      {selectedItem.description && (
                        <p
                          style={{
                            maxWidth: '760px',
                            color: 'var(--text-secondary)',
                            fontSize: '1rem',
                            lineHeight: 1.78,
                            marginBottom: '1rem',
                          }}
                        >
                          {selectedItem.description}
                        </p>
                      )}

                      {featuredTrack && (
                        <div
                          style={{
                            padding: '0.95rem 1rem',
                            borderRadius: '18px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            marginBottom: '1rem',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.7rem',
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.4rem',
                            }}
                          >
                            Now Playing
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                            {featuredTrack}
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gap: '0.45rem',
                              marginTop: '0.85rem',
                            }}
                          >
                            <input
                              className="music-progress"
                              type="range"
                              min={0}
                              max={duration || 0}
                              step={0.1}
                              value={Math.min(currentTime, duration || 0)}
                              onChange={event => handleSeek(Number(event.target.value))}
                              disabled={!hasAudio}
                              style={{
                                width: '100%',
                                cursor: hasAudio ? 'pointer' : 'not-allowed',
                                opacity: hasAudio ? 1 : 0.45,
                                background: `linear-gradient(90deg, #1DB954 0%, #1DB954 ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%, rgba(255,255,255,0.12) 100%)`,
                              }}
                            />
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <span>{formatTime(currentTime)}</span>
                              <span>{hasAudio ? formatTime(duration) : '未添加试听'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <audio ref={audioRef} preload="none">
                        {audioUrl ? <source src={audioUrl} /> : null}
                      </audio>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          onClick={togglePlayback}
                          disabled={!hasAudio}
                          style={{
                            border: 'none',
                            borderRadius: '999px',
                            padding: '0.88rem 1.35rem',
                            background: hasAudio ? '#1DB954' : 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.55rem',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            cursor: hasAudio ? 'pointer' : 'not-allowed',
                            boxShadow: hasAudio ? '0 14px 28px rgba(29,185,84,0.18)' : 'none',
                            opacity: hasAudio ? 1 : 0.6,
                          }}
                        >
                          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                          {hasAudio ? (isPlaying ? 'Pause Preview' : 'Play Preview') : 'No Preview'}
                        </button>

                        <a
                          href={albumActionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            borderRadius: '999px',
                            padding: '0.82rem 1.05rem',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            textDecoration: 'none',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLink size={15} />
                          {albumActionLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                </section>

                <section style={{ marginTop: '2.1rem' }}>
                  <div className="year-header" style={{ marginBottom: '1rem' }}>
                    <div>
                      <h2 className="year-title text-xl md:text-2xl">My Library</h2>
                      <p
                        style={{
                          marginTop: '0.45rem',
                          color: 'var(--text-secondary)',
                          fontSize: '0.84rem',
                          paddingLeft: '1.1rem',
                        }}
                      >
                        被反复收藏、也被反复点开的那些声音封套。
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    {data.items.map(item => (
                      <AlbumCard
                        key={item.id}
                        item={item}
                        active={item.id === selectedItem.id}
                        onSelect={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </section>
              </main>
            </div>
          </div>
        ) : (
          <div className="empty-vault animate-fade-up">
            <div style={{ fontSize: '6rem', color: 'var(--glass-border)', userSelect: 'none', lineHeight: 1 }}>∅</div>
            <div className="empty-vault-badge">
              <p
                style={{
                  fontSize: '0.68rem',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                AUDIO · CLASSIFIED
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>频率尚未锁定</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .music-progress {
          appearance: none;
          -webkit-appearance: none;
          height: 6px;
          border-radius: 999px;
          outline: none;
        }
        .music-progress::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: transparent;
        }
        .music-progress::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          margin-top: -4px;
          background: #ffffff;
          border: 2px solid #1DB954;
          box-shadow: 0 4px 12px rgba(0,0,0,0.16);
        }
        .music-progress::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
        }
        .music-progress::-moz-range-progress {
          height: 6px;
          border-radius: 999px;
          background: #1DB954;
        }
        .music-progress::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #ffffff;
          border: 2px solid #1DB954;
          box-shadow: 0 4px 12px rgba(0,0,0,0.16);
        }
        .music-track-link:hover {
          background: rgba(29,185,84,0.08) !important;
          color: #149244 !important;
        }
        .music-track-link:hover .music-track-link__label {
          color: #149244 !important;
        }
        .music-track-link:hover .music-track-link__arrow {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }
        button:hover .music-library-card__overlay {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .music-feature-panel {
          animation: musicFeatureSwap 340ms cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: center top;
        }
        @keyframes musicFeatureSwap {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
