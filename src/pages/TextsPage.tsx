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

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div className="page-header animate-fade-up">
        <p className="page-label">{data.display_name}</p>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'baseline' }}>
          灵犀断章
          <span className="text-sm text-gray-400 ml-4 font-light" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '1rem', fontWeight: 300, letterSpacing: '0.02em' }}>
            在字里行间，寻觅灵魂的归宿
          </span>
        </h1>
        {hasData && (
          <p className="page-count">
            共收录 <strong>{data.total_count}</strong> 篇短文
          </p>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        {hasData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                    style={{
                      padding: '1.5rem 2rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.2rem',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(128,128,128,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Top Row: Title + Chevron */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.4, flex: 1, paddingRight: '1rem', margin: 0 }}>
                        {item.title}
                      </h2>
                      <div style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        <ChevronDown size={20} strokeWidth={1.5} />
                      </div>
                    </div>
                    
                    {/* Bottom Row: Tags + Date */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {item.tags.map(tag => (
                          <span 
                            key={tag}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.6rem',
                              background: 'rgba(128,128,128,0.1)',
                              color: 'var(--text-secondary)',
                              borderRadius: '4px'
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      
                      <span className="font-geek tracking-wider font-bold" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', opacity: 0.85, letterSpacing: '0.08em' }}>
                        {item.date}
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
                      <div style={{
                        padding: '1rem 2rem 2rem',
                        borderTop: '1px solid var(--glass-border)',
                        color: 'var(--text-primary)'
                      }}>
                        {/* 优雅的 Markdown 渲染 */}
                        <div className="elegant-markdown">
                          <ReactMarkdown
                            components={{
                              p: ({node, ...props}) => <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: '1.5rem', letterSpacing: '0.02em' }} {...props} />,
                              h1: ({node, ...props}) => <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '2.5rem', marginBottom: '1rem', fontWeight: 600 }} {...props} />,
                              h2: ({node, ...props}) => <h4 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginTop: '2rem', marginBottom: '0.8rem', fontWeight: 600 }} {...props} />,
                              h3: ({node, ...props}) => <h5 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '1.5rem', marginBottom: '0.8rem', fontWeight: 600 }} {...props} />,
                              ul: ({node, ...props}) => <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.8 }} {...props} />,
                              ol: ({node, ...props}) => <ol style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.8 }} {...props} />,
                              li: ({node, ...props}) => <li style={{ marginBottom: '0.5rem' }} {...props} />,
                              blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '4px solid var(--glass-border)', paddingLeft: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '1.5rem', opacity: 0.8 }} {...props} />
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
                               transition: 'all 0.2sease'
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
    </div>
  )
}
