import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { TextsCategory } from '../types'

interface Props {
  data: TextsCategory
}

export default function TextsPage({ data }: Props) {
  const hasData = data.items.length > 0 && data.total_count > 0
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  // 引用映射，用于滚动对焦
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setExpandedId(prev => prev === id ? null : id)
  }

  // 当展开项变化时，平滑滚动到该项头部，避开 70px 导航栏
  useEffect(() => {
    if (expandedId && itemRefs.current[expandedId]) {
      const element = itemRefs.current[expandedId];
      if (element) {
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
        }, 120); // 稍微长一点点，给折叠留出时间
      }
    }
  }, [expandedId])

  const formatDisplayDate = (rawDate: string, sortDate?: string) => {
    if (sortDate) return sortDate
    return rawDate
  }

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
                {data.items.map(item => (
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
                      transition: 'all 0.22s ease',
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
          </aside>

          <main style={{ minWidth: 0 }}>
            <div style={{ maxWidth: '800px' }}>
              <div className="flex flex-col gap-4 md:gap-6">
            {data.items.map((item, idx) => {
              const isExpanded = expandedId === item.id;
              
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
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s'
                  }}
                >
                  {/* Card Header (Clickable) */}
                  <div 
                    onClick={() => toggleExpand(item.id)}
                    className="p-4 md:p-8 cursor-pointer flex flex-col gap-3 md:gap-5 transition-colors"
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Top Row: Title + Chevron */}
                    <div className="flex items-start justify-between w-full">
                      <h2 className={`font-semibold text-primary tracking-tight leading-snug flex-1 pr-4 m-0 transition-all ${isExpanded ? 'text-lg md:text-xl' : 'text-base md:text-lg'}`}>
                        {item.title}
                      </h2>
                      <div 
                        className={`transition-transform duration-500 flex items-center justify-center text-primary flex-shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                      >
                        <ChevronDown size={isExpanded ? 24 : 20} strokeWidth={1.5} />
                      </div>
                    </div>
                    
                    {/* Bottom Row: Tags + Date */}
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

                  {/* Card Body (Accordion Content via Grid transitions) */}
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateRows: isExpanded ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div className="px-4 md:px-8 pb-6 md:pb-10 border-t border-glass-border text-primary">
                        {/* 优雅的 Markdown 渲染 */}
                        <div className="elegant-markdown">
                          <ReactMarkdown
                            components={{
                              p: ({node, ...props}) => <p className="text-xs md:text-base leading-relaxed md:leading-loose text-secondary mb-4 md:mb-6 tracking-normal md:tracking-wide font-light" {...props} />,
                              h1: ({node, ...props}) => <h3 className="text-lg md:text-2xl text-primary mt-6 md:mt-10 mb-4 font-semibold" {...props} />,
                              h2: ({node, ...props}) => <h4 className="text-base md:text-xl text-primary mt-5 md:mt-8 mb-3 font-semibold" {...props} />,
                              h3: ({node, ...props}) => <h5 className="text-sm md:text-lg text-primary mt-4 md:mt-6 mb-2 font-semibold" {...props} />,
                              ul: ({node, ...props}) => <ul className="pl-4 md:pl-6 text-secondary mb-4 md:mb-6 leading-relaxed" {...props} />,
                              ol: ({node, ...props}) => <ol className="pl-4 md:pl-6 text-secondary mb-4 md:mb-6 leading-relaxed" {...props} />,
                              li: ({node, ...props}) => <li className="mb-2" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-glass-border pl-4 text-secondary italic mb-4 md:mb-6 opacity-80" {...props} />
                            }}
                          >
                            {item.content}
                          </ReactMarkdown>
                        </div>
                        
                        {/* 底部居中的快速收起按钮 */}
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
                               transition: 'all 0.2s ease'
                             }}
                             onMouseEnter={e => {
                               (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                               (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                             }}
                             onMouseLeave={e => {
                               (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                               (e.currentTarget as HTMLElement).style.background = 'transparent';
                             }}
                           >
                             <ChevronUp size={16} />
                             收起 (COLLAPSE)
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            </div>
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
