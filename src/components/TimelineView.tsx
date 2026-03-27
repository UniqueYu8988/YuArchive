import { useState } from 'react'
import type { TimelineCategory, ArchiveItem } from '../types'
import { yearDescriptions, easterEggYear } from '../data/yearDescriptions'

function toImageUrl(imagePath: string): string {
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

// ── 单张海报卡片 (改造成 Steam 纯净直连魔法链接) ───────────────────
function PosterCard({ item }: { item: ArchiveItem }) {
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState(false)

  const steamSearchUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(item.title)}`

  return (
    <a
      href={steamSearchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="poster-card interactive-poster"
      style={{ display: 'block', textDecoration: 'none' }}
    >
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
      <div className="card-overlay p-2 md:p-3">
        <span className="card-title text-[10px] md:text-sm">{item.title}</span>
      </div>
    </a>
  )
}

// ── 年份区块（含诗句描述） ────────────────────────────────────
function YearSection({
  year,
  items,
  index,
  isEasterEgg = false,
}: {
  year: number
  items: ArchiveItem[]
  index: number
  isEasterEgg?: boolean
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
          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', flexShrink: 0 }} className="md:text-xs text-secondary-dim">
            {String(items.length).padStart(2, '0')} 项
          </span>
        )}
      </div>

      {/* 年份诗句 */}
      {desc && (
        <p className="year-desc text-xs md:text-sm">{desc}</p>
      )}

      {/* 海报网格（彩蛋年份无内容）*/}
      {!isEasterEgg && items.length > 0 && (
        <div className="year-grid">
          {items.map(item => (
            <PosterCard key={item.id} item={item} />
          ))}
        </div>
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
}

export default function TimelineView({ data, title, subtitle, showEasterEgg = false }: TimelineViewProps) {
  const hasData = data.years.length > 0 && data.total_count > 0

  return (
    <div>
      {/* 页面头部 */}
      <div className="page-header animate-fade-up">
        <p className="page-label">{data.display_name}</p>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'baseline' }}>
          {title}
          {subtitle && (
            <span className="text-sm text-gray-400 ml-4 font-light" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '1rem', fontWeight: 300, letterSpacing: '0.02em' }}>
              {subtitle}
            </span>
          )}
        </h1>
        {hasData && (
          <p className="page-count">
            共收录 <strong>{data.total_count}</strong> 款作品
          </p>
        )}
      </div>

      <div className="media-grid-container">
        {hasData ? (
          <>
            {data.years.map((yearGroup, idx) => (
              <YearSection
                key={yearGroup.year}
                year={yearGroup.year}
                items={yearGroup.items}
                index={idx}
              />
            ))}

            {/* 2001 彩蛋：只在 Games 页末尾出现 */}
            {showEasterEgg && (
              <YearSection
                year={easterEggYear.year}
                items={[]}
                index={data.years.length}
                isEasterEgg
              />
            )}
          </>
        ) : (
          /* 空状态 */
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
    </div>
  )
}
