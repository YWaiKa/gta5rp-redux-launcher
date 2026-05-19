import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig, InstalledRedux } from '../shared/types'

const DEFAULT_CONFIG: AppConfig = {
  backendRepo: 'YWaiKa/gta5rp-redux-launcher-data',
  accentColor: '#7c3aed'
}

function dataDir(): string {
  return app.getPath('userData')
}

function configPath(): string {
  return join(dataDir(), 'config.json')
}

function manifestPath(): string {
  return join(dataDir(), 'installed.json')
}

async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true })
  await fs.writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
}

export async function readConfig(): Promise<AppConfig> {
  const stored = await readJsonSafe<Partial<AppConfig>>(configPath(), {})
  return { ...DEFAULT_CONFIG, ...stored }
}

export async function writeConfig(next: AppConfig): Promise<void> {
  await writeJson(configPath(), next)
}

export async function updateConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readConfig()
  const next: AppConfig = { ...current, ...patch }
  await writeConfig(next)
  return next
}

export async function readManifest(): Promise<InstalledRedux[]> {
  return readJsonSafe<InstalledRedux[]>(manifestPath(), [])
}

export async function writeManifest(value: InstalledRedux[]): Promise<void> {
  await writeJson(manifestPath(), value)
}

export async function upsertInstalled(entry: InstalledRedux): Promise<void> {
  const list = await readManifest()
  const idx = list.findIndex((it) => it.reduxId === entry.reduxId)
  if (idx >= 0) list[idx] = entry
  else list.push(entry)
  await writeManifest(list)
}

export async function removeInstalled(reduxId: string): Promise<void> {
  const list = await readManifest()
  await writeManifest(list.filter((it) => it.reduxId !== reduxId))
}
