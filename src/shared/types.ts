export interface Category {
  id: string
  name: string
  order?: number
}

export interface Redux {
  id: string
  categoryId: string
  name: string
  description?: string
  coverUrl?: string
  /**
   * URL pointing to the redux zip archive (typically a GitHub Release asset).
   */
  downloadUrl: string
  /**
   * Path relative to the GTA root folder where the archive's contents will be
   * extracted. An empty string means "extract into the root of the GTA folder".
   */
  installTarget: string
  version?: string
  uploadedAt?: string
  fileSize?: number
  author?: string
}

export interface RemoteData {
  categories: Category[]
  reduxes: Redux[]
  updatedAt?: string
}

/**
 * A file that the installer touched while installing a redux. Used to roll
 * the installation back on uninstall.
 */
export interface InstalledFile {
  /** Absolute path of the installed file on disk. */
  path: string
  /**
   * If true, this file existed before installation and was renamed to
   * `${path}.reduxbak`. On uninstall we must restore the backup.
   */
  hadOriginal: boolean
}

export interface InstalledRedux {
  reduxId: string
  /** Redux name at the time of installation (kept locally so we can show it even if remote data changes). */
  name: string
  installedAt: string
  version?: string
  /** Files that were created or replaced. */
  files: InstalledFile[]
  /** Directories that we created (used to clean up on uninstall). */
  createdDirs: string[]
}

export interface AppConfig {
  gtaRootPath?: string
  /** GitHub backend repository — "owner/repo". */
  backendRepo: string
  /** GitHub Personal Access Token used by admins to upload reduxes. */
  githubToken?: string
  /** UI accent color, e.g. "#7c3aed". */
  accentColor: string
  /** Optional: cached remote data for offline browsing. */
  cachedData?: RemoteData
}

export interface GithubReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export type InstallProgressEvent =
  | { kind: 'downloading'; reduxId: string; received: number; total: number }
  | { kind: 'extracting'; reduxId: string }
  | { kind: 'done'; reduxId: string }
  | { kind: 'error'; reduxId: string; message: string }

/**
 * Inputs accepted by the admin-only "publish redux" workflow. The launcher
 * uploads the zip + cover as a GitHub Release, then patches data.json in the
 * backend repo so every user sees the new entry.
 */
export interface PublishReduxInput {
  categoryId: string
  name: string
  description?: string
  installTarget: string
  version?: string
  author?: string
  /** Local absolute path to the redux .zip file. */
  zipPath: string
  /** Local absolute path to a cover image (jpg/png), optional. */
  coverPath?: string
}

export interface PublishCategoryInput {
  name: string
  order?: number
}

/**
 * Inputs for editing an already-published redux. Any field left as `undefined`
 * keeps its existing value. Pass a new `zipPath` / `coverPath` to upload a
 * replacement asset to the existing GitHub Release; pass `removeCover: true`
 * to drop the cover image from the catalog entry.
 */
export interface UpdateReduxInput {
  reduxId: string
  categoryId?: string
  name?: string
  description?: string
  installTarget?: string
  version?: string
  author?: string
  zipPath?: string
  coverPath?: string
  removeCover?: boolean
}
