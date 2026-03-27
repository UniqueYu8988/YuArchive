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

      <div className="mx-auto px-4 md:px-8" style={{ maxWidth: '800px' }}>
        {hasData ? (
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
                        {item.tags.map(tag => (
                          <span 
                            key={tag}
                            className="text-[10px] md:text-xs px-2 py-0.5 bg-[rgba(128,128,128,0.1)] text-secondary rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                      
                      <span className="font-geek tracking-wider font-bold text-[10px] md:text-sm text-secondary opacity-85">
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
