import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, UploadCloud } from 'lucide-react'
import { invalidateJsonData } from '../hooks/useJsonData'

type Board = 'music' | 'texts' | 'visions' | 'games'

interface SyncPreview {
  ok: boolean
  board: Board
  state: 'ready' | 'current' | 'synced'
  pendingEntries: number
  currentEntries: number
  nextEntries: number
  mediaFiles: number
  mediaTransforms?: Array<{
    role: string
    profile: string
    sourceExtension: string
    outputExtension: string
    sourceBytes: number
    relativeTarget: string
  }>
  jsonFiles: number
  homeJsonModified: false
  publishTriggered: false
  relativeTargets: string[]
  syncEnabled?: boolean
  syncToken?: string | null
}

const labels: Record<Board, string> = {
  music: '音乐', texts: '文本', visions: '影视', games: '游戏',
}

const routes: Record<Board, string> = {
  music: '/music', texts: '/texts', visions: '/movies', games: '/games',
}

async function requestSync(board: Board, action: 'preview' | 'apply', syncToken?: string) {
  const response = await fetch(`/api/studio/${board}/sync-${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncToken ? { syncToken } : {}),
  })
  const body = await response.json() as SyncPreview & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message || '同步请求失败')
  return body
}

export default function ArchiveStudioPublicSync({ board, refreshKey = '' }: { board: Board; refreshKey?: string }) {
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'syncing' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const result = await requestSync(board, 'preview')
      setPreview(result)
      setStatus(result.pendingEntries ? 'ready' : 'success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法检查网页同步状态')
      setStatus('error')
    }
  }, [board])

  useEffect(() => { void refresh() }, [refresh, refreshKey])

  const sync = async () => {
    if (!preview?.syncToken) return
    setStatus('syncing')
    setError('')
    try {
      const result = await requestSync(board, 'apply', preview.syncToken)
      invalidateJsonData(`/data/${board}.json`)
      setPreview(result)
      setStatus('success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '同步失败，公开数据未改变')
      setStatus('error')
    }
  }

  const openPublicPage = () => {
    invalidateJsonData(`/data/${board}.json`)
    window.location.assign(`${routes[board]}?refresh=${Date.now()}`)
  }

  return (
    <section className={`studio-sync-panel${status === 'error' ? ' has-errors' : ''}`} aria-live="polite">
      <div className="studio-sync-copy">
        {status === 'success' ? <CheckCircle2 size={19} /> : <UploadCloud size={19} />}
        <div>
          <strong>公开网页同步</strong>
          <span>
            {status === 'loading' && '正在检查 Archive 与公开网页的差异...'}
            {status === 'ready' && `有 ${preview?.pendingEntries ?? 0} 个${labels[board]}条目等待同步，将优化 ${preview?.mediaFiles ?? 0} 个媒体文件，完成后网页总数为 ${preview?.nextEntries ?? 0}。`}
            {status === 'syncing' && '正在优化公开媒体并更新网页 JSON...'}
            {status === 'success' && (preview?.state === 'synced' ? '同步完成，公开页面现在可以读取新条目。' : 'Archive 与公开网页已经同步。')}
            {status === 'error' && error}
          </span>
        </div>
      </div>
      <div className="studio-sync-actions">
        {status === 'ready' ? (
          <button type="button" className="studio-button studio-button--primary" onClick={() => void sync()}>
            <UploadCloud size={16} />同步到网页
          </button>
        ) : null}
        {status === 'success' && preview?.state === 'synced' ? (
          <button type="button" className="studio-button studio-button--secondary" onClick={openPublicPage}>查看公开页面</button>
        ) : null}
        <button type="button" className="studio-button studio-button--quiet" onClick={() => void refresh()} disabled={status === 'loading' || status === 'syncing'} title="重新检查同步状态">
          <RefreshCw size={16} />重新检查
        </button>
      </div>
    </section>
  )
}
