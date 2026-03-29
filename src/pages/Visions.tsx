import { useMemo, useState } from 'react'
import { Clapperboard, Tv } from 'lucide-react'
import type { TimelineCategory, ArchiveItem } from '../types'

function toImageUrl(imagePath: string): string {
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

const VISION_YEAR_LABELS: Record<number, string> = {
  2026: '此岸',
  2025: '未远',
  2024: '未远',
  2023: '旧影',
  2022: '旧影',
  2021: '旧影',
  2020: '前尘',
  2019: '前尘',
  2018: '前尘',
  2017: '开端',
  0: '未分类',
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

// ── 混合时间线海报卡片 (Visions) ──────────────────────────────
function VisionsPosterCard({ item }: { item: ArchiveItem }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [hovered, setHovered] = useState(false)

  const displayText = item.quote || ''

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="poster-card"
      style={{
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 骨架屏 & 错误占位 */}
      {!loaded && !error && <div className="absolute inset-0 poster-skeleton" />}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>N/A</span>
        </div>
      )}

      {/* 海报图片 */}
      {!error && (
        <img
          src={toImageUrl(item.image_path)}
          alt={item.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true) }}
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s, filter 0.3s ease',
            filter: hovered ? 'brightness(0.9)' : 'brightness(1)',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* ── hover 信息层 ── */}
      <div
        style={{
          position: 'absolute',
          inset: 'auto 0 0 0',
          padding: '1.15rem 0.9rem 0.9rem',
          background: 'linear-gradient(180deg, rgba(8, 8, 10, 0.02) 0%, rgba(8, 8, 10, 0.36) 26%, rgba(8, 8, 10, 0.9) 100%)',
          color: '#fff',
          pointerEvents: 'none',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.3s cubic-bezier(0.2, 0, 0, 1), transform 0.35s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: displayText ? '0.45rem' : 0,
            paddingRight: item.cinema ? '1.75rem' : 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '0.96rem',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '0.01em',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
            }}
          >
            {item.title}
          </h3>
        </div>

        {displayText && (
          <p
            style={{
              margin: 0,
              fontSize: '0.73rem',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.88)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
            }}
          >
            {displayText}
          </p>
        )}
      </div>

      {/* ── 左上角：身份印记 ── */}
      <div style={{
        position: 'absolute',
        top: '0.5rem',
        left: '0.5rem',
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '4px',
        padding: '3px 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        pointerEvents: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        {item.type === 'movie' ? <Clapperboard size={12} strokeWidth={2.5} /> : <Tv size={12} strokeWidth={2.5} />}
      </div>

      {/* ── 右上角：VIP 电影院钢印 ── */}
      {item.cinema && (
        <div style={{
          position: 'absolute',
          top: '0.45rem',
          right: '0.45rem',
          background: 'transparent',
          padding: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <img
            src="/icons/cinema-ticket.svg"
            alt="院线观看"
            style={{
              width: '20px',
              height: '20px',
              display: 'block',
              filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.22))',
            }}
          />
        </div>
      )}
    </a>
  )
}

// ── 年份区块 ──────────────────────────────────────────────────
function VisionsYearSection({
  year,
  items,
  index,
}: {
  year: number
  items: ArchiveItem[]
  index: number
}) {
  const yearLabel = VISION_YEAR_LABELS[Math.floor(year)] ?? String(year)

  // 光影专属“三重优先级排序算法”
  const sortedItems = [...items].sort((a, b) => {
    // 1. 院线优先
    if (a.cinema !== b.cinema) {
      return a.cinema ? -1 : 1
    }
    // 2. 类型优先 (movie > tv)
    if (a.type !== b.type) {
      return a.type === 'movie' ? -1 : 1
    }
    // 3. 兜底顺序
    return 0
  })

  return (
    <div
      className="year-section animate-fade-up"
      style={{ animationDelay: `${index * 0.07}s`, opacity: 0, animationFillMode: 'both' }}
    >
      <div className="year-header">
        <h2 className="year-title text-xl md:text-2xl">{yearLabel}</h2>
        <div className="year-line" />
        <CountBadge count={items.length} unit="部" />
      </div>

      <div className="year-grid">
        {sortedItems.map(item => (
          <VisionsPosterCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// ── Visions 主组件 ───────────────────────────────────────────
interface VisionsProps {
  data: TimelineCategory
}

type VisionFilter = 'all' | 'movie' | 'tv'

export default function Visions({ data }: VisionsProps) {
  const hasData = data && data.years.length > 0 && data.total_count > 0
  const [activeFilter, setActiveFilter] = useState<VisionFilter>('all')

  const filteredYears = useMemo(() => {
    if (!hasData) {
      return []
    }

    return data.years
      .map(yearGroup => ({
        ...yearGroup,
        items: yearGroup.items.filter(item => activeFilter === 'all' || item.type === activeFilter),
      }))
      .filter(yearGroup => yearGroup.items.length > 0)
  }, [activeFilter, data.years, hasData])

  const filteredCount = useMemo(
    () => filteredYears.reduce((sum, yearGroup) => sum + yearGroup.items.length, 0),
    [filteredYears]
  )

  const filterButtons: Array<{ key: VisionFilter; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'movie', label: '电影' },
    { key: 'tv', label: 'TV / 动画' },
  ]

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
                光影长卷
              </h1>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.86rem',
                  marginTop: '0.55rem',
                }}
              >
                共收录 <strong style={{ color: 'var(--text-primary)' }}>{filteredCount}</strong> 部精彩视界
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
                Filter
              </div>

              <div style={{ display: 'grid', gap: '0.42rem', marginBottom: '1rem' }}>
                {filterButtons.map(button => {
                  const isActive = activeFilter === button.key
                  return (
                    <button
                      key={button.key}
                      onClick={() => setActiveFilter(button.key)}
                      style={{
                        textAlign: 'left',
                        borderRadius: '14px',
                        padding: '0.76rem 0.82rem',
                        border: 'none',
                        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '0.84rem',
                        transition: 'all 0.22s ease',
                        cursor: 'pointer',
                      }}
                    >
                      {button.label}
                    </button>
                  )
                })}
              </div>

              <div
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.95rem',
                }}
              >
                Timeline
              </div>

              <div style={{ display: 'grid', gap: '0.38rem' }}>
                {filteredYears.map(yearGroup => (
                  <a
                    key={yearGroup.year}
                    href={`#vision-year-${yearGroup.year}`}
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
                    <span>{VISION_YEAR_LABELS[Math.floor(yearGroup.year)] ?? yearGroup.year}</span>
                    <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>{yearGroup.items.length}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <main style={{ minWidth: 0 }}>
            <div className="media-grid-container" style={{ padding: 0, maxWidth: 'none' }}>
              {filteredYears.map((yearGroup, idx) => (
                <div
                  key={`${yearGroup.year}`}
                  id={`vision-year-${yearGroup.year}`}
                  style={{ scrollMarginTop: '108px' }}
                >
                  <VisionsYearSection
                    year={yearGroup.year}
                    items={yearGroup.items}
                    index={idx}
                  />
                </div>
              ))}
            </div>
          </main>
        </div>
      ) : (
        <div className="empty-vault animate-fade-up">
          <div style={{ fontSize: '6rem', color: 'var(--glass-border)', userSelect: 'none', lineHeight: 1 }}>∅</div>
          <div className="empty-vault-badge">
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              VISIONS · CLASSIFIED
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>长卷正在绘制</p>
          </div>
        </div>
      )}
    </div>
  )
}
