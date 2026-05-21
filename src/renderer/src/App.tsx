import { useEffect, useMemo, useState } from 'react'
import type { Category } from '../../shared/types'
import { Icon } from './components/Icon'
import { Onboarding } from './components/Onboarding'
import { ReduxCard } from './components/ReduxCard'
import { SettingsModal } from './components/SettingsModal'
import { AdminModal } from './components/AdminModal'
import { Toasts } from './components/Toasts'
import { categoriesSorted, useLauncherStore } from './hooks/useLauncherStore'

const INSTALLED_VIEW = '__installed__'

function App(): React.JSX.Element {
  const store = useLauncherStore()
  const {
    config,
    data,
    installed,
    loadingData,
    dataError,
    reloadData,
    reloadInstalled,
    reloadConfig,
    updateConfig,
    installRedux,
    uninstallRedux,
    pushToast,
    dismissToast,
    toasts,
    busy
  } = store

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  // Apply accent color to the root element.
  useEffect(() => {
    if (config?.accentColor) {
      document.documentElement.style.setProperty('--accent', config.accentColor)
    }
  }, [config?.accentColor])

  const installedById = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const it of installed) m.set(it.reduxId, true)
    return m
  }, [installed])

  async function pickGtaFolder(): Promise<void> {
    const picked = await window.api.config.pickGtaFolder()
    if (picked) {
      await reloadConfig()
      pushToast({ kind: 'success', title: 'GTA folder set', body: picked })
    }
  }

  if (!config) {
    return (
      <div className="onboard">
        <span className="spinner" />
      </div>
    )
  }

  if (!config.gtaRootPath) {
    return <Onboarding onPickFolder={pickGtaFolder} />
  }

  const categories: Category[] = categoriesSorted(data?.categories ?? [])
  const reduxes = data?.reduxes ?? []

  const filteredReduxes =
    activeCategory === 'all'
      ? reduxes
      : activeCategory === INSTALLED_VIEW
        ? reduxes.filter((r) => installedById.has(r.id))
        : reduxes.filter((r) => r.categoryId === activeCategory)

  const showInstalledTab = installed.length > 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          GTA 5 RP Redux Launcher
        </div>
        <div className="spacer" />
        <div className="actions">
          <button
            className="icon-btn has-label"
            onClick={() => window.api.install.openGtaFolder()}
            title="Open GTA folder"
          >
            <Icon name="open" /> GTA folder
          </button>
          <button
            className="icon-btn has-label"
            onClick={() => void reloadData()}
            title="Refresh catalog"
            disabled={loadingData}
          >
            {loadingData ? <span className="spinner" /> : <Icon name="refresh" />} Refresh
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <Icon name="settings" />
          </button>
          <button
            className="icon-btn primary has-label"
            onClick={() => setAdminOpen(true)}
            title="Admin panel"
          >
            <Icon name="shield" /> Admin
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-header">Categories</div>
        <nav className="sidebar-list">
          <button
            className={`sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <span>All reduxes</span>
            <span className="count">{reduxes.length}</span>
          </button>
          {showInstalledTab && (
            <button
              className={`sidebar-item ${activeCategory === INSTALLED_VIEW ? 'active' : ''}`}
              onClick={() => setActiveCategory(INSTALLED_VIEW)}
            >
              <span>Installed</span>
              <span className="count">{installed.length}</span>
            </button>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
            >
              <span>{c.name}</span>
              <span className="count">{reduxes.filter((r) => r.categoryId === c.id).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-meta" title={config.gtaRootPath ?? ''}>
            GTA folder:
            <br />
            <span style={{ color: 'var(--text-1)' }}>{config.gtaRootPath}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-header">
          <h1>
            {activeCategory === 'all'
              ? 'All reduxes'
              : activeCategory === INSTALLED_VIEW
                ? 'Installed'
                : categories.find((c) => c.id === activeCategory)?.name}
          </h1>
          <div className="subtitle">
            {filteredReduxes.length} {filteredReduxes.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        {dataError && (
          <div className="empty-state">
            <div className="glyph">⚠️</div>
            <div>Could not load catalog: {dataError}</div>
            <button className="btn" onClick={() => void reloadData()}>
              <Icon name="refresh" /> Try again
            </button>
          </div>
        )}

        {!dataError && filteredReduxes.length === 0 && (
          <div className="empty-state">
            <div className="glyph">📭</div>
            {loadingData ? (
              <div>Loading catalog…</div>
            ) : reduxes.length === 0 ? (
              <>
                <div>The catalog is empty yet.</div>
                <div className="hint">
                  Open <strong>Admin</strong> to add categories and publish your first redux.
                </div>
              </>
            ) : (
              <div>Nothing in this category.</div>
            )}
          </div>
        )}

        {!dataError && filteredReduxes.length > 0 && (
          <div className="cards">
            {filteredReduxes.map((r) => (
              <ReduxCard
                key={r.id}
                redux={r}
                installed={installedById.has(r.id)}
                busy={busy[r.id]}
                onInstall={() => void installRedux(r)}
                onUninstall={() => void uninstallRedux(r.id)}
              />
            ))}
          </div>
        )}

        {activeCategory === INSTALLED_VIEW && installed.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="main-header" style={{ marginBottom: 8 }}>
              <h1 style={{ fontSize: 16 }}>Installation log</h1>
              <div className="subtitle">Files touched on disk — reverting restores originals.</div>
            </div>
            {installed.map((it) => (
              <div className="installed-row" key={it.reduxId}>
                <div className="meta">
                  <div className="name">{it.name}</div>
                  <div className="sub">
                    {new Date(it.installedAt).toLocaleString()} · {it.files.length} files{' '}
                    {it.version && `· v${it.version}`}
                  </div>
                </div>
                <button
                  className="btn danger"
                  onClick={() => void uninstallRedux(it.reduxId)}
                  disabled={Boolean(busy[it.reduxId])}
                >
                  {busy[it.reduxId] === 'uninstall' ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="undo" />
                  )}
                  Revert
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsModal
          config={config}
          onClose={() => setSettingsOpen(false)}
          onUpdate={updateConfig}
          onPickGtaFolder={pickGtaFolder}
        />
      )}

      {adminOpen && (
        <AdminModal
          config={config}
          data={data}
          onClose={() => setAdminOpen(false)}
          onUpdate={updateConfig}
          onDataChanged={async () => {
            await reloadData()
            await reloadInstalled()
          }}
          pushToast={pushToast}
        />
      )}

      <Toasts toasts={toasts} dismiss={dismissToast} />
    </div>
  )
}

export default App
