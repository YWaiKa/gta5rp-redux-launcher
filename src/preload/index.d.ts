import { ElectronAPI } from '@electron-toolkit/preload'
import type { LauncherApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: LauncherApi
  }
}
