import type { Redux } from '../../../shared/types'
import { formatBytes } from '../hooks/useLauncherStore'
import { Icon } from './Icon'

interface ReduxCardProps {
  redux: Redux
  installed: boolean
  busy?: 'install' | 'uninstall'
  onInstall: () => void
  onUninstall: () => void
}

export function ReduxCard({
  redux,
  installed,
  busy,
  onInstall,
  onUninstall
}: ReduxCardProps): React.JSX.Element {
  return (
    <div className="card">
      <div className="card-cover">
        {redux.coverUrl ? (
          <img src={redux.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className="cover-placeholder">No cover</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-title">{redux.name}</h3>
          {redux.version && <span className="card-version">v{redux.version}</span>}
        </div>
        {redux.description && <div className="card-desc">{redux.description}</div>}
        <div className="card-meta">
          <span title="Install target">
            <Icon name="folder" size={12} /> {redux.installTarget ? redux.installTarget : '/'}
          </span>
          <span title="Size">{formatBytes(redux.fileSize)}</span>
          {redux.author && <span>@{redux.author}</span>}
        </div>
        <div className="card-actions">
          {installed ? (
            <button
              className="btn danger"
              onClick={onUninstall}
              disabled={Boolean(busy)}
              title="Revert this redux and restore originals"
            >
              {busy === 'uninstall' ? <span className="spinner" /> : <Icon name="undo" />}
              Revert
            </button>
          ) : (
            <button className="btn primary" onClick={onInstall} disabled={Boolean(busy)}>
              {busy === 'install' ? <span className="spinner" /> : <Icon name="download" />}
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
