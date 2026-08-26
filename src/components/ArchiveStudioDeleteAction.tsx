import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

type Board = 'music' | 'texts' | 'visions' | 'games'
type DeleteStatus = 'idle' | 'loading' | 'error' | 'success'

type DeletePreview = {
  ok: boolean
  errors: Array<{ code: string; message: string }>
  deleteToken?: string | null
}

export type DeleteResult = {
  ok: true
  board: Board
  entryId: string
  deletedFiles: number
  publicSyncPending: boolean
  sourceUnchanged: boolean
}

async function postJson<T>(pathname: string, body: unknown): Promise<{ response: Response; result: T }> {
  const response = await fetch(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { response, result: await response.json() as T }
}

export default function ArchiveStudioDeleteAction({
  board,
  entryId,
  title,
  disabled = false,
  onDeleted,
}: {
  board: Board
  entryId: string
  title: string
  disabled?: boolean
  onDeleted: (result: DeleteResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<DeleteStatus>('idle')
  const [message, setMessage] = useState('')

  const close = () => {
    if (status === 'loading') return
    setOpen(false)
    setStatus('idle')
    setMessage('')
  }

  const deleteEntry = async () => {
    const payload = { board, id: entryId }
    setStatus('loading')
    setMessage('')
    try {
      const previewCall = await postJson<DeletePreview>(`/api/studio/${board}/delete-preview`, payload)
      if (!previewCall.response.ok || !previewCall.result.ok) {
        throw new Error(previewCall.result.errors?.[0]?.message || '删除范围检查未通过。')
      }

      const preflightCall = await postJson<DeletePreview>(`/api/studio/${board}/delete-preflight`, payload)
      const token = preflightCall.result.deleteToken
      if (!preflightCall.response.ok || !preflightCall.result.ok || !token) {
        throw new Error(preflightCall.result.errors?.[0]?.message || '删除前检查未通过。')
      }

      const applyCall = await postJson<DeleteResult & { error?: { message?: string; rollback?: { completed: boolean } } }>(
        `/api/studio/${board}/delete-apply`,
        { payload, deleteToken: token },
      )
      if (!applyCall.response.ok || !applyCall.result.ok) {
        const rollback = applyCall.result.error?.rollback
          ? ` 回退${applyCall.result.error.rollback.completed ? '已完成' : '需要人工检查'}。`
          : ''
        throw new Error(`${applyCall.result.error?.message || '删除失败。'}${rollback}`)
      }

      setStatus('success')
      setMessage(applyCall.result.publicSyncPending ? '条目已删除，等待同步公开页面。' : '条目已删除。')
      setOpen(false)
      onDeleted(applyCall.result)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '删除失败。')
    }
  }

  return (
    <>
      {entryId ? (
        <button
          className="studio-button studio-button--danger"
          type="button"
          onClick={() => { setOpen(true); setStatus('idle'); setMessage('') }}
          disabled={disabled}
        >
          <Trash2 size={16} /> 删除条目
        </button>
      ) : status === 'success' ? (
        <span className="studio-delete-notice">{message}</span>
      ) : null}

      {open ? createPortal((
        <div className="studio-dialog-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) close()
        }}>
          <section className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-delete-title">
            <button className="studio-dialog-close" type="button" onClick={close} aria-label="关闭">
              <X size={17} />
            </button>
            <AlertTriangle size={22} />
            <h2 id="studio-delete-title">删除整个条目？</h2>
            <strong>{title}</strong>
            <p>将删除该条目的元数据、正文和全部素材。已公开内容会进入待同步状态，首页精选中的条目必须先替换。</p>
            {status === 'error' ? <div className="studio-dialog-error">{message}</div> : null}
            <div className="studio-dialog-actions">
              <button className="studio-button studio-button--quiet" type="button" onClick={close} disabled={status === 'loading'}>取消</button>
              <button className="studio-button studio-button--danger" type="button" onClick={deleteEntry} disabled={status === 'loading'}>
                <Trash2 size={16} /> {status === 'loading' ? '检查并删除...' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      ), document.querySelector('.studio-app') ?? document.body) : null}
    </>
  )
}
