import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipc'
import type {
  AppConfig,
  InstalledRedux,
  PublishCategoryInput,
  PublishReduxInput,
  Redux,
  RemoteData
} from '../shared/types'
import { readConfig, readManifest, updateConfig } from './store'
import { installRedux, openGtaFolder, uninstallRedux } from './installer'
import {
  deleteCategory,
  deleteRedux,
  ensureBackendInitialized,
  fetchRemoteData,
  publishCategory,
  publishRedux,
  verifyToken
} from './github'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'GTA 5 RP Redux Launcher',
    backgroundColor: '#0d0b14',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

async function pickGtaFolder(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select your GTA V root folder',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const next = result.filePaths[0]
  await updateConfig({ gtaRootPath: next })
  return next
}

interface PickFileArgs {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

async function pickFile(win: BrowserWindow, args: PickFileArgs = {}): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: args.title ?? 'Select a file',
    properties: ['openFile'],
    filters: args.filters
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.configGet, async (): Promise<AppConfig> => readConfig())
  ipcMain.handle(
    IPC.configUpdate,
    async (_e, patch: Partial<AppConfig>): Promise<AppConfig> => updateConfig(patch)
  )
  ipcMain.handle(IPC.pickGtaFolder, async (): Promise<string | null> => {
    const win = getWindow()
    if (!win) return null
    return pickGtaFolder(win)
  })
  ipcMain.handle(IPC.pickFile, async (_e, args: PickFileArgs): Promise<string | null> => {
    const win = getWindow()
    if (!win) return null
    return pickFile(win, args)
  })

  ipcMain.handle(IPC.dataFetch, async (): Promise<RemoteData> => fetchRemoteData())

  ipcMain.handle(
    IPC.installRedux,
    async (_e, redux: Redux): Promise<InstalledRedux> => installRedux(redux)
  )
  ipcMain.handle(
    IPC.uninstallRedux,
    async (_e, reduxId: string): Promise<void> => uninstallRedux(reduxId)
  )
  ipcMain.handle(IPC.installedList, async (): Promise<InstalledRedux[]> => readManifest())
  ipcMain.handle(IPC.openGtaFolder, async (): Promise<void> => openGtaFolder())

  ipcMain.handle(IPC.verifyToken, async (): Promise<{ login: string }> => verifyToken())
  ipcMain.handle(IPC.ensureBackend, async (): Promise<void> => ensureBackendInitialized())
  ipcMain.handle(IPC.publishCategory, async (_e, input: PublishCategoryInput) =>
    publishCategory(input)
  )
  ipcMain.handle(IPC.deleteCategory, async (_e, id: string): Promise<void> => deleteCategory(id))
  ipcMain.handle(IPC.publishRedux, async (_e, input: PublishReduxInput) => publishRedux(input))
  ipcMain.handle(IPC.deleteRedux, async (_e, id: string): Promise<void> => deleteRedux(id))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ywaika.reduxlauncher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()
  registerIpc(() => BrowserWindow.getFocusedWindow() ?? mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
