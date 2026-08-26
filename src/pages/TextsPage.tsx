import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { TextItem, TextsCategory } from '../types'
import { siteLayout } from '../data/siteConfig'
import { useIsMobile } from '../hooks/useIsMobile'
import { TextBookCoverCard, TextEntryCardHeader, textSectionVariant } from '../components/TextDisplayCards'

interface Props {
  data: TextsCategory
}

function BookishHeading({
  level,
  children,
}: {
  level: 'h1' | 'h2' | 'h3'
  children: ReactNode
}) {
  const Tag = level === 'h1' ? 'h3' : level === 'h2' ? 'h4' : 'h5'

  return (
    <div className={`bookish-heading bookish-heading--${level}`}>
      <span className="bookish-heading__rule" aria-hidden="true" />
      <Tag className="bookish-heading__title">{children}</Tag>
    </div>
  )
}

const bookishMarkdownComponents = {
  p: ({ node, ...props }: any) => <p className="text-xs md:text-base leading-relaxed md:leading-loose text-secondary mb-4 md:mb-6 tracking-normal md:tracking-wide font-light" {...props} />,
  h1: ({ node, children, ...props }: any) => (
    <BookishHeading level="h1">
      <span {...props}>{children}</span>
    </BookishHeading>
  ),
  h2: ({ node, children, ...props }: any) => (
    <BookishHeading level="h2">
      <span {...props}>{children}</span>
    </BookishHeading>
  ),
  h3: ({ node, children, ...props }: any) => (
    <BookishHeading level="h3">
      <span {...props}>{children}</span>
    </BookishHeading>
  ),
  ul: ({ node, ...props }: any) => <ul className="pl-4 md:pl-6 text-secondary mb-4 md:mb-6 leading-relaxed" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="pl-4 md:pl-6 text-secondary mb-4 md:mb-6 leading-relaxed" {...props} />,
  li: ({ node, ...props }: any) => <li className="mb-2" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-glass-border pl-4 text-secondary italic mb-4 md:mb-6 opacity-80" {...props} />,
}

function extractExcerpt(item: { summary?: string; excerpt?: string }) {
  const summary = item.summary?.trim()
  if (summary) return summary
  return item.excerpt?.trim() ?? ''
}

export default function TextsPage({ data }: Props) {
  const hasData = data.items.length > 0 && data.total_count > 0
  const sections = data.sections ?? []
  const defaultSection = sections.find(section => section.key === siteLayout.texts_default_section_key)?.key ?? sections[0]?.key ?? 'book-reviews'
  const [activeSection, setActiveSection] = useState(defaultSection)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bookShelfPage, setBookShelfPage] = useState(0)
  const [bookShelfPageSize, setBookShelfPageSize] = useState(5)
  const [showMobileIndex, setShowMobileIndex] = useState(false)
  const [visibleListCount, setVisibleListCount] = useState(6)
  const hasMountedShelfPageRef = useRef(false)
  const [animateShelfPage, setAnimateShelfPage] = useState(false)
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const previousSectionRef = useRef(activeSection)
  const isMobileLayout = useIsMobile()

  useEffect(() => {
    if (!sections.length) return
    if (!sections.some(section => section.key === activeSection)) {
      setActiveSection(sections[0].key)
    }
  }, [sections, activeSection])

  const filteredItems = useMemo(
    () => data.items.filter(item => (item.section ?? 'headline') === activeSection),
    [data.items, activeSection]
  )

  const activeSectionInfo = useMemo(
    () => sections.find(section => section.key === activeSection) ?? sections[0],
    [sections, activeSection]
  )
  const isBookShelfSection = activeSection === 'book-reviews'
  const currentSectionVariant = textSectionVariant(activeSection)
  const expandedItem = filteredItems.find(item => item.id === expandedId) ?? null
  const featuredTextItem = !isBookShelfSection ? filteredItems[0] ?? null : null
  const indexedTextItems = !isBookShelfSection ? filteredItems.slice(featuredTextItem ? 1 : 0) : filteredItems
  const visibleIndexedTextItems = !isBookShelfSection ? indexedTextItems.slice(0, visibleListCount) : indexedTextItems
  const totalBookShelfPages = isBookShelfSection ? Math.max(1, Math.ceil(filteredItems.length / bookShelfPageSize)) : 1
  const visibleBookShelfItems = isBookShelfSection
    ? filteredItems.slice(bookShelfPage * bookShelfPageSize, (bookShelfPage + 1) * bookShelfPageSize)
    : filteredItems

  const bookShelfArcOffsets = useMemo(() => {
    if (!visibleBookShelfItems.length) return []
    const center = (visibleBookShelfItems.length - 1) / 2
    const safeCenter = Math.max(center, 1)
    return visibleBookShelfItems.map((_, idx) => {
      const distance = Math.abs(idx - center) / safeCenter
      return Math.round(distance * distance * 28)
    })
  }, [visibleBookShelfItems])

  useEffect(() => {
    if (previousSectionRef.current !== activeSection) {
      previousSectionRef.current = activeSection
      setBookShelfPage(0)
      if (activeSection === 'book-reviews' && filteredItems.length) {
        setExpandedId(filteredItems[0].id)
      } else {
        setExpandedId(null)
      }
      return
    }

    if (expandedId && !filteredItems.some(item => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [activeSection, filteredItems, expandedId])

  useEffect(() => {
    const calculatePageSize = () => {
      const width = window.innerWidth
      if (width >= 1500) return 6
      if (width >= 1200) return 5
      if (width >= 900) return 4
      if (width >= 520) return 3
      return 2
    }

    const syncPageSize = () => {
      setBookShelfPageSize(calculatePageSize())
    }

    syncPageSize()
    window.addEventListener('resize', syncPageSize)
    return () => window.removeEventListener('resize', syncPageSize)
  }, [])

  useEffect(() => {
    if (!isMobileLayout) {
      setShowMobileIndex(false)
    }
  }, [isMobileLayout])

  useEffect(() => {
    if (isBookShelfSection) return
    setVisibleListCount(isMobileLayout ? 4 : 6)
  }, [activeSection, isBookShelfSection, isMobileLayout])

  useEffect(() => {
    if (isBookShelfSection) return
    if (visibleListCount >= indexedTextItems.length) return
    const trigger = loadMoreTriggerRef.current
    if (!trigger) return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setVisibleListCount(prev => Math.min(indexedTextItems.length, prev + (isMobileLayout ? 3 : 4)))
      },
      {
        rootMargin: '180px 0px',
      }
    )

    observer.observe(trigger)
    return () => observer.disconnect()
  }, [indexedTextItems.length, visibleListCount, isBookShelfSection, isMobileLayout])

  useEffect(() => {
    if (!isBookShelfSection) return
    setBookShelfPage(prev => Math.min(prev, Math.max(0, totalBookShelfPages - 1)))
  }, [isBookShelfSection, totalBookShelfPages])

  useEffect(() => {
    if (!isBookShelfSection) return
    if (!expandedId && filteredItems.length) {
      const firstVisible = filteredItems[bookShelfPage * bookShelfPageSize]
      if (firstVisible) setExpandedId(firstVisible.id)
      return
    }
    if (!expandedId) return
    const expandedIndex = filteredItems.findIndex(item => item.id === expandedId)
    if (expandedIndex === -1) return
    const targetPage = Math.floor(expandedIndex / bookShelfPageSize)
    if (targetPage !== bookShelfPage) {
      setBookShelfPage(targetPage)
    }
  }, [isBookShelfSection, expandedId, filteredItems, bookShelfPage, bookShelfPageSize])

  useEffect(() => {
    if (!isBookShelfSection) {
      setAnimateShelfPage(false)
      return
    }
    if (!hasMountedShelfPageRef.current) {
      hasMountedShelfPageRef.current = true
      return
    }

    setAnimateShelfPage(true)
    const timeoutId = window.setTimeout(() => setAnimateShelfPage(false), 380)
    return () => window.clearTimeout(timeoutId)
  }, [isBookShelfSection, bookShelfPage])

  const jumpBookShelfPage = (nextPage: number) => {
    const safePage = Math.max(0, Math.min(totalBookShelfPages - 1, nextPage))
    const nextItem = filteredItems[safePage * bookShelfPageSize] ?? null
    setBookShelfPage(safePage)
    setExpandedId(nextItem?.id ?? null)
  }

  const handleSectionChange = (sectionKey: string) => {
    setActiveSection(sectionKey)
    setShowMobileIndex(false)
  }

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedId(prev => (prev === id ? null : id))
  }

  const formatDisplayDate = (rawDate: string, sortDate?: string) => {
    if (sortDate) return sortDate
    return rawDate
  }

  const scrollToItem = (id: string) => {
    setExpandedId(id)
    setShowMobileIndex(false)
    setTimeout(() => {
      const element = itemRefs.current[id]
      if (!element) return
      const offset = isMobileLayout ? 96 : 108
      const bodyTop = document.body.getBoundingClientRect().top
      const elementTop = element.getBoundingClientRect().top
      const targetTop = elementTop - bodyTop - offset
      window.scrollTo({ top: targetTop, behavior: 'smooth' })
    }, 80)
  }

  const renderExpandedBody = (item: TextItem) => {
    if (expandedId !== item.id) {
      return null
    }

    return (
      <div className="texts-entry-expanded texts-entry-expanded--visible">
        <div className="elegant-markdown">
          <ReactMarkdown components={bookishMarkdownComponents}>{item.content}</ReactMarkdown>
        </div>

        <div className="texts-entry-collapse">
          <button
            onClick={(e) => toggleExpand(item.id, e)}
            className="texts-entry-collapse__button"
          >
            <ChevronUp size={16} />
            收起
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '1460px', paddingTop: '0.9rem', paddingBottom: '6rem' }}>
      {hasData ? (
        <div
          className="texts-page-layout"
          style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: isMobileLayout ? 'minmax(0, 1fr)' : '270px minmax(0, 1fr)',
          }}
        >
          {!isMobileLayout ? (
            <aside
              style={{
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
                灵犀断章
              </h1>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.86rem',
                  marginTop: '0.55rem',
                }}
              >
                共收录 <strong style={{ color: 'var(--text-primary)' }}>{data.total_count}</strong> 篇短文
              </div>
            </div>

            <div
              style={{
                borderRadius: '24px',
                border: '1px solid var(--glass-border)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
                padding: '1.1rem',
                boxShadow: '0 16px 40px rgba(0,0,0,0.05)',
                marginBottom: '1rem',
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
                Sections
              </div>

              <div style={{ display: 'grid', gap: '0.42rem' }}>
                {sections.map(section => {
                  const isActive = activeSection === section.key
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => handleSectionChange(section.key)}
                      style={{
                        textAlign: 'left',
                        borderRadius: '14px',
                        padding: '0.76rem 0.82rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '0.84rem',
                        transition: 'background-color 0.22s ease, color 0.22s ease, transform 0.22s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.62rem', minWidth: 0 }}>
                        {section.icon ? (
                          <img
                            src={`/${section.icon}`}
                            alt={section.title}
                            loading="lazy"
                            className={section.icon.endsWith('.svg') ? 'texts-section-icon texts-section-icon--themed' : 'texts-section-icon'}
                            style={{
                              width: section.icon.endsWith('.svg') ? '1.45rem' : '1.8rem',
                              height: section.icon.endsWith('.svg') ? '1.45rem' : '1.8rem',
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        <span>{section.title}</span>
                      </span>
                      <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>{section.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {!isBookShelfSection ? (
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
              <div style={{ display: 'grid', gap: '0.38rem' }}>
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToItem(item.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: '14px',
                      padding: '0.76rem 0.82rem',
                      border: 'none',
                      cursor: 'pointer',
                      background: expandedId === item.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: expandedId === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.84rem',
                      transition: 'background-color 0.22s ease, color 0.22s ease, transform 0.22s ease',
                    }}
                  >
                    <div
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: '0.24rem',
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                      {formatDisplayDate(item.date, item.sort_date)}
                    </div>
                  </button>
                ))}
              </div>
              </div>
            ) : null}
          </aside>
          ) : null}

          <main style={{ minWidth: 0, maxWidth: isMobileLayout ? '860px' : undefined }}>
            {isMobileLayout ? (
              <section className="texts-mobile-intro">
                <div className="texts-mobile-intro__eyebrow">{data.display_name}</div>
                <div className="texts-mobile-intro__header">
                  <h1 className="texts-mobile-intro__title">灵犀断章</h1>
                  <div className="texts-mobile-intro__count">
                    共收录 <strong style={{ color: 'var(--text-primary)' }}>{data.total_count}</strong> 篇短文
                  </div>
                </div>
              </section>
            ) : null}

            {isMobileLayout ? (
              <div className="texts-mobile-toolbar">
                <div className="texts-mobile-sections" aria-label="Texts sections">
                  {sections.map(section => {
                    const isActive = activeSection === section.key
                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => handleSectionChange(section.key)}
                        className={`texts-mobile-section-pill${isActive ? ' is-active' : ''}`}
                      >
                        {section.icon ? (
                          <img
                            src={`/${section.icon}`}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className={section.icon.endsWith('.svg') ? 'texts-section-icon texts-section-icon--themed' : 'texts-section-icon'}
                            style={{
                              width: section.icon.endsWith('.svg') ? '1.15rem' : '1.4rem',
                              height: section.icon.endsWith('.svg') ? '1.15rem' : '1.4rem',
                              objectFit: 'contain',
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        <span>{section.title}</span>
                        <span className="texts-mobile-section-pill__count">{section.count}</span>
                      </button>
                    )
                  })}
                </div>

                {!isBookShelfSection ? (
                  <div className={`texts-mobile-index${showMobileIndex ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="texts-mobile-index__toggle"
                      onClick={() => setShowMobileIndex(open => !open)}
                    >
                      <span>Archive Index</span>
                      <span style={{ opacity: 0.72 }}>{showMobileIndex ? '收起' : `${filteredItems.length} 篇`}</span>
                    </button>

                    {showMobileIndex ? (
                      <div className="texts-mobile-index__panel">
                        {filteredItems.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => scrollToItem(item.id)}
                            className={`texts-mobile-index__item${expandedId === item.id ? ' is-active' : ''}`}
                          >
                            <span className="texts-mobile-index__item-title">{item.title}</span>
                            <span className="texts-mobile-index__item-date">{formatDisplayDate(item.date, item.sort_date)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isBookShelfSection ? (
              <section
                className={`animate-fade-up texts-channel-hero texts-channel-hero--${currentSectionVariant}`}
                style={{
                  marginBottom: '1.35rem',
                  maxWidth: '860px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="texts-channel-hero__title-row">
                    {activeSectionInfo?.icon ? (
                      <img
                        src={`/${activeSectionInfo.icon}`}
                        alt={activeSectionInfo.title}
                        loading="lazy"
                        className={activeSectionInfo.icon.endsWith('.svg') ? 'texts-heading-icon texts-heading-icon--themed' : 'texts-heading-icon'}
                        style={{
                          width: activeSectionInfo.icon.endsWith('.svg')
                            ? 'clamp(4.1rem, 5.5vw, 5.8rem)'
                            : 'clamp(5rem, 6.8vw, 7rem)',
                          height: activeSectionInfo.icon.endsWith('.svg')
                            ? 'clamp(4.1rem, 5.5vw, 5.8rem)'
                            : 'clamp(5rem, 6.8vw, 7rem)',
                          objectFit: 'contain',
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <h2 className="texts-channel-hero__title">
                      {activeSectionInfo?.title ?? '每天听本书'}
                    </h2>
                  </div>
                  <p className="texts-channel-hero__description">
                    {activeSectionInfo?.description ?? '把值得留下的内容浓缩成可以再次翻阅的文字切片。'}
                  </p>
                </div>
              </section>
            ) : null}

            {isBookShelfSection ? (
              <section
                className="daily-shelf-shell"
                style={{
                  marginBottom: '1.55rem',
                  position: 'relative',
                  borderRadius: '30px',
                  border: '1px solid var(--glass-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="daily-shelf-glow"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'grid',
                    gap: '1.25rem',
                    padding: '1.4rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.65rem',
                      }}
                    >
                      Daily Shelf
                    </div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 'clamp(2.3rem, 4vw, 4.2rem)',
                        lineHeight: 0.96,
                        letterSpacing: '-0.06em',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                      }}
                    >
                      每天听本书
                    </h2>
                    <p
                      style={{
                        marginTop: '0.9rem',
                        marginBottom: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '0.98rem',
                        lineHeight: 1.78,
                        maxWidth: '760px',
                      }}
                    >
                      把一本书留下一个入口、一段印象，像搭起一排可以反复回望的书架。
                    </p>
                  </div>

                  <div
                    className="daily-shelf-rail-shell"
                    style={{
                      minHeight: '320px',
                      padding: '1.2rem 1.2rem 0.5rem',
                      display: 'grid',
                      gap: '1.15rem',
                      alignContent: 'start',
                      position: 'relative',
                    }}
                  >
                    {filteredItems.length ? (
                      <>
                        <div className="daily-shelf-arc-stage">
                          <div className="daily-shelf-arc-control daily-shelf-arc-control--left">
                            <button
                              type="button"
                              onClick={() => jumpBookShelfPage(bookShelfPage - 1)}
                              disabled={bookShelfPage === 0}
                              className="daily-shelf-turn-button"
                              aria-label="上一页"
                            >
                              <span aria-hidden="true">‹</span>
                            </button>
                          </div>

                          <div className={`daily-shelf-arc-books${animateShelfPage ? ' daily-shelf-arc-books--animated' : ''}`}>
                            {visibleBookShelfItems.map((item, idx) => {
                              const isExpanded = expandedId === item.id
                              const center = (visibleBookShelfItems.length - 1) / 2
                              const tilt = idx < center ? -1.1 : idx > center ? 1.1 : 0
                              return (
                                <TextBookCoverCard
                                  key={item.id}
                                  item={item}
                                  active={isExpanded}
                                  onSelect={() => toggleExpand(item.id)}
                                  style={{ transform: `translateY(${bookShelfArcOffsets[idx] ?? 0}px) rotate(${isMobileLayout ? 0 : tilt}deg) ${isExpanded ? 'scale(1.04)' : 'scale(1)'}` }}
                                />
                              )
                            })}
                          </div>

                          <div className="daily-shelf-arc-control daily-shelf-arc-control--right">
                            <button
                              type="button"
                              onClick={() => jumpBookShelfPage(bookShelfPage + 1)}
                              disabled={bookShelfPage >= totalBookShelfPages - 1}
                              className="daily-shelf-turn-button"
                              aria-label="下一页"
                            >
                              <span aria-hidden="true">›</span>
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginTop: '-0.1rem',
                          }}
                        >
                          <div
                            className="daily-shelf-page-indicator"
                            style={{
                              fontSize: '0.76rem',
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Page {bookShelfPage + 1} / {totalBookShelfPages}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          minHeight: '220px',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--text-secondary)',
                          fontSize: '0.92rem',
                        }}
                      >
                        把书封放进「每天听本书/书架」，这里就会长出你的首页书架。
                      </div>
                    )}
                  </div>

                  {expandedItem ? (
                    <div
                      style={{
                        borderTop: '1px dashed rgba(128,128,128,0.22)',
                        paddingTop: '1.05rem',
                        display: 'grid',
                        gap: '1rem',
                      }}
                    >
                      <div
                        className="daily-shelf-detail-card"
                        style={{
                          position: 'relative',
                          display: 'grid',
                          gridTemplateColumns: expandedItem.cover ? '124px minmax(0, 1fr)' : 'minmax(0, 1fr)',
                          gap: '1rem',
                          alignItems: 'start',
                          padding: '1rem 4.8rem 1rem 1rem',
                          borderRadius: '22px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))',
                        }}
                      >
                        {expandedItem.cover ? (
                          <div
                            style={{
                              width: '124px',
                              aspectRatio: '2 / 3',
                              borderRadius: '16px',
                              overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgba(255,255,255,0.03)',
                              boxShadow: '0 14px 28px rgba(0,0,0,0.12)',
                            }}
                          >
                            <img
                              src={`/${expandedItem.cover}`}
                              alt={expandedItem.title}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </div>
                        ) : null}
                        <div style={{ minWidth: 0 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '1.56rem',
                              lineHeight: 1.1,
                              letterSpacing: '-0.03em',
                              color: 'var(--text-primary)',
                              fontWeight: 800,
                            }}
                          >
                            {expandedItem.title}
                          </h3>
                          {expandedItem.author ? (
                            <div
                              style={{
                                marginTop: '0.55rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.34rem 0.72rem',
                                borderRadius: '999px',
                                border: '1px solid rgba(196, 168, 120, 0.18)',
                                background: 'rgba(196, 168, 120, 0.12)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.82rem',
                              }}
                            >
                              作者 · {expandedItem.author}
                            </div>
                          ) : null}
                          {expandedItem.summary ? (
                            <p
                              className="daily-shelf-summary"
                              style={{
                                marginTop: '0.85rem',
                                marginBottom: 0,
                                color: 'var(--text-secondary)',
                                fontSize: '0.96rem',
                                lineHeight: 1.78,
                                textWrap: 'pretty',
                              }}
                            >
                              {expandedItem.summary}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          style={{
                            position: 'absolute',
                            top: '0.9rem',
                            right: '0.9rem',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            letterSpacing: '0.08em',
                            padding: '0.35rem 0.7rem',
                            borderRadius: '999px',
                            alignSelf: 'start',
                          }}
                        >
                          收起
                        </button>
                      </div>
                      <div
                        className="elegant-markdown"
                        style={{
                          borderRadius: '22px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                          padding: '1rem 1.1rem 0.55rem',
                        }}
                      >
                        <ReactMarkdown
                          components={bookishMarkdownComponents}
                        >
                          {expandedItem.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!isBookShelfSection ? (
              <div style={{ maxWidth: '860px' }}>
              <div className="flex flex-col gap-4 md:gap-6">
                {featuredTextItem ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(featuredTextItem.id)}
                    className={`texts-featured-card texts-featured-card--${currentSectionVariant} ${expandedId === featuredTextItem.id ? 'is-active' : ''}`}
                    style={{ width: '100%' }}
                  >
                    <div className="texts-featured-card__label">本期聚焦</div>
                    <h3 className="texts-featured-card__title">{featuredTextItem.title}</h3>
                    <p className="texts-featured-card__excerpt">{extractExcerpt(featuredTextItem)}</p>
                    <div className="texts-featured-card__meta">
                      <span>{formatDisplayDate(featuredTextItem.date, featuredTextItem.sort_date)}</span>
                      {featuredTextItem.tags[0] ? <span>#{featuredTextItem.tags[0]}</span> : null}
                    </div>
                  </button>
                ) : null}
                {featuredTextItem && expandedItem?.id === featuredTextItem.id ? (
                  <div className={`texts-entry-card texts-entry-card--${currentSectionVariant} is-expanded`}>
                    {renderExpandedBody(featuredTextItem)}
                  </div>
                ) : null}
                {visibleIndexedTextItems.map((item, index) => {
                  const isExpanded = expandedId === item.id

                  return (
                    <div
                      key={item.id}
                      ref={el => (itemRefs.current[item.id] = el)}
                      className={`texts-entry-card texts-entry-card--${currentSectionVariant} ${isExpanded ? 'is-expanded' : ''}`}
                      style={{
                        animationDelay: `${Math.min(index, 6) * 0.04}s`,
                      }}
                    >
                      <TextEntryCardHeader item={item} expanded={isExpanded} onToggle={() => toggleExpand(item.id)} />

                      {renderExpandedBody(item)}
                    </div>
                  )
                })}
                {!isBookShelfSection && visibleListCount < indexedTextItems.length ? (
                  <div
                    ref={loadMoreTriggerRef}
                    className="texts-load-more-sentinel"
                  >
                    正在翻出更多条目...
                  </div>
                ) : null}
              </div>
              </div>
            ) : null}
          </main>
        </div>
      ) : (
        <div className="empty-vault animate-fade-up">
          <div style={{ fontSize: '6rem', color: 'var(--glass-border)', userSelect: 'none', lineHeight: 1 }}>∅</div>
          <div className="empty-vault-badge">
            <p style={{ fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              TEXTS · CLASSIFIED
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>思想的碎片尚未着陆</p>
          </div>
        </div>
      )}
    </div>
  )
}
