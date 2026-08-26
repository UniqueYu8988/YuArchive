import { ChevronDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { TextItem } from '../types'

function mediaUrl(path?: string) {
  if (!path) return ''
  if (/^(?:blob:|data:|https?:)/i.test(path)) return path
  return `/${path.replace(/^\//, '')}`
}

export function textSectionVariant(sectionKey: string) {
  switch (sectionKey) {
    case 'headline': return 'headline'
    case 'bedtime-news': return 'bedtime'
    case 'reference-info': return 'reference'
    case 'miscellany': return 'miscellany'
    default: return 'default'
  }
}

export function TextEntryCardHeader({
  item,
  expanded = false,
  onToggle,
}: {
  item: TextItem
  expanded?: boolean
  onToggle?: () => void
}) {
  const excerpt = item.summary?.trim() || item.excerpt?.trim() || ''
  const displayDate = item.sort_date || item.date
  return (
    <div
      onClick={onToggle}
      className={`texts-entry-card__header p-4 md:p-6 flex flex-col gap-2.5 transition-colors md:gap-3.5${onToggle ? ' cursor-pointer' : ' is-static'}`}
      onMouseEnter={event => { event.currentTarget.style.background = 'rgba(128,128,128,0.08)' }}
      onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex w-full items-start justify-between">
        <h2 className={`m-0 flex-1 pr-4 font-semibold leading-snug tracking-tight text-primary transition-all ${expanded ? 'text-lg md:text-xl' : 'text-base md:text-lg'}`}>{item.title}</h2>
        <div className={`mt-0.5 flex flex-shrink-0 items-center justify-center text-primary transition-transform duration-500 ${expanded ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown size={expanded ? 24 : 20} strokeWidth={1.5} />
        </div>
      </div>
      <p className="texts-entry-card__excerpt">{excerpt}</p>
      <div className="texts-entry-card__meta">
        <span className="texts-entry-card__meta-date" title={displayDate}>{displayDate}</span>
        {item.tags.length ? item.tags.map(tag => <span key={tag} className="texts-entry-card__meta-tag">#{tag}</span>) : <span className="texts-entry-card__meta-empty">无标签</span>}
      </div>
    </div>
  )
}

export function TextBookCoverCard({
  item,
  active = true,
  onSelect,
  style,
}: {
  item: TextItem
  active?: boolean
  onSelect?: () => void
  style?: CSSProperties
}) {
  return (
    <button type="button" onClick={onSelect} className={`daily-shelf-book${active ? ' is-active' : ''}`} aria-label={item.title} style={style}>
      <div className="daily-shelf-book__media">
        {item.cover ? <img src={mediaUrl(item.cover)} alt={item.title} loading="lazy" /> : <div className="daily-shelf-book__fallback">暂无封面</div>}
      </div>
    </button>
  )
}
