import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, RefreshCw, UploadCloud } from 'lucide-react'
import { invalidateJsonData } from '../hooks/useJsonData'

type Board = 'music' | 'texts' | 'visions' | 'games'

interface SyncPreview {
  ok: boolean
  board: Board
  state: 'ready' | 'current' | 'synced'
  pendingEntries: number
  pendingDeletes?: number
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
  const latestRequest = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    setStatus('loading')
    setError('')
    try {
      const result = await requestSync(board, 'preview')
      if (requestId !== latestRequest.current) return
      setPreview(result)
      setStatus(result.pendingEntries ? 'ready' : 'success')
    } catch (caught) {
      if (requestId !== latestRequest.current) return
      setError(caught instanceof Error ? caught.message : '无法检查网页同步状态')
      setStatus('error')
    }
  }, [board])

  useEffect(() => {
    void refresh()
    const verificationTimer = window.setTimeout(() => void refresh(), 1200)
    return () => {
      window.clearTimeout(verificationTimer)
      latestRequest.current += 1
    }
  }, [refresh, refreshKey])

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

  if (status === 'success' && preview?.state !== 'synced') return null

  return (
    <section className={`studio-sync-panel${status === 'error' ? ' has-errors' : ''}`} aria-live="polite">
      <div className="studio-sync-copy">
        {status === 'success' ? <CheckCircle2 size={19} /> : <UploadCloud size={19} />}
        <div>
          <strong>公开网页同步</strong>
          <span>
            {status === 'loading' && '正在检查是否有待同步内容...'}
            {status === 'ready' && (preview?.pendingDeletes
              ? `有 ${preview.pendingDeletes} 个${labels[board]}条目待从网页移除。`
              : `有 ${preview?.pendingEntries ?? 0} 个${labels[board]}条目待同步。`)}
            {status === 'syncing' && '正在同步到本地网页...'}
            {status === 'success' && (preview?.state === 'synced' ? '同步完成，可以查看公开页面。' : '已同步。')}
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
