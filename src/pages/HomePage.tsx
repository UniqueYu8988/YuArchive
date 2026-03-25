import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { ArchiveData, ArchiveItem } from '../types'

// 图片 URL 转换：相对路径 → Vite 中间件服务 URL
function toImageUrl(imagePath: string): string {
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

// ── 迷你卡片（海报墙专用） ──────────────────────────────────
function MiniCard({ item }: { item: ArchiveItem }) {
  const [err, setErr] = useState(false)
  return (
    <div className="game-card-mini">
      {!err ? (
        <img
          src={toImageUrl(item.image_path)}
          alt={item.title}
          loading="lazy"
          onError={() => setErr(true)}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'rgba(128,128,128,0.15)' }} />
      )}
    </div>
  )
}

// ── 滚动行 ────────────────────────────────────────────────────
function ScrollRow({
  items,
  direction,
  speed = 300,
}: {
  items: ArchiveItem[]
  direction: 'left' | 'right'
  speed?: number
}) {
  // 4倍复制确保无缝填充宽屏
  const filled = [...items, ...items, ...items, ...items]
  return (
    <div
      className={`scroll-track ${direction === 'left' ? 'animate-left' : 'animate-right'}`}
      style={{ animationDuration: `${speed}s` }}
    >
      {filled.map((item, i) => (
        <MiniCard key={`${item.id}-${i}`} item={item} />
      ))}
    </div>
  )
}

// ── 四分类统计卡片 ──────────────────────────────────────────
function StatCard({ label, count, path }: { label: string; count: number; path: string }) {
  return (
    <NavLink
      to={path}
      style={{
        display: 'block',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '1.2rem 1.5rem',
        color: 'inherit',
        textDecoration: 'none',
        background: 'rgba(128,128,128,0.04)',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-secondary)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.04)'
      }}
    >
      <p style={{ fontSize: '0.68rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
        {count > 0 ? count : '—'}
      </p>
    </NavLink>
  )
}

// ── 首页主组件 ────────────────────────────────────────────────
interface HomePageProps {
  data: ArchiveData
}

export default function HomePage({ data }: HomePageProps) {
  const { games, visions, music, texts } = data.categories

  // 过滤老游戏 (<= 2015)，并将 2025/2026 的新作品强行置顶到最前面
  const allItems = useMemo(() => {
    // 1. 过滤并提取所有 > 2015 的 item
    const validItems = [...games.years]
      .filter(y => y.year > 2015)
      .sort((a, b) => b.year - a.year)
      .flatMap(y => y.items)

    // 2. 将 2025 和 2026 的 item 强行摘离
    const newItems = validItems.filter(item => 
      item.id.includes('_2025_') || item.id.includes('_2026_')
    )
    const otherItems = validItems.filter(item => 
      !item.id.includes('_2025_') && !item.id.includes('_2026_')
    )

    // 3. 拼接返回，确保最新的在最前几行
    return [...newItems, ...otherItems]
  }, [games])

  // 采用 7 行阵列配合自适应高度与顶级安全渲染机制，确保绝不留白
  const rows = useMemo<ArchiveItem[][]>(() => {
    const r: ArchiveItem[][] = Array.from({ length: 7 }, () => [])
    allItems.forEach((item, i) => r[i % 7].push(item))
    return r
  }, [allItems])

  return (
    <div>
      {/* ── 英雄区：7行横向滚动海报墙 ──────────────────────── */}
      <section className="hero-section">
        <div className="scrolling-wrapper">
          {rows.map((row, i) => (
            <ScrollRow
              key={i}
              items={row}
              direction={i % 2 === 0 ? 'left' : 'right'}
              speed={280 + i * 20}
            />
          ))}
        </div>

        {/* 底部渐变遮罩（与 bg-primary 一致，老版精髓） */}
        <div className="hero-overlay" />

        {/* 品牌信息叠加在左下角 */}
        <div className="hero-branding">
          <h1 className="hero-title">Yu Archive</h1>
          <p className="hero-desc">
            收录共计 {games.total_count + visions.total_count + music.total_count + texts.total_count} 款作品。这里是我的数字灵魂碎片，在比特流中永恒回响。
          </p>
        </div>
      </section>

      {/* ── 统计卡片区 ─────────────────────────────────────── */}
      <section style={{ padding: '2.5rem 2.5rem 4rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <StatCard label="Games"   count={games.total_count}   path="/games"  />
          <StatCard label="Visions" count={visions.total_count} path="/movies" />
          <StatCard label="Music"   count={music.total_count}   path="/music"  />
          <StatCard label="Texts"   count={texts.total_count}   path="/texts"  />
        </div>
        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '0.15em', opacity: 0.5 }}>
          // SELECT CATEGORY TO ENTER ARCHIVE
        </p>
      </section>
    </div>
  )
}
