import type { Toast } from '../hooks/useLauncherStore'
import { Icon } from './Icon'

interface ToastsProps {
  toasts: Toast[]
  dismiss: (id: number) => void
}

export function Toasts({ toasts, dismiss }: ToastsProps): React.JSX.Element {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div className={`toast ${t.kind}`} key={t.id}>
          <div style={{ flex: 1 }}>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
          <button className="icon-btn ghost" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
