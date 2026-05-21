import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/ipc'
import type {
  AppConfig,
  InstalledRedux,
  PublishCategoryInput,
  PublishReduxInput,
  Redux,
  RemoteData,
  Category,
  UpdateReduxInput
} from '../shared/types'

interface PickFileArgs {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
    update: (patch: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke(IPC.configUpdate, patch),
    pickGtaFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.pickGtaFolder)
  },
  dialog: {
    pickFile: (args?: PickFileArgs): Promise<string | null> =>
      ipcRenderer.invoke(IPC.pickFile, args ?? {})
  },
  data: {
    fetch: (): Promise<RemoteData> => ipcRenderer.invoke(IPC.dataFetch)
  },
  install: {
    install: (redux: Redux): Promise<InstalledRedux> => ipcRenderer.invoke(IPC.installRedux, redux),
    uninstall: (reduxId: string): Promise<void> => ipcRenderer.invoke(IPC.uninstallRedux, reduxId),
    list: (): Promise<InstalledRedux[]> => ipcRenderer.invoke(IPC.installedList),
    openGtaFolder: (): Promise<void> => ipcRenderer.invoke(IPC.openGtaFolder)
  },
  admin: {
    verifyToken: (): Promise<{ login: string }> => ipcRenderer.invoke(IPC.verifyToken),
    ensureBackend: (): Promise<void> => ipcRenderer.invoke(IPC.ensureBackend),
    publishCategory: (input: PublishCategoryInput): Promise<Category> =>
      ipcRenderer.invoke(IPC.publishCategory, input),
    deleteCategory: (id: string): Promise<void> => ipcRenderer.invoke(IPC.deleteCategory, id),
    publishRedux: (
      input: PublishReduxInput
    ): Promise<{ downloadUrl: string; coverUrl?: string; id: string }> =>
      ipcRenderer.invoke(IPC.publishRedux, input),
    updateRedux: (input: UpdateReduxInput): Promise<{ downloadUrl?: string; coverUrl?: string }> =>
      ipcRenderer.invoke(IPC.updateRedux, input),
    deleteRedux: (id: string): Promise<void> => ipcRenderer.invoke(IPC.deleteRedux, id)
  }
}

export type LauncherApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
