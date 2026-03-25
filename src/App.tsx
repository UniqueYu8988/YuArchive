import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  Gamepad2, Clapperboard, Music, Feather,
  Sun, Moon, Volume2, VolumeX, ArrowUp
} from 'lucide-react'
import type { ArchiveData } from './types'

// 页面组件
import GamesPage  from './pages/GamesPage'
import Visions    from './pages/Visions'
import MusicPage  from './pages/MusicPage'
import TextsPage  from './pages/TextsPage'
import HomePage   from './pages/HomePage'

// 导入 JSON 数据（Vite 内联为 ES module）
import archiveDataRaw from './data/archive_data.json'
const archiveData = archiveDataRaw as ArchiveData

// ── Navbar ───────────────────────────────────────────────────
interface NavbarProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isMuted: boolean
  toggleMute: () => void
}

function Navbar({ theme, toggleTheme, isMuted, toggleMute }: NavbarProps) {
  // 路由链接配置：图标 + 文字 + 路径
  const navItems = [
    { name: '溯游', path: '/games',  icon: <Gamepad2    size={16} /> },
    { name: '光影', path: '/movies', icon: <Clapperboard size={16} /> },
    { name: '律动', path: '/music',  icon: <Music       size={16} /> },
    { name: '灵犀', path: '/texts',  icon: <Feather     size={16} /> },
  ]

  return (
    <nav className="navbar">
      <div className="nav-container">

        {/* ── 左区：Logo（favicon.png = “Yu”手写图标 + Archive 文字 = “Yu Archive”） ── */}
        <NavLink to="/" className="nav-logo">
          {/* favicon.png 是白色线稿：亮色主题用 invert(1) 变黑可见；暗色主题就是白色，保持原样 */}
          <img src="/favicon.png" alt="Yu" className="nav-avatar" />
          <span className="nav-title">Archive</span>
        </NavLink>

        {/* ── 中区：四大分类路由 ── */}
        <div className="nav-links">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>

        {/* ── 右区：控制按钮 ── */}
        <div className="nav-controls">
          {/* 静音切换 */}
          <button
            onClick={toggleMute}
            className="nav-control-btn"
            title={isMuted ? '播放背景音乐' : '静音'}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          {/* 昼夜切换 */}
          <button
            onClick={toggleTheme}
            className="nav-control-btn"
            title={theme === 'light' ? '切换为极客黑' : '切换为明亮版'}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          {/* Github 极客名片 */}
          <a
            href="https://github.com/UniqueYu8988"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-control-btn"
            title="Yu 的 GitHub 宇宙"
          >
            {/* GitHub 官方极简黑白 SVG */}
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

          {/* Spotify 专属入口 */}
          <a
            href="https://open.spotify.com/playlist/3dYRKji8hGTIJHbT4BSK8H?si=2de89ff7b41e4516"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-control-btn"
            title="Yu 的 Spotify 歌单"
          >
            {/* Spotify 官方 Logo SVG 极简黑白版 */}
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
        </div>

      </div>
    </nav>
  )
}

// ── App 主体 ─────────────────────────────────────────────────
export default function App() {
  // 主题：从 localStorage 读取，默认 dark（极客黑）
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('yu-theme') as 'light' | 'dark') ?? 'dark'
  )
  const [isMuted, setIsMuted] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
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
      <audio ref={audioRef} src="/bgm.mp3" loop />

      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        isMuted={isMuted}
        toggleMute={toggleMute}
      />

      <Routes>
        <Route path="/"       element={<HomePage  data={archiveData} />} />
        <Route path="/games"  element={<GamesPage data={archiveData.categories.games}   />} />
        <Route path="/movies" element={<Visions   data={archiveData.categories.visions} />} />
        <Route path="/music"  element={<MusicPage data={archiveData.categories.music}   />} />
        <Route path="/texts"  element={<TextsPage data={archiveData.categories.texts}   />} />
      </Routes>

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
