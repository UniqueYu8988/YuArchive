import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { TextsCategory } from '../types'
import { siteLayout } from '../data/siteConfig'

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

export default function TextsPage({ data }: Props) {
  const hasData = data.items.length > 0 && data.total_count > 0
  const sections = data.sections ?? []
  const defaultSection = sections.find(section => section.key === siteLayout.texts_default_section_key)?.key ?? sections[0]?.key ?? 'book-reviews'
  const [activeSection, setActiveSection] = useState(defaultSection)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bookShelfPage, setBookShelfPage] = useState(0)
  const [bookShelfPageSize, setBookShelfPageSize] = useState(5)
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const previousSectionRef = useRef(activeSection)

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
  const expandedItem = filteredItems.find(item => item.id === expandedId) ?? null
  const totalBookShelfPages = isBookShelfSection ? Math.max(1, Math.ceil(filteredItems.length / bookShelfPageSize)) : 1
  const visibleBookShelfItems = isBookShelfSection
    ? filteredItems.slice(bookShelfPage * bookShelfPageSize, (bookShelfPage + 1) * bookShelfPageSize)
    : filteredItems

  useEffect(() => {
    if (previousSectionRef.current !== activeSection) {
      previousSectionRef.current = activeSection
      setExpandedId(null)
      setBookShelfPage(0)
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
      return 3
    }

    const syncPageSize = () => {
      setBookShelfPageSize(calculatePageSize())
    }

    syncPageSize()
    window.addEventListener('resize', syncPageSize)
    return () => window.removeEventListener('resize', syncPageSize)
  }, [])

  useEffect(() => {
    if (!isBookShelfSection) return
    setBookShelfPage(prev => Math.min(prev, Math.max(0, totalBookShelfPages - 1)))
  }, [isBookShelfSection, totalBookShelfPages])

  useEffect(() => {
    if (!isBookShelfSection || !expandedId) return
    const expandedIndex = filteredItems.findIndex(item => item.id === expandedId)
    if (expandedIndex === -1) return
    const targetPage = Math.floor(expandedIndex / bookShelfPageSize)
    if (targetPage !== bookShelfPage) {
      setBookShelfPage(targetPage)
    }
  }, [isBookShelfSection, expandedId, filteredItems, bookShelfPage, bookShelfPageSize])

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedId(prev => (prev === id ? null : id))
  }

  const formatDisplayDate = (rawDate: string, sortDate?: string) => {
    if (sortDate) return sortDate
    return rawDate
  }

  return (
    <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '1460px', paddingTop: '0.9rem', paddingBottom: '6rem' }}>
      {hasData ? (
        <div className="animate-fade-up md:grid md:grid-cols-[270px_1fr] md:gap-6" style={{ display: 'grid', gap: '1.5rem' }}>
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
                      onClick={() => setActiveSection(section.key)}
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
                    onClick={() => {
                      setExpandedId(item.id)
                      setTimeout(() => {
                        const element = itemRefs.current[item.id]
                        if (!element) return
                        const offset = 108
                        const bodyTop = document.body.getBoundingClientRect().top
                        const elementTop = element.getBoundingClientRect().top
                        const targetTop = elementTop - bodyTop - offset
                        window.scrollTo({ top: targetTop, behavior: 'smooth' })
                      }, 80)
                    }}
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

          <main style={{ minWidth: 0 }}>
            {!isBookShelfSection ? (
              <section
                className="animate-fade-up"
                style={{
                  padding: '0.25rem 0.1rem 0.35rem',
                  marginBottom: '1.35rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '0.45rem',
                    marginBottom: '0.9rem',
                  }}
                >
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
                  <h2
                    style={{
                      fontSize: 'clamp(2.3rem, 4vw, 4.2rem)',
                      lineHeight: 0.96,
                      letterSpacing: '-0.06em',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    {activeSectionInfo?.title ?? '每天听本书'}
                  </h2>
                </div>
                <p
                  style={{
                    maxWidth: '760px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.98rem',
                    lineHeight: 1.78,
                    margin: 0,
                  }}
                >
                  {activeSectionInfo?.description ?? '把值得留下的内容浓缩成可以再次翻阅的文字切片。'}
                </p>
              </section>
            ) : null}

            {isBookShelfSection ? (
              <section
                className="animate-fade-up daily-shelf-shell"
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
                    style={{
                      borderRadius: '24px',
                      border: '1px dashed rgba(128,128,128,0.22)',
                      minHeight: '260px',
                      padding: '1.2rem',
                      display: 'grid',
                      gap: '1.05rem',
                      alignContent: 'start',
                    }}
                  >
                    {filteredItems.length ? (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.8rem',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.76rem',
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Shelf Page {bookShelfPage + 1} / {totalBookShelfPages}
                          </div>
                          {totalBookShelfPages > 1 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => setBookShelfPage(prev => Math.max(0, prev - 1))}
                                disabled={bookShelfPage === 0}
                                style={{
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  background: bookShelfPage === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                                  color: bookShelfPage === 0 ? 'rgba(255,255,255,0.35)' : 'var(--text-primary)',
                                  cursor: bookShelfPage === 0 ? 'default' : 'pointer',
                                  fontSize: '0.78rem',
                                  letterSpacing: '0.08em',
                                  padding: '0.42rem 0.82rem',
                                  borderRadius: '999px',
                                }}
                              >
                                上一页
                              </button>
                              <button
                                type="button"
                                onClick={() => setBookShelfPage(prev => Math.min(totalBookShelfPages - 1, prev + 1))}
                                disabled={bookShelfPage >= totalBookShelfPages - 1}
                                style={{
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  background: bookShelfPage >= totalBookShelfPages - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                                  color: bookShelfPage >= totalBookShelfPages - 1 ? 'rgba(255,255,255,0.35)' : 'var(--text-primary)',
                                  cursor: bookShelfPage >= totalBookShelfPages - 1 ? 'default' : 'pointer',
                                  fontSize: '0.78rem',
                                  letterSpacing: '0.08em',
                                  padding: '0.42rem 0.82rem',
                                  borderRadius: '999px',
                                }}
                              >
                                下一页
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(bookShelfPageSize, visibleBookShelfItems.length)}, minmax(0, 1fr))`,
                            gap: '0.95rem',
                            alignItems: 'end',
                          }}
                        >
                        {visibleBookShelfItems.map((item, idx) => {
                          const isExpanded = expandedId === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleExpand(item.id)}
                              style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <div
                                style={{
                                  aspectRatio: '2 / 3',
                                  borderRadius: '18px',
                                  overflow: 'hidden',
                                  background: 'rgba(255,255,255,0.03)',
                                  border: isExpanded ? '1px solid rgba(196, 168, 120, 0.45)' : '1px solid rgba(255,255,255,0.08)',
                                  transform: `translateY(${idx % 3 === 1 ? '8px' : idx % 3 === 2 ? '4px' : '0px'}) rotate(${idx % 2 === 0 ? '-0.9deg' : '0.9deg'})`,
                                  boxShadow: isExpanded ? '0 18px 36px rgba(0,0,0,0.16)' : '0 14px 28px rgba(0,0,0,0.1)',
                                  transition: 'transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease',
                                }}
                              >
                                {item.cover ? (
                                  <img
                                    src={`/${item.cover}`}
                                    alt={item.title}
                                    loading="lazy"
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      display: 'block',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      display: 'grid',
                                      placeItems: 'center',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.82rem',
                                      padding: '1rem',
                                      textAlign: 'center',
                                    }}
                                  >
                                    暂无封面
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
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
                {filteredItems.map((item) => {
                  const isExpanded = expandedId === item.id

                  return (
                    <div
                      key={item.id}
                      ref={el => (itemRefs.current[item.id] = el)}
                      style={{
                        background: 'rgba(128,128,128,0.03)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        transition: 'border-color 0.3s',
                      }}
                    >
                      <div
                        onClick={() => toggleExpand(item.id)}
                        className="p-4 md:p-8 cursor-pointer flex flex-col gap-3 md:gap-5 transition-colors"
                        onMouseEnter={e => {
                          ;(e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)'
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                        }}
                      >
                        <div className="flex items-start justify-between w-full">
                          <h2 className={`font-semibold text-primary tracking-tight leading-snug flex-1 pr-4 m-0 transition-all ${isExpanded ? 'text-lg md:text-xl' : 'text-base md:text-lg'}`}>
                            {item.title}
                          </h2>
                          <div className={`transition-transform duration-500 flex items-center justify-center text-primary flex-shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                            <ChevronDown size={isExpanded ? 24 : 20} strokeWidth={1.5} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between w-full">
                          <div className="flex gap-2 flex-wrap">
                            {item.tags.length > 0 ? item.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-[10px] md:text-xs px-2 py-0.5 bg-[rgba(128,128,128,0.1)] text-secondary rounded"
                              >
                                #{tag}
                              </span>
                            )) : (
                              <span className="text-[10px] md:text-xs text-secondary opacity-60">
                                无标签
                              </span>
                            )}
                          </div>

                          <span
                            className="font-geek tracking-wider font-bold text-[10px] md:text-sm text-secondary opacity-85"
                            title={formatDisplayDate(item.date, item.sort_date)}
                          >
                            {formatDisplayDate(item.date, item.sort_date)}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: isExpanded ? '1fr' : '0fr',
                          transition: 'grid-template-rows 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div className="px-4 md:px-8 pb-6 md:pb-10 border-t border-glass-border text-primary">
                            <div className="elegant-markdown">
                              <ReactMarkdown
                                components={bookishMarkdownComponents}
                              >
                                {item.content}
                              </ReactMarkdown>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(128,128,128,0.2)' }}>
                              <button
                                onClick={(e) => toggleExpand(item.id, e)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  color: 'var(--text-secondary)',
                                  fontSize: '0.9rem',
                                  letterSpacing: '0.1em',
                                  cursor: 'pointer',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '20px',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => {
                                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
                                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)'
                                }}
                                onMouseLeave={e => {
                                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                                }}
                              >
                                <ChevronUp size={16} />
                                收起
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
