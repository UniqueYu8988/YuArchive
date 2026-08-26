import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function ArchiveStudioScaledPreview({
  width,
  children,
}: {
  width: number
  children: ReactNode
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState({ scale: 1, height: 0 })

  useEffect(() => {
    const host = hostRef.current
    const content = contentRef.current
    if (!host || !content) return

    const measure = () => {
      const scale = Math.min(1, host.clientWidth / width)
      setLayout({ scale, height: content.scrollHeight * scale })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    observer.observe(content)
    measure()
    return () => observer.disconnect()
  }, [width])

  return (
    <div ref={hostRef} className="studio-scaled-preview" style={{ height: layout.height || undefined }}>
      <div ref={contentRef} style={{ width, transform: `scale(${layout.scale})` }}>
        {children}
      </div>
    </div>
  )
}
