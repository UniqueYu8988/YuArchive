import { useMemo, useState } from 'react'
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
  const [isDirty, setIsDirty] = useState(false)
  const [previewRequested, setPreviewRequested] = useState(false)

  const coverExtension = getExtension(form.cover)
  const audioExtension = getExtension(form.audio)
  const suggestedEntryId = useMemo(() => slugifyTitle(form.title), [form.title])
  const effectiveEntryId = form.entryId || suggestedEntryId

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
      { role: 'Transaction manifest', relativePath: `.studio/transactions/${effectiveEntryId}.json`, status: 'pending' },
    ]
  }, [audioExtension, coverExtension, effectiveEntryId, form.audio, form.cover])

  const updateField = (field: keyof Omit<FormState, 'cover' | 'audio'>, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setIsDirty(true)
    setPreviewRequested(false)
  }

  const updateFile = (field: 'cover' | 'audio', file: File | null) => {
    setForm(current => ({ ...current, [field]: file }))
    setIsDirty(true)
    setPreviewRequested(false)
  }

  const resetForm = () => {
    setForm(initialForm)
    setIsDirty(false)
    setPreviewRequested(false)
  }

  const generatePreview = () => {
    if (!form.entryId) {
      setForm(current => ({ ...current, entryId: suggestedEntryId }))
    }
    setPreviewRequested(true)
  }

  const previewReady = previewRequested && validation.length === 0

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div>
          <div className="studio-kicker">Local collection workspace</div>
          <h1>Archive Studio</h1>
        </div>
        <div className="studio-status-cluster">
          <span className="studio-status studio-status--safe"><ShieldCheck size={15} /> Read-only UI</span>
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
          {previewReady ? 'Preview ready' : isDirty ? 'Unsaved draft' : 'Pristine'}
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
              <p>Files stay in the browser until a future create API is enabled.</p>
            </div>

            <div className="studio-asset-grid">
              <label className={`studio-asset-picker${form.cover ? ' has-file' : ''}`}>
                <input
                  type="file"
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
              <p>Stored later as content.md without automatic rewriting.</p>
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
              <span>Waiting for local preflight API</span>
            </div>

            {previewRequested ? (
              <div className={`studio-validation${validation.length ? ' has-errors' : ' is-valid'}`}>
                <div>
                  {validation.length ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  <strong>{validation.length ? 'Preview blocked' : 'Local preview ready'}</strong>
                </div>
                {validation.length ? (
                  <ul>
                    {validation.map(error => <li key={error}>{error}</li>)}
                  </ul>
                ) : (
                  <p>All browser-side checks passed. No files were written.</p>
                )}
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
          <span>{isDirty ? 'Draft changed' : 'No draft changes'}</span>
          <small>Real write capability is disabled in this version.</small>
        </div>
        <div className="studio-actions">
          <button className="studio-button studio-button--quiet" type="button" onClick={resetForm}>
            <RefreshCcw size={16} /> Reset
          </button>
          <button className="studio-button studio-button--secondary" type="button" onClick={generatePreview}>
            <SearchCheck size={16} /> Generate preview
          </button>
          <button className="studio-button studio-button--primary" type="button" disabled>
            Create entry
          </button>
        </div>
      </footer>
    </main>
  )
}
