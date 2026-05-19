import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import extract from 'extract-zip'
import type { InstalledFile, InstalledRedux, Redux } from '../shared/types'
import { readConfig, readManifest, removeInstalled, upsertInstalled } from './store'

const BACKUP_SUFFIX = '.reduxbak'

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.stat(path)
    return true
  } catch {
    return false
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await fs.stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) out.push(...(await walk(p)))
    else if (ent.isFile()) out.push(p)
  }
  return out
}

async function listDirsInOrder(root: string, extractedRoot: string): Promise<string[]> {
  /**
   * Returns target dirs (deepest first) for every directory inside extractedRoot,
   * mapped to their position under `root`.
   */
  const acc: string[] = []
  async function recur(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) {
        await recur(p)
        const rel = relative(extractedRoot, p)
        acc.push(join(root, rel))
      }
    }
  }
  await recur(extractedRoot)
  // Deepest dirs first so the post-uninstall empty-dir cleanup can unwind correctly.
  return acc.sort((a, b) => b.length - a.length)
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return !rel.startsWith('..') && !resolve(rel).startsWith('..') && !rel.split(sep).includes('..')
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  }
  const ws = createWriteStream(dest)
  // res.body is a web ReadableStream; Node ≥18 can pipe it through pipeline.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pipeline(res.body as unknown as any, ws)
}

export async function installRedux(redux: Redux): Promise<InstalledRedux> {
  const config = await readConfig()
  if (!config.gtaRootPath) {
    throw new Error('GTA root folder is not configured. Please set it in Settings.')
  }
  const gtaRoot = resolve(config.gtaRootPath)
  if (!(await dirExists(gtaRoot))) {
    throw new Error(`GTA root folder does not exist: ${gtaRoot}`)
  }

  // Resolve install target (relative to GTA root). Default = root.
  const targetRoot = resolve(gtaRoot, redux.installTarget || '.')
  if (!isPathInside(gtaRoot, targetRoot) && targetRoot !== gtaRoot) {
    throw new Error('Install target must be inside the GTA root folder.')
  }
  await fs.mkdir(targetRoot, { recursive: true })

  // Stage download + extraction in a tmp dir.
  const stamp = Date.now().toString(36)
  const workDir = join(tmpdir(), `redux-${redux.id}-${stamp}`)
  const zipPath = join(workDir, 'archive.zip')
  const extractedDir = join(workDir, 'extracted')
  await fs.mkdir(extractedDir, { recursive: true })

  try {
    await downloadToFile(redux.downloadUrl, zipPath)
    await extract(zipPath, { dir: extractedDir })

    const stagedFiles = await walk(extractedDir)

    const installed: InstalledFile[] = []
    const createdDirs: string[] = []

    // Track which target dirs already existed so we know what we created.
    const targetDirsInZip = await listDirsInOrder(targetRoot, extractedDir)
    const preexistingDirs = new Set<string>()
    for (const d of targetDirsInZip) {
      if (await dirExists(d)) preexistingDirs.add(d)
    }

    for (const src of stagedFiles) {
      const rel = relative(extractedDir, src)
      const target = join(targetRoot, rel)
      if (!isPathInside(targetRoot, target) && target !== targetRoot) {
        throw new Error(`Refusing to extract outside install target: ${rel}`)
      }
      await fs.mkdir(dirname(target), { recursive: true })

      const hadOriginal = await fileExists(target)
      if (hadOriginal) {
        // Stash the original file so uninstall can roll it back.
        const backup = target + BACKUP_SUFFIX
        // If a stale backup exists, remove it so rename succeeds on Windows.
        if (await fileExists(backup)) {
          await fs.unlink(backup)
        }
        await fs.rename(target, backup)
      }

      await fs.copyFile(src, target)
      installed.push({ path: target, hadOriginal })
    }

    // After extraction, mark any directories under targetRoot that did NOT exist
    // before as "createdDirs" so uninstall can prune empty ones.
    for (const d of targetDirsInZip) {
      if (!preexistingDirs.has(d) && (await dirExists(d))) {
        createdDirs.push(d)
      }
    }

    const entry: InstalledRedux = {
      reduxId: redux.id,
      name: redux.name,
      installedAt: new Date().toISOString(),
      version: redux.version,
      files: installed,
      createdDirs
    }
    await upsertInstalled(entry)
    return entry
  } finally {
    // Best-effort cleanup of staging directory.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function uninstallRedux(reduxId: string): Promise<void> {
  const list = await readManifest()
  const entry = list.find((it) => it.reduxId === reduxId)
  if (!entry) {
    throw new Error(`Redux is not installed: ${reduxId}`)
  }

  // 1. Delete the files we copied in.
  for (const f of entry.files) {
    await fs.unlink(f.path).catch(() => undefined)
  }
  // 2. Restore backups for files that pre-existed.
  for (const f of entry.files) {
    if (f.hadOriginal) {
      const backup = f.path + BACKUP_SUFFIX
      if (await fileExists(backup)) {
        await fs.rename(backup, f.path).catch(() => undefined)
      }
    }
  }
  // 3. Try to remove directories we created (deepest first), but only if empty.
  for (const d of entry.createdDirs) {
    await fs.rmdir(d).catch(() => undefined)
  }
  await removeInstalled(reduxId)
}

export async function openGtaFolder(): Promise<void> {
  const { gtaRootPath } = await readConfig()
  if (!gtaRootPath) return
  const { shell } = await import('electron')
  await shell.openPath(gtaRootPath)
}

export function defaultStagingDir(): string {
  return join(app.getPath('userData'), 'staging')
}
