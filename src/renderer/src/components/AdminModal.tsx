import { useEffect, useState } from 'react'
import type { AppConfig, Category, Redux, RemoteData } from '../../../shared/types'
import { Modal } from './Modal'
import { Icon } from './Icon'

interface AdminModalProps {
  config: AppConfig
  data: RemoteData | null
  onClose: () => void
  onUpdate: (patch: Partial<AppConfig>) => Promise<void>
  onDataChanged: () => Promise<void>
  pushToast: (toast: { kind: 'success' | 'error' | 'info'; title: string; body?: string }) => void
}

type TabKey = 'token' | 'category' | 'redux'

export function AdminModal({
  config,
  data,
  onClose,
  onUpdate,
  onDataChanged,
  pushToast
}: AdminModalProps): React.JSX.Element {
  const [tab, setTab] = useState<TabKey>(config.githubToken ? 'redux' : 'token')

  return (
    <Modal title="Admin panel" onClose={onClose} wide>
      <div className="tabs">
        <button className={tab === 'token' ? 'active' : ''} onClick={() => setTab('token')}>
          GitHub token
        </button>
        <button className={tab === 'category' ? 'active' : ''} onClick={() => setTab('category')}>
          Categories
        </button>
        <button className={tab === 'redux' ? 'active' : ''} onClick={() => setTab('redux')}>
          Publish redux
        </button>
      </div>

      {tab === 'token' && <TokenTab config={config} onUpdate={onUpdate} pushToast={pushToast} />}
      {tab === 'category' && (
        <CategoryTab data={data} onDataChanged={onDataChanged} pushToast={pushToast} />
      )}
      {tab === 'redux' && (
        <ReduxTab data={data} onDataChanged={onDataChanged} pushToast={pushToast} />
      )}
    </Modal>
  )
}

function TokenTab({
  config,
  onUpdate,
  pushToast
}: {
  config: AppConfig
  onUpdate: (patch: Partial<AppConfig>) => Promise<void>
  pushToast: AdminModalProps['pushToast']
}): React.JSX.Element {
  const [token, setToken] = useState(config.githubToken ?? '')
  const [verifying, setVerifying] = useState(false)
  const [identity, setIdentity] = useState<string | null>(null)

  async function save(): Promise<void> {
    setVerifying(true)
    try {
      await onUpdate({ githubToken: token.trim() || undefined })
      if (token.trim()) {
        const { login } = await window.api.admin.verifyToken()
        setIdentity(login)
        await window.api.admin.ensureBackend()
        pushToast({ kind: 'success', title: 'Logged in as ' + login })
      } else {
        setIdentity(null)
      }
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Token check failed',
        body: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
      <div className="field">
        <label>GitHub Personal Access Token (classic, with `repo` scope)</label>
        <input
          type="password"
          value={token}
          placeholder="ghp_..."
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="hint">
          Used only by you, stored locally. Create one at{' '}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
            github.com/settings/tokens
          </a>{' '}
          with the <code>repo</code> scope.
        </div>
      </div>
      <div className="row">
        <button className="btn primary" onClick={save} disabled={verifying}>
          {verifying ? <span className="spinner" /> : <Icon name="check" />}
          {token ? 'Save & verify' : 'Clear token'}
        </button>
        {identity && <div className="hint">Authenticated as @{identity}</div>}
      </div>
    </>
  )
}

function CategoryTab({
  data,
  onDataChanged,
  pushToast
}: {
  data: RemoteData | null
  onDataChanged: () => Promise<void>
  pushToast: AdminModalProps['pushToast']
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function create(): Promise<void> {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await window.api.admin.publishCategory({ name: name.trim() })
      setName('')
      await onDataChanged()
      pushToast({ kind: 'success', title: 'Category created' })
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Failed to create category',
        body: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string, name: string): Promise<void> {
    const ok = window.confirm(
      `Delete category "${name}"? All reduxes inside it will be removed from the catalog too.`
    )
    if (!ok) return
    try {
      await window.api.admin.deleteCategory(id)
      await onDataChanged()
      pushToast({ kind: 'success', title: 'Category deleted' })
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Failed to delete',
        body: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return (
    <>
      <div className="field">
        <label>Create a new category</label>
        <div className="row">
          <input
            value={name}
            placeholder="e.g. Graphics, ENBs, Vehicles..."
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" disabled={submitting || !name.trim()} onClick={create}>
            <Icon name="plus" /> Add
          </button>
        </div>
      </div>

      <div className="field">
        <label>Existing categories</label>
        {!data?.categories.length ? (
          <div className="hint">No categories yet — add one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.categories.map((c) => (
              <div className="installed-row" key={c.id}>
                <div className="meta">
                  <div className="name">{c.name}</div>
                  <div className="sub">
                    {data.reduxes.filter((r) => r.categoryId === c.id).length} reduxes
                  </div>
                </div>
                <button className="icon-btn danger" onClick={() => remove(c.id, c.name)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ReduxTab({
  data,
  onDataChanged,
  pushToast
}: {
  data: RemoteData | null
  onDataChanged: () => Promise<void>
  pushToast: AdminModalProps['pushToast']
}): React.JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [installTarget, setInstallTarget] = useState('')
  const [version, setVersion] = useState('')
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!categoryId && data?.categories[0]) setCategoryId(data.categories[0].id)
  }, [data, categoryId])

  const categories: Category[] = data?.categories ?? []

  async function pickZip(): Promise<void> {
    const p = await window.api.dialog.pickFile({
      title: 'Select redux .zip',
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (p) setZipPath(p)
  }

  async function pickCover(): Promise<void> {
    const p = await window.api.dialog.pickFile({
      title: 'Select cover image',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (p) setCoverPath(p)
  }

  function reset(): void {
    setName('')
    setDescription('')
    setInstallTarget('')
    setVersion('')
    setZipPath(null)
    setCoverPath(null)
  }

  async function publish(): Promise<void> {
    if (!categoryId || !name.trim() || !zipPath) return
    setUploading(true)
    try {
      await window.api.admin.publishRedux({
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        installTarget: installTarget.trim(),
        version: version.trim() || undefined,
        zipPath,
        coverPath: coverPath ?? undefined
      })
      reset()
      await onDataChanged()
      pushToast({ kind: 'success', title: 'Redux published' })
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Publish failed',
        body: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setUploading(false)
    }
  }

  async function deleteOne(id: string, label: string): Promise<void> {
    if (
      !window.confirm(`Remove "${label}" from the catalog? Existing installations are unaffected.`)
    )
      return
    try {
      await window.api.admin.deleteRedux(id)
      await onDataChanged()
      pushToast({ kind: 'success', title: 'Redux removed' })
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Delete failed',
        body: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return (
    <>
      <div className="field">
        <label>Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.length === 0 && <option value="">— no categories yet —</option>}
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Version</label>
          <input value={version} placeholder="1.0.0" onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea
          value={description}
          placeholder="What does this redux do?"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Install target (relative to GTA folder)</label>
        <input
          value={installTarget}
          placeholder='leave empty for GTA root — or e.g. "mods/x64v.rpf"'
          onChange={(e) => setInstallTarget(e.target.value)}
        />
        <div className="hint">
          The contents of the zip will be extracted into this subfolder of the user&apos;s GTA root.
          Use forward slashes.
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Redux .zip</label>
          <div className="path-row">
            <div className="path" title={zipPath ?? ''}>
              {zipPath ?? '— pick a .zip file —'}
            </div>
            <button className="icon-btn has-label" onClick={pickZip}>
              <Icon name="box" /> Pick
            </button>
          </div>
        </div>
        <div className="field">
          <label>Cover image (optional)</label>
          <div className="path-row">
            <div className="path" title={coverPath ?? ''}>
              {coverPath ?? '— pick an image —'}
            </div>
            <button className="icon-btn has-label" onClick={pickCover}>
              <Icon name="image" /> Pick
            </button>
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button
          className="btn primary"
          disabled={uploading || !zipPath || !name.trim() || !categoryId}
          onClick={publish}
        >
          {uploading ? <span className="spinner" /> : <Icon name="download" />}
          Publish redux
        </button>
        <div className="hint">
          The zip is uploaded as a GitHub Release asset on the backend repo, then registered in
          <code> data.json</code>.
        </div>
      </div>

      {data && data.reduxes.length > 0 && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>Catalog</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.reduxes.map((r) => (
              <div className="installed-row" key={r.id}>
                <div className="meta">
                  <div className="name">{r.name}</div>
                  <div className="sub">
                    {categories.find((c) => c.id === r.categoryId)?.name ?? 'Uncategorized'} ·{' '}
                    {r.version ?? '—'}
                  </div>
                </div>
                <button className="icon-btn" aria-label="Edit" onClick={() => setEditingId(r.id)}>
                  <Icon name="edit" />
                </button>
                <button className="icon-btn danger" onClick={() => deleteOne(r.id, r.name)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingId &&
        data &&
        (() => {
          const target = data.reduxes.find((r) => r.id === editingId)
          if (!target) return null
          return (
            <EditReduxModal
              redux={target}
              categories={categories}
              onClose={() => setEditingId(null)}
              onSaved={async () => {
                await onDataChanged()
                setEditingId(null)
              }}
              pushToast={pushToast}
            />
          )
        })()}
    </>
  )
}

function EditReduxModal({
  redux,
  categories,
  onClose,
  onSaved,
  pushToast
}: {
  redux: Redux
  categories: Category[]
  onClose: () => void
  onSaved: () => Promise<void>
  pushToast: AdminModalProps['pushToast']
}): React.JSX.Element {
  const [categoryId, setCategoryId] = useState(redux.categoryId)
  const [name, setName] = useState(redux.name)
  const [description, setDescription] = useState(redux.description ?? '')
  const [installTarget, setInstallTarget] = useState(redux.installTarget)
  const [version, setVersion] = useState(redux.version ?? '')
  const [author, setAuthor] = useState(redux.author ?? '')
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [saving, setSaving] = useState(false)

  async function pickZip(): Promise<void> {
    const p = await window.api.dialog.pickFile({
      title: 'Select replacement .zip',
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (p) setZipPath(p)
  }

  async function pickCover(): Promise<void> {
    const p = await window.api.dialog.pickFile({
      title: 'Select replacement cover',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (p) {
      setCoverPath(p)
      setRemoveCover(false)
    }
  }

  async function save(): Promise<void> {
    if (!name.trim()) return
    setSaving(true)
    try {
      await window.api.admin.updateRedux({
        reduxId: redux.id,
        categoryId,
        name: name.trim(),
        description,
        installTarget,
        version,
        author,
        zipPath: zipPath ?? undefined,
        coverPath: coverPath ?? undefined,
        removeCover: removeCover && !coverPath ? true : undefined
      })
      pushToast({ kind: 'success', title: 'Redux updated' })
      await onSaved()
    } catch (err) {
      pushToast({
        kind: 'error',
        title: 'Update failed',
        body: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit "${redux.name}"`} onClose={onClose} wide>
      <div className="field">
        <label>Category</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Author (optional)</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} />
      </div>
      <div className="field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label>Install target (relative to GTA folder)</label>
        <input value={installTarget} onChange={(e) => setInstallTarget(e.target.value)} />
        <div className="hint">
          Changing this only affects future installations — already-installed copies are unaffected
          until users revert and re-install.
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Replacement .zip (optional)</label>
          <div className="path-row">
            <div className="path" title={zipPath ?? ''}>
              {zipPath ?? '— keep current —'}
            </div>
            <button className="icon-btn has-label" onClick={pickZip}>
              <Icon name="box" /> Pick
            </button>
            {zipPath && (
              <button
                className="icon-btn ghost"
                onClick={() => setZipPath(null)}
                aria-label="Clear"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </div>
        <div className="field">
          <label>Replacement cover (optional)</label>
          <div className="path-row">
            <div className="path" title={coverPath ?? ''}>
              {coverPath ?? (redux.coverUrl && !removeCover ? '— keep current —' : '— none —')}
            </div>
            <button className="icon-btn has-label" onClick={pickCover}>
              <Icon name="image" /> Pick
            </button>
            {coverPath && (
              <button
                className="icon-btn ghost"
                onClick={() => setCoverPath(null)}
                aria-label="Clear"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          {redux.coverUrl && !coverPath && (
            <label className="hint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={removeCover}
                onChange={(e) => setRemoveCover(e.target.checked)}
              />
              Remove existing cover
            </label>
          )}
        </div>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn primary" disabled={saving || !name.trim()} onClick={save}>
          {saving ? <span className="spinner" /> : <Icon name="check" />}
          Save changes
        </button>
        <button className="btn ghost" disabled={saving} onClick={onClose}>
          Cancel
        </button>
        <div className="hint">
          Replacement files are uploaded as new assets on the existing GitHub Release. Old assets
          stay there so anyone who already downloaded the old URL keeps working.
        </div>
      </div>
    </Modal>
  )
}
