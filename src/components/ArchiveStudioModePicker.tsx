import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

export type StudioMode = 'create' | 'update'
export type EditableEntryDetail = {
  ok: true
  board: string
  kind: string
  id: string
  fields: Record<string, unknown>
  content: string
  assets: Record<string, { name: string; extension: string } | null>
  publiclySynced: boolean
}

type EntrySummary = {
  id: string
  title: string
  secondary: string
  thumbnail: string
  synced: boolean
}

export default function ArchiveStudioModePicker({
  board,
  mode,
  selectedId,
  onModeChange,
  onEntryLoad,
}: {
  board: 'music' | 'texts' | 'visions' | 'games'
  mode: StudioMode
  selectedId: string
  onModeChange: (mode: StudioMode) => void
  onEntryLoad: (detail: EditableEntryDetail) => void
}) {
  const [entries, setEntries] = useState<EntrySummary[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'update') return
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/studio/${board}/entries`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('无法读取已有条目')
        const body = await response.json() as { entries: EntrySummary[] }
        setEntries(body.entries)
        setError('')
      })
      .catch(caught => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : '无法读取已有条目')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [board, mode])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return entries.slice(0, 12)
    return entries.filter(entry => `${entry.title} ${entry.secondary}`.toLocaleLowerCase().includes(normalized)).slice(0, 20)
  }, [entries, query])

  const loadEntry = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/studio/${board}/entries/${id}`)
      if (!response.ok) throw new Error('无法读取条目详情')
      onEntryLoad(await response.json() as EditableEntryDetail)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法读取条目详情')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="studio-mode-toolbar">
      <div className="studio-mode-segment" aria-label="编辑模式">
        <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => onModeChange('create')}>新建</button>
        <button type="button" className={mode === 'update' ? 'active' : ''} onClick={() => onModeChange('update')}>修改</button>
      </div>
      {mode === 'update' ? (
        <div className="studio-entry-search">
          <label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={loading ? '正在读取条目...' : '搜索已有条目'} /></label>
          <div className="studio-entry-results">
            {visible.map(entry => (
              <button key={entry.id} type="button" className={selectedId === entry.id ? 'active' : ''} onClick={() => void loadEntry(entry.id)}>
                {entry.thumbnail ? <img src={`/${entry.thumbnail.replace(/^\//, '')}`} alt="" /> : <span />}
                <div><strong>{entry.title}</strong><small>{entry.secondary || entry.id}</small></div>
                <i>{entry.synced ? '已公开' : '待同步'}</i>
              </button>
            ))}
          </div>
        </div>
      ) : <p>填写下方表单创建新条目。</p>}
      {error ? <span className="studio-mode-error">{error}</span> : null}
    </section>
  )
}
