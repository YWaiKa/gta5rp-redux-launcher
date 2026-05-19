import { useState } from 'react'
import type { AppConfig } from '../../../shared/types'
import { Modal } from './Modal'
import { Icon } from './Icon'

const PRESET_COLORS = [
  '#7c3aed', // violet (default)
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#a855f7', // purple
  '#64748b' // slate
]

interface SettingsModalProps {
  config: AppConfig
  onClose: () => void
  onUpdate: (patch: Partial<AppConfig>) => Promise<void>
  onPickGtaFolder: () => Promise<void>
}

export function SettingsModal({
  config,
  onClose,
  onUpdate,
  onPickGtaFolder
}: SettingsModalProps): React.JSX.Element {
  const [accent, setAccent] = useState(config.accentColor)
  const [backendRepo, setBackendRepo] = useState(config.backendRepo)
  const [savingRepo, setSavingRepo] = useState(false)

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="field">
        <label>GTA V root folder</label>
        <div className="path-row">
          <div className="path" title={config.gtaRootPath ?? ''}>
            {config.gtaRootPath ?? 'Not set — pick your GTA installation folder'}
          </div>
          <button className="icon-btn has-label" onClick={onPickGtaFolder}>
            <Icon name="folder" /> Change
          </button>
        </div>
        <div className="hint">
          The folder that contains <code>GTA5.exe</code>. Reduxes are installed relative to this
          folder.
        </div>
      </div>

      <div className="field">
        <label>Accent color</label>
        <div className="color-swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${accent.toLowerCase() === c ? 'active' : ''}`}
              style={{ background: c }}
              aria-label={`Use ${c}`}
              onClick={async () => {
                setAccent(c)
                await onUpdate({ accentColor: c })
              }}
            />
          ))}
        </div>
        <div className="row">
          <input
            type="color"
            value={accent}
            onChange={async (e) => {
              setAccent(e.target.value)
              await onUpdate({ accentColor: e.target.value })
            }}
            style={{ maxWidth: 64, padding: 4, cursor: 'pointer' }}
          />
          <input
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            onBlur={() => void onUpdate({ accentColor: accent })}
          />
        </div>
        <div className="hint">Pick from a preset or use any custom HEX color.</div>
      </div>

      <div className="field">
        <label>Backend repository</label>
        <div className="row">
          <input
            value={backendRepo}
            placeholder="owner/repo"
            onChange={(e) => setBackendRepo(e.target.value)}
          />
          <button
            className="btn"
            disabled={savingRepo || backendRepo === config.backendRepo}
            onClick={async () => {
              setSavingRepo(true)
              try {
                await onUpdate({ backendRepo: backendRepo.trim() })
              } finally {
                setSavingRepo(false)
              }
            }}
          >
            Save
          </button>
        </div>
        <div className="hint">
          GitHub repo (`owner/repo`) that hosts <code>data.json</code> and release assets.
        </div>
      </div>
    </Modal>
  )
}
