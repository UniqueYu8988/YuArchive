import { useEffect, useMemo, useState } from 'react'
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

export default function ArchiveStudioPage() {
  const [form, setForm] = useState<FormState>(initialForm)
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
        if (!response.ok) throw new Error('Local service did not accept the profile request.')
        const result = await response.json() as {
          localOnly?: boolean
          writeEnabled?: boolean
          profiles?: Array<{ capabilities?: { create?: boolean; publish?: boolean } }>
        }
        const capabilities = result.profiles?.[0]?.capabilities
        if (result.localOnly !== true || capabilities?.publish !== false) {
          throw new Error('Local service reported an unsafe capability profile.')
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

    if (!form.title.trim()) errors.push('Title is required.')
    if (!form.cover) errors.push('Select a cover file.')
    if (!form.audio) errors.push('Select an audio file.')
    if (form.cover && !coverExtensions.has(coverExtension)) errors.push('Cover file type is not supported.')
    if (form.audio && !audioExtensions.has(audioExtension)) errors.push('Audio file type is not supported.')
    if (!entryIdPattern.test(effectiveEntryId)) errors.push('Entry ID must be a lowercase slug with 2-80 characters.')

    return errors
  }, [audioExtension, coverExtension, effectiveEntryId, form])

  const operations = useMemo<PreviewOperation[]>(() => {
    const entryRoot = `entries/music/album/${effectiveEntryId}`
    return [
      { role: 'Entry directory', relativePath: entryRoot, status: 'ready' },
      { role: 'YAML metadata', relativePath: `${entryRoot}/entry.yaml`, status: 'ready' },
      { role: 'Markdown content', relativePath: `${entryRoot}/content.md`, status: 'ready' },
      {
        role: 'Cover asset',
        relativePath: `${entryRoot}/cover.${coverExtension || 'ext'}`,
        status: form.cover ? 'ready' : 'pending',
      },
      {
        role: 'Audio asset',
        relativePath: `${entryRoot}/audio.${audioExtension || 'ext'}`,
        status: form.audio ? 'ready' : 'pending',
      },
      {
        role: 'Transaction manifest',
        relativePath: 'migration/archive-studio-v0/transactions/[transaction-id]/',
        status: 'pending',
      },
    ]
  }, [audioExtension, coverExtension, effectiveEntryId, form.audio, form.cover])

  const buildPayload = () => ({
    mode: 'create',
    board: 'music',
    kind: 'album',
    id: effectiveEntryId,
    fields: {
      title: form.title.trim(),
      date: form.date.trim(),
      url: form.url.trim(),
      note: form.note,
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
      } : {}),
      ...(form.audio ? {
        audio: {
          source: 'selected-file',
          originalName: form.audio.name,
          extension: `.${audioExtension}`,
        },
      } : {}),
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
      throw new Error('Local Archive Studio service failed to process the request.')
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
      const result = await postJson<ApiPreview>('/api/studio/music/album/preview', buildPayload())
      setPreviewResult(result)
      setPreviewStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreviewResult(null)
      setPreviewStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : 'Preview request failed.')
    }
  }

  const runPreflight = async () => {
    setPreflightStatus('loading')
    setPreflightResult(null)
    setRequestError('')

    try {
      const result = await postJson<ApiPreflight>('/api/studio/music/album/preflight', buildPayload())
      setPreflightResult(result)
      setPreflightStatus(result.ok ? 'success' : 'error')
      setServiceStatus('online')
    } catch (error) {
      setPreflightStatus('error')
      setServiceStatus('offline')
      setRequestError(error instanceof Error ? error.message : 'Preflight request failed.')
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
      setRequestError(error instanceof Error ? error.message : 'Music v2 check failed.')
    }
  }

  const createEntry = async () => {
    if (!form.cover || !form.audio || !preflightResult?.preflightToken) return

    setCreateStatus('loading')
    setCreateResult(null)
    setRequestError('')

    const body = new FormData()
    body.set('payload', JSON.stringify(buildPayload()))
    body.set('preflightToken', preflightResult.preflightToken)
    body.set('cover', form.cover)
    body.set('audio', form.audio)

    try {
      const response = await fetch('/api/studio/music/album/create', {
        method: 'POST',
        body,
      })
      const result = await response.json() as ApiCreateResult | ApiErrorResult
      if (!response.ok || !result.ok) {
        const details = 'error' in result ? result.error : undefined
        const rollback = details?.rollback
          ? ` Rollback ${details.rollback.completed ? 'completed' : 'needs review'}.`
          : ''
        const message = details?.message || 'Archive Studio could not create the entry.'
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
      setRequestError(error instanceof Error ? error.message : 'Create request failed.')
    } finally {
      setPreflightResult(current => current ? {
        ...current,
        writeEnabled: false,
        preflightToken: null,
        preflightExpiresAt: null,
      } : current)
    }
  }

  const previewReady = previewRequested && previewResult?.ok === true && validation.length === 0
  const createReady = previewReady
    && preflightResult?.ok === true
    && preflightResult.writeEnabled
    && Boolean(preflightResult.preflightToken)
    && createAvailable
    && createStatus !== 'loading'
    && createStatus !== 'success'

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div>
          <div className="studio-kicker">Local collection workspace</div>
          <h1>Archive Studio</h1>
        </div>
        <div className="studio-status-cluster">
          <span className={`studio-status${serviceStatus === 'online' ? ' studio-status--safe' : ''}`}>
            <ShieldCheck size={15} />
            {serviceStatus === 'checking' ? 'Checking local API' : serviceStatus === 'online' ? 'Local API online' : 'Local API offline'}
          </span>
          <span className="studio-status">No publish</span>
          <span className="studio-status">No source writes</span>
        </div>
      </header>

      <section className="studio-context-bar" aria-label="Current creation profile">
        <div className="studio-context-item">
          <span>Board</span>
          <strong>Music</strong>
        </div>
        <div className="studio-context-item">
          <span>Kind</span>
          <strong>Album</strong>
        </div>
        <div className="studio-context-item">
          <span>Mode</span>
          <strong>Create</strong>
        </div>
        <div className="studio-context-state">
          <span className={`studio-state-dot${isDirty ? ' is-dirty' : ''}`} />
          {createStatus === 'success'
            ? 'Entry created'
            : preflightResult?.ok
              ? 'Preflight passed'
              : previewReady
                ? 'Preview ready'
                : isDirty
                  ? 'Unsaved draft'
                  : 'Pristine'}
        </div>
      </section>

      <div className="studio-workspace">
        <div className="studio-editor-column">
          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>01</span>
                <h2>Album details</h2>
              </div>
              <p>Only the fields needed for a new Music album entry.</p>
            </div>

            <div className="studio-form-grid">
              <label className="studio-field studio-field--wide">
                <span>Title <b>Required</b></span>
                <input
                  value={form.title}
                  onChange={event => updateField('title', event.target.value)}
                  placeholder="Album title"
                />
              </label>

              <label className="studio-field">
                <span>Date or year</span>
                <input
                  value={form.date}
                  onChange={event => updateField('date', event.target.value)}
                  placeholder="2026"
                />
              </label>

              <label className="studio-field">
                <span>External URL</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={event => updateField('url', event.target.value)}
                  placeholder="https://"
                />
              </label>

              <label className="studio-field studio-field--wide">
                <span>Entry ID <b>Generated</b></span>
                <input
                  value={form.entryId}
                  onChange={event => updateField('entryId', event.target.value.toLowerCase())}
                  placeholder={suggestedEntryId}
                />
                <small>Suggested from title. Lowercase letters, numbers, and hyphens only.</small>
              </label>

              <label className="studio-field studio-field--wide">
                <span>Note</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={event => updateField('note', event.target.value)}
                  placeholder="Optional working note"
                />
              </label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>02</span>
                <h2>Assets</h2>
              </div>
              <p>Files remain local until preview and preflight both pass.</p>
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
                <span className="studio-asset-label">Cover</span>
                <strong>{form.cover?.name ?? 'Choose image'}</strong>
                <small>{formatFileSize(form.cover)} · JPG, PNG, or WebP</small>
              </label>

              <label className={`studio-asset-picker${form.audio ? ' has-file' : ''}`}>
                <input
                  type="file"
                  key={`audio-${fileInputVersion}`}
                  accept=".mp3,.wav,.flac,.m4a,.ogg,.aac"
                  onChange={event => updateFile('audio', event.target.files?.[0] ?? null)}
                />
                <FileAudio size={24} />
                <span className="studio-asset-label">Audio</span>
                <strong>{form.audio?.name ?? 'Choose audio'}</strong>
                <small>{formatFileSize(form.audio)} · MP3, FLAC, M4A, or WAV</small>
              </label>
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-heading">
              <div>
                <span>03</span>
                <h2>Markdown content</h2>
              </div>
              <p>Saved as content.md without automatic rewriting.</p>
            </div>

            <label className="studio-field studio-field--wide">
              <span>Content</span>
              <textarea
                className="studio-markdown-input"
                rows={12}
                value={form.content}
                onChange={event => updateField('content', event.target.value)}
                placeholder="Write notes, a track list, or a short description in Markdown."
              />
              <small>{form.content.length} characters · {form.content ? form.content.split(/\r\n|\r|\n/).length : 0} lines</small>
            </label>
          </section>
        </div>

        <aside className="studio-preview-column">
          <section className="studio-preview-panel">
            <div className="studio-preview-title">
              <FolderTree size={19} />
              <div>
                <span>Write preview</span>
                <strong>[ArchiveData-v2]</strong>
              </div>
            </div>

            <div className="studio-preview-id">
              <span>Entry ID</span>
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
                    {operation.status === 'ready' ? 'Ready' : 'Pending'}
                  </i>
                </div>
              ))}
            </div>

            <div className="studio-check-block">
              <div>
                <SearchCheck size={17} />
                <strong>Target conflict</strong>
              </div>
              <span>
                {preflightStatus === 'loading'
                  ? 'Checking ArchiveData-v2 target...'
                  : preflightResult
                    ? preflightResult.targetEntryExists
                      ? 'Conflict: target entry already exists'
                      : 'No target entry conflict detected'
                    : 'Run preflight after preview'}
              </span>
            </div>

            <div className="studio-check-block studio-check-block--action">
              <div>
                <ShieldCheck size={17} />
                <strong>Music v2 structure</strong>
              </div>
              <button type="button" onClick={runMusicCheck} disabled={musicCheckStatus === 'loading' || serviceStatus === 'offline'}>
                {musicCheckStatus === 'loading' ? 'Checking...' : 'Run check'}
              </button>
              {musicCheckResult ? (
                <span>
                  {musicCheckResult.ok ? 'Passed' : 'Needs review'} · {musicCheckResult.albumEntryDirs} entries · {musicCheckResult.malformedEntryDirs} malformed
                </span>
              ) : null}
            </div>

            {preflightResult ? (
              <div className={`studio-validation${preflightResult.ok ? ' is-valid' : ' has-errors'}`}>
                <div>
                  {preflightResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <strong>{preflightResult.ok ? 'Preflight passed' : 'Preflight blocked'}</strong>
                </div>
                <p>
                  Target files: {preflightResult.targetFilesExisting} · planned writes: {preflightResult.dryRun.writeItems} · write scope: {preflightResult.writeScope}
                </p>
                {preflightResult.blockedReasons.length ? (
                  <ul>
                    {preflightResult.blockedReasons.map(reason => <li key={reason}>{reason}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {createStatus !== 'idle' ? (
              <div className={`studio-validation${createStatus === 'success' ? ' is-valid' : createStatus === 'error' ? ' has-errors' : ''}`}>
                <div>
                  {createStatus === 'success' ? <CheckCircle2 size={18} /> : createStatus === 'error' ? <AlertCircle size={18} /> : <Sparkles size={18} />}
                  <strong>
                    {createStatus === 'loading' ? 'Creating entry' : createStatus === 'success' ? 'Entry created' : 'Create failed'}
                  </strong>
                </div>
                {createResult ? (
                  <p>
                    {createResult.entryRelativeDir} · {createResult.createdEntryFiles} entry files · Music v2 check {createResult.check.ok ? 'passed' : 'failed'} · source unchanged
                  </p>
                ) : requestError ? <p>{requestError}</p> : null}
              </div>
            ) : null}

            {previewRequested ? (
              <div className={`studio-validation${previewReady ? ' is-valid' : ' has-errors'}`}>
                <div>
                  {previewReady ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <strong>
                    {previewStatus === 'loading' ? 'Generating preview' : previewReady ? 'API preview ready' : 'Preview blocked'}
                  </strong>
                </div>
                {requestError ? <p>{requestError}</p> : null}
                {previewStatus !== 'loading' && (previewResult?.errors.length || validation.length) ? (
                  <ul>
                    {(previewResult?.errors.map(error => error.message) ?? validation).map(error => <li key={error}>{error}</li>)}
                  </ul>
                ) : null}
                {previewReady ? <p>Preview API passed. No files were written.</p> : null}
                {previewResult?.warnings.map(warning => <p key={warning.code}>{warning.message}</p>)}
              </div>
            ) : (
              <div className="studio-preview-placeholder">
                Generate a preview to validate the draft and file roles.
              </div>
            )}
          </section>
        </aside>
      </div>

      <footer className="studio-actionbar">
        <div className="studio-action-summary">
          <span>{createStatus === 'success' ? 'Entry saved' : isDirty ? 'Draft changed' : 'No draft changes'}</span>
          <small>{createAvailable ? 'Create writes only to ArchiveData-v2. Publishing is unavailable.' : 'Local create service is unavailable.'}</small>
        </div>
        <div className="studio-actions">
          <button className="studio-button studio-button--quiet" type="button" onClick={resetForm}>
            <RefreshCcw size={16} /> Reset
          </button>
          <button className="studio-button studio-button--secondary" type="button" onClick={generatePreview}>
            <SearchCheck size={16} /> {previewStatus === 'loading' ? 'Generating...' : 'Generate preview'}
          </button>
          <button
            className="studio-button studio-button--secondary"
            type="button"
            onClick={runPreflight}
            disabled={!previewReady || preflightStatus === 'loading'}
          >
            <ShieldCheck size={16} /> {preflightStatus === 'loading' ? 'Checking...' : 'Run preflight'}
          </button>
          <button
            className="studio-button studio-button--primary"
            type="button"
            onClick={createEntry}
            disabled={!createReady}
          >
            {createStatus === 'loading' ? 'Creating...' : createStatus === 'success' ? 'Entry created' : 'Create entry'}
          </button>
        </div>
      </footer>
    </main>
  )
}
