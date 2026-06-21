import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  FileAudio,
  FileImage,
  FileText,
  FolderTree,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import './ArchiveStudioPage.css'
import ArchiveStudioPublicSync from '../components/ArchiveStudioPublicSync'
import ArchiveStudioModePicker, { type EditableEntryDetail, type StudioMode } from '../components/ArchiveStudioModePicker'

type FormState = {
  title: string
  date: string
  url: string
  note: string
  entryId: string
  content: string
  cover: File | null
  audio: File | null
}

type PreviewOperation = {
  role: string
  relativePath: string
  status: 'ready' | 'pending'
}

type ApiIssue = {
  code: string
  message: string
  path?: string
}

type ApiPreview = {
  ok: boolean
  target: {
    entryId: string
    entryRelativeDir: string
    entryYaml: string
    contentMd: string
    cover: string
    audio: string
  }
  operations: Array<{
    type: string
    role?: string
    relativePath: string
    willOverwrite: boolean
    requiresBackup: boolean
  }>
  warnings: ApiIssue[]
  errors: ApiIssue[]
  writeEnabled: boolean
  writeScope: 'none'
}

type ApiPreflight = {
  ok: boolean
  entryId: string
  targetEntryExists: boolean
  targetFilesExisting: number
  blockedReasons: string[]
  scope: string
  dryRun: {
    status: string
    writeItems: number
    backupItems: number
    rollbackDeletes: number
    rollbackRestores: number
  }
  writeEnabled: boolean
  writeScope: string
  preflightToken: string | null
  preflightExpiresAt: number | null
  updateToken?: string | null
}

type MusicCheckResult = {
  ok: boolean
  albumEntryDirs: number
  entryYamlFiles: number
  contentFiles: number
  coverFiles: number
  audioFiles: number
  malformedEntryDirs: number
  privacyRuleHits: number
  writeScope: 'none'
}

type ApiCreateResult = {
  ok: boolean
  entryId: string
  entryRelativeDir: string
  transactionId: string
  createdEntryFiles: number
  createdTransactionFiles: number
  musicEntries: number
  sourceFilesChecked: number
  sourceUnchanged: boolean
  writeScope: string
  check: MusicCheckResult
  publishTriggered: false
}

type ApiErrorResult = {
  ok: false
  error?: {
    code?: string
    message?: string
    stage?: string
    rollback?: {
      attempted: boolean
      completed: boolean
      errorCount: number
    }
  }
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

const initialForm: FormState = {
  title: '',
  date: '',
  url: '',
  note: '',
  entryId: '',
  content: '',
  cover: null,
  audio: null,
}

const coverExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])
const audioExtensions = new Set(['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'])
const entryIdPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

function getExtension(file: File | null) {
  if (!file) return ''
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function formatFileSize(file: File | null) {
  if (!file) return '尚未选择'
  const megabytes = file.size / 1024 / 1024
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
}

function slugifyTitle(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')

  return slug.length >= 2 ? slug : 'music-album'
}

const issueMessages: Record<string, string> = {
  invalid_mode: '操作模式无效。',
  invalid_board: '当前只支持音乐板块。',
  invalid_kind: '当前只支持专辑类型。',
  invalid_entry_id: '条目 ID 格式无效。',
  missing_title: '请填写专辑标题。',
  content_empty: 'Markdown 正文为空。',
  missing_cover: '请选择封面文件。',
  missing_audio: '请选择音频文件。',
  invalid_cover_extension: '封面扩展名不受支持。',
  invalid_audio_extension: '音频扩展名不受支持。',
  operation_not_allowed: '预览包含不允许的文件操作。',
}

const blockedReasonMessages: Record<string, string> = {
  v2_root_missing: 'ArchiveData-v2 根目录不存在。',
  v2_music_root_missing: 'Music v2 目录不存在。',
  v2_migration_root_missing: '迁移基线目录不存在。',
  create_target_exists: '目标条目已经存在，不能覆盖。',
  update_target_missing: '要更新的目标条目不存在。',
}

function describeIssue(issue: ApiIssue) {
  return issueMessages[issue.code] ?? issue.message
}

function describeBlockedReason(reason: string) {
  return blockedReasonMessages[reason] ?? `预检规则未通过：${reason}`
}

function describeCreateError(details: ApiErrorResult['error']) {
  if (!details) return 'Archive Studio 无法创建条目。'
  if (details.code === 'preflight_token_invalid') return '预检凭证已失效，请重新生成预览并运行预检。'
  if (details.code === 'asset_name_mismatch') return '所选素材已变化，请重新生成预览并运行预检。'
  if (details.code === 'create_disabled') return '本地创建功能当前未启用。'
  if (details.code === 'create_transaction_failed') {
    const stageNames: Record<string, string> = {
      staging: '准备素材',
      'entry-write': '写入条目',
      'manifest-write': '写入事务记录',
      'post-write-check': '写后结构检查',
      'source-boundary-check': '旧源数据边界检查',
    }
    return `创建在“${stageNames[details.stage ?? ''] ?? '未知阶段'}”失败。`
  }
  return details.message || 'Archive Studio 无法创建条目。'
}

export default function ArchiveStudioPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [mode, setMode] = useState<StudioMode>('create')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [existingAssets, setExistingAssets] = useState<Record<string, { name: string; extension: string } | null>>({})
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [previewRequested, setPreviewRequested] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [createAvailable, setCreateAvailable] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<RequestStatus>('idle')
  const [previewResult, setPreviewResult] = useState<ApiPreview | null>(null)
  const [preflightStatus, setPreflightStatus] = useState<RequestStatus>('idle')
  const [preflightResult, setPreflightResult] = useState<ApiPreflight | null>(null)
  const [musicCheckStatus, setMusicCheckStatus] = useState<RequestStatus>('idle')
  const [musicCheckResult, setMusicCheckResult] = useState<MusicCheckResult | null>(null)
  const [createStatus, setCreateStatus] = useState<RequestStatus>('idle')
  const [createResult, setCreateResult] = useState<ApiCreateResult | null>(null)
  const [requestError, setRequestError] = useState('')

  const coverExtension = getExtension(form.cover)
  const audioExtension = getExtension(form.audio)
  const suggestedEntryId = useMemo(() => slugifyTitle(form.title), [form.title])
  const effectiveEntryId = form.entryId || suggestedEntryId

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/studio/profiles', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('本地服务未接受能力检查请求。')
        const result = await response.json() as {
          localOnly?: boolean
          writeEnabled?: boolean
          profiles?: Array<{ capabilities?: { create?: boolean; publish?: boolean } }>
        }
        const capabilities = result.profiles?.[0]?.capabilities
        if (result.localOnly !== true || capabilities?.publish !== false) {
          throw new Error('本地服务返回了不安全的能力配置。')
        }
        setCreateAvailable(result.writeEnabled === true && capabilities.create === true)
        setServiceStatus('online')
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setServiceStatus('offline')
      })

    return () => controller.abort()
  }, [])

  const validation = useMemo(() => {
    const errors: string[] = []

    if (!form.title.trim()) errors.push('请填写专辑标题。')
    if (mode === 'create' && !form.cover) errors.push('请选择封面文件。')
    if (mode === 'create' && !form.audio) errors.push('请选择音频文件。')
    if (form.cover && !coverExtensions.has(coverExtension)) errors.push('封面文件类型不受支持。')
    if (form.audio && !audioExtensions.has(audioExtension)) errors.push('音频文件类型不受支持。')
    if (!entryIdPattern.test(effectiveEntryId)) errors.push('条目 ID 必须是 2-80 位小写字母、数字和连字符。')

    return errors
  }, [audioExtension, coverExtension, effectiveEntryId, form, mode])

  const operations = useMemo<PreviewOperation[]>(() => {
    const entryRoot = `entries/music/album/${effectiveEntryId}`
    return [
      { role: '条目目录', relativePath: entryRoot, status: 'ready' },
      { role: 'YAML 元数据', relativePath: `${entryRoot}/entry.yaml`, status: 'ready' },
      { role: 'Markdown 内容', relativePath: `${entryRoot}/content.md`, status: 'ready' },
      {
        role: '封面素材',
        relativePath: `${entryRoot}/cover.${coverExtension || 'ext'}`,
        status: form.cover ? 'ready' : 'pending',
      },
      {
        role: '音频素材',
        relativePath: `${entryRoot}/audio.${audioExtension || 'ext'}`,
        status: form.audio ? 'ready' : 'pending',
      },
      {
        role: '事务记录',
        relativePath: 'migration/archive-studio-v0/transactions/[transaction-id]/',
        status: 'pending',
      },
    ]
  }, [audioExtension, coverExtension, effectiveEntryId, form.audio, form.cover])

  const buildPayload = () => ({
    mode,
    board: 'music',
    kind: 'album',
    id: effectiveEntryId,
    fields: {
      title: form.title.trim(),
      date: form.date.trim(),
      url: form.url.trim(),
      description: form.note,
      legacy: {},
    },
    content: {
      markdown: form.content,
    },
    assets: {
      ...(form.cover ? {
        cover: {
          source: 'selected-file',
          originalName: form.cover.name,
          extension: `.${coverExtension}`,
        },
      } : mode === 'update' ? { cover: { source: 'keep-existing', extension: existingAssets.cover?.extension ?? '' } } : {}),
      ...(form.audio ? {
        audio: {
          source: 'selected-file',
          originalName: form.audio.name,
          extension: `.${audioExtension}`,
        },
      } : mode === 'update' ? { audio: { source: 'keep-existing', extension: existingAssets.audio?.extension ?? '' } } : {}),
    },
    options: {
      allowOverwriteEntry: false,
      allowOverwriteAssets: false,
      runCheckAfterWrite: true,
      backupBeforeOverwrite: true,
    },
  })

  const postJson = async <T,>(pathname: string, body: unknown): Promise<T> => {
    const response = await fetch(pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json() as T
    if (!response.ok && response.status >= 500) {
      throw new Error('本地 Archive Studio 服务处理请求失败。')
    }
    return result
  }

  const updateField = (field: keyof Omit<FormState, 'cover' | 'audio'>, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setIsDirty(true)
    setPreviewRequested(false)
    setPreviewStatus('idle')
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
  }

  const updateFile = (field: 'cover' | 'audio', file: File | null) => {
    setForm(current => ({ ...current, [field]: file }))
    setIsDirty(true)
    setPreviewRequested(false)
    setPreviewStatus('idle')
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
  }

  const resetForm = () => {
    setForm(initialForm)
    setFileInputVersion(current => current + 1)
    setIsDirty(false)
    setPreviewRequested(false)
    setPreviewStatus('idle')
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setMusicCheckStatus('idle')
    setMusicCheckResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
    if (mode === 'update') {
      setSelectedEntryId('')
      setExistingAssets({})
    }
  }

  const changeMode = (nextMode: StudioMode) => {
    setMode(nextMode)
    setSelectedEntryId('')
    setExistingAssets({})
    setForm(initialForm)
    setFileInputVersion(current => current + 1)
    setIsDirty(false)
    setPreviewRequested(false)
    setPreviewResult(null)
    setPreflightResult(null)
    setCreateResult(null)
  }

  const loadExistingEntry = (detail: EditableEntryDetail) => {
    setSelectedEntryId(detail.id)
    setExistingAssets(detail.assets)
    setForm({
      title: String(detail.fields.title ?? ''),
      date: String(detail.fields.date ?? ''),
      url: String(detail.fields.url ?? ''),
      note: String(detail.fields.description ?? detail.fields.note ?? ''),
      entryId: detail.id,
      content: detail.content,
      cover: null,
      audio: null,
    })
    setFileInputVersion(current => current + 1)
    setIsDirty(false)
    setPreviewRequested(false)
    setPreviewResult(null)
    setPreflightResult(null)
    setCreateResult(null)
  }

  const generatePreview = async () => {
    if (!form.entryId) {
      setForm(current => ({ ...current, entryId: suggestedEntryId }))
    }
    setPreviewRequested(true)
    setPreviewStatus('loading')
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')

    try {
      const endpoint = mode === 'update' ? '/api/studio/music/update-preview' : '/api/studio/music/album/preview'
      const result = await postJson<ApiPreview>(endpoint, buildPayload())
      setPreviewResult(result)
      setPreviewStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreviewResult(null)
      setPreviewStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : '生成预览失败。')
    }
  }

  const runPreflight = async () => {
    setPreflightStatus('loading')
    setPreflightResult(null)
    setRequestError('')

    try {
      const endpoint = mode === 'update' ? '/api/studio/music/update-preflight' : '/api/studio/music/album/preflight'
      const raw = await postJson<ApiPreflight & { operations?: unknown[] }>(endpoint, buildPayload())
      const result = mode === 'update' ? {
        ...raw,
        entryId: effectiveEntryId,
        targetEntryExists: true,
        targetFilesExisting: raw.operations?.length ?? 0,
        blockedReasons: [],
        scope: `entries/music/album/${effectiveEntryId}`,
        dryRun: { status: 'ready', writeItems: raw.operations?.length ?? 0, backupItems: raw.operations?.length ?? 0, rollbackDeletes: 0, rollbackRestores: raw.operations?.length ?? 0 },
        writeScope: `entries/music/album/${effectiveEntryId}`,
        preflightToken: null,
        preflightExpiresAt: null,
      } : raw
      setPreflightResult(result)
      setPreflightStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreflightStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : '预检请求失败。')
    }
  }

  const runMusicCheck = async () => {
    setMusicCheckStatus('loading')
    setMusicCheckResult(null)
    setRequestError('')

    try {
      const result = await postJson<MusicCheckResult>('/api/studio/checks/music-v2', {})
      setMusicCheckResult(result)
      setMusicCheckStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setMusicCheckStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : 'Music v2 检查失败。')
    }
  }

  const createEntry = async () => {
    const token = mode === 'update' ? preflightResult?.updateToken : preflightResult?.preflightToken
    if (!token || (mode === 'create' && (!form.cover || !form.audio))) return

    setCreateStatus('loading')
    setCreateResult(null)
    setRequestError('')

    const body = new FormData()
    body.set('payload', JSON.stringify(buildPayload()))
    body.set(mode === 'update' ? 'updateToken' : 'preflightToken', token)
    if (form.cover) body.set('cover', form.cover)
    if (form.audio) body.set('audio', form.audio)

    try {
      const response = await fetch(mode === 'update' ? '/api/studio/music/update-apply' : '/api/studio/music/album/create', {
        method: 'POST',
        body,
      })
      const result = await response.json() as ApiCreateResult | ApiErrorResult
      if (!response.ok || !result.ok) {
        const details = 'error' in result ? result.error : undefined
        const rollback = details?.rollback
          ? ` 回退${details.rollback.completed ? '已完成' : '需要人工检查'}。`
          : ''
        const message = describeCreateError(details)
        throw new Error(`${message}${rollback}`)
      }

      setCreateResult(result)
      setCreateStatus('success')
      setIsDirty(false)
      setMusicCheckResult(result.check)
      setMusicCheckStatus(result.check.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setCreateStatus('error')
      setRequestError(error instanceof Error ? error.message : '创建条目失败。')
    } finally {
      setPreflightResult(current => current ? {
        ...current,
        writeEnabled: false,
        preflightToken: null,
        updateToken: null,
        preflightExpiresAt: null,
      } : current)
    }
  }

  const previewReady = previewRequested && previewResult?.ok === true && validation.length === 0
  const createReady = previewReady
    && preflightResult?.ok === true
    && preflightResult.writeEnabled
    && Boolean(mode === 'update' ? preflightResult.updateToken : preflightResult.preflightToken)
    && createAvailable
    && createStatus !== 'loading'
    && createStatus !== 'success'

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div>
          <div className="studio-kicker">本地收藏维护工具</div>
          <h1>Archive Studio</h1>
        </div>
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
        <NavLink to="/studio/home">首页</NavLink>
        <NavLink to="/studio" end>音乐</NavLink>
        <NavLink to="/studio/texts">文本</NavLink>
        <NavLink to="/studio/visions">影视</NavLink>
        <NavLink to="/studio/games">游戏</NavLink>
      </nav>

      <ArchiveStudioModePicker board="music" mode={mode} selectedId={selectedEntryId} onModeChange={changeMode} onEntryLoad={loadExistingEntry} />

      {createResult ? (
        <section className="studio-save-result" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <div>
            <strong>创建成功，条目已保存到 ArchiveData-v2</strong>
            <span>{createResult.entryRelativeDir}</span>
          </div>
          <dl>
            <div><dt>条目文件</dt><dd>{createResult.createdEntryFiles}</dd></div>
            <div><dt>Music v2 总数</dt><dd>{createResult.musicEntries}</dd></div>
            <div><dt>结构检查</dt><dd>{createResult.check.ok ? '通过' : '失败'}</dd></div>
            <div><dt>旧源数据</dt><dd>{createResult.sourceUnchanged ? '未变化' : '需检查'}</dd></div>
            <div><dt>发布</dt><dd>{createResult.publishTriggered ? '已触发' : '未触发'}</dd></div>
          </dl>
        </section>
      ) : null}

      <ArchiveStudioPublicSync board="music" refreshKey={createResult?.entryRelativeDir} />

      <div className="studio-workspace">
        <div className="studio-editor-column">
          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>01</span>
                <h2>专辑信息</h2>
              </div>
              <p>{mode === 'update' ? '修改已有专辑；稳定 ID 保持不变。' : '填写新建音乐专辑条目所需的基本信息。'}</p>
            </div>

            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide">
                <span>标题 <b>必填</b></span>
                <input
                  value={form.title}
                  onChange={event => updateField('title', event.target.value)}
                  placeholder="专辑标题"
                />
              </label>

              <label className="studio-field">
                <span>日期或年份</span>
                <input
                  value={form.date}
                  onChange={event => updateField('date', event.target.value)}
                  placeholder="2026"
                />
              </label>

              <label className="studio-field">
                <span>外部链接</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={event => updateField('url', event.target.value)}
                  placeholder="https://"
                />
              </label>

              <label className="studio-field studio-field--wide">
                <span>条目 ID <b>自动建议</b></span>
                <input
                  value={form.entryId}
                  onChange={event => updateField('entryId', event.target.value.toLowerCase())}
                  placeholder={suggestedEntryId}
                  readOnly={mode === 'update'}
                />
                <small>根据标题生成；只允许小写字母、数字和连字符。</small>
              </label>

              <label className="studio-field studio-field--wide">
                <span>备注</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={event => updateField('note', event.target.value)}
                  placeholder="可选的简短备注"
                />
              </label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>02</span>
                <h2>素材</h2>
              </div>
              <p>预览和预检都通过前，文件不会写入 ArchiveData-v2。</p>
            </div>

            <div className="studio-asset-grid">
              <label className={`studio-asset-picker${form.cover ? ' has-file' : ''}`}>
                <input
                  type="file"
                  key={`cover-${fileInputVersion}`}
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={event => updateFile('cover', event.target.files?.[0] ?? null)}
                />
                <FileImage size={24} />
                <span className="studio-asset-label">封面</span>
                <strong>{form.cover?.name ?? (mode === 'update' ? '保留现有封面' : '选择图片')}</strong>
                <small>{form.cover ? formatFileSize(form.cover) : mode === 'update' ? existingAssets.cover?.name : '尚未选择'} · JPG、PNG 或 WebP</small>
              </label>

              <label className={`studio-asset-picker${form.audio ? ' has-file' : ''}`}>
                <input
                  type="file"
                  key={`audio-${fileInputVersion}`}
                  accept=".mp3,.wav,.flac,.m4a,.ogg,.aac"
                  onChange={event => updateFile('audio', event.target.files?.[0] ?? null)}
                />
                <FileAudio size={24} />
                <span className="studio-asset-label">音频</span>
                <strong>{form.audio?.name ?? (mode === 'update' ? '保留现有音频' : '选择音频')}</strong>
                <small>{form.audio ? formatFileSize(form.audio) : mode === 'update' ? existingAssets.audio?.name : '尚未选择'} · MP3、FLAC、M4A 或 WAV</small>
              </label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>03</span>
                <h2>Markdown 内容</h2>
              </div>
              <p>原样保存为 content.md，不会自动改写。</p>
            </div>

            <label className="studio-field studio-field--wide">
              <span>正文</span>
              <textarea
                className="studio-markdown-input"
                rows={12}
                value={form.content}
                onChange={event => updateField('content', event.target.value)}
                placeholder="可用 Markdown 填写说明、曲目列表或个人记录。"
              />
              <small>{form.content.length} 个字符 · {form.content ? form.content.split(/\r\n|\r|\n/).length : 0} 行</small>
            </label>
          </section>
        </div>

        <aside className="studio-preview-column">
          <section className="studio-preview-panel">
            <div className="studio-preview-title">
              <FolderTree size={19} />
              <div>
                <span>写入预览</span>
                <strong>[ArchiveData-v2]</strong>
              </div>
            </div>

            <div className="studio-preview-id">
              <span>条目 ID</span>
              <code>{effectiveEntryId}</code>
            </div>

            <div className="studio-operation-list">
              {operations.map(operation => (
                <div className="studio-operation" key={`${operation.role}-${operation.relativePath}`}>
                  {operation.role.includes('Markdown') ? <FileText size={16} /> : <Sparkles size={16} />}
                  <div>
                    <span>{operation.role}</span>
                    <code>{operation.relativePath}</code>
                  </div>
                  <i className={operation.status === 'ready' ? 'is-ready' : ''}>
                    {operation.status === 'ready' ? '就绪' : '待处理'}
                  </i>
                </div>
              ))}
            </div>

            <div className="studio-check-block">
              <div>
                <SearchCheck size={17} />
                  <strong>目标冲突</strong>
              </div>
              <span>
                {preflightStatus === 'loading'
                  ? '正在检查 ArchiveData-v2 目标...'
                  : preflightResult
                    ? preflightResult.targetEntryExists
                      ? '冲突：目标条目已经存在'
                      : '未发现目标条目冲突'
                    : '生成预览后运行预检'}
              </span>
            </div>

            <div className="studio-check-block studio-check-block--action">
              <div>
                <ShieldCheck size={17} />
                  <strong>Music v2 结构</strong>
              </div>
              <button type="button" onClick={runMusicCheck} disabled={musicCheckStatus === 'loading' || serviceStatus === 'offline'}>
                {musicCheckStatus === 'loading' ? '检查中...' : '运行检查'}
              </button>
              {musicCheckResult ? (
                <span>
                  {musicCheckResult.ok ? '通过' : '需要检查'} · {musicCheckResult.albumEntryDirs} 个条目 · {musicCheckResult.malformedEntryDirs} 个异常
                </span>
              ) : null}
            </div>

            {preflightResult ? (
              <div className={`studio-validation${preflightResult.ok ? ' is-valid' : ' has-errors'}`}>
                <div>
                  {preflightResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <strong>{preflightResult.ok ? '预检通过' : '预检被阻断'}</strong>
                </div>
                <p>
                  已有目标文件：{preflightResult.targetFilesExisting} · 计划写入：{preflightResult.dryRun.writeItems} · 写入范围：{preflightResult.writeScope}
                </p>
                {preflightResult.blockedReasons.length ? (
                  <ul>
                    {preflightResult.blockedReasons.map(reason => <li key={reason}>{describeBlockedReason(reason)}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {createStatus !== 'idle' ? (
              <div className={`studio-validation${createStatus === 'success' ? ' is-valid' : createStatus === 'error' ? ' has-errors' : ''}`}>
                <div>
                  {createStatus === 'success' ? <CheckCircle2 size={18} /> : createStatus === 'error' ? <AlertCircle size={18} /> : <Sparkles size={18} />}
                  <strong>
                    {createStatus === 'loading' ? '正在创建条目' : createStatus === 'success' ? '条目创建成功' : '创建失败'}
                  </strong>
                </div>
                {createResult ? (
                  <p>
                    {createResult.entryRelativeDir} · {createResult.createdEntryFiles} 个条目文件 · Music v2 检查{createResult.check.ok ? '通过' : '失败'} · 旧源数据未变化
                  </p>
                ) : requestError ? <p>{requestError}</p> : null}
              </div>
            ) : null}

            {previewRequested ? (
              <div className={`studio-validation${previewReady ? ' is-valid' : ' has-errors'}`}>
                <div>
                  {previewReady ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <strong>
                    {previewStatus === 'loading' ? '正在生成预览' : previewReady ? '预览已就绪' : '预览被阻断'}
                  </strong>
                </div>
                {requestError ? <p>{requestError}</p> : null}
                {previewStatus !== 'loading' && (previewResult?.errors.length || validation.length) ? (
                  <ul>
                    {(previewResult?.errors.map(describeIssue) ?? validation).map(error => <li key={error}>{error}</li>)}
                  </ul>
                ) : null}
                {previewReady ? <p>预览检查通过，此步骤尚未写入文件。</p> : null}
                {previewResult?.warnings.map(warning => <p key={warning.code}>{describeIssue(warning)}</p>)}
              </div>
            ) : (
              <div className="studio-preview-placeholder">
                请先生成预览，检查草稿和目标文件。
              </div>
            )}
          </section>
        </aside>
      </div>

      <footer className="studio-actionbar">
        <div className="studio-action-summary">
          <span>{createStatus === 'success' ? '条目已保存' : isDirty ? '草稿有改动' : mode === 'update' ? '选择条目后修改' : '草稿无改动'}</span>
          <small>{createAvailable ? '只写入 ArchiveData-v2，不会自动发布。' : '本地创建服务不可用。'}</small>
        </div>
        <div className="studio-actions">
          <button className="studio-button studio-button--quiet" type="button" onClick={resetForm}>
            <RefreshCcw size={16} /> 重置
          </button>
          <button className="studio-button studio-button--secondary" type="button" onClick={generatePreview}>
            <SearchCheck size={16} /> {previewStatus === 'loading' ? '生成中...' : '生成预览'}
          </button>
          <button
            className="studio-button studio-button--secondary"
            type="button"
            onClick={runPreflight}
            disabled={!previewReady || preflightStatus === 'loading'}
          >
            <ShieldCheck size={16} /> {preflightStatus === 'loading' ? '检查中...' : '运行预检'}
          </button>
          <button
            className="studio-button studio-button--primary"
            type="button"
            onClick={createEntry}
            disabled={!createReady}
          >
            {createStatus === 'loading' ? (mode === 'update' ? '保存中...' : '创建中...') : createStatus === 'success' ? '保存成功' : mode === 'update' ? '保存修改' : '创建条目'}
          </button>
        </div>
      </footer>
    </main>
  )
}
