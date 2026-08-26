import { useEffect, useId, useState, type ReactNode } from 'react'
import { Maximize2, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function ArchiveStudioDisplayPreview({
  title,
  children,
  expandedChildren,
}: {
  title: string
  children: ReactNode
  expandedChildren?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expanded])

  return (
    <div className="studio-display-preview">
      <div className="studio-display-preview__heading">
        <div>
          <span>展示预览</span>
          <strong>{title}</strong>
        </div>
        <button type="button" onClick={() => setExpanded(true)} aria-label="放大展示预览" title="放大预览">
          <Maximize2 size={16} />
        </button>
      </div>
      {children}

      {expanded ? createPortal(
        <div className="studio-preview-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={() => setExpanded(false)}>
          <div className="studio-preview-dialog__surface" onMouseDown={event => event.stopPropagation()}>
            <header>
              <strong id={titleId}>{title}</strong>
              <button type="button" onClick={() => setExpanded(false)} aria-label="关闭展示预览" title="关闭">
                <X size={18} />
              </button>
            </header>
            <div className="studio-preview-dialog__content">
              {expandedChildren ?? children}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
