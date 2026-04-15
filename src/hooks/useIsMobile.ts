import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const syncIsMobile = () => {
      setIsMobile(window.innerWidth <= breakpoint)
    }

    syncIsMobile()
    window.addEventListener('resize', syncIsMobile)
    return () => window.removeEventListener('resize', syncIsMobile)
  }, [breakpoint])

  return isMobile
}
