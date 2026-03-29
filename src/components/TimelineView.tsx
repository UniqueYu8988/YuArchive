import { useMemo, useState } from 'react'
import { CircleDollarSign, Clock3, Gem, Layers3, Star } from 'lucide-react'
import type { TimelineCategory, ArchiveItem } from '../types'
import { yearDescriptions, easterEggYear } from '../data/yearDescriptions'

function toImageUrl(imagePath: string): string {
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

function CountBadge({ count, unit }: { count: number; unit: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.55rem',
        padding: '0.35rem 0.7rem 0.35rem 0.85rem',
        borderRadius: '999px',
        border: '1px solid var(--glass-border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.05)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '0.62rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.75,
        }}
      >
        收录
      </span>
      <span
        style={{
          fontSize: '0.9rem',
          lineHeight: 1,
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: '"Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: '0.68rem',
          letterSpacing: '0.08em',
        }}
      >
        {unit}
      </span>
    </div>
  )
}

// ── 单张海报卡片 (改造成 Steam 纯净直连魔法链接) ───────────────────
function formatGameRating(rating?: number | '') {
  const value = typeof rating === 'number' ? rating : 0
  return value > 0 ? '★'.repeat(value) : '未评分'
}

function formatGameGenre(genre?: string) {
  const labels: Record<string, string> = {
    action: '动作',
    rpg: '角色扮演',
    strategy: '策略',
    shooter: '射击',
    simulation: '模拟',
    sports: '体育',
    racing: '竞速',
    puzzle: '解谜',
    casual: '休闲',
  }
  if (!genre) return '未分类'
  return labels[genre] ?? genre
}

function formatGamePlaytime(playtime?: string) {
  if (!playtime) return '未知'
  return playtime
}

function platformIconPath(platform?: string) {
  const icons: Record<string, string> = {
    steam: '/platform-icons/steam.svg',
    xbox: '/platform-icons/xbox.svg',
    riotgame: '/platform-icons/riotgame.svg',
    battlenet: '/platform-icons/battlenet.svg',
    playstation: '/platform-icons/playstation.svg',
    switch: '/platform-icons/switch.svg',
  }
  return icons[platform ?? ''] ?? ''
}

function renderSeasonEntryMeta(itemTitle: string, entry: NonNullable<ArchiveItem['season_entries']>[number]) {
  const lines: string[] = []

  if (itemTitle === '英雄联盟') {
    if (entry.champion) lines.push(entry.champion)
    if (entry.note) lines.push(entry.note)
  } else if (itemTitle === '云顶之弈') {
    if (entry.period) lines.push(`时间：${entry.period}`)
    if (entry.feature) lines.push(`机制：${entry.feature}`)
  } else if (itemTitle === '暗黑破坏神 IV') {
    if (entry.period) lines.push(`时间：${entry.period}`)
    if (entry.build) lines.push(`职业：${entry.build}`)
  }

  return lines.slice(0, 3)
}

function PosterCard({
  item,
  mode = 'default',
  expanded = false,
  onToggleSeason,
  forceStatic = false,
}: {
  item: ArchiveItem
  mode?: 'default' | 'games'
  expanded?: boolean
  onToggleSeason?: (id: string) => void
  forceStatic?: boolean
}) {
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState(false)
  const href = item.url || '#'
  const isGames = mode === 'games' && item.game_meta_enabled
  const isSeasonal = Boolean(item.seasonal && item.season_entries?.length)
  const isDlc = Boolean(item.dlc)
  const ratingText = useMemo(() => formatGameRating(item.rating), [item.rating])
  const cardStyle = { display: 'block', textDecoration: 'none' } as const
  const cardContent = (
    <>
      {!loaded && !error && <div className="absolute inset-0 poster-skeleton" />}
      {error && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-secondary)' }}>
          <span style={{ fontSize:'0.65rem', color:'var(--text-secondary)', fontFamily:'monospace' }}>N/A</span>
        </div>
      )}
      {!error && (
        <img
          src={toImageUrl(item.image_path)}
          alt={item.title}
          loading="lazy"
          onLoad={()  => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true) }}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.4s' }}
        />
      )}
      {isSeasonal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '12px',
            border: expanded ? '2px solid rgba(96,165,250,0.95)' : '1px solid rgba(255,255,255,0.12)',
            boxShadow: expanded ? '0 0 0 3px rgba(96,165,250,0.18), 0 18px 40px rgba(37,99,235,0.24)' : 'none',
            transition: 'all 0.25s ease',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
      {!isGames ? (
        <div className="card-overlay p-2 md:p-3">
          <span className="card-title text-[10px] md:text-sm">{item.title}</span>
        </div>
      ) : (
        <>
          <div
            className="game-hover-shell p-3 md:p-4"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(8,8,12,0.92) 0%, rgba(8,8,12,0.72) 45%, rgba(8,8,12,0.08) 100%)',
              transition: 'opacity 0.28s ease',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              zIndex: 2,
            }}
          >
            <div className="game-hover-overlay">
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.25 }}>
                {item.title}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.72rem', lineHeight: 1.25, marginTop: '0.2rem' }}>
                {item.english_title || 'Pending Title'}
              </div>
              {item.summary && (
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.66rem', lineHeight: 1.45, marginTop: '0.45rem' }}>
                  {item.summary}
                </div>
              )}
              <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.75rem' }}>
                <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.68rem' }}>
                  {formatGameGenre(item.genre)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: '0.68rem' }}>
                  <Star size={12} color="#facc15" fill="#facc15" />
                  <span>{ratingText}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: '0.68rem' }}>
                  <Clock3 size={12} />
                  <span>{formatGamePlaytime(item.playtime)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: '0.68rem' }}>
                  <CircleDollarSign size={12} />
                  <span>{item.price || '--'}</span>
                </div>
              </div>
              {isDlc && item.dlc_parent && (
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.64rem', lineHeight: 1.45, marginTop: '0.65rem' }}>
                  扩展所属：{item.dlc_parent}
                </div>
              )}
              {item.hover_note && (
                <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.63rem', lineHeight: 1.45, marginTop: '0.7rem', paddingRight: item.platform ? '2.8rem' : undefined }}>
                  {item.hover_note}
                </div>
              )}
            </div>
          </div>

          {item.platform && (
            <div style={{
              position: 'absolute',
              right: '0.55rem',
              bottom: '0.55rem',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3,
              borderRadius: '10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(244,244,245,0.78) 100%)',
              backdropFilter: 'blur(6px)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.26)',
            }}>
              <img
                src={platformIconPath(item.platform)}
                alt={item.platform}
                style={{
                  width: item.platform === 'playstation' ? '24px' : '23px',
                  height: item.platform === 'playstation' ? '24px' : '23px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))',
                }}
              />
            </div>
          )}

          {item.completed && (
            <div style={{
              position: 'absolute',
              top: '0.45rem',
              right: '0.45rem',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3,
            }}>
              <img
                src="/platform-icons/crown.svg"
                alt="completed"
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain',
                  imageRendering: 'pixelated',
                  filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.35))',
                }}
              />
            </div>
          )}

          {(isSeasonal || isDlc) && (
            <div style={{
              position: 'absolute',
              top: '0.45rem',
              left: '0.45rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              zIndex: 3,
              pointerEvents: 'none',
            }}>
              {isSeasonal && (
                <div style={{
                  minWidth: '54px',
                  height: '28px',
                  borderRadius: '10px',
                  background: expanded ? 'rgba(59,130,246,0.94)' : 'rgba(17,24,39,0.82)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 0.5rem',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
                  gap: '0.35rem',
                }}>
                  <Layers3 size={14} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {expanded ? '收起' : '赛季'}
                  </span>
                </div>
              )}
              {isDlc && (
                <div style={{
                  minWidth: '54px',
                  height: '28px',
                  borderRadius: '10px',
                  background: 'rgba(17,24,39,0.62)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 0.5rem',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                  gap: '0.35rem',
                }}>
                  <Gem size={12} color="#fde68a" />
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}>
                    拓展
                  </span>
                </div>
              )}
            </div>
          )}

        </>
      )}
    </>
  )

  if (forceStatic) {
    return (
      <div
        className="poster-card interactive-poster"
        style={cardStyle}
      >
        {cardContent}
      </div>
    )
  }

  if (isSeasonal) {
    return (
      <button
        type="button"
        onClick={() => onToggleSeason?.(item.id)}
        className="poster-card interactive-poster"
        style={{ ...cardStyle, border: 'none', padding: 0, background: 'transparent', textAlign: 'left' }}
        aria-pressed={expanded}
      >
        {cardContent}
      </button>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="poster-card interactive-poster"
      style={cardStyle}
    >
      {cardContent}
    </a>
  )
}

function SeasonPanel({ item }: { item: ArchiveItem }) {
  const entries = item.season_entries ?? []
  if (!entries.length) return null

  return (
    <div
      className="season-inline-panel"
      style={{
        borderRadius: '18px',
        border: '1px solid var(--glass-border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        padding: '1rem',
        boxShadow: '0 18px 40px rgba(0,0,0,0.08)',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {item.season_description && (
        <div style={{ marginBottom: '0.95rem', maxWidth: '760px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.7 }}>
          {item.season_description}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 132px))',
          gap: '0.9rem',
          alignContent: 'start',
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="season-entry-card"
            style={{
              display: 'grid',
              gap: '0.45rem',
              padding: '0.4rem',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {(() => {
              const metaLines = renderSeasonEntryMeta(item.title, entry)
              return (
                <>
                  <div
                    style={{
                      aspectRatio: '2 / 3',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'var(--bg-secondary)',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={toImageUrl(entry.image_path)}
                      alt={entry.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div
                      className="season-entry-hover"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        padding: '0.72rem',
                        background: 'linear-gradient(to top, rgba(8,8,12,0.94) 0%, rgba(8,8,12,0.78) 52%, rgba(8,8,12,0.14) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        transition: 'opacity 0.25s ease',
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ color: '#fff', fontSize: '0.78rem', lineHeight: 1.3, fontWeight: 700 }}>
                        {entry.title}
                      </div>
                      <div style={{ display: 'grid', gap: '0.18rem', marginTop: '0.45rem' }}>
                        {metaLines.map((line, index) => (
                          <div
                            key={`${entry.id}_${index}`}
                            style={{
                              color: 'rgba(255,255,255,0.82)',
                              fontSize: '0.64rem',
                              lineHeight: 1.42,
                            }}
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}

function LiveArchiveSection({
  items,
  mode,
}: {
  items: ArchiveItem[]
  mode?: 'default' | 'games'
}) {
  const [expandedSeasonTitle, setExpandedSeasonTitle] = useState<string | null>(null)
  const expandedSeasonItem = items.find(item => item.title === expandedSeasonTitle) ?? null

  if (!items.length) return null

  return (
    <div className="year-section animate-fade-up" style={{ opacity: 1, animationFillMode: 'both' }}>
      <div className="year-header">
        <h2 className="year-title text-xl md:text-2xl">未完待续</h2>
        <div className="year-line" />
        <CountBadge count={items.length} unit="项" />
      </div>

      <p className="year-desc text-xs md:text-sm">有些事物并不停在某一年，它们会在漫长更迭中反复归来，像季风，像联赛，像迟迟没有写完的旧梦。</p>

      <div className="season-featured-section">
        <div className="season-featured-grid">
          {items.map(item => (
            <div
              key={item.id}
              className="live-archive-card-button"
              onClick={() => setExpandedSeasonTitle(current => (current === item.title ? null : item.title))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setExpandedSeasonTitle(current => (current === item.title ? null : item.title))
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={expandedSeasonTitle === item.title}
            >
              <PosterCard
                item={item}
                mode={mode}
                expanded={expandedSeasonTitle === item.title}
                forceStatic
              />
            </div>
          ))}
        </div>
        {expandedSeasonItem && (
          <div className="season-featured-panel">
            <SeasonPanel item={expandedSeasonItem} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── 年份区块（含诗句描述） ────────────────────────────────────
function YearSection({
  year,
  items,
  index,
  isEasterEgg = false,
  mode = 'default',
}: {
  year: number
  items: ArchiveItem[]
  index: number
  isEasterEgg?: boolean
  mode?: 'default' | 'games'
}) {
  const desc = yearDescriptions[year]

  return (
    <div
      className="year-section animate-fade-up"
      style={{ animationDelay: `${index * 0.07}s`, opacity: 0, animationFillMode: 'both' }}
    >
      {/* 年份标题行 */}
      <div className="year-header">
        <h2 className="year-title text-xl md:text-2xl">{year === 2025.5 ? 'SEASON / 赛季专区' : year === 0 ? '未分类' : year}</h2>
        <div className="year-line" />
        {!isEasterEgg && (
          <CountBadge count={items.length} unit="项" />
        )}
      </div>

      {/* 年份诗句 */}
      {desc && (
        <p className="year-desc text-xs md:text-sm">{desc}</p>
      )}

      {/* 海报网格（彩蛋年份无内容）*/}
      {!isEasterEgg && items.length > 0 && (
        <>
          {items.length > 0 && (
            <div className="year-grid">
              {items.map(item => (
                <PosterCard
                  key={item.id}
                  item={item}
                  mode={mode}
                  expanded={false}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 彩蛋年份：显示前辈原文诗句，同时加一行极客注释 */}
      {isEasterEgg && (
        <>
          <p className="year-desc">{easterEggYear.desc}</p>
          <div style={{ paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.4, fontFamily: 'monospace', marginTop: '0.5rem' }}>
            // PLAYER 1 HAS ENTERED THE GAME
          </div>
        </>
      )}
    </div>
  )
}

// ── TimelineView 主组件 ─────────────────────────────────────
interface TimelineViewProps {
  data: TimelineCategory
  title: string
  subtitle?: string
  /** 是否在底部追加 2001 彩蛋（只有 Games 页需要） */
  showEasterEgg?: boolean
  mode?: 'default' | 'games'
}

export default function TimelineView({ data, title, subtitle: _subtitle, showEasterEgg = false, mode = 'default' }: TimelineViewProps) {
  const hasData = data.years.length > 0 && data.total_count > 0
  const liveItems = mode === 'games'
    ? data.years.flatMap(yearGroup => yearGroup.items.filter(item => item.seasonal))
    : []
  const displayYears = mode === 'games'
    ? data.years
        .map(yearGroup => ({
          ...yearGroup,
          items: yearGroup.items.filter(item => !item.seasonal),
        }))
        .filter(yearGroup => yearGroup.items.length > 0)
    : data.years

  return (
    <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '1460px', paddingTop: '0.9rem', paddingBottom: '6rem' }}>
      {hasData ? (
        <div className="animate-fade-up md:grid md:grid-cols-[250px_1fr] md:gap-6" style={{ display: 'grid', gap: '1.5rem' }}>
          <aside
            style={{
              position: 'sticky',
              top: '88px',
              alignSelf: 'start',
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
                {title}
              </h1>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.86rem',
                  marginTop: '0.55rem',
                }}
              >
                共收录 <strong style={{ color: 'var(--text-primary)' }}>{data.total_count}</strong> 款作品
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
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.95rem',
                }}
              >
                Archive Index
              </div>

              {liveItems.length > 0 && (
                <a
                  href="#timeline-live-archive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    textDecoration: 'none',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '14px',
                    padding: '0.76rem 0.82rem',
                    marginBottom: '0.8rem',
                  }}
                >
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>未完待续</span>
                  <span style={{ fontSize: '0.74rem' }}>{liveItems.length}</span>
                </a>
              )}

              <div style={{ display: 'grid', gap: '0.38rem' }}>
                {displayYears.map(yearGroup => (
                  <a
                    key={yearGroup.year}
                    href={`#timeline-year-${yearGroup.year}`}
                    style={{
                      textAlign: 'left',
                      borderRadius: '14px',
                      padding: '0.76rem 0.82rem',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.84rem',
                      transition: 'all 0.22s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.6rem',
                      textDecoration: 'none',
                    }}
                  >
                    <span>{yearGroup.year === 0 ? '未分类' : yearGroup.year}</span>
                    <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>{yearGroup.items.length}</span>
                  </a>
                ))}
                {showEasterEgg && (
                  <a
                    href={`#timeline-year-${easterEggYear.year}`}
                    style={{
                      textAlign: 'left',
                      borderRadius: '14px',
                      padding: '0.76rem 0.82rem',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.6rem',
                      textDecoration: 'none',
                    }}
                  >
                    <span>{easterEggYear.year}</span>
                    <span style={{ fontSize: '0.74rem', opacity: 0.5 }}>?</span>
                  </a>
                )}
              </div>
            </div>
          </aside>

          <main style={{ minWidth: 0 }}>
            <div className="media-grid-container" style={{ padding: 0, maxWidth: 'none' }}>
              {liveItems.length > 0 && (
                <div id="timeline-live-archive" style={{ scrollMarginTop: '108px' }}>
                  <LiveArchiveSection items={liveItems} mode={mode} />
                </div>
              )}

              {displayYears.map((yearGroup, idx) => (
                <div
                  key={yearGroup.year}
                  id={`timeline-year-${yearGroup.year}`}
                  style={{ scrollMarginTop: '108px' }}
                >
                  <YearSection
                    year={yearGroup.year}
                    items={yearGroup.items}
                    index={idx}
                    mode={mode}
                  />
                </div>
              ))}

              {showEasterEgg && (
                <div
                  id={`timeline-year-${easterEggYear.year}`}
                  style={{ scrollMarginTop: '108px' }}
                >
                  <YearSection
                    year={easterEggYear.year}
                    items={[]}
                    index={data.years.length}
                    isEasterEgg
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        <div className="empty-vault animate-fade-up">
          <div style={{ fontSize: '6rem', color: 'var(--glass-border)', userSelect: 'none', lineHeight: 1 }}>∅</div>
          <div className="empty-vault-badge">
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {data.display_name} · CLASSIFIED
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>档案尚未解密</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.3rem', fontFamily: 'monospace', opacity: 0.5 }}>
              // PENDING INITIALIZATION
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
