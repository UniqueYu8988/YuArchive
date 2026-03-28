import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { MusicCategory } from '../types'

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) return extractText(node.props.children)
  return ''
}

function toImageUrl(imagePath?: string): string {
  if (!imagePath) return ''
  return `/${encodeURIComponent(imagePath).replace(/%2F/g, '/')}`
}

interface Props {
  data: MusicCategory
}

export default function MusicPage({ data }: Props) {
  const hasData = data.items.length > 0 && data.total_count > 0
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  // 引用映射，用于滚动对焦
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedId(prev => (prev === id ? null : id))
  }

  // 当展开项变化时，平滑滚动到该项头部，并避开 70px 的固定导航栏
  useEffect(() => {
    if (expandedId && itemRefs.current[expandedId]) {
      const element = itemRefs.current[expandedId];
      if (element) {
        // 延迟一小会儿，等待 React 完成渲染和 Grid 开始动画
        setTimeout(() => {
          const offset = 120; // 70px navbar + 50px 呼吸间距
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = element.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [expandedId])

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div className="page-header animate-fade-up">
        <p className="page-label">{data.display_name}</p>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'baseline' }}>
          律动共鸣
          <span className="text-sm text-gray-400 ml-4 font-light" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '1rem', fontWeight: 300, letterSpacing: '0.02em' }}>
            以波长为载体，铭刻情绪与记忆
          </span>
        </h1>
        {hasData && (
          <p className="page-count">
            共收录 <strong>{data.total_count}</strong> 张独立专辑
          </p>
        )}
      </div>

      <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '900px' }}>
        {hasData ? (
          <div className="flex flex-col gap-6 md:gap-12">
            {data.items.map((item, idx) => {
              const isExpanded = expandedId === item.id

              return (
                <div
                  key={item.id}
                  ref={el => (itemRefs.current[item.id] = el)}
                  className="animate-fade-up"
                  style={{
                    animationDelay: `${idx * 0.05}s`,
                    animationFillMode: 'both',
                    background: 'rgba(128,128,128,0.03)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    transition: 'background 0.3s, border-color 0.3s'
                  }}
                >
                  {/* 专辑 Header 区：封面 + 信息 (Clickable) */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-4 md:gap-10 p-4 md:p-8 cursor-pointer transition-colors"
                  >
                    {/* 封面 */}
                    <div
                      style={{
                        width: isExpanded ? (window.innerWidth < 768 ? '100px' : '140px') : (window.innerWidth < 768 ? '70px' : '100px'),
                        height: isExpanded ? (window.innerWidth < 768 ? '100px' : '140px') : (window.innerWidth < 768 ? '70px' : '100px'),
                        flexShrink: 0,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      {item.cover ? (
                        <img
                          src={toImageUrl(item.cover)}
                          alt={item.title}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                            fontSize: '0.7rem'
                          }}
                        >
                          No Cover
                        </div>
                      )}
                    </div>

                    {/* 标题 & 描述 */}
                    <div className="flex-1 overflow-hidden">
                      <h2
                        className={`font-bold transition-all duration-500 tracking-tight text-primary leading-tight ${isExpanded ? 'text-lg md:text-2xl mb-1 md:mb-2' : 'text-base md:text-xl mb-1'}`}
                      >
                        {item.title}
                      </h2>
                      {item.description && (
                        <p
                          className={`text-secondary text-[11px] md:text-sm leading-relaxed opacity-70 transition-all ${isExpanded ? 'line-clamp-none' : 'line-clamp-1 md:line-clamp-2'}`}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* 展开指示器 */}
                    <div
                      className={`transition-transform duration-500 text-secondary px-2 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                    >
                      <ChevronDown size={window.innerWidth < 768 ? 18 : 24} strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* 音轨列表 Body 区 (Accordion Content) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: isExpanded ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        className="album-tracklist px-4 md:px-8 pb-6 md:pb-10"
                        style={{
                          borderTop: '1px solid var(--glass-border)'
                        }}
                      >
                        <ReactMarkdown
                          components={{
                            ul: ({ node, ...props }) => (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol
                                style={{
                                  listStyle: 'none',
                                  padding: 0,
                                  margin: 0,
                                  counterReset: 'track-counter'
                                }}
                                {...props}
                              />
                            ),
                            li: ({ node, ...props }) => {
                              const [hoveredTrack, setHoveredTrack] = useState(false)
                              const songName = extractText(props.children).trim()
                              const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(songName)}`

                              return (
                                <li
                                  className="flex items-center py-2 md:py-3 border-b border-glass-border transition-colors relative"
                                  style={{
                                    color: 'var(--text-primary)',
                                    fontSize: '0.825rem',
                                  }}
                                  onMouseEnter={e => {
                                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.06)'
                                    setHoveredTrack(true)
                                  }}
                                  onMouseLeave={e => {
                                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                                    setHoveredTrack(false)
                                  }}
                                >
                                  <span
                                    className="track-number text-[10px] md:text-xs text-secondary-dim opacity-60 w-8 md:w-10 font-mono"
                                  />
                                  <a
                                    href={spotifyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: hoveredTrack ? '#1DB954' : 'inherit',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      flex: 1,
                                      transition: 'color 0.3s ease',
                                      position: 'relative'
                                    }}
                                  >
                                    <span 
                                      className="relative text-xs md:text-sm"
                                    >
                                      {props.children}
                                      <span
                                        style={{
                                          position: 'absolute',
                                          left: 0,
                                          bottom: '-2px',
                                          width: hoveredTrack ? '100%' : '0%',
                                          height: '1px',
                                          background: '#1DB954',
                                          transition: 'width 0.3s ease',
                                        }}
                                      />
                                    </span>
                                    <span style={{ 
                                      marginLeft: '0.5rem', 
                                      opacity: hoveredTrack ? 1 : 0, 
                                      transform: hoveredTrack ? 'translateX(0)' : 'translateX(-6px)',
                                      transition: 'all 0.3s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      color: '#1DB954'
                                    }}>
                                      <ExternalLink size={14} />
                                    </span>
                                  </a>
                                </li>
                              )
                            },
                            h1: ({ node, ...props }) => (
                              <h3
                                className="text-[10px] md:text-sm text-secondary uppercase tracking-widest mt-6 md:mt-10 mb-2 md:mb-4 border-b border-glass-border pb-2 opacity-80"
                                {...props}
                              />
                            ),
                            h2: ({ node, ...props }) => (
                              <h3
                                className="text-[10px] md:text-sm text-secondary uppercase tracking-widest mt-6 md:mt-10 mb-2 md:mb-4 border-b border-glass-border pb-2 opacity-80"
                                {...props}
                              />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3
                                className="text-[10px] md:text-sm text-secondary uppercase tracking-widest mt-6 md:mt-10 mb-2 md:mb-4 border-b border-glass-border pb-2 opacity-80"
                                {...props}
                              />
                            )
                          }}
                        >
                          {item.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  <style>{`
                    .album-tracklist li { counter-increment: track-counter; }
                    .album-tracklist li .track-number::before {
                      content: counter(track-counter, decimal-leading-zero);
                    }
                  `}</style>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-vault animate-fade-up">
            <div style={{ fontSize: '6rem', color: 'var(--glass-border)', userSelect: 'none', lineHeight: 1 }}>∅</div>
            <div className="empty-vault-badge">
              <p style={{ fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                AUDIO · CLASSIFIED
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>频率尚未锁定</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
