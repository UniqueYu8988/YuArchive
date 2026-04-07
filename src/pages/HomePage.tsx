import { ArrowUpRight, CircleDollarSign, Clock3, Star, Clapperboard, Tv } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useMemo, useState, type ReactNode } from 'react'
import type { ArchiveData, ArchiveItem, MusicItem, TextItem } from '../types'
import { assetVersion, homepageConfig, siteLayout, siteUi } from '../data/siteConfig'

function toImageUrl(imagePath: string) {
  const encodedPath = `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
  return assetVersion ? `${encodedPath}?v=${encodeURIComponent(assetVersion)}` : encodedPath
}

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function collectTimelineItems(years: Array<{ items: ArchiveItem[] }>) {
  return years.flatMap(year => year.items)
}

function selectConfiguredItems<T extends { id: string; title: string }>(
  items: T[],
  configuredTitles: string[],
  count: number,
) {
  const selected: T[] = []
  const usedIds = new Set<string>()

  for (const title of configuredTitles) {
    const match = items.find(item => item.title === title && !usedIds.has(item.id))
    if (!match) continue
    selected.push(match)
    usedIds.add(match.id)
    if (selected.length >= count) {
      return selected
    }
  }

  for (const item of items) {
    if (usedIds.has(item.id)) continue
    selected.push(item)
    usedIds.add(item.id)
    if (selected.length >= count) {
      break
    }
  }

  return selected
}

function extractPlainText(text: string, maxLength: number) {
  const normalized = text
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return clampText(normalized, maxLength)
}

function SidebarStatCard({
  label,
  count,
  iconPath,
  to,
}: {
  label: string
  count: number
  iconPath: string
  to: string
}) {
  return (
    <NavLink
      to={to}
      className="home-sidebar-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.86rem 0.95rem',
        borderRadius: '20px',
        background: 'var(--home-stat-bg)',
        border: '1px solid var(--home-stat-border)',
        boxShadow: 'var(--home-stat-shadow)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={iconPath}
          alt=""
          aria-hidden
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            imageRendering: 'auto',
          }}
        />
      </div>

      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--home-stat-label)',
            marginBottom: '0.45rem',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '1.8rem',
            lineHeight: 0.95,
            letterSpacing: '-0.06em',
            fontWeight: 800,
            color: 'var(--home-stat-value)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </div>
      </div>
    </NavLink>
  )
}

function SectionHeader({
  id,
  title,
  to,
  frameOrnaments = false,
  leftImageSrc,
  leftImageWidth,
  leftImageLeft,
  leftImageBottom,
  leftImageZIndex,
  rightImageSrc,
  rightImageWidth,
  rightImageRight,
  rightImageBottom,
  rightImageZIndex,
}: {
  id: string
  title: string
  to: string
  frameOrnaments?: boolean
  leftImageSrc?: string
  leftImageWidth?: string
  leftImageLeft?: string
  leftImageBottom?: string
  leftImageZIndex?: number
  rightImageSrc?: string
  rightImageWidth?: string
  rightImageRight?: string
  rightImageBottom?: string
  rightImageZIndex?: number
}) {
  return (
    <div
      id={id}
      style={{
        width: '100%',
        maxWidth: '1020px',
        margin: '0 auto',
        paddingLeft: '0.1rem',
        position: 'relative',
        display: 'flex',
        alignItems: 'end',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '0.95rem',
        scrollMarginTop: '108px',
      }}
    >
      {leftImageSrc && (
        <img
          src={leftImageSrc}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            left: leftImageLeft ?? '8rem',
            bottom: leftImageBottom ?? '0.08rem',
            width: leftImageWidth ?? '66px',
            height: 'auto',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: leftImageZIndex ?? 1,
            filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.14))',
          }}
        />
      )}
      {rightImageSrc && (
        <img
          src={rightImageSrc}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            right: rightImageRight ?? '8rem',
            bottom: rightImageBottom ?? '0.08rem',
            width: rightImageWidth ?? '66px',
            height: 'auto',
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: rightImageZIndex ?? 1,
            filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.14))',
          }}
        />
      )}
      {frameOrnaments && (
        <>
          <img
            src="/icons/ornament-side-divider.webp"
            alt=""
            aria-hidden
            className="home-side-divider-ornament"
            style={{
              position: 'absolute',
              left: '-2.15rem',
              top: '50%',
              width: '14px',
              height: 'auto',
              objectFit: 'contain',
              transform: 'translateY(-50%) rotate(180deg) scaleX(-1)',
              pointerEvents: 'none',
            }}
          />
          <img
            src="/icons/ornament-side-divider.webp"
            alt=""
            aria-hidden
            className="home-side-divider-ornament"
            style={{
              position: 'absolute',
              right: '-2.15rem',
              top: '50%',
              width: '14px',
              height: 'auto',
              objectFit: 'contain',
              transform: 'translateY(-50%) rotate(180deg)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '0.9rem',
            maxWidth: '100%',
          }}
        >
          <img
            src="/icons/ornament-title-side.webp"
            alt=""
            aria-hidden
            className="home-title-ornament"
            style={{
              width: '84px',
              height: 'auto',
              objectFit: 'contain',
              transform: 'scaleX(-1)',
              flexShrink: 0,
              marginBottom: '0.16rem',
            }}
          />
          <h2
            className="home-section-title"
            style={{
              margin: 0,
              fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
              lineHeight: 0.98,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </h2>
          <img
            src="/icons/ornament-title-side.webp"
            alt=""
            aria-hidden
            className="home-title-ornament"
            style={{
              width: '84px',
              height: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
              marginBottom: '0.16rem',
            }}
          />
        </div>
      </div>

      <NavLink
        to={to}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          textDecoration: 'none',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        查看全部
        <ArrowUpRight size={15} />
      </NavLink>
    </div>
  )
}

const GAME_GENRE_LABELS: Record<string, string> = {
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

function formatGameRating(rating?: number | '') {
  const value = typeof rating === 'number' ? rating : 0
  return value > 0 ? '★'.repeat(value) : siteUi.unrated
}

function HomeGameCard({ item, featured = false }: { item: ArchiveItem; featured?: boolean }) {
  const ratingText = useMemo(() => formatGameRating(item.rating), [item.rating])
  const isDlc = Boolean(item.dlc)
  const isSeasonal = Boolean(item.seasonal && item.season_entries?.length)

  return (
    <NavLink
      to="/games"
      className="home-poster-card"
      style={{
        position: 'relative',
        display: 'block',
        height: '100%',
        minHeight: featured ? '100%' : undefined,
        aspectRatio: featured ? undefined : '2 / 3',
        borderRadius: featured ? '26px' : '20px',
        overflow: 'hidden',
        textDecoration: 'none',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: featured ? '0 18px 42px rgba(0,0,0,0.06)' : '0 14px 34px rgba(0,0,0,0.06)',
      }}
    >
      {item.image_path && (
        <img
          src={toImageUrl(item.image_path)}
          alt={item.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            position: 'absolute',
            inset: 0,
            transition: 'transform 0.35s ease',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,16,0.04) 0%, rgba(10,10,16,0.2) 100%)',
        }}
      />
      <div
        className="game-hover-shell"
        style={{
          position: 'absolute',
          inset: 0,
          padding: featured ? '1.15rem' : '1rem',
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
          <div style={{ color: '#fff', fontWeight: 700, fontSize: featured ? '1rem' : '0.85rem', lineHeight: 1.25 }}>
            {item.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: featured ? '0.8rem' : '0.72rem', lineHeight: 1.25, marginTop: '0.2rem' }}>
            {item.english_title || 'Pending Title'}
          </div>
          {item.summary && !isSeasonal && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: featured ? '0.72rem' : '0.66rem', lineHeight: 1.45, marginTop: '0.45rem' }}>
              {item.summary}
            </div>
          )}
          <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.75rem' }}>
            <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: featured ? '0.74rem' : '0.68rem' }}>
                  {item.genre ? GAME_GENRE_LABELS[item.genre] ?? item.genre : siteUi.unclassified}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: featured ? '0.74rem' : '0.68rem' }}>
              <Star size={12} color="#facc15" fill="#facc15" />
              <span>{ratingText}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: featured ? '0.74rem' : '0.68rem' }}>
              <Clock3 size={12} />
                <span>{item.playtime || siteUi.unknown}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'rgba(255,255,255,0.88)', fontSize: featured ? '0.74rem' : '0.68rem' }}>
              <CircleDollarSign size={12} />
              <span>{item.price || '--'}</span>
            </div>
          </div>
          {isDlc && item.dlc_parent && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: featured ? '0.7rem' : '0.64rem', lineHeight: 1.45, marginTop: '0.65rem' }}>
              扩展所属：{item.dlc_parent}
            </div>
          )}
          {item.hover_note && !isSeasonal && (
            <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: featured ? '0.69rem' : '0.63rem', lineHeight: 1.45, marginTop: '0.7rem' }}>
              {item.hover_note}
            </div>
          )}
        </div>
      </div>
    </NavLink>
  )
}

function HomeVisionCard({ item, featured = false }: { item: ArchiveItem; featured?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const displayText = item.quote || ''

  return (
    <NavLink
      to="/movies"
      className="home-poster-card"
      style={{
        position: 'relative',
        display: 'block',
        height: '100%',
        minHeight: featured ? '100%' : undefined,
        aspectRatio: featured ? undefined : '2 / 3',
        borderRadius: featured ? '26px' : '20px',
        overflow: 'hidden',
        textDecoration: 'none',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: featured ? '0 18px 42px rgba(0,0,0,0.06)' : '0 14px 34px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.image_path && (
        <img
          src={toImageUrl(item.image_path)}
          alt={item.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            position: 'absolute',
            inset: 0,
            transition: 'opacity 0.4s, filter 0.3s ease',
            filter: hovered ? 'brightness(0.9)' : 'brightness(1)',
            willChange: 'transform, filter',
          }}
        />
      )}
      <div
        className="home-poster-hover"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(8, 8, 10, 0.02) 0%, rgba(8, 8, 10, 0.18) 46%, rgba(8, 8, 10, 0.86) 100%)',
          color: '#fff',
          pointerEvents: 'none',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.28s cubic-bezier(0.2, 0, 0, 1)',
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <div
          className="home-hover-fade-inner"
          style={{
            width: '100%',
            padding: '1.15rem 0.9rem 0.9rem',
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
                fontSize: featured ? '1rem' : '0.96rem',
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
                fontSize: featured ? '0.78rem' : '0.73rem',
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
      </div>

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
    </NavLink>
  )
}

function HomePosterMosaic({
  items,
  renderCard,
}: {
  items: ArchiveItem[]
  renderCard: (item: ArchiveItem, featured?: boolean) => ReactNode
}) {
  if (items.length === 0) return null

  const featured = items[0]
  const secondary = items.slice(1, 9)

  return (
    <div
      className="home-mosaic-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
        gap: '0.82rem',
        alignItems: 'stretch',
      }}
    >
      <div className="home-mosaic-featured" style={{ gridColumn: '1', gridRow: '1 / span 2' }}>
        {renderCard(featured, true)}
      </div>
      {secondary.map(item => (
        <div key={item.id} className="home-mosaic-secondary">
          {renderCard(item, false)}
        </div>
      ))}
    </div>
  )
}

function WelcomeCard({
  title,
}: {
  title: string
}) {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '78px',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 0,
          padding: '0rem 0.2rem',
          minHeight: '78px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
        >
        <div style={{ maxWidth: '940px', margin: '0 auto', width: '100%', position: 'relative', textAlign: 'center' }}>
          <img
            src="/icons/home-title-transparent.webp"
            alt={title}
            className="home-welcome-title"
            style={{
              display: 'block',
              width: 'min(100%, 620px)',
              height: 'auto',
              margin: '0 auto',
              imageRendering: 'auto',
            }}
          />
          <img
            src="/icons/welcome-character.webp"
            alt=""
            aria-hidden
            style={{
              position: 'absolute',
              right: '2.4rem',
              bottom: '-1.85rem',
              width: '118px',
              height: 'auto',
              objectFit: 'contain',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.16))',
            }}
          />
        </div>
      </div>
    </section>
  )
}

const HOME_SECTION_BODY_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: '1020px',
  margin: '0 auto',
}

function HomeSectionShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="home-section-shell"
      style={{
        padding: '1.18rem 1.16rem 1.2rem',
      }}
    >
      {children}
    </div>
  )
}

function HomeSectionDivider({ flushBottom = false }: { flushBottom?: boolean }) {
  return (
    <div
      style={{
        marginTop: flushBottom ? '0.72rem' : '0.88rem',
        marginBottom: flushBottom ? '-0.72rem' : '-0.54rem',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <img
        src="/icons/ornament-divider.webp"
        alt=""
        aria-hidden
        className="home-ornament-divider"
        style={{
          width: 'min(100%, 286px)',
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  )
}

function OrnateSectionFrame({ children }: { children: ReactNode }) {
  const cornerBase: React.CSSProperties = {
    position: 'absolute',
    width: '112px',
    height: '112px',
    objectFit: 'contain',
    pointerEvents: 'none',
  }

  return (
    <div style={{ position: 'relative', padding: '1.12rem 1.24rem 1.08rem 1.24rem' }}>
      <img src="/icons/ornament-corner.webp" alt="" aria-hidden className="home-ornament-corner" style={{ ...cornerBase, top: '-3.1rem', left: '-0.45rem' }} />
      <img src="/icons/ornament-corner.webp" alt="" aria-hidden className="home-ornament-corner" style={{ ...cornerBase, top: '-3.1rem', right: '-0.45rem', transform: 'scaleX(-1)' }} />
      <img src="/icons/ornament-corner.webp" alt="" aria-hidden className="home-ornament-corner" style={{ ...cornerBase, bottom: '-0.35rem', left: '-0.45rem', transform: 'scaleY(-1)' }} />
      <img src="/icons/ornament-corner.webp" alt="" aria-hidden className="home-ornament-corner" style={{ ...cornerBase, bottom: '-0.35rem', right: '-0.45rem', transform: 'scale(-1, -1)' }} />
      <div style={{ display: 'grid', gap: '1.08rem' }}>{children}</div>
    </div>
  )
}

function MusicFeatureCard({ item }: { item: MusicItem }) {
  return (
    <NavLink
      to="/music"
      className="home-glass-card home-music-feature-card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr)',
        gap: '1.15rem',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: '26px',
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 18px 42px rgba(0,0,0,0.05)',
        padding: '1rem',
        minHeight: '278px',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          alignSelf: 'start',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: '0 16px 36px rgba(0,0,0,0.08)',
        }}
      >
        {item.cover && (
          <img
            src={toImageUrl(item.cover)}
            alt={item.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      <div
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: '0.48rem',
            }}
          >
            {siteUi.current_album}
          </div>
          <div
            style={{
              fontSize: 'clamp(1.8rem, 3.6vw, 2.8rem)',
              lineHeight: 0.92,
              letterSpacing: '-0.06em',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.8rem',
            }}
          >
            {item.title}
          </div>
            <div
              style={{
                fontSize: '0.86rem',
                lineHeight: 1.75,
                color: 'var(--text-secondary)',
                maxWidth: 'none',
              }}
            >
              {clampText(item.description ?? '被反复点开的封面，会慢慢长成一段更稳定的回响。', 120)}
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.52rem',
            color: 'var(--text-primary)',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          打开曲库
          <ArrowUpRight size={15} />
        </div>
      </div>
    </NavLink>
  )
}

function MusicLibraryCard({ item }: { item: MusicItem }) {
  return (
    <NavLink
      to="/music"
      className="home-music-library-link"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        className="home-music-library-media"
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          borderRadius: '22px',
          overflow: 'hidden',
          boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.06)',
          marginBottom: '0.8rem',
        }}
      >
        {item.cover && (
          <img
            src={toImageUrl(item.cover)}
            alt={item.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        <div
          className="home-music-library-hover"
          style={{
            position: 'absolute',
            inset: 0,
            padding: '0.85rem',
            background: 'linear-gradient(180deg, rgba(10,10,16,0) 0%, rgba(10,10,16,0.18) 42%, rgba(10,10,16,0.92) 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            className="home-hover-fade-inner"
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              fontWeight: 800,
              width: '100%',
            }}
          >
            {item.title}
          </div>
        </div>
      </div>
    </NavLink>
  )
}

function TextFeatureCard({ item }: { item: TextItem }) {
  return (
    <NavLink
      to="/texts"
      className="home-glass-card"
      style={{
        display: 'block',
        textDecoration: 'none',
        borderRadius: '28px',
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
        padding: '1.4rem',
      }}
    >
      <div
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '0.55rem',
        }}
      >
        {item.section_title ?? 'Texts'}
      </div>
      <div
        style={{
          fontSize: 'clamp(1.6rem, 2.8vw, 2.3rem)',
          lineHeight: 0.98,
          letterSpacing: '-0.05em',
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: '0.9rem',
        }}
      >
        {item.title}
      </div>
      <div
        style={{
          fontSize: '0.92rem',
          lineHeight: 1.78,
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
        }}
      >
        {extractPlainText(item.content, 150)}
      </div>
      <div
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {item.sort_date ?? item.date}
      </div>
    </NavLink>
  )
}

function TextListCard({ item }: { item: TextItem }) {
  return (
    <NavLink
      to="/texts"
      className="home-glass-card"
      style={{
        display: 'block',
        textDecoration: 'none',
        borderRadius: '20px',
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 14px 36px rgba(0,0,0,0.04)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '0.45rem',
        }}
      >
        {item.section_title ?? 'Texts'}
      </div>
      <div
        style={{
          fontSize: '1rem',
          lineHeight: 1.18,
          letterSpacing: '-0.03em',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.62rem',
        }}
      >
        {clampText(item.title, 48)}
      </div>
      <div
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {item.sort_date ?? item.date}
      </div>
    </NavLink>
  )
}

interface HomePageProps {
  data: ArchiveData
}

export default function HomePage({ data }: HomePageProps) {
  const { games, visions, music, texts } = data.categories

  const latestGames = selectConfiguredItems(
    collectTimelineItems(games.years),
    homepageConfig.games,
    siteLayout.home_latest_games_count,
  )
  const latestVisions = selectConfiguredItems(
    collectTimelineItems(visions.years),
    homepageConfig.visions,
    siteLayout.home_latest_visions_count,
  )
  const latestMusic = selectConfiguredItems(
    music.items,
    homepageConfig.music,
    siteLayout.home_latest_music_count,
  )
  const latestTexts = selectConfiguredItems(
    texts.items,
    homepageConfig.texts,
    siteLayout.home_latest_texts_count,
  )

  const featuredMusic = latestMusic[0]
  const featuredText = latestTexts[0]

  return (
    <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '1360px', paddingTop: '0.55rem', paddingBottom: '5rem' }}>
      <div
        className="md:grid md:gap-6 home-page-layout"
        style={{
          display: 'grid',
          gap: '1.15rem',
          gridTemplateColumns: '230px minmax(0, 1040px)',
          justifyContent: 'center',
        }}
      >
        <aside
          className="home-sidebar-column"
          style={{
            alignSelf: 'start',
            position: 'sticky',
            top: '84px',
            height: 'fit-content',
          }}
        >
          <div
            style={{
              height: 'fit-content',
            }}
          >
            <div
              style={{
                marginBottom: '0.78rem',
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: 0.9,
              }}
            >
              <img
                src="/icons/bee-minecraft.webp"
                alt=""
                aria-hidden
                className="home-sidebar-decor home-sidebar-decor-top"
                style={{
                  width: 'clamp(72px, 7vw, 88px)',
                  height: 'clamp(72px, 7vw, 88px)',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>

            <div className="home-sidebar-stats" style={{ display: 'grid', gap: '0.85rem', padding: '0 0.95rem' }}>
              <SidebarStatCard label="Games" count={games.total_count} iconPath="/icons/GAMES.gif" to="/games" />
              <SidebarStatCard label="Visions" count={visions.total_count} iconPath="/icons/VISIONS.gif" to="/movies" />
              <SidebarStatCard label="Music" count={music.total_count} iconPath="/icons/MUSIC.png" to="/music" />
              <SidebarStatCard label="Texts" count={texts.total_count} iconPath="/icons/TEXTS.webp" to="/texts" />
            </div>

            <div
              style={{
                marginTop: '0.9rem',
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: 0.9,
              }}
            >
              <img
                src="/icons/minecraft-grass.webp"
                alt=""
                aria-hidden
                className="home-sidebar-decor home-sidebar-decor-bottom"
                style={{
                  width: 'clamp(128px, 14vw, 164px)',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </aside>

        <main className="home-main-column" style={{ minWidth: 0, width: '100%', display: 'grid', gap: '1.7rem', margin: '0 auto' }}>
          <section
            id="home-overview"
            className="animate-fade-up"
            style={{ scrollMarginTop: '108px', animationDelay: '0.02s', opacity: 0, animationFillMode: 'both' }}
          >
            <WelcomeCard
              title="Yu Archive"
            />
          </section>

          <OrnateSectionFrame>
            <section
              id="home-games"
              className="animate-fade-up"
              style={{ scrollMarginTop: '108px', animationDelay: '0.12s', opacity: 0, animationFillMode: 'both' }}
            >
              <div style={{ marginTop: '-3.85rem', position: 'relative', zIndex: 2 }}>
                <div style={HOME_SECTION_BODY_STYLE}>
                  <HomeSectionShell>
                    <SectionHeader id="home-games-title" title="Games" to="/games" />
                    <HomePosterMosaic
                      items={latestGames.slice(0, siteLayout.home_latest_games_count)}
                      renderCard={(item, featured) => <HomeGameCard key={item.id} item={item} featured={featured} />}
                    />
                    <HomeSectionDivider />
                  </HomeSectionShell>
                </div>
              </div>
            </section>

            <section
              id="home-music"
              className="animate-fade-up"
              style={{ scrollMarginTop: '108px', animationDelay: '0.2s', opacity: 0, animationFillMode: 'both' }}
            >
              {featuredMusic && (
                <div className="home-section-body" style={{ ...HOME_SECTION_BODY_STYLE, display: 'grid', gap: '0.96rem' }}>
                  <HomeSectionShell>
                    <div style={{ display: 'grid', gap: '0.96rem' }}>
                      <SectionHeader
                        id="home-music-title"
                        title="Music"
                        to="/music"
                        frameOrnaments
                        leftImageSrc="/icons/welcome-character-left.webp"
                        leftImageWidth="clamp(86px, 9vw, 117px)"
                        leftImageLeft="clamp(1.8rem, 4.4vw, 3.55rem)"
                        leftImageBottom="clamp(-2.1rem, -1vw, -1.2rem)"
                      />
                      <MusicFeatureCard item={featuredMusic} />
                      <div
                        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 home-music-library-grid"
                        style={{ display: 'grid', gap: '0.9rem' }}
                      >
                        {latestMusic.slice(1, 7).map(item => (
                          <MusicLibraryCard key={item.id} item={item} />
                        ))}
                      </div>
                      <HomeSectionDivider />
                    </div>
                  </HomeSectionShell>
                </div>
              )}
            </section>

            <section
              id="home-visions"
              className="animate-fade-up"
              style={{ scrollMarginTop: '108px', animationDelay: '0.28s', opacity: 0, animationFillMode: 'both' }}
            >
              <div className="home-section-body" style={HOME_SECTION_BODY_STYLE}>
                <HomeSectionShell>
                  <SectionHeader
                    id="home-visions-title"
                    title="Visions"
                    to="/movies"
                    frameOrnaments
                    rightImageSrc="/icons/visions-character.webp"
                    rightImageWidth="clamp(84px, 8vw, 108px)"
                    rightImageRight="clamp(-0.65rem, -1vw, -0.2rem)"
                    rightImageBottom="clamp(0.25rem, 1vw, 0.8rem)"
                    rightImageZIndex={0}
                  />
                  <HomePosterMosaic
                    items={latestVisions.slice(0, siteLayout.home_latest_visions_count)}
                    renderCard={(item, featured) => <HomeVisionCard key={item.id} item={item} featured={featured} />}
                  />
                  <HomeSectionDivider />
                </HomeSectionShell>
              </div>
            </section>

            <section
              id="home-texts"
              className="animate-fade-up"
              style={{ scrollMarginTop: '108px', animationDelay: '0.36s', opacity: 0, animationFillMode: 'both' }}
            >
              <div className="home-section-body" style={HOME_SECTION_BODY_STYLE}>
                <HomeSectionShell>
                  <SectionHeader
                    id="home-texts-title"
                    title="Texts"
                    to="/texts"
                    frameOrnaments
                    leftImageSrc="/icons/texts-character.webp"
                    leftImageWidth="clamp(86px, 9vw, 117px)"
                    leftImageLeft="clamp(1.8rem, 4.4vw, 3.55rem)"
                    leftImageBottom="clamp(0rem, 0.8vw, 0.85rem)"
                    leftImageZIndex={0}
                  />
                  <div
                    className="xl:grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-4"
                    style={{ display: 'grid', gap: '1.08rem' }}
                  >
                    {featuredText && <TextFeatureCard item={featuredText} />}
                    <div style={{ display: 'grid', gap: '1.08rem' }}>
                      {latestTexts.slice(1, 4).map(item => (
                        <TextListCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                  <HomeSectionDivider flushBottom />
                </HomeSectionShell>
              </div>
            </section>
          </OrnateSectionFrame>
        </main>
      </div>
    </div>
  )
}
