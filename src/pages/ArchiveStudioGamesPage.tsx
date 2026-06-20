import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  FolderTree,
  Gamepad2,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react'
import './ArchiveStudioPage.css'

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'
type GameForm = {
  title: string
  year: string
  metadataEnabled: boolean
  englishTitle: string
  url: string
  platform: string
  price: string
  rating: string
  playtime: string
  completed: boolean
  genre: string
  cover: File | null
}
type ApiIssue = { code: string; message: string }
type ApiPreview = {
  ok: boolean
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
type GamesCheck = {
  ok: boolean
  totalEntries: number
  malformedEntries: number
  malformedSeasons: number
  privacyRuleHits: number
}
type CreateResult = {
  ok: true
  entryRelativeDir: string
  createdEntryFiles: number
  gamesEntries: number
  sourceUnchanged: boolean
  publishTriggered: false
  check: GamesCheck
}
type ErrorResult = {
  ok: false
  error?: { message?: string; rollback?: { completed: boolean } }
}

const platforms = [
  ['steam', 'Steam'], ['xbox', 'Xbox'], ['riotgame', 'Riot Games'],
  ['battlenet', 'Battle.net'], ['playstation', 'PlayStation'], ['switch', 'Nintendo Switch'],
]
const genres = [
  ['', '未分类'], ['action', '动作'], ['rpg', '角色扮演'], ['strategy', '策略'],
  ['shooter', '射击'], ['simulation', '模拟'], ['sports', '体育'], ['racing', '竞速'],
  ['puzzle', '解谜'], ['casual', '休闲'],
]
const initialForm: GameForm = {
  title: '', year: String(new Date().getFullYear()), metadataEnabled: true,
  englishTitle: '', url: '', platform: 'steam', price: '', rating: '',
  playtime: '', completed: false, genre: '', cover: null,
}
const issueMessages: Record<string, string> = {
  invalid_entry_id: '条目 ID 无效，请重置草稿。',
  missing_title: '请填写标题。',
  invalid_year: '年份必须是 1900–2100 的整数。',
  missing_cover: '请选择封面。',
  invalid_cover_extension: '封面格式不受支持。',
  invalid_platform: '请选择有效平台。',
  invalid_url: '外部链接必须以 http:// 或 https:// 开头。',
  invalid_rating: '评分必须是 0–5 的整数。',
  invalid_genre: '请选择有效分类。',
  english_title_empty: '英文标题为空，不影响保存。',
  url_empty: '外部链接为空，不影响保存。',
}
const blockedMessages: Record<string, string> = {
  games_v2_baseline_failed: 'Games v2 当前结构检查未通过。',
  create_target_exists: '目标条目已存在，不能覆盖。',
  create_target_files_exist: '目标文件已存在，不能覆盖。',
}

function newGameId() {
  const now = new Date()
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('')
  return `game-${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
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

export default function ArchiveStudioGamesPage() {
  const [entryId, setEntryId] = useState(newGameId)
  const [form, setForm] = useState<GameForm>(initialForm)
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
  const [checkResult, setCheckResult] = useState<GamesCheck | null>(null)
  const [requestError, setRequestError] = useState('')
  const coverExtension = fileExtension(form.cover)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/studio/profiles', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('本地服务不可用。')
        const data = await response.json() as {
          localOnly?: boolean
          writeEnabled?: boolean
          profiles?: Array<{ board?: string; kind?: string; capabilities?: { create?: boolean; publish?: boolean } }>
        }
        const profile = data.profiles?.find(item => item.board === 'games' && item.kind === 'normal_game')
        const safe = data.localOnly === true && profile?.capabilities?.publish === false
        if (!safe) throw new Error('本地服务能力配置不安全。')
        setCreateAvailable(data.writeEnabled === true && profile?.capabilities?.create === true)
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

  const updateField = <K extends keyof GameForm>(field: K, value: GameForm[K]) => {
    setForm(current => ({ ...current, [field]: value }))
    invalidate()
  }

  const validation = useMemo(() => {
    const errors: string[] = []
    const year = Number(form.year)
    if (!form.title.trim()) errors.push('请填写标题。')
    if (!Number.isInteger(year) || year < 1900 || year > 2100) errors.push('年份必须是 1900–2100 的整数。')
    if (!form.cover) errors.push('请选择封面。')
    if (form.cover && !['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(coverExtension)) errors.push('封面格式不受支持。')
    if (form.metadataEnabled && form.url && !/^https?:\/\//i.test(form.url)) errors.push('外部链接格式无效。')
    return errors
  }, [form, coverExtension])

  const buildPayload = () => ({
    mode: 'create', board: 'games', kind: 'normal_game', id: entryId,
    fields: {
      title: form.title.trim(), year: Number(form.year), metadata_enabled: form.metadataEnabled,
      english_title: form.englishTitle.trim(), url: form.url.trim(), platform: form.platform,
      price: form.price.trim(), rating: form.rating === '' ? '' : Number(form.rating),
      playtime: form.playtime.trim(), completed: form.completed, genre: form.genre,
    },
    assets: form.cover ? { cover: { source: 'selected-file', originalName: form.cover.name, extension: coverExtension } } : {},
  })

  const postJson = async <T,>(pathname: string, body: unknown): Promise<T> => {
    const response = await fetch(pathname, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json() as T
    if (!response.ok && response.status >= 500) throw new Error('本地服务处理请求失败。')
    return result
  }

  const reset = () => {
    setEntryId(newGameId())
    setForm({ ...initialForm, year: String(new Date().getFullYear()) })
    setFileInputVersion(current => current + 1)
    setIsDirty(false)
    setPreviewStatus('idle'); setPreviewResult(null)
    setPreflightStatus('idle'); setPreflightResult(null)
    setCreateStatus('idle'); setCreateResult(null)
    setCheckStatus('idle'); setCheckResult(null); setRequestError('')
  }

  const generatePreview = async () => {
    setPreviewStatus('loading'); setPreflightResult(null); setCreateResult(null); setRequestError('')
    try {
      const result = await postJson<ApiPreview>('/api/studio/games/preview', buildPayload())
      setPreviewResult(result); setPreviewStatus(result.ok ? 'success' : 'error'); setServiceStatus('online')
    } catch (error) {
      setPreviewStatus('error'); setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : '生成预览失败。')
    }
  }

  const runPreflight = async () => {
    setPreflightStatus('loading'); setCreateResult(null); setRequestError('')
    try {
      const result = await postJson<ApiPreflight>('/api/studio/games/preflight', buildPayload())
      setPreflightResult(result); setPreflightStatus(result.ok ? 'success' : 'error')
    } catch (error) {
      setPreflightStatus('error'); setRequestError(error instanceof Error ? error.message : '预检失败。')
    }
  }

  const runCheck = async () => {
    setCheckStatus('loading')
    try {
      const result = await postJson<GamesCheck>('/api/studio/checks/games-v2', {})
      setCheckResult(result); setCheckStatus(result.ok ? 'success' : 'error')
    } catch { setCheckStatus('error') }
  }

  const createEntry = async () => {
    if (!preflightResult?.preflightToken || !form.cover) return
    setCreateStatus('loading'); setRequestError('')
    const body = new FormData()
    body.set('payload', JSON.stringify(buildPayload()))
    body.set('preflightToken', preflightResult.preflightToken)
    body.set('cover', form.cover)
    try {
      const response = await fetch('/api/studio/games/create', { method: 'POST', body })
      const result = await response.json() as CreateResult | ErrorResult
      if (!response.ok || !result.ok) {
        const details = 'error' in result ? result.error : undefined
        const rollback = details?.rollback ? ` 回退${details.rollback.completed ? '已完成' : '需要人工检查'}。` : ''
        throw new Error(`${details?.message || '创建失败。'}${rollback}`)
      }
      setCreateResult(result); setCreateStatus('success')
      setCheckResult(result.check); setCheckStatus(result.check.ok ? 'success' : 'error'); setIsDirty(false)
    } catch (error) {
      setCreateStatus('error'); setRequestError(error instanceof Error ? error.message : '创建失败。')
    } finally {
      setPreflightResult(current => current ? { ...current, preflightToken: null, preflightExpiresAt: null } : current)
    }
  }

  const previewReady = previewResult?.ok === true && validation.length === 0
  const createReady = previewReady && preflightResult?.ok === true && Boolean(preflightResult.preflightToken)
    && createAvailable && createStatus !== 'loading' && createStatus !== 'success'

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div><div className="studio-kicker">本地收藏维护工具</div><h1>Archive Studio</h1></div>
        <div className="studio-status-cluster">
          <span className={`studio-status${serviceStatus === 'online' ? ' studio-status--safe' : ''}`}><ShieldCheck size={15} />{serviceStatus === 'checking' ? '正在检查本地服务' : serviceStatus === 'online' ? '本地服务已连接' : '本地服务未连接'}</span>
          <span className="studio-status">不会自动发布</span><span className="studio-status">不写旧源数据</span>
        </div>
      </header>

      <nav className="studio-board-tabs" aria-label="Archive Studio 板块">
        <NavLink to="/studio" end>音乐</NavLink><NavLink to="/studio/texts">文本</NavLink>
        <NavLink to="/studio/visions">影视</NavLink><NavLink to="/studio/games">游戏</NavLink>
      </nav>

      <section className="studio-context-bar" aria-label="当前创建配置">
        <div className="studio-context-item"><span>板块</span><strong>游戏</strong></div>
        <div className="studio-context-item"><span>类型</span><strong>普通游戏</strong></div>
        <div className="studio-context-item"><span>操作</span><strong>新建</strong></div>
        <div className="studio-context-state"><span className={`studio-state-dot${isDirty ? ' is-dirty' : ''}`} />{createStatus === 'success' ? '条目已创建' : preflightResult?.ok ? '预检已通过' : previewReady ? '预览已就绪' : isDirty ? '草稿有改动' : '尚未编辑'}</div>
      </section>

      {createResult ? (
        <section className="studio-save-result" role="status" aria-live="polite">
          <CheckCircle2 size={22} /><div><strong>创建成功，游戏条目已保存到 ArchiveData-v2</strong><span>{createResult.entryRelativeDir}</span></div>
          <dl><div><dt>条目文件</dt><dd>{createResult.createdEntryFiles}</dd></div><div><dt>Games v2 总数</dt><dd>{createResult.gamesEntries}</dd></div><div><dt>结构检查</dt><dd>{createResult.check.ok ? '通过' : '失败'}</dd></div><div><dt>旧源数据</dt><dd>{createResult.sourceUnchanged ? '未变化' : '需检查'}</dd></div><div><dt>发布</dt><dd>{createResult.publishTriggered ? '已触发' : '未触发'}</dd></div></dl>
        </section>
      ) : null}

      <div className="studio-workspace">
        <div className="studio-editor-column">
          <section className="studio-section">
            <div className="studio-section-heading"><div><span>01</span><h2>基础信息</h2></div><p>第一版只创建普通游戏，不处理 DLC 或赛季。</p></div>
            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide"><span>标题 <b>必填</b></span><input value={form.title} onChange={event => updateField('title', event.target.value)} placeholder="游戏标题" /></label>
              <label className="studio-field"><span>年份 <b>必填</b></span><input type="number" min="1900" max="2100" value={form.year} onChange={event => updateField('year', event.target.value)} /></label>
              <label className="studio-toggle"><span>增强元数据<small>关闭后只保存标题、年份和封面</small></span><input type="checkbox" checked={form.metadataEnabled} onChange={event => updateField('metadataEnabled', event.target.checked)} /></label>
              <label className="studio-field studio-field--wide"><span>条目 ID <b>系统生成</b></span><input value={entryId} readOnly /></label>
            </div>
          </section>

          {form.metadataEnabled ? (
            <section className="studio-section">
              <div className="studio-section-heading"><div><span>02</span><h2>游戏信息</h2></div><p>全部由你填写，不会查询 Steam 或自动补全。</p></div>
              <div className="studio-form-grid">
                <label className="studio-field studio-field--wide"><span>英文标题</span><input value={form.englishTitle} onChange={event => updateField('englishTitle', event.target.value)} placeholder="可选" /></label>
                <label className="studio-field"><span>平台 <b>必填</b></span><select value={form.platform} onChange={event => updateField('platform', event.target.value)}>{platforms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="studio-field"><span>分类</span><select value={form.genre} onChange={event => updateField('genre', event.target.value)}>{genres.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="studio-field"><span>评分</span><select value={form.rating} onChange={event => updateField('rating', event.target.value)}><option value="">未评分</option>{[0, 1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} 星</option>)}</select></label>
                <label className="studio-field"><span>游玩时长</span><input value={form.playtime} onChange={event => updateField('playtime', event.target.value)} placeholder="例如 <50h" /></label>
                <label className="studio-field"><span>价格</span><input value={form.price} onChange={event => updateField('price', event.target.value)} placeholder="可选文本" /></label>
                <label className="studio-toggle"><span>已完成<small>记录当前完成状态</small></span><input type="checkbox" checked={form.completed} onChange={event => updateField('completed', event.target.checked)} /></label>
                <label className="studio-field studio-field--wide"><span>外部链接</span><input value={form.url} onChange={event => updateField('url', event.target.value)} placeholder="https://..." /></label>
              </div>
            </section>
          ) : null}

          <section className="studio-section">
            <div className="studio-section-heading"><div><span>{form.metadataEnabled ? '03' : '02'}</span><h2>封面</h2></div><p>原图保存到新条目目录，不会自动找图或改写源文件。</p></div>
            <label className={`studio-asset-picker${form.cover ? ' has-file' : ''}`}>
              <input key={fileInputVersion} type="file" accept=".jpg,.jpeg,.png,.webp,.avif" onChange={event => updateField('cover', event.target.files?.[0] ?? null)} />
              <FileImage size={24} /><span className="studio-asset-label">封面</span><strong>{form.cover?.name ?? '选择图片'}</strong><small>{formatSize(form.cover)} · JPG、PNG、WebP 或 AVIF</small>
            </label>
          </section>
        </div>

        <aside className="studio-preview-column">
          <section className="studio-preview-panel">
            <div className="studio-preview-title"><FolderTree size={19} /><div><span>写入预览</span><strong>[ArchiveData-v2]</strong></div></div>
            <div className="studio-preview-id"><span>条目 ID</span><code>{entryId}</code></div>
            <div className="studio-operation-list">
              {(previewResult?.operations ?? [
                { role: 'entry_yaml', relativePath: `entries/games/normal_game/${entryId}/entry.yaml` },
                { role: 'cover', relativePath: `entries/games/normal_game/${entryId}/cover${coverExtension || '.ext'}` },
              ]).map(operation => <div className="studio-operation" key={operation.role}><Gamepad2 size={16} /><div><span>{operation.role}</span><code>{operation.relativePath}</code></div><i className="is-ready">就绪</i></div>)}
            </div>
            <div className="studio-check-block studio-check-block--action"><div><ShieldCheck size={17} /><strong>Games v2 结构</strong></div><button type="button" onClick={runCheck} disabled={checkStatus === 'loading' || serviceStatus === 'offline'}>{checkStatus === 'loading' ? '检查中...' : '运行检查'}</button>{checkResult ? <span>{checkResult.ok ? '通过' : '需要检查'} · {checkResult.totalEntries} 个条目 · {checkResult.malformedEntries + checkResult.malformedSeasons} 个异常</span> : null}</div>
            {preflightResult ? <div className={`studio-validation${preflightResult.ok ? ' is-valid' : ' has-errors'}`}><div>{preflightResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{preflightResult.ok ? '预检通过' : '预检被阻断'}</strong></div><p>已有目标文件：{preflightResult.targetFilesExisting} · 计划写入：{preflightResult.dryRun.writeItems} · 写入范围：{preflightResult.writeScope}</p>{preflightResult.blockedReasons.length ? <ul>{preflightResult.blockedReasons.map(reason => <li key={reason}>{blockedMessages[reason] ?? reason}</li>)}</ul> : null}</div> : null}
            {previewStatus !== 'idle' ? <div className={`studio-validation${previewReady ? ' is-valid' : ' has-errors'}`}><div>{previewReady ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{previewStatus === 'loading' ? '正在生成预览' : previewReady ? '预览已就绪' : '预览被阻断'}</strong></div>{requestError ? <p>{requestError}</p> : null}{previewStatus !== 'loading' && (previewResult?.errors.length || validation.length) ? <ul>{(previewResult?.errors.map(issue => issueMessages[issue.code] ?? issue.message) ?? validation).map(message => <li key={message}>{message}</li>)}</ul> : null}{previewReady ? <p>预览通过，此步骤尚未写入文件。</p> : null}{previewResult?.warnings.map(warning => <p key={warning.code}>{issueMessages[warning.code] ?? warning.message}</p>)}</div> : <div className="studio-preview-placeholder">填写表单并选择封面后生成预览。</div>}
            {createStatus === 'error' ? <div className="studio-validation has-errors"><div><AlertCircle size={18} /><strong>创建失败</strong></div><p>{requestError}</p></div> : null}
          </section>
        </aside>
      </div>

      <footer className="studio-actionbar">
        <div className="studio-action-summary"><span>{createStatus === 'success' ? '条目已保存' : isDirty ? '草稿有改动' : '草稿无改动'}</span><small>{createAvailable ? '只写入 ArchiveData-v2，不会自动发布。' : '本地创建服务不可用。'}</small></div>
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
