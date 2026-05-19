import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig, Category, InstalledRedux, Redux, RemoteData } from '../../../shared/types'

interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  title: string
  body?: string
}

interface LauncherStore {
  config: AppConfig | null
  data: RemoteData | null
  installed: InstalledRedux[]
  loadingData: boolean
  dataError: string | null
  toasts: Toast[]
  reloadData: () => Promise<void>
  reloadInstalled: () => Promise<void>
  reloadConfig: () => Promise<void>
  updateConfig: (patch: Partial<AppConfig>) => Promise<void>
  installRedux: (redux: Redux) => Promise<void>
  uninstallRedux: (reduxId: string) => Promise<void>
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  /** True when a particular redux is currently being installed/uninstalled. */
  busy: Record<string, 'install' | 'uninstall' | undefined>
}

export function useLauncherStore(): LauncherStore {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [data, setData] = useState<RemoteData | null>(null)
  const [installed, setInstalled] = useState<InstalledRedux[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [busy, setBusy] = useState<Record<string, 'install' | 'uninstall' | undefined>>({})

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5500)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const reloadConfig = useCallback(async () => {
    const c = await window.api.config.get()
    setConfig(c)
  }, [])

  const reloadInstalled = useCallback(async () => {
    const list = await window.api.install.list()
    setInstalled(list)
  }, [])

  const reloadData = useCallback(async () => {
    setLoadingData(true)
    setDataError(null)
    try {
      const fresh = await window.api.data.fetch()
      setData(fresh)
    } catch (err) {
      setDataError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingData(false)
    }
  }, [])

  const updateConfigPatch = useCallback(async (patch: Partial<AppConfig>) => {
    const next = await window.api.config.update(patch)
    setConfig(next)
  }, [])

  const installRedux = useCallback(
    async (redux: Redux) => {
      setBusy((prev) => ({ ...prev, [redux.id]: 'install' }))
      try {
        await window.api.install.install(redux)
        await reloadInstalled()
        pushToast({ kind: 'success', title: 'Installed', body: redux.name })
      } catch (err) {
        pushToast({
          kind: 'error',
          title: 'Install failed',
          body: err instanceof Error ? err.message : String(err)
        })
      } finally {
        setBusy((prev) => {
          const next = { ...prev }
          delete next[redux.id]
          return next
        })
      }
    },
    [pushToast, reloadInstalled]
  )

  const uninstallRedux = useCallback(
    async (reduxId: string) => {
      const name = installed.find((it) => it.reduxId === reduxId)?.name ?? reduxId
      setBusy((prev) => ({ ...prev, [reduxId]: 'uninstall' }))
      try {
        await window.api.install.uninstall(reduxId)
        await reloadInstalled()
        pushToast({ kind: 'success', title: 'Reverted', body: name })
      } catch (err) {
        pushToast({
          kind: 'error',
          title: 'Uninstall failed',
          body: err instanceof Error ? err.message : String(err)
        })
      } finally {
        setBusy((prev) => {
          const next = { ...prev }
          delete next[reduxId]
          return next
        })
      }
    },
    [installed, pushToast, reloadInstalled]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadConfig()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadInstalled()
  }, [reloadConfig, reloadInstalled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (config?.gtaRootPath) void reloadData()
  }, [config?.gtaRootPath, reloadData])

  return useMemo(
    () => ({
      config,
      data,
      installed,
      loadingData,
      dataError,
      toasts,
      reloadData,
      reloadInstalled,
      reloadConfig,
      updateConfig: updateConfigPatch,
      installRedux,
      uninstallRedux,
      pushToast,
      dismissToast,
      busy
    }),
    [
      config,
      data,
      installed,
      loadingData,
      dataError,
      toasts,
      reloadData,
      reloadInstalled,
      reloadConfig,
      updateConfigPatch,
      installRedux,
      uninstallRedux,
      pushToast,
      dismissToast,
      busy
    ]
  )
}

export function categoriesSorted(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

export function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export type { Toast }
