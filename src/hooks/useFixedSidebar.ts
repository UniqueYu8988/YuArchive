import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

type FixedSidebarResult<T extends HTMLElement> = {
  sidebarRef: RefObject<T>
  sidebarContentRef: RefObject<HTMLDivElement>
  sidebarWrapperStyle: CSSProperties
  sidebarContentStyle: CSSProperties
}

type SidebarMode = 'static' | 'fixed' | 'bottom'

export function useFixedSidebar<T extends HTMLElement>(topOffset = 84): FixedSidebarResult<T> {
  const sidebarRef = useRef<T | null>(null) as RefObject<T>
  const sidebarContentRef = useRef<HTMLDivElement | null>(null) as RefObject<HTMLDivElement>

  const [state, setState] = useState<{
    enabled: boolean
    mode: SidebarMode
    left: number
    width: number
    height: number
    viewportHeight: number
  }>({
    enabled: false,
    mode: 'static',
    left: 0,
    width: 0,
    height: 0,
    viewportHeight: 0,
  })

  useEffect(() => {
    const update = () => {
      const wrapper = sidebarRef.current
      const content = sidebarContentRef.current
      if (!wrapper || !content) return

      const desktop = window.innerWidth >= 768
      const wrapperRect = wrapper.getBoundingClientRect()
      const wrapperTop = window.scrollY + wrapperRect.top
      const wrapperHeight = wrapper.offsetHeight
      const contentHeight = content.offsetHeight
      const viewportHeight = window.innerHeight
      const scrollY = window.scrollY

      let mode: SidebarMode = 'static'
      if (desktop) {
        const startStickAt = wrapperTop - topOffset
        const stopStickAt = wrapperTop + wrapperHeight - contentHeight - topOffset

        if (scrollY <= startStickAt) {
          mode = 'static'
        } else if (scrollY >= stopStickAt) {
          mode = 'bottom'
        } else {
          mode = 'fixed'
        }
      }

      setState({
        enabled: desktop,
        mode,
        left: wrapperRect.left,
        width: wrapperRect.width,
        height: contentHeight,
        viewportHeight,
      })
    }

    update()

    const observer = new ResizeObserver(update)
    if (sidebarRef.current) observer.observe(sidebarRef.current)
    if (sidebarContentRef.current) observer.observe(sidebarContentRef.current)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [topOffset])

  const sidebarWrapperStyle: CSSProperties = state.enabled
    ? {
        position: 'relative',
        minHeight: state.height ? `${state.height}px` : undefined,
      }
    : {}

  let sidebarContentStyle: CSSProperties = {}
  if (state.enabled) {
    if (state.mode === 'fixed') {
      sidebarContentStyle = {
        position: 'fixed',
        top: `${topOffset}px`,
        left: `${state.left}px`,
        width: `${state.width}px`,
        maxHeight: `calc(${state.viewportHeight}px - ${topOffset + 16}px)`,
        overflowY: 'auto',
      }
    } else if (state.mode === 'bottom') {
      sidebarContentStyle = {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
      }
    }
  }

  return {
    sidebarRef: sidebarRef as unknown as RefObject<T>,
    sidebarContentRef: sidebarContentRef as unknown as RefObject<HTMLDivElement>,
    sidebarWrapperStyle,
    sidebarContentStyle,
  }
}
