import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import {
  Gamepad2, Clapperboard, Music, Feather,
  Sun, Moon, Volume2, VolumeX, ArrowUp, Ellipsis, Wrench
} from 'lucide-react'
import type { HomePageData, MusicCategory, TextsCategory, TimelineCategory } from './types'
import { useIsMobile } from './hooks/useIsMobile'
import { loadJsonData, useJsonData } from './hooks/useJsonData'

const MOBILE_NOTICE_STORAGE_KEY = 'yu-archive-mobile-notice-dismissed-v1'
const routePreloads = {
  home: () => import('./pages/HomePage'),
  games: () => import('./pages/GamesPage'),
  visions: () => import('./pages/Visions'),
  music: () => import('./pages/MusicPage'),
  texts: () => import('./pages/TextsPage'),
  studio: () => import('./pages/ArchiveStudioPage'),
  studioTexts: () => import('./pages/ArchiveStudioTextsPage'),
  studioVisions: () => import('./pages/ArchiveStudioVisionsPage'),
  studioGames: () => import('./pages/ArchiveStudioGamesPage'),
  studioHome: () => import('./pages/ArchiveStudioHomepagePage'),
}
const HomePage = lazy(routePreloads.home)
const GamesPage = lazy(routePreloads.games)
const Visions = lazy(routePreloads.visions)
const MusicPage = lazy(routePreloads.music)
const TextsPage = lazy(routePreloads.texts)
const ArchiveStudioPage = lazy(routePreloads.studio)
const ArchiveStudioTextsPage = lazy(routePreloads.studioTexts)
const ArchiveStudioVisionsPage = lazy(routePreloads.studioVisions)
const ArchiveStudioGamesPage = lazy(routePreloads.studioGames)
const ArchiveStudioHomepagePage = lazy(routePreloads.studioHome)

const routeWarmups: Record<string, () => Promise<unknown>> = {
  '/': () => Promise.all([routePreloads.home(), loadJsonData<HomePageData>('/data/home.json')]),
  '/games': () => Promise.all([routePreloads.games(), loadJsonData<TimelineCategory>('/data/games.json')]),
  '/movies': () => Promise.all([routePreloads.visions(), loadJsonData<TimelineCategory>('/data/visions.json')]),
  '/music': () => Promise.all([routePreloads.music(), loadJsonData<MusicCategory>('/data/music.json')]),
  '/texts': () => Promise.all([routePreloads.texts(), loadJsonData<TextsCategory>('/data/texts.json')]),
  '/studio': routePreloads.studio,
  '/studio/texts': routePreloads.studioTexts,
  '/studio/visions': routePreloads.studioVisions,
  '/studio/games': routePreloads.studioGames,
  '/studio/home': routePreloads.studioHome,
}

function warmRoute(path: string) {
  void routeWarmups[path]?.().catch(() => {})
}

function warmAllRoutes() {
  Object.keys(routeWarmups).forEach(warmRoute)
}

// ── Navbar ───────────────────────────────────────────────────
interface NavbarProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isMuted: boolean
  toggleMute: () => void
  isMobile: boolean
}

function Navbar({ theme, toggleTheme, isMuted, toggleMute, isMobile }: NavbarProps) {
  const [showMobileUtilities, setShowMobileUtilities] = useState(false)
  // 路由链接配置：图标 + 文字 + 路径
  const navItems = [
    { name: '溯游', path: '/games',  icon: <Gamepad2    size={16} /> },
    { name: '光影', path: '/movies', icon: <Clapperboard size={16} /> },
    { name: '律动', path: '/music',  icon: <Music       size={16} /> },
    { name: '灵犀', path: '/texts',  icon: <Feather     size={16} /> },
  ]

  const muteButton = (
    <button
      onClick={toggleMute}
      className="nav-control-btn"
      title={isMuted ? '播放背景音乐' : '静音'}
    >
      {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
    </button>
  )

  const themeButton = (
    <button
      onClick={toggleTheme}
      className="nav-control-btn"
      title={theme === 'light' ? '切换为极客黑' : '切换为明亮版'}
    >
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  )

  const githubButton = (
    <a
      href="https://github.com/UniqueYu8988"
      target="_blank"
      rel="noopener noreferrer"
      className="nav-control-btn"
      title="Yu 的 GitHub 宇宙"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
    </a>
  )

  const spotifyButton = (
    <a
      href="https://open.spotify.com/playlist/3dYRKji8hGTIJHbT4BSK8H?si=2de89ff7b41e4516"
      target="_blank"
      rel="noopener noreferrer"
      className="nav-control-btn"
      title="Yu 的 Spotify 歌单"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.72a.78.78 0 0 1-1.072.257c-2.687-1.652-6.786-2.13-9.965-1.166a.78.78 0 0 1-.43-1.498c3.633-1.102 8.147-.568 11.21 1.335a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.527-1.07 9.393-.863 13.098 1.332a.937.937 0 0 1-.938 1.62z"/>
      </svg>
    </a>
  )

  const studioButton = (
    <NavLink
      to="/studio"
      className={({ isActive }) => `nav-control-btn${isActive ? ' is-active' : ''}`}
      title="Archive Studio"
      aria-label="打开 Archive Studio"
      onMouseEnter={() => warmRoute('/studio')}
      onFocus={() => warmRoute('/studio')}
    >
      <Wrench size={17} />
    </NavLink>
  )

  if (isMobile) {
    return (
      <nav className="navbar navbar--mobile">
        <div className="nav-container nav-container--mobile">
          <div className="nav-mobile-brand-row">
            <NavLink to="/" className="nav-logo nav-logo--mobile" onMouseEnter={() => warmRoute('/')} onFocus={() => warmRoute('/')}>
              <img src="/favicon.png" alt="Yu" className="nav-avatar" />
              <span className="nav-title nav-title--mobile">Archive</span>
            </NavLink>

            <div className="nav-controls nav-controls--mobile">
              {muteButton}
              {themeButton}
              <button
                type="button"
                onClick={() => setShowMobileUtilities(open => !open)}
                className={`nav-control-btn${showMobileUtilities ? ' is-active' : ''}`}
                title="更多入口"
                aria-expanded={showMobileUtilities}
                aria-label="展开更多入口"
              >
                <Ellipsis size={17} />
              </button>
            </div>
          </div>

          {showMobileUtilities ? (
            <div className="nav-mobile-utility-menu">
              {studioButton}
              {githubButton}
              {spotifyButton}
            </div>
          ) : null}

          <div className="nav-links nav-links--mobile">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onMouseEnter={() => warmRoute(item.path)}
                onFocus={() => warmRoute(item.path)}
                className={({ isActive }) => `nav-item nav-item--mobile ${isActive ? 'active' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="navbar">
      <div className="nav-container">

        {/* ── 左区：Logo（favicon.png = “Yu”手写图标 + Archive 文字 = “Yu Archive”） ── */}
        <NavLink to="/" className="nav-logo" onMouseEnter={() => warmRoute('/')} onFocus={() => warmRoute('/')}>
          {/* favicon.png 是白色线稿：亮色主题用 invert(1) 变黑可见；暗色主题就是白色，保持原样 */}
          <img src="/favicon.png" alt="Yu" className="nav-avatar" />
          <span className="nav-title hidden md:inline">Archive</span>
        </NavLink>

        {/* ── 中区：四大分类路由 ── */}
        <div className="nav-links">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onMouseEnter={() => warmRoute(item.path)}
              onFocus={() => warmRoute(item.path)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              <span className="hidden md:inline">{item.name}</span>
            </NavLink>
          ))}
        </div>

        {/* ── 右区：控制按钮 ── */}
        <div className="nav-controls">
          {muteButton}
          {themeButton}
          {studioButton}
          {githubButton}
          {spotifyButton}
        </div>

      </div>
    </nav>
  )
}

function MobileViewportNotice({ onDismiss }: { onDismiss: () => void }) {
  const location = useLocation()

  if (location.pathname === '/studio') {
    return null
  }

  return (
    <div className="mobile-viewport-notice" role="status" aria-live="polite">
      <div className="mobile-viewport-notice__eyebrow">Mobile Viewing Note</div>
      <div className="mobile-viewport-notice__body">
        当前移动端已提供轻量浏览，完整展陈与最佳排版仍建议在电脑端查看。
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mobile-viewport-notice__dismiss"
        aria-label="关闭移动端提示"
      >
        知道了
      </button>
    </div>
  )
}

function RouteStateCard({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      style={{
        maxWidth: '880px',
        margin: '2.2rem auto 0',
        padding: '1.2rem 1.35rem',
        borderRadius: '24px',
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
        boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '0.55rem',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '0.98rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
        }}
      >
        {message}
      </div>
    </div>
  )
}

function HomeRoute() {
  const { data, error } = useJsonData<HomePageData>('/data/home.json')

  if (error) {
    return <RouteStateCard title="Home" message="首页数据暂时没有整理好，请稍后再试。" />
  }

  if (!data) {
    return <RouteStateCard title="Home" message="正在整理首页馆藏..." />
  }

  return <HomePage data={data} />
}

function GamesRoute() {
  const { data, error } = useJsonData<TimelineCategory>('/data/games.json')

  if (error) {
    return <RouteStateCard title="Games" message="游戏馆藏暂时没有装载成功，请稍后再试。" />
  }

  if (!data) {
    return <RouteStateCard title="Games" message="正在展开时间线..." />
  }

  return <GamesPage data={data} />
}

function VisionsRoute() {
  const { data, error } = useJsonData<TimelineCategory>('/data/visions.json')

  if (error) {
    return <RouteStateCard title="Visions" message="光影档案暂时没有装载成功，请稍后再试。" />
  }

  if (!data) {
    return <RouteStateCard title="Visions" message="正在点亮光影馆藏..." />
  }

  return <Visions data={data} />
}

function MusicRoute() {
  const { data, error } = useJsonData<MusicCategory>('/data/music.json')

  if (error) {
    return <RouteStateCard title="Music" message="音乐馆藏暂时没有装载成功，请稍后再试。" />
  }

  if (!data) {
    return <RouteStateCard title="Music" message="正在装载唱片架..." />
  }

  return <MusicPage data={data} />
}

function TextsRoute() {
  const { data, error } = useJsonData<TextsCategory>('/data/texts.json')

  if (error) {
    return <RouteStateCard title="Texts" message="文本档案暂时没有装载成功，请稍后再试。" />
  }

  if (!data) {
    return <RouteStateCard title="Texts" message="正在翻开文稿目录..." />
  }

  return <TextsPage data={data} />
}

// ── App 主体 ─────────────────────────────────────────────────
export default function App() {
  // 主题：从 localStorage 读取，默认 dark（极客黑）
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('yu-theme') as 'light' | 'dark') ?? 'dark'
  )
  const [isMuted, setIsMuted] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showMobileViewportNotice, setShowMobileViewportNotice] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMobileViewport = useIsMobile()

  // 主题切换：修改 <html> 的 data-theme 属性，触发 CSS 变量全局切换
  // 这是实现"丝滑无闪烁"昼夜切换的核心机制
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('yu-theme', theme)
  }, [theme])

  // 初始化：立即设置主题，避免首屏闪白
  useEffect(() => {
    const saved = localStorage.getItem('yu-theme') as 'light' | 'dark' | null
    const initial = saved ?? 'dark'
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  // 监听滚动，控制返回顶部按钮显示
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isMobileViewport) {
      setShowMobileViewportNotice(false)
      return
    }

    const dismissed = localStorage.getItem(MOBILE_NOTICE_STORAGE_KEY) === '1'
    setShowMobileViewportNotice(!dismissed)
  }, [isMobileViewport])

  useEffect(() => {
    const warm = () => warmAllRoutes()
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warm, { timeout: 1800 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = globalThis.setTimeout(warm, 500)
    return () => globalThis.clearTimeout(timeoutId)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const dismissMobileViewportNotice = () => {
    localStorage.setItem(MOBILE_NOTICE_STORAGE_KEY, '1')
    setShowMobileViewportNotice(false)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        if (!audioRef.current.src) {
          audioRef.current.src = '/bgm.mp3'
          audioRef.current.load()
        }
        audioRef.current.play().catch(() => {})
        setIsMuted(false)
      } else {
        audioRef.current.pause()
        setIsMuted(true)
      }
    }
  }

  return (
    <BrowserRouter>
      {/* 背景音乐（静音启动） */}
      <audio ref={audioRef} loop preload="none" />

      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        isMuted={isMuted}
        toggleMute={toggleMute}
        isMobile={isMobileViewport}
      />

      {isMobileViewport && showMobileViewportNotice ? (
        <MobileViewportNotice onDismiss={dismissMobileViewportNotice} />
      ) : null}

      <Suspense fallback={<RouteStateCard title="Archive" message="正在开启档案馆..." />}>
        <Routes>
          <Route path="/"       element={<HomeRoute />} />
          <Route path="/games"  element={<GamesRoute />} />
          <Route path="/movies" element={<VisionsRoute />} />
          <Route path="/music"  element={<MusicRoute />} />
          <Route path="/texts"  element={<TextsRoute />} />
          <Route path="/studio" element={<ArchiveStudioPage />} />
          <Route path="/studio/texts" element={<ArchiveStudioTextsPage />} />
          <Route path="/studio/visions" element={<ArchiveStudioVisionsPage />} />
          <Route path="/studio/games" element={<ArchiveStudioGamesPage />} />
          <Route path="/studio/home" element={<ArchiveStudioHomepagePage />} />
        </Routes>
      </Suspense>

      {/* 返回顶部按钮 */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="scroll-to-top"
          title="返回顶部"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
          }}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </BrowserRouter>
  )
}
