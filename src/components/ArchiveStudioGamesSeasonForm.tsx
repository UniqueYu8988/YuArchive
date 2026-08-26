import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, FileImage, FolderTree, RefreshCcw, ShieldCheck } from 'lucide-react'
import ArchiveStudioDisplayPreview from './ArchiveStudioDisplayPreview'
import ArchiveStudioPublicSync from './ArchiveStudioPublicSync'

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'
type LiveParent = {
  id: string
  title: string
  seasonCount: number
  nextOrder: number
  defaultLabel: string
  supportedFields: string[]
  publiclySynced: boolean
}
type Preview = {
  ok: boolean
  operations: Array<{ role: string; relativePath: string }>
  errors: Array<{ code: string; message: string }>
}
type Preflight = {
  ok: boolean
  blockedReasons: string[]
  preflightToken: string | null
  dryRun: { writeItems: number }
}

const optionalFieldLabels: Record<string, string> = {
  period: '时间', theme: '主题', feature: '机制', champion: '角色', note: '备注', build: '职业 / Build',
}

const errorLabels: Record<string, string> = {
  invalid_season_id: '赛季 ID 无效，请重置草稿。',
  invalid_parent_id: '请选择长期运营游戏。',
  missing_title: '请填写赛季标题。',
  missing_label: '请填写展示标签。',
  invalid_order: '展示顺序必须是数字。',
  missing_cover: '请选择赛季封面。',
  invalid_cover_extension: '封面格式不受支持。',
  games_v2_baseline_failed: 'Games v2 当前结构检查未通过。',
  live_game_parent_missing: '父游戏不存在或不是长期运营游戏。',
  live_game_parent_not_synced: '父游戏尚未同步到网页，暂时不能新增赛季。',
  season_title_conflict: '该父游戏下已存在同名赛季。',
  season_order_conflict: '该展示顺序已被使用，请换一个数字。',
  season_fields_not_supported_by_parent: '填写了该父游戏不使用的赛季字段。',
  create_target_exists: '目标赛季已存在。',
  create_target_files_exist: '目标文件已存在。',
}

function newSeasonId() {
  return `season-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function extension(file: File | null) {
  const value = file?.name.split('.').pop()?.toLowerCase()
  return value ? `.${value}` : ''
}

function formatSize(file: File | null) {
  if (!file) return '尚未选择'
  const megabytes = file.size / 1024 / 1024
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
}

export default function ArchiveStudioGamesSeasonForm() {
  const [parents, setParents] = useState<LiveParent[]>([])
  const [parentsStatus, setParentsStatus] = useState<RequestStatus>('loading')
  const [createAvailable, setCreateAvailable] = useState(false)
  const [parentId, setParentId] = useState('')
  const [seasonId, setSeasonId] = useState(newSeasonId)
  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [order, setOrder] = useState('')
  const [optionalFields, setOptionalFields] = useState<Record<string, string>>({})
  const [cover, setCover] = useState<File | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [fileVersion, setFileVersion] = useState(0)
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [message, setMessage] = useState('')
  const [syncVersion, setSyncVersion] = useState(0)
  const parent = parents.find(item => item.id === parentId)
  const coverExtension = extension(cover)

  useEffect(() => {
    Promise.all([
      fetch('/api/studio/games/live-parents').then(response => response.json()),
      fetch('/api/studio/profiles').then(response => response.json()),
    ]).then(([parentsResult, profilesResult]) => {
      const available = (profilesResult.profiles ?? []).some((profile: { board?: string; kind?: string; capabilities?: { create?: boolean } }) => (
        profile.board === 'games' && profile.kind === 'season' && profile.capabilities?.create === true
      ))
      setCreateAvailable(available)
      setParents((parentsResult.parents ?? []).filter((item: LiveParent) => item.publiclySynced))
      setParentsStatus('success')
    }).catch(() => setParentsStatus('error'))
  }, [])

  useEffect(() => {
    if (!cover) { setCoverUrl(''); return }
    const objectUrl = URL.createObjectURL(cover)
    setCoverUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [cover])

  const reset = () => {
    setParentId('')
    setSeasonId(newSeasonId())
    setTitle('')
    setLabel('')
    setOrder('')
    setOptionalFields({})
    setCover(null)
    setFileVersion(current => current + 1)
    setStatus('idle')
    setPreview(null)
    setPreflight(null)
    setMessage('')
  }

  const selectParent = (value: string) => {
    const selected = parents.find(item => item.id === value)
    setParentId(value)
    setLabel(selected?.defaultLabel ?? '')
    setOrder(selected ? String(selected.nextOrder) : '')
    setOptionalFields({})
    setStatus('idle')
    setPreview(null)
    setPreflight(null)
    setMessage('')
  }

  const validation = useMemo(() => {
    const errors: string[] = []
    if (!parentId) errors.push('请选择长期运营游戏。')
    if (!title.trim()) errors.push('请填写赛季标题。')
    if (!label.trim()) errors.push('请填写展示标签。')
    if (!order.trim() || !Number.isFinite(Number(order))) errors.push('展示顺序必须是数字。')
    if (!cover) errors.push('请选择赛季封面。')
    if (cover && !['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(coverExtension)) errors.push('封面格式不受支持。')
    return errors
  }, [parentId, title, label, order, cover, coverExtension])

  const payload = () => ({
    mode: 'create', board: 'games', kind: 'season', id: seasonId, parentId,
    fields: { title: title.trim(), label: label.trim(), order: Number(order), ...optionalFields },
    assets: cover ? { cover: { source: 'selected-file', originalName: cover.name, extension: coverExtension } } : {},
  })

  const postJson = async <T,>(pathname: string, body: unknown): Promise<T> => {
    const response = await fetch(pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return await response.json() as T
  }

  const createSeason = async () => {
    if (validation.length) { setStatus('error'); setMessage(validation[0]); return }
    setStatus('loading')
    setMessage('')
    setPreview(null)
    setPreflight(null)
    const nextPayload = payload()
    try {
      const previewResult = await postJson<Preview>('/api/studio/games/season-preview', nextPayload)
      setPreview(previewResult)
      if (!previewResult.ok) throw new Error(errorLabels[previewResult.errors[0]?.code] ?? previewResult.errors[0]?.message ?? '赛季预览未通过。')
      const preflightResult = await postJson<Preflight>('/api/studio/games/season-preflight', nextPayload)
      setPreflight(preflightResult)
      if (!preflightResult.ok || !preflightResult.preflightToken) {
        throw new Error(errorLabels[preflightResult.blockedReasons[0]] ?? preflightResult.blockedReasons[0] ?? '赛季预检未通过。')
      }
      const body = new FormData()
      body.set('payload', JSON.stringify(nextPayload))
      body.set('preflightToken', preflightResult.preflightToken)
      body.set('cover', cover as File)
      const response = await fetch('/api/studio/games/season-create', { method: 'POST', body })
      const result = await response.json() as { ok?: boolean; error?: { message?: string } }
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? '赛季创建失败。')
      setStatus('success')
      setMessage('赛季已保存到 Archive，等待同步到网页。')
      setSyncVersion(current => current + 1)
      setTitle('')
      setCover(null)
      setFileVersion(current => current + 1)
      setSeasonId(newSeasonId())
      const refreshed = await fetch('/api/studio/games/live-parents').then(item => item.json())
      const nextParents = (refreshed.parents ?? []).filter((item: LiveParent) => item.publiclySynced)
      setParents(nextParents)
      const nextParent = nextParents.find((item: LiveParent) => item.id === parentId)
      if (nextParent) setOrder(String(nextParent.nextOrder))
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '赛季创建失败。')
    }
  }

  return (
    <>
      <ArchiveStudioPublicSync board="games" refreshKey={String(syncVersion)} />
      <div className="studio-workspace">
        <div className="studio-editor-column">
          <section className="studio-section">
            <div className="studio-section-heading"><div><span>01</span><h2>赛季归属</h2></div></div>
            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide"><span>长期运营游戏 <b>必填</b></span><select value={parentId} onChange={event => selectParent(event.target.value)} disabled={parentsStatus !== 'success'}><option value="">选择父游戏</option>{parents.map(item => <option key={item.id} value={item.id}>{item.title} · {item.seasonCount} 个赛季</option>)}</select></label>
              <label className="studio-field studio-field--wide"><span>赛季 ID <b>系统生成</b></span><input value={seasonId} readOnly /></label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading"><div><span>02</span><h2>赛季信息</h2></div></div>
            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide"><span>赛季标题 <b>必填</b></span><input value={title} onChange={event => { setTitle(event.target.value); setStatus('idle') }} placeholder="例如 S15 或 Worlds 2026" /></label>
              <label className="studio-field"><span>展示标签 <b>必填</b></span><input value={label} onChange={event => { setLabel(event.target.value); setStatus('idle') }} placeholder="例如 赛季" /></label>
              <label className="studio-field"><span>展示顺序 <b>必填</b></span><input type="number" step="any" value={order} onChange={event => { setOrder(event.target.value); setStatus('idle') }} /></label>
              {(parent?.supportedFields ?? []).map(field => <label className="studio-field" key={field}><span>{optionalFieldLabels[field] ?? field}</span><input value={optionalFields[field] ?? ''} onChange={event => { setOptionalFields(current => ({ ...current, [field]: event.target.value })); setStatus('idle') }} placeholder="可选" /></label>)}
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading"><div><span>03</span><h2>赛季封面</h2></div></div>
            <label className={`studio-asset-picker${cover ? ' has-file' : ''}`}>
              <input key={fileVersion} type="file" accept=".jpg,.jpeg,.png,.webp,.avif" onChange={event => { setCover(event.target.files?.[0] ?? null); setStatus('idle') }} />
              <FileImage size={24} /><span className="studio-asset-label">封面</span><strong>{cover?.name ?? '选择图片'}</strong><small>{formatSize(cover)} · JPG、PNG、WebP 或 AVIF</small>
            </label>
          </section>
        </div>

        <aside className="studio-preview-column">
          <section className="studio-preview-panel">
            <ArchiveStudioDisplayPreview title="赛季卡片预览">
              <div className="studio-season-preview">
                {coverUrl ? <img src={coverUrl} alt="赛季封面预览" /> : <div className="studio-season-preview__empty"><FileImage size={26} /><span>选择封面后预览</span></div>}
                <div><strong>{title.trim() || '赛季标题'}</strong><span>{label.trim() || '展示标签'} · 顺序 {order || '—'}</span>{(parent?.supportedFields ?? []).map(field => optionalFields[field] ? <small key={field}>{optionalFieldLabels[field] ?? field}：{optionalFields[field]}</small> : null)}</div>
              </div>
            </ArchiveStudioDisplayPreview>
            <div className="studio-preview-title"><FolderTree size={19} /><div><span>写入详情</span><strong>保存时自动检查</strong></div></div>
            <div className="studio-preview-id"><span>赛季 ID</span><code>{seasonId}</code></div>
            <div className="studio-operation-list">
              {(preview?.operations ?? [
                { role: 'season_yaml', relativePath: `entries/games/live_game/${parentId || '[parent]'}/seasons/${seasonId}/season.yaml` },
                { role: 'cover', relativePath: `entries/games/live_game/${parentId || '[parent]'}/seasons/${seasonId}/cover${coverExtension || '.ext'}` },
              ]).map(operation => <div className="studio-operation" key={operation.role}><ShieldCheck size={16} /><div><span>{operation.role}</span><code>{operation.relativePath}</code></div><i className="is-ready">就绪</i></div>)}
            </div>
            {status !== 'idle' ? <div className={`studio-validation${status === 'success' ? ' is-valid' : status === 'error' ? ' has-errors' : ''}`}><div>{status === 'success' ? <CheckCircle2 size={18} /> : status === 'error' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}<strong>{status === 'loading' ? '正在检查并保存' : status === 'success' ? '赛季创建成功' : '无法创建赛季'}</strong></div>{message ? <p>{message}</p> : null}{preflight?.ok ? <p>预检通过，将写入 {preflight.dryRun.writeItems} 个文件。</p> : null}</div> : <div className="studio-preview-placeholder">填写赛季信息并选择封面后可直接保存。</div>}
          </section>
        </aside>
      </div>

      <footer className="studio-actionbar">
        <div className="studio-action-summary"><span>{status === 'success' ? '赛季已保存' : '新建赛季'}</span><small>只写入 Archive，不会自动发布。</small></div>
        <div className="studio-actions">
          <button className="studio-button studio-button--quiet" type="button" onClick={reset}><RefreshCcw size={16} /> 重置</button>
          <button className="studio-button studio-button--primary" type="button" onClick={() => void createSeason()} disabled={!createAvailable || status === 'loading' || parentsStatus !== 'success'}>{status === 'loading' ? '检查并创建...' : '创建赛季'}</button>
        </div>
      </footer>
    </>
  )
}
