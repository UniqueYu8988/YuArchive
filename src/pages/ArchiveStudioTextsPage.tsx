import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileImage,
  FileText,
  FolderTree,
  Newspaper,
  RefreshCcw,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react'
import './ArchiveStudioPage.css'

type TextKind = 'article' | 'book_note' | 'series_note'
type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

type TextForm = {
  title: string
  date: string
  author: string
  summary: string
  tags: string
  content: string
  cover: File | null
}

type ApiIssue = {
  code: string
  message: string
}

type ApiPreview = {
  ok: boolean
  target: {
    entryId: string
    entryRelativeDir: string
    entryYaml: string
    contentMd: string
    cover: string
  }
  operations: Array<{
    role: string
    relativePath: string
  }>
  warnings: ApiIssue[]
  errors: ApiIssue[]
}

type ApiPreflight = {
  ok: boolean
  targetEntryExists: boolean
  targetFilesExisting: number
  blockedReasons: string[]
  writeScope: string
  preflightToken: string | null
  preflightExpiresAt: number | null
  dryRun: {
    writeItems: number
    rollbackDeletes: number
  }
}

type TextsCheck = {
  ok: boolean
  totalEntries: number
  malformedEntries: number
  privacyRuleHits: number
  kindCounts: Record<TextKind, number>
}

type CreateResult = {
  ok: true
  entryRelativeDir: string
  createdEntryFiles: number
  createdTransactionFiles: number
  textsEntries: number
  sourceUnchanged: boolean
  publishTriggered: false
  check: TextsCheck
}

type ErrorResult = {
  ok: false
  error?: {
    code?: string
    message?: string
    stage?: string
    rollback?: {
      completed: boolean
    }
  }
}

const kindOptions: Array<{
  kind: TextKind
  label: string
  description: string
  icon: typeof FileText
}> = [
  { kind: 'article', label: '文章', description: '参考信息或拾遗', icon: FileText },
  { kind: 'book_note', label: '书籍笔记', description: '每天听本书', icon: BookOpen },
  { kind: 'series_note', label: '系列文本', description: '头条或睡前消息', icon: Newspaper },
]

const sectionsByKind: Record<TextKind, Array<{ key: string; label: string }>> = {
  article: [
    { key: 'reference-info', label: '参考信息' },
    { key: 'miscellany', label: '拾遗' },
  ],
  book_note: [
    { key: 'book-reviews', label: '每天听本书' },
  ],
  series_note: [
    { key: 'headline', label: '得到头条' },
    { key: 'bedtime-news', label: '睡前消息' },
  ],
}

const initialForm: TextForm = {
  title: '',
  date: '',
  author: '',
  summary: '',
  tags: '',
  content: '',
  cover: null,
}

const issueMessages: Record<string, string> = {
  invalid_entry_id: '条目 ID 无效，请重置草稿。',
  missing_title: '请填写标题。',
  missing_content: '请填写 Markdown 正文。',
  section_kind_mismatch: '所选栏目与文本类型不匹配。',
  invalid_optional_date: '日期应为 YYYY-MM-DD 或留空。',
  invalid_required_date: '请填写 YYYY-MM-DD 格式的日期。',
  missing_cover: '书籍笔记必须选择封面。',
  invalid_cover_extension: '封面类型不受支持。',
  unexpected_cover: '当前文本类型不使用封面。',
  summary_empty: '摘要为空，不影响保存。',
  tags_normalized: '空标签或重复标签会自动移除。',
}

const blockedMessages: Record<string, string> = {
  texts_v2_baseline_failed: 'Texts v2 当前结构检查未通过。',
  create_target_exists: '目标条目已存在，不能覆盖。',
  create_target_files_exist: '目标文件已存在，不能覆盖。',
}

function newTextId() {
  const now = new Date()
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  return `text-${day}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
}

function tagsFromInput(value: string) {
  return [...new Set(value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))]
}

function fileExtension(file: File | null) {
  if (!file) return ''
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension ? `.${extension}` : ''
}

function formatSize(file: File | null) {
  if (!file) return '尚未选择'
  const megabytes = file.size / 1024 / 1024
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`
}

function issueText(issue: ApiIssue) {
  return issueMessages[issue.code] ?? issue.message
}

function blockedText(reason: string) {
  return blockedMessages[reason] ?? `预检规则未通过：${reason}`
}

export default function ArchiveStudioTextsPage() {
  const [kind, setKind] = useState<TextKind>('article')
  const [section, setSection] = useState(sectionsByKind.article[0].key)
  const [entryId, setEntryId] = useState(newTextId)
  const [form, setForm] = useState<TextForm>(initialForm)
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
  const [checkResult, setCheckResult] = useState<TextsCheck | null>(null)
  const [requestError, setRequestError] = useState('')

  const isBookNote = kind === 'book_note'
  const coverExtension = fileExtension(form.cover)
  const tags = useMemo(() => tagsFromInput(form.tags), [form.tags])

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
            kind?: string
            capabilities?: { create?: boolean; publish?: boolean }
          }>
        }
        const profiles = data.profiles?.filter(profile => profile.board === 'texts') ?? []
        const safe = data.localOnly === true
          && profiles.length === 3
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

  const updateField = (field: keyof Omit<TextForm, 'cover'>, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    invalidate()
  }

  const updateCover = (cover: File | null) => {
    setForm(current => ({ ...current, cover }))
    invalidate()
  }

  const changeKind = (nextKind: TextKind) => {
    setKind(nextKind)
    setSection(sectionsByKind[nextKind][0].key)
    setForm(current => ({
      ...current,
      date: nextKind === 'book_note' ? '' : current.date,
      author: nextKind === 'book_note' ? current.author : '',
      cover: nextKind === 'book_note' ? current.cover : null,
    }))
    setFileInputVersion(current => current + 1)
    invalidate()
  }

  const validation = useMemo(() => {
    const errors: string[] = []
    if (!form.title.trim()) errors.push('请填写标题。')
    if (!form.content.trim()) errors.push('请填写 Markdown 正文。')
    if (isBookNote) {
      if (!form.cover) errors.push('请选择书籍封面。')
      if (form.cover && !['.jpg', '.jpeg', '.png', '.webp'].includes(coverExtension)) {
        errors.push('封面格式不受支持。')
      }
      if (form.date && !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.push('日期格式应为 YYYY-MM-DD。')
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      errors.push('文章和系列文本必须填写 YYYY-MM-DD 日期。')
    }
    return errors
  }, [coverExtension, form, isBookNote])

  const buildPayload = () => ({
    mode: 'create',
    board: 'texts',
    kind,
    id: entryId,
    fields: {
      title: form.title.trim(),
      section,
      date: form.date.trim(),
      author: isBookNote ? form.author.trim() : '',
      summary: form.summary.trim(),
      tags,
    },
    content: { markdown: form.content },
    assets: isBookNote && form.cover ? {
      cover: {
        source: 'selected-file',
        originalName: form.cover.name,
        extension: coverExtension,
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
    setKind('article')
    setSection(sectionsByKind.article[0].key)
    setEntryId(newTextId())
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
    setPreviewResult(null)
    setPreflightStatus('idle')
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
    try {
      const result = await postJson<ApiPreview>('/api/studio/texts/preview', buildPayload())
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
    setPreflightResult(null)
    setCreateStatus('idle')
    setCreateResult(null)
    setRequestError('')
    try {
      const result = await postJson<ApiPreflight>('/api/studio/texts/preflight', buildPayload())
      setPreflightResult(result)
      setPreflightStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreflightStatus('error')
      setRequestError(error instanceof Error ? error.message : '预检失败。')
    }
  }

  const runCheck = async () => {
    setCheckStatus('loading')
    setCheckResult(null)
    try {
      const result = await postJson<TextsCheck>('/api/studio/checks/texts-v2', {})
      setCheckResult(result)
      setCheckStatus(result.ok ? 'success' : 'error')
    } catch {
      setCheckStatus('error')
    }
  }

  const createEntry = async () => {
    if (!preflightResult?.preflightToken) return
    setCreateStatus('loading')
    setCreateResult(null)
    setRequestError('')
    const body = new FormData()
    body.set('payload', JSON.stringify(buildPayload()))
    body.set('preflightToken', preflightResult.preflightToken)
    if (isBookNote && form.cover) body.set('cover', form.cover)
    try {
      const response = await fetch('/api/studio/texts/create', { method: 'POST', body })
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
  const KindIcon = kindOptions.find(option => option.kind === kind)?.icon ?? FileText

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
        <NavLink to="/studio" end>音乐</NavLink>
        <NavLink to="/studio/texts">文本</NavLink>
      </nav>

      <section className="studio-context-bar" aria-label="当前创建配置">
        <div className="studio-context-item"><span>板块</span><strong>文本</strong></div>
        <div className="studio-context-item"><span>类型</span><strong>{kindOptions.find(option => option.kind === kind)?.label}</strong></div>
        <div className="studio-context-item"><span>操作</span><strong>新建</strong></div>
        <div className="studio-context-state">
          <span className={`studio-state-dot${isDirty ? ' is-dirty' : ''}`} />
          {createStatus === 'success' ? '条目已创建' : preflightResult?.ok ? '预检已通过' : previewReady ? '预览已就绪' : isDirty ? '草稿有改动' : '尚未编辑'}
        </div>
      </section>

      {createResult ? (
        <section className="studio-save-result" role="status" aria-live="polite">
          <CheckCircle2 size={22} />
          <div>
            <strong>创建成功，文本已保存到 ArchiveData-v2</strong>
            <span>{createResult.entryRelativeDir}</span>
          </div>
          <dl>
            <div><dt>条目文件</dt><dd>{createResult.createdEntryFiles}</dd></div>
            <div><dt>Texts v2 总数</dt><dd>{createResult.textsEntries}</dd></div>
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
              <div><span>01</span><h2>文本类型</h2></div>
              <p>类型决定可用栏目、日期和封面规则。</p>
            </div>
            <div className="studio-kind-selector">
              {kindOptions.map(option => {
                const Icon = option.icon
                return (
                  <button
                    key={option.kind}
                    className={kind === option.kind ? 'is-active' : ''}
                    type="button"
                    onClick={() => changeKind(option.kind)}
                  >
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
              <p>只填写当前类型需要的字段。</p>
            </div>
            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide">
                <span>标题 <b>必填</b></span>
                <input value={form.title} onChange={event => updateField('title', event.target.value)} placeholder="文本标题" />
              </label>
              <label className="studio-field">
                <span>栏目 <b>必填</b></span>
                <select value={section} onChange={event => { setSection(event.target.value); invalidate() }}>
                  {sectionsByKind[kind].map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </label>
              <label className="studio-field">
                <span>日期 {isBookNote ? '可选' : <b>必填</b>}</span>
                <input type="date" value={form.date} onChange={event => updateField('date', event.target.value)} />
              </label>
              {isBookNote ? (
                <label className="studio-field studio-field--wide">
                  <span>作者</span>
                  <input value={form.author} onChange={event => updateField('author', event.target.value)} placeholder="可选" />
                </label>
              ) : null}
              <label className="studio-field studio-field--wide">
                <span>摘要</span>
                <textarea rows={3} value={form.summary} onChange={event => updateField('summary', event.target.value)} placeholder="可选的简短摘要，不会自动生成" />
              </label>
              <label className="studio-field studio-field--wide">
                <span>标签</span>
                <input value={form.tags} onChange={event => updateField('tags', event.target.value)} placeholder="用逗号分隔" />
                <small>将保存 {tags.length} 个去重后的标签。</small>
              </label>
              <label className="studio-field studio-field--wide">
                <span>条目 ID <b>系统生成</b></span>
                <input value={entryId} readOnly />
              </label>
            </div>
          </section>

          {isBookNote ? (
            <section className="studio-section">
              <div className="studio-section-heading">
                <div><span>03</span><h2>书籍封面</h2></div>
                <p>保存为条目目录下的 cover 文件。</p>
              </div>
              <label className={`studio-asset-picker${form.cover ? ' has-file' : ''}`}>
                <input
                  key={`cover-${fileInputVersion}`}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={event => updateCover(event.target.files?.[0] ?? null)}
                />
                <FileImage size={24} />
                <span className="studio-asset-label">封面</span>
                <strong>{form.cover?.name ?? '选择图片'}</strong>
                <small>{formatSize(form.cover)} · JPG、PNG 或 WebP</small>
              </label>
            </section>
          ) : null}

          <section className="studio-section">
            <div className="studio-section-heading">
              <div><span>{isBookNote ? '04' : '03'}</span><h2>Markdown 正文</h2></div>
              <p>正文原样保存为 content.md，不会自动改写。</p>
            </div>
            <label className="studio-field studio-field--wide">
              <span>正文 <b>必填</b></span>
              <textarea
                className="studio-markdown-input"
                rows={16}
                value={form.content}
                onChange={event => updateField('content', event.target.value)}
                placeholder="填写 Markdown 正文"
              />
              <small>{form.content.length} 个字符 · {form.content ? form.content.split(/\r\n|\r|\n/).length : 0} 行</small>
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
                { role: 'entry_yaml', relativePath: `entries/texts/${kind}/${entryId}/entry.yaml` },
                { role: 'content_md', relativePath: `entries/texts/${kind}/${entryId}/content.md` },
                ...(isBookNote ? [{ role: 'cover', relativePath: `entries/texts/${kind}/${entryId}/cover${coverExtension || '.ext'}` }] : []),
              ]).map(operation => (
                <div className="studio-operation" key={`${operation.role}-${operation.relativePath}`}>
                  <KindIcon size={16} />
                  <div><span>{operation.role}</span><code>{operation.relativePath}</code></div>
                  <i className="is-ready">就绪</i>
                </div>
              ))}
            </div>
            <div className="studio-check-block studio-check-block--action">
              <div><ShieldCheck size={17} /><strong>Texts v2 结构</strong></div>
              <button type="button" onClick={runCheck} disabled={checkStatus === 'loading' || serviceStatus === 'offline'}>
                {checkStatus === 'loading' ? '检查中...' : '运行检查'}
              </button>
              {checkResult ? <span>{checkResult.ok ? '通过' : '需要检查'} · {checkResult.totalEntries} 个条目 · {checkResult.malformedEntries} 个异常</span> : null}
            </div>
            {preflightResult ? (
              <div className={`studio-validation${preflightResult.ok ? ' is-valid' : ' has-errors'}`}>
                <div>{preflightResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{preflightResult.ok ? '预检通过' : '预检被阻断'}</strong></div>
                <p>已有目标文件：{preflightResult.targetFilesExisting} · 计划写入：{preflightResult.dryRun.writeItems} · 写入范围：{preflightResult.writeScope}</p>
                {preflightResult.blockedReasons.length ? <ul>{preflightResult.blockedReasons.map(reason => <li key={reason}>{blockedText(reason)}</li>)}</ul> : null}
              </div>
            ) : null}
            {previewStatus !== 'idle' ? (
              <div className={`studio-validation${previewReady ? ' is-valid' : ' has-errors'}`}>
                <div>{previewReady ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}<strong>{previewStatus === 'loading' ? '正在生成预览' : previewReady ? '预览已就绪' : '预览被阻断'}</strong></div>
                {requestError ? <p>{requestError}</p> : null}
                {previewStatus !== 'loading' && (previewResult?.errors.length || validation.length) ? (
                  <ul>{(previewResult?.errors.map(issueText) ?? validation).map(message => <li key={message}>{message}</li>)}</ul>
                ) : null}
                {previewReady ? <p>预览通过，此步骤尚未写入文件。</p> : null}
                {previewResult?.warnings.map(warning => <p key={warning.code}>{issueText(warning)}</p>)}
              </div>
            ) : (
              <div className="studio-preview-placeholder">填写表单后生成预览，检查目标文件和规则。</div>
            )}
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
