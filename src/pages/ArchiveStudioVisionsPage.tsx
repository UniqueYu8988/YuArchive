import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  FileImage,
  FolderTree,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
  Tv,
} from 'lucide-react'
import './ArchiveStudioPage.css'

type VisionKind = 'movie' | 'series'
type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

type VisionForm = {
  title: string
  period: string
  cinema: boolean
  quote: string
  url: string
  poster: File | null
}

type ApiIssue = { code: string; message: string }
type ApiPreview = {
  ok: boolean
  target: {
    entryId: string
    entryRelativeDir: string
    entryYaml: string
    poster: string
  }
  operations: Array<{ role: string; relativePath: string }>
  warnings: ApiIssue[]
  errors: ApiIssue[]
}
type ApiPreflight = {
  ok: boolean
  targetFilesExisting: number
  blockedReasons: string[]
  writeScope: string
  preflightToken: string | null
  preflightExpiresAt: number | null
  dryRun: { writeItems: number; rollbackDeletes: number }
}
type VisionsCheck = {
  ok: boolean
  totalEntries: number
  malformedEntries: number
  malformedCharacters: number
  privacyRuleHits: number
  kindCounts: Record<'movie' | 'series' | 'showcase', number>
}
type CreateResult = {
  ok: true
  entryRelativeDir: string
  createdEntryFiles: number
  createdTransactionFiles: number
  visionsEntries: number
  sourceUnchanged: boolean
  publishTriggered: false
  check: VisionsCheck
}
type ErrorResult = {
  ok: false
  error?: {
    message?: string
    rollback?: { completed: boolean }
  }
}

const periods = ['此岸', '未远', '旧影', '前尘', '开端']
const kinds: Array<{ kind: VisionKind; label: string; description: string; icon: typeof Clapperboard }> = [
  { kind: 'movie', label: '电影', description: '单部电影或短片', icon: Clapperboard },
  { kind: 'series', label: '剧集 / 动画', description: '连续剧集与动画作品', icon: Tv },
]
const initialForm: VisionForm = {
  title: '',
  period: periods[0],
  cinema: false,
  quote: '',
  url: '',
  poster: null,
}
const issueMessages: Record<string, string> = {
  invalid_entry_id: '条目 ID 无效，请重置草稿。',
  missing_title: '请填写标题。',
  invalid_period: '请选择有效的时期。',
  missing_poster: '请选择海报。',
  invalid_poster_extension: '海报格式不受支持。',
  invalid_url: '外部链接必须以 http:// 或 https:// 开头。',
  quote_empty: '短句为空，不影响保存。',
  url_empty: '外部链接为空，不影响保存。',
}
const blockedMessages: Record<string, string> = {
  visions_v2_baseline_failed: 'Visions v2 当前结构检查未通过。',
  create_target_exists: '目标条目已存在，不能覆盖。',
  create_target_files_exist: '目标文件已存在，不能覆盖。',
}

function newVisionId() {
  const now = new Date()
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  return `vision-${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
}

function fileExtension(file: File | null) {
  const extension = file?.name.split('.').pop()?.toLowerCase()
  return extension ? `.${extension}` : ''
}

function formatSize(file: File | null) {
  if (!file) return '尚未选择'
  const megabytes = file.size / 1024 / 1024
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
}

export default function ArchiveStudioVisionsPage() {
  const [kind, setKind] = useState<VisionKind>('movie')
  const [entryId, setEntryId] = useState(newVisionId)
  const [form, setForm] = useState<VisionForm>(initialForm)
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [createAvailable, setCreateAvailable] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<RequestStatus>('idle')
  const [previewResult, setPreviewResult] = useState<ApiPreview | null>(null)
  const [preflightStatus, setPreflightStatus] = useState<RequestStatus>('idle')
  const [preflightResult, setPreflightResult] = useState<ApiPreflight | null>(null)
  const [createStatus, setCreateStatus] = useState<RequestStatus>('idle')
  const [createResult, setCreateResult] = useState<CreateResult | null>(null)
  const [checkStatus, setCheckStatus] = useState<RequestStatus>('idle')
  const [checkResult, setCheckResult] = useState<VisionsCheck | null>(null)
  const [requestError, setRequestError] = useState('')
  const posterExtension = fileExtension(form.poster)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/studio/profiles', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('本地服务不可用。')
        const data = await response.json() as {
          localOnly?: boolean
          writeEnabled?: boolean
          profiles?: Array<{
            board?: string
            capabilities?: { create?: boolean; publish?: boolean }
          }>
        }
        const profiles = data.profiles?.filter(profile => profile.board === 'visions') ?? []
        const safe = data.localOnly === true
          && profiles.length === 2
          && profiles.every(profile => profile.capabilities?.publish === false)
        if (!safe) throw new Error('本地服务能力配置不安全。')
        setCreateAvailable(data.writeEnabled === true && profiles.every(profile => profile.capabilities?.create))
        setServiceStatus('online')
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setServiceStatus('offline')
      })
    return () => controller.abort()
  }, [])

  const invalidate = () => {
    setIsDirty(true)
    setPreviewStatus('idle')
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
  }

  const updateField = <K extends keyof VisionForm>(field: K, value: VisionForm[K]) => {
    setForm(current => ({ ...current, [field]: value }))
    invalidate()
  }

  const validation = useMemo(() => {
    const errors: string[] = []
    if (!form.title.trim()) errors.push('请填写标题。')
    if (!periods.includes(form.period)) errors.push('请选择有效的时期。')
    if (!form.poster) errors.push('请选择海报。')
    if (form.poster && !['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(posterExtension)) {
      errors.push('海报格式不受支持。')
    }
    if (form.url && !/^https?:\/\//i.test(form.url)) errors.push('外部链接格式无效。')
    return errors
  }, [form, posterExtension])

  const buildPayload = () => ({
    mode: 'create',
    board: 'visions',
    kind,
    id: entryId,
    fields: {
      title: form.title.trim(),
      period: form.period,
      cinema: form.cinema,
      quote: form.quote.trim(),
      url: form.url.trim(),
    },
    assets: form.poster ? {
      poster: {
        source: 'selected-file',
        originalName: form.poster.name,
        extension: posterExtension,
      },
    } : {},
  })

  const postJson = async <T,>(pathname: string, body: unknown): Promise<T> => {
    const response = await fetch(pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json() as T
    if (!response.ok && response.status >= 500) throw new Error('本地服务处理请求失败。')
    return result
  }

  const reset = () => {
    setKind('movie')
    setEntryId(newVisionId())
    setForm(initialForm)
    setFileInputVersion(current => current + 1)
    setIsDirty(false)
    setPreviewStatus('idle')
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setCheckStatus('idle')
    setCheckResult(null)
    setRequestError('')
  }

  const generatePreview = async () => {
    setPreviewStatus('loading')
    setPreflightResult(null)
    setCreateResult(null)
    setRequestError('')
    try {
      const result = await postJson<ApiPreview>('/api/studio/visions/preview', buildPayload())
      setPreviewResult(result)
      setPreviewStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreviewStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : '生成预览失败。')
    }
  }

  const runPreflight = async () => {
    setPreflightStatus('loading')
    setCreateResult(null)
    setRequestError('')
    try {
      const result = await postJson<ApiPreflight>('/api/studio/visions/preflight', buildPayload())
      setPreflightResult(result)
      setPreflightStatus(result.ok ? 'success' : 'error')
    } catch (error) {
      setPreflightStatus('error')
      setRequestError(error instanceof Error ? error.message : '预检失败。')
    }
  }

  const runCheck = async () => {
    setCheckStatus('loading')
    try {
      const result = await postJson<VisionsCheck>('/api/studio/checks/visions-v2', {})
      setCheckResult(result)
      setCheckStatus(result.ok ? 'success' : 'error')
    } catch {
      setCheckStatus('error')
    }
  }

  const createEntry = async () => {
    if (!preflightResult?.preflightToken || !form.poster) return
    setCreateStatus('loading')
    setRequestError('')
    const body = new FormData()
    body.set('payload', JSON.stringify(buildPayload()))
    body.set('preflightToken', preflightResult.preflightToken)
    body.set('poster', form.poster)
    try {
      const response = await fetch('/api/studio/visions/create', { method: 'POST', body })
      const result = await response.json() as CreateResult | ErrorResult
      if (!response.ok || !result.ok) {
        const details = 'error' in result ? result.error : undefined
        const rollback = details?.rollback
          ? ` 回退${details.rollback.completed ? '已完成' : '需要人工检查'}。`
          : ''
        throw new Error(`${details?.message || '创建失败。'}${rollback}`)
      }
      setCreateResult(result)
      setCreateStatus('success')
      setCheckResult(result.check)
      setCheckStatus(result.check.ok ? 'success' : 'error')
      setIsDirty(false)
    } catch (error) {
      setCreateStatus('error')
      setRequestError(error instanceof Error ? error.message : '创建失败。')
    } finally {
      setPreflightResult(current => current ? {
        ...current,
        preflightToken: null,
        preflightExpiresAt: null,
      } : current)
    }
  }

  const previewReady = previewResult?.ok === true && validation.length === 0
  const createReady = previewReady
    && preflightResult?.ok === true
    && Boolean(preflightResult.preflightToken)
    && createAvailable
    && createStatus !== 'loading'
    && createStatus !== 'success'
  const KindIcon = kind === 'movie' ? Clapperboard : Tv

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div><div className="studio-kicker">本地收藏维护工具</div><h1>Archive Studio</h1></div>
        <div className="studio-status-cluster">
          <span className={`studio-status${serviceStatus === 'online' ? ' studio-status--safe' : ''}`}>
            <ShieldCheck size={15} />
            {serviceStatus === 'checking' ? '正在检查本地服务' : serviceStatus === 'online' ? '本地服务已连接' : '本地服务未连接'}
          </span>
          <span className="studio-status">不会自动发布</span>
          <span className="studio-status">不写旧源数据</span>
        </div>
      </header>

      <nav className="studio-board-tabs" aria-label="Archive Studio 板块">
        <NavLink to="/studio" end>音乐</NavLink>
        <NavLink to="/studio/texts">文本</NavLink>
        <NavLink to="/studio/visions">影视</NavLink>
        <NavLink to="/studio/games">游戏</NavLink>
      </nav>

      <section className="studio-context-bar" aria-label="当前创建配置">
        <div className="studio-context-item"><span>板块</span><strong>影视</strong></div>
        <div className="studio-context-item"><span>类型</span><strong>{kind === 'movie' ? '电影' : '剧集 / 动画'}</strong></div>
        <div className="studio-context-item"><span>操作</span><strong>新建</strong></div>
        <div className="studio-context-state">
          <span className={`studio-state-dot${isDirty ? ' is-dirty' : ''}`} />
          {createStatus === 'success' ? '条目已创建' : preflightResult?.ok ? '预检已通过' : previewReady ? '预览已就绪' : isDirty ? '草稿有改动' : '尚未编辑'}
        </div>
      </section>

      {createResult ? (
        <section className="studio-save-result" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <div><strong>创建成功，影视条目已保存到 ArchiveData-v2</strong><span>{createResult.entryRelativeDir}</span></div>
          <dl>
            <div><dt>条目文件</dt><dd>{createResult.createdEntryFiles}</dd></div>
            <div><dt>Visions v2 总数</dt><dd>{createResult.visionsEntries}</dd></div>
            <div><dt>结构检查</dt><dd>{createResult.check.ok ? '通过' : '失败'}</dd></div>
            <div><dt>旧源数据</dt><dd>{createResult.sourceUnchanged ? '未变化' : '需检查'}</dd></div>
            <div><dt>发布</dt><dd>{createResult.publishTriggered ? '已触发' : '未触发'}</dd></div>
          </dl>
        </section>
      ) : null}

      <div className="studio-workspace">
        <div className="studio-editor-column">
          <section className="studio-section">
            <div className="studio-section-heading">
              <div><span>01</span><h2>影视类型</h2></div>
              <p>动画与连续剧在第一版统一使用剧集类型。</p>
            </div>
            <div className="studio-kind-selector">
              {kinds.map(option => {
                const Icon = option.icon
                return (
                  <button key={option.kind} className={kind === option.kind ? 'is-active' : ''} type="button" onClick={() => { setKind(option.kind); invalidate() }}>
                    <Icon size={18} />
                    <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div><span>02</span><h2>条目信息</h2></div>
              <p>这些字段将直接进入 entry.yaml，不会自动补全。</p>
            </div>
            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide">
                <span>标题 <b>必填</b></span>
                <input value={form.title} onChange={event => updateField('title', event.target.value)} placeholder="影视标题" />
              </label>
              <label className="studio-field">
                <span>时期 <b>必填</b></span>
                <select value={form.period} onChange={event => updateField('period', event.target.value)}>
                  {periods.map(period => <option key={period} value={period}>{period}</option>)}
                </select>
              </label>
              <label className="studio-toggle">
                <span>院线观看<small>在海报右上角显示影院标记</small></span>
                <input type="checkbox" checked={form.cinema} onChange={event => updateField('cinema', event.target.checked)} />
              </label>
              <label className="studio-field studio-field--wide">
                <span>展示短句</span>
                <textarea rows={3} value={form.quote} onChange={event => updateField('quote', event.target.value)} placeholder="可选，不会自动生成" />
              </label>
              <label className="studio-field studio-field--wide">
                <span>外部链接</span>
                <input value={form.url} onChange={event => updateField('url', event.target.value)} placeholder="https://..." />
              </label>
              <label className="studio-field studio-field--wide">
                <span>条目 ID <b>系统生成</b></span>
                <input value={entryId} readOnly />
              </label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div><span>03</span><h2>海报</h2></div>
              <p>原图保存到新条目目录，不会自动找图或裁剪源文件。</p>
            </div>
            <label className={`studio-asset-picker${form.poster ? ' has-file' : ''}`}>
              <input
                key={fileInputVersion}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.avif"
                onChange={event => updateField('poster', event.target.files?.[0] ?? null)}
              />
              <FileImage size={24} />
              <span className="studio-asset-label">海报</span>
              <strong>{form.poster?.name ?? '选择图片'}</strong>
              <small>{formatSize(form.poster)} · JPG、PNG、WebP 或 AVIF</small>
            </label>
          </section>
        </div>

        <aside className="studio-preview-column">
          <section className="studio-preview-panel">
            <div className="studio-preview-title">
              <FolderTree size={19} />
              <div><span>写入预览</span><strong>[ArchiveData-v2]</strong></div>
            </div>
            <div className="studio-preview-id"><span>条目 ID</span><code>{entryId}</code></div>
            <div className="studio-operation-list">
              {(previewResult?.operations ?? [
                { role: 'entry_yaml', relativePath: `entries/visions/${kind}/${entryId}/entry.yaml` },
                { role: 'poster', relativePath: `entries/visions/${kind}/${entryId}/poster${posterExtension || '.ext'}` },
              ]).map(operation => (
                <div className="studio-operation" key={operation.role}>
                  <KindIcon size={16} />
                  <div><span>{operation.role}</span><code>{operation.relativePath}</code></div>
                  <i className="is-ready">就绪</i>
                </div>
              ))}
            </div>
            <div className="studio-check-block studio-check-block--action">
              <div><ShieldCheck size={17} /><strong>Visions v2 结构</strong></div>
              <button type="button" onClick={runCheck} disabled={checkStatus === 'loading' || serviceStatus === 'offline'}>
                {checkStatus === 'loading' ? '检查中...' : '运行检查'}
              </button>
              {checkResult ? <span>{checkResult.ok ? '通过' : '需要检查'} · {checkResult.totalEntries} 个条目 · {checkResult.malformedEntries + checkResult.malformedCharacters} 个异常</span> : null}
            </div>
            {preflightResult ? (
              <div className={`studio-validation${preflightResult.ok ? ' is-valid' : ' has-errors'}`}>
                <div>{preflightResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{preflightResult.ok ? '预检通过' : '预检被阻断'}</strong></div>
                <p>已有目标文件：{preflightResult.targetFilesExisting} · 计划写入：{preflightResult.dryRun.writeItems} · 写入范围：{preflightResult.writeScope}</p>
                {preflightResult.blockedReasons.length ? <ul>{preflightResult.blockedReasons.map(reason => <li key={reason}>{blockedMessages[reason] ?? reason}</li>)}</ul> : null}
              </div>
            ) : null}
            {previewStatus !== 'idle' ? (
              <div className={`studio-validation${previewReady ? ' is-valid' : ' has-errors'}`}>
                <div>{previewReady ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{previewStatus === 'loading' ? '正在生成预览' : previewReady ? '预览已就绪' : '预览被阻断'}</strong></div>
                {requestError ? <p>{requestError}</p> : null}
                {previewStatus !== 'loading' && (previewResult?.errors.length || validation.length) ? (
                  <ul>{(previewResult?.errors.map(issue => issueMessages[issue.code] ?? issue.message) ?? validation).map(message => <li key={message}>{message}</li>)}</ul>
                ) : null}
                {previewReady ? <p>预览通过，此步骤尚未写入文件。</p> : null}
                {previewResult?.warnings.map(warning => <p key={warning.code}>{issueMessages[warning.code] ?? warning.message}</p>)}
              </div>
            ) : <div className="studio-preview-placeholder">填写表单并选择海报后生成预览。</div>}
            {createStatus === 'error' ? (
              <div className="studio-validation has-errors"><div><AlertCircle size={18} /><strong>创建失败</strong></div><p>{requestError}</p></div>
            ) : null}
          </section>
        </aside>
      </div>

      <footer className="studio-actionbar">
        <div className="studio-action-summary">
          <span>{createStatus === 'success' ? '条目已保存' : isDirty ? '草稿有改动' : '草稿无改动'}</span>
          <small>{createAvailable ? '只写入 ArchiveData-v2，不会自动发布。' : '本地创建服务不可用。'}</small>
        </div>
        <div className="studio-actions">
          <button className="studio-button studio-button--quiet" type="button" onClick={reset}><RefreshCcw size={16} /> 重置</button>
          <button className="studio-button studio-button--secondary" type="button" onClick={generatePreview}><SearchCheck size={16} /> {previewStatus === 'loading' ? '生成中...' : '生成预览'}</button>
          <button className="studio-button studio-button--secondary" type="button" onClick={runPreflight} disabled={!previewReady || preflightStatus === 'loading'}><ShieldCheck size={16} /> {preflightStatus === 'loading' ? '检查中...' : '运行预检'}</button>
          <button className="studio-button studio-button--primary" type="button" onClick={createEntry} disabled={!createReady}>{createStatus === 'loading' ? '创建中...' : createStatus === 'success' ? '创建成功' : '创建条目'}</button>
        </div>
      </footer>
    </main>
  )
}
