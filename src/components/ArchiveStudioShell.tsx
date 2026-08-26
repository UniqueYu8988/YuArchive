import { useEffect, useState, type ReactNode } from 'react'
import { Clapperboard, ExternalLink, Feather, Gamepad2, Home, Music } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const sections = [
  { path: '/studio/home', label: '首页', icon: Home },
  { path: '/studio/games', label: '游戏', icon: Gamepad2 },
  { path: '/studio/visions', label: '影视', icon: Clapperboard },
  { path: '/studio', label: '音乐', icon: Music, end: true },
  { path: '/studio/texts', label: '文本', icon: Feather },
]

export default function ArchiveStudioShell({ children }: { children: ReactNode }) {
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null)
  const serviceLabel = serviceOnline === null
    ? '正在连接本地服务'
    : serviceOnline
      ? '本地服务已连接'
      : '本地服务未连接'

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/studio/profiles', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('offline')
        setServiceOnline(true)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setServiceOnline(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="studio-app">
      <header className="studio-app-header">
        <div className="studio-app-brand">
          <img src="/favicon.png" alt="" />
          <strong>Archive Studio</strong>
        </div>

        <nav className="studio-app-nav" aria-label="管理板块">
          {sections.map(({ path, label, icon: Icon, end }) => (
            <NavLink key={path} to={path} end={end} title={label}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="studio-app-tools">
          <span
            className={`studio-service-dot${serviceOnline === null ? ' is-checking' : serviceOnline ? '' : ' is-offline'}`}
            title={serviceLabel}
            aria-label={serviceLabel}
          />
          <a href="/" target="_blank" rel="noreferrer" title="打开展示网站">
            <ExternalLink size={17} />
            <span>网站</span>
          </a>
        </div>
      </header>

      <div className="studio-app-content">{children}</div>
    </div>
  )
}
