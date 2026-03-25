import { useState } from 'react'
import { Clapperboard, Tv, Ticket } from 'lucide-react'
import type { TimelineCategory, ArchiveItem } from '../types'

function toImageUrl(imagePath: string): string {
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

// ── 混合时间线海报卡片 (Visions) ──────────────────────────────
function VisionsPosterCard({ item }: { item: ArchiveItem }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [hovered, setHovered] = useState(false)

  const hasQuote = Boolean(item.quote)
  const displayText = item.quote || ""

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="poster-card"
      style={{ display: 'block', position: 'relative', overflow: 'hidden', textDecoration: 'none' }}
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
            display: 'block'
          }}
        />
      )}

      {/* ── 统一毛玻璃悬停层（Glassmorphism + 紫韵高光） ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2rem',
        background: 'rgba(10, 10, 15, 0.45)', // 极客暗色
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        opacity: hovered ? 1 : 0,
        transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)',
        pointerEvents: 'none',
        boxShadow: hovered ? 'inset 0 0 0 1px rgba(168, 85, 247, 0.25)' : 'none' // 极其克制的皇家紫高光边框
      }}>
        {hasQuote && (
          <p style={{
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 500,
            lineHeight: 1.6,
            textAlign: 'center',
            letterSpacing: '0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transform: hovered ? 'translateY(0)' : 'translateY(10px)',
            transition: 'transform 0.4s cubic-bezier(0.2, 0, 0, 1)'
          }}>
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
          top: '0.5rem',
          right: '0.5rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          borderRadius: '4px',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          pointerEvents: 'none',
          boxShadow: '0 0 10px rgba(255,255,255,0.4)',
          border: '1px solid rgba(255,255,255,0.5)'
        }}>
          <Ticket size={14} strokeWidth={2.5} />
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
        <h2 className="year-title">{year === 0 ? '未分类' : year}</h2>
        <div className="year-line" />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', flexShrink: 0 }}>
          {String(items.length).padStart(2, '0')} 部
        </span>
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

export default function Visions({ data }: VisionsProps) {
  const hasData = data && data.years.length > 0 && data.total_count > 0

  return (
    <div>
      {/* 页面头部 */}
      <div className="page-header animate-fade-up">
        <p className="page-label">{data.display_name}</p>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'baseline' }}>
          光影长卷
          <span className="text-sm text-gray-400 ml-4 font-light" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '1rem', fontWeight: 300, letterSpacing: '0.02em' }}>
            在光影流转中，体验万千宇宙
          </span>
        </h1>
        {hasData && (
          <p className="page-count">
            共收录 <strong>{data.total_count}</strong> 部精彩视界
          </p>
        )}
      </div>

      {/* 内容区 */}
      <div className="media-grid-container">
        {hasData ? (
          data.years.map((yearGroup, idx) => (
            <VisionsYearSection
              key={`${yearGroup.year}`}
              year={yearGroup.year}
              items={yearGroup.items}
              index={idx}
            />
          ))
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
    </div>
  )
}
