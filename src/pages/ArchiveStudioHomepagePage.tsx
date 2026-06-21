import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle, ArrowDown, ArrowUp, CheckCircle2, GripVertical,
  Home, RefreshCcw, Save, Search, ShieldCheck,
} from 'lucide-react'
import { invalidateJsonData } from '../hooks/useJsonData'
import './ArchiveStudioPage.css'

type Board = 'games' | 'visions' | 'music' | 'texts'
type Selection = Record<Board, string[]>
type Candidate = { id: string; title: string; synced: boolean; thumbnail: string; secondary: string }
type HomepageState = {
  ok: boolean
  configExists: boolean
  selection: Selection
  limits: Record<Board, number>
  candidates: Record<Board, Candidate[]>
  validationErrors: unknown[]
}
type PreviewResult = {
  ok: boolean
  errors: Array<{ code: string; board?: Board }>
  configChanged?: boolean
  homeChanged?: boolean
  state?: 'ready' | 'current' | 'synced'
  token?: string | null
}

const boards: Array<{ key: Board; label: string }> = [
  { key: 'games', label: '游戏' },
  { key: 'visions', label: '影视' },
  { key: 'music', label: '音乐' },
  { key: 'texts', label: '文本' },
]

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const body = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message || '请求失败')
  return body
}

function postJson<T>(url: string, body: object) {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default function ArchiveStudioHomepagePage() {
  const [state, setState] = useState<HomepageState | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [baseline, setBaseline] = useState('')
  const [activeBoard, setActiveBoard] = useState<Board>('games')
  const [activeSlot, setActiveSlot] = useState(0)
  const [query, setQuery] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'idle' | 'preview' | 'saving' | 'sync-ready' | 'syncing' | 'success' | 'error'>('loading')
  const [configToken, setConfigToken] = useState<string | null>(null)
  const [syncToken, setSyncToken] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    setStatus('loading')
    setMessage('')
    try {
      const result = await requestJson<HomepageState>('/api/studio/homepage')
      setState(result)
      setSelection(result.selection)
      setBaseline(JSON.stringify(result.selection))
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '无法加载首页配置')
    }
  }

  useEffect(() => { void load() }, [])

  const dirty = selection ? JSON.stringify(selection) !== baseline : false
  const candidateById = useMemo(() => new Map((state?.candidates[activeBoard] ?? []).map(item => [item.id, item])), [state, activeBoard])
  const selected = selection?.[activeBoard] ?? []
  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return (state?.candidates[activeBoard] ?? []).filter(item => (
      !normalized || `${item.title} ${item.secondary}`.toLocaleLowerCase().includes(normalized)
    ))
  }, [state, activeBoard, query])

  const invalidatePreview = () => {
    setConfigToken(null)
    setSyncToken(null)
    setStatus('idle')
    setMessage('')
  }

  const replaceSlot = (candidate: Candidate) => {
    if (!selection || !candidate.synced) return
    const next = [...selection[activeBoard]]
    const existing = next.indexOf(candidate.id)
    if (existing >= 0 && existing !== activeSlot) [next[activeSlot], next[existing]] = [next[existing], next[activeSlot]]
    else next[activeSlot] = candidate.id
    setSelection({ ...selection, [activeBoard]: next })
    invalidatePreview()
  }

  const move = (from: number, to: number) => {
    if (!selection || to < 0 || to >= selected.length || from === to) return
    const next = [...selected]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setSelection({ ...selection, [activeBoard]: next })
    setActiveSlot(to)
    invalidatePreview()
  }

  const previewConfig = async () => {
    if (!selection) return
    setStatus('preview')
    try {
      const result = await postJson<PreviewResult>('/api/studio/homepage/config-preview', { selection })
      setConfigToken(result.token ?? null)
      setMessage(result.configChanged ? '预览通过，可以保存首页选择。' : '配置与已保存版本一致。')
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '首页配置预览失败')
    }
  }

  const checkHomeSync = async () => {
    try {
      const result = await postJson<PreviewResult>('/api/studio/homepage/sync-preview', {})
      setSyncToken(result.token ?? null)
      setStatus(result.state === 'ready' ? 'sync-ready' : 'success')
      setMessage(result.state === 'ready' ? '首页配置已保存，可以同步公开首页。' : '公开首页已经是当前配置。')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '首页同步预览失败')
    }
  }

  const saveConfig = async () => {
    if (!configToken || !selection) return
    setStatus('saving')
    try {
      await postJson('/api/studio/homepage/config-save', { token: configToken })
      setBaseline(JSON.stringify(selection))
      setConfigToken(null)
      await checkHomeSync()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '保存首页配置失败')
    }
  }

  const syncHome = async () => {
    if (!syncToken) return
    setStatus('syncing')
    try {
      await postJson('/api/studio/homepage/sync-apply', { token: syncToken })
      invalidateJsonData('/data/home.json')
      setSyncToken(null)
      setStatus('success')
      setMessage('首页同步完成，现在可以查看更新后的首页。')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '首页同步失败')
    }
  }

  const openHome = () => {
    invalidateJsonData('/data/home.json')
    window.location.assign(`/?refresh=${Date.now()}`)
  }

  return (
    <main className="studio-shell studio-homepage">
      <header className="studio-topbar">
        <div><div className="studio-kicker">本地收藏维护工具</div><h1>Archive Studio</h1></div>
        <div className="studio-status-cluster">
          <span className="studio-status studio-status--safe"><ShieldCheck size={15} />本地服务已连接</span>
          <span className="studio-status">不会自动发布</span><span className="studio-status">不写旧源数据</span>
        </div>
      </header>

      <nav className="studio-board-tabs" aria-label="Archive Studio 板块">
        <NavLink to="/studio/home" className="active">首页</NavLink><NavLink to="/studio" end>音乐</NavLink>
        <NavLink to="/studio/texts">文本</NavLink><NavLink to="/studio/visions">影视</NavLink><NavLink to="/studio/games">游戏</NavLink>
      </nav>

      {message ? (
        <section className={`studio-home-message${status === 'error' ? ' has-errors' : ''}`}>
          {status === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span>{message}</span>
        </section>
      ) : null}

      <div className="studio-home-board-switch" role="tablist" aria-label="首页板块">
        {boards.map(board => (
          <button key={board.key} type="button" className={activeBoard === board.key ? 'active' : ''} onClick={() => { setActiveBoard(board.key); setActiveSlot(0); setQuery('') }}>
            {board.label}<span>{selection?.[board.key].length ?? 0}/{state?.limits[board.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="studio-home-workspace">
        <section className="studio-home-slots" aria-label={`${activeBoard} 已选条目`}>
          <div className="studio-section-heading"><div><span>01</span><h2>首页顺序</h2></div><p>拖拽或使用箭头调整；音乐与文本第 1 项为主展示。</p></div>
          <div className="studio-home-slot-list">
            {selected.map((id, index) => {
              const item = candidateById.get(id)
              return (
                <div key={id} draggable onDragStart={() => setDragIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null) }} className={`studio-home-slot${activeSlot === index ? ' active' : ''}`} onClick={() => setActiveSlot(index)}>
                  <GripVertical size={16} aria-hidden />
                  <span className="studio-home-slot-number">{String(index + 1).padStart(2, '0')}</span>
                  {item?.thumbnail ? <img src={`/${item.thumbnail.replace(/^\//, '')}`} alt="" /> : <span className="studio-home-placeholder"><Home size={16} /></span>}
                  <div><strong>{item?.title || '未找到条目'}</strong><span>{item?.secondary || '精选槽位'}</span></div>
                  <button type="button" title="上移" aria-label="上移" onClick={event => { event.stopPropagation(); move(index, index - 1) }} disabled={index === 0}><ArrowUp size={15} /></button>
                  <button type="button" title="下移" aria-label="下移" onClick={event => { event.stopPropagation(); move(index, index + 1) }} disabled={index === selected.length - 1}><ArrowDown size={15} /></button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="studio-home-catalog" aria-label={`${activeBoard} 候选条目`}>
          <div className="studio-section-heading"><div><span>02</span><h2>选择条目</h2></div><p>点击候选替换当前高亮槽位。</p></div>
          <label className="studio-home-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题或分类" /></label>
          <div className="studio-home-candidate-list">
            {visibleCandidates.map(item => {
              const chosen = selected.includes(item.id)
              return (
                <button key={item.id} type="button" disabled={!item.synced} className={chosen ? 'selected' : ''} onClick={() => replaceSlot(item)}>
                  {item.thumbnail ? <img src={`/${item.thumbnail.replace(/^\//, '')}`} alt="" /> : <span className="studio-home-placeholder"><Home size={16} /></span>}
                  <div><strong>{item.title}</strong><span>{item.secondary || (item.synced ? '可用于首页' : '尚未同步到网页')}</span></div>
                  <small>{!item.synced ? '待同步' : chosen ? '已选择' : '选择'}</small>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="studio-actionbar">
        <div className="studio-action-summary"><span>{dirty ? '首页选择有改动' : '首页选择无改动'}</span><small>只写 ArchiveData-v2 首页配置和 public/data/home.json，不会发布。</small></div>
        <div className="studio-actions">
          <button type="button" className="studio-button studio-button--quiet" onClick={() => void load()}><RefreshCcw size={16} />重置</button>
          <button type="button" className="studio-button studio-button--secondary" onClick={() => void previewConfig()} disabled={!selection || status === 'loading'}>生成预览</button>
          <button type="button" className="studio-button studio-button--primary" onClick={() => void saveConfig()} disabled={!configToken || status === 'saving'}><Save size={16} />保存配置</button>
          {status === 'sync-ready' ? <button type="button" className="studio-button studio-button--primary" onClick={() => void syncHome()} disabled={!syncToken}>同步首页</button> : null}
          {status === 'success' ? <button type="button" className="studio-button studio-button--secondary" onClick={openHome}>查看首页</button> : null}
        </div>
      </div>
    </main>
  )
}
