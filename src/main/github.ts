import { promises as fs } from 'node:fs'
import { basename, extname } from 'node:path'
import type {
  Category,
  PublishCategoryInput,
  PublishReduxInput,
  Redux,
  RemoteData,
  UpdateReduxInput
} from '../shared/types'
import { readConfig, updateConfig } from './store'

const GH_API = 'https://api.github.com'
const GH_UPLOAD = 'https://uploads.github.com'

interface RepoSlug {
  owner: string
  repo: string
}

function parseRepo(slug: string): RepoSlug {
  const [owner, repo] = slug.split('/')
  if (!owner || !repo) throw new Error(`Invalid backend repo: "${slug}"`)
  return { owner, repo }
}

interface ContentsResponse {
  sha: string
  content: string
  encoding: 'base64'
}

async function ghRequest<T>(
  url: string,
  init: { method?: string; token?: string; body?: BodyInit; headers?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers ?? {})
  }
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  const res = await fetch(url, { method: init.method ?? 'GET', headers, body: init.body })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub ${init.method ?? 'GET'} ${url} failed: ${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as unknown as T
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as unknown as T
}

function emptyData(): RemoteData {
  return { categories: [], reduxes: [], updatedAt: new Date().toISOString() }
}

export async function fetchRemoteData(): Promise<RemoteData> {
  const { backendRepo } = await readConfig()
  const { owner, repo } = parseRepo(backendRepo)
  // Use the raw CDN with a cache-buster so users always see fresh data.
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/data.json?t=${Date.now()}`
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } })
    if (res.status === 404) {
      return emptyData()
    }
    if (!res.ok) throw new Error(`Failed to fetch data.json: ${res.status}`)
    const json = (await res.json()) as RemoteData
    // Cache for offline use.
    await updateConfig({ cachedData: json })
    return json
  } catch (err) {
    const { cachedData } = await readConfig()
    if (cachedData) return cachedData
    throw err
  }
}

async function getDataFileSha(
  slug: RepoSlug,
  token: string
): Promise<{ sha?: string; data: RemoteData }> {
  try {
    const res = await ghRequest<ContentsResponse>(
      `${GH_API}/repos/${slug.owner}/${slug.repo}/contents/data.json`,
      { token }
    )
    const decoded = Buffer.from(res.content, 'base64').toString('utf-8')
    const data = JSON.parse(decoded) as RemoteData
    return { sha: res.sha, data }
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return { data: emptyData() }
    }
    throw err
  }
}

async function putContents(
  slug: RepoSlug,
  token: string,
  path: string,
  contentBase64: string,
  message: string,
  sha?: string
): Promise<void> {
  await ghRequest(`${GH_API}/repos/${slug.owner}/${slug.repo}/contents/${path}`, {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: contentBase64,
      sha,
      branch: 'main'
    })
  })
}

interface CreatedRelease {
  id: number
  upload_url: string
  html_url: string
}

interface UploadedAsset {
  browser_download_url: string
  size: number
}

async function createRelease(
  slug: RepoSlug,
  token: string,
  tag: string,
  name: string
): Promise<CreatedRelease> {
  return ghRequest<CreatedRelease>(`${GH_API}/repos/${slug.owner}/${slug.repo}/releases`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      name,
      body: `Auto-uploaded by Redux Launcher at ${new Date().toISOString()}`,
      draft: false,
      prerelease: false
    })
  })
}

async function uploadReleaseAsset(
  slug: RepoSlug,
  token: string,
  releaseId: number,
  filePath: string,
  assetName: string
): Promise<UploadedAsset> {
  const buf = await fs.readFile(filePath)
  // Web fetch wants a Uint8Array body, not a Node Buffer.
  const body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  const url = `${GH_UPLOAD}/repos/${slug.owner}/${slug.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(
    assetName
  )}`
  return ghRequest<UploadedAsset>(url, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/octet-stream' },
    body
  })
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function ensureBackendInitialized(): Promise<void> {
  const { backendRepo, githubToken } = await readConfig()
  if (!githubToken) throw new Error('GitHub token required to initialize the backend.')
  const slug = parseRepo(backendRepo)
  const { sha, data } = await getDataFileSha(slug, githubToken)
  if (sha) return
  await putContents(
    slug,
    githubToken,
    'data.json',
    Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    'Initialize redux launcher data.json'
  )
}

async function withDataJson<T>(
  fn: (data: RemoteData) => Promise<{ next: RemoteData; result: T; message: string }>
): Promise<T> {
  const { backendRepo, githubToken } = await readConfig()
  if (!githubToken) throw new Error('GitHub token required for admin actions.')
  const slug = parseRepo(backendRepo)
  const { sha, data } = await getDataFileSha(slug, githubToken)
  const { next, result, message } = await fn(data)
  next.updatedAt = new Date().toISOString()
  await putContents(
    slug,
    githubToken,
    'data.json',
    Buffer.from(JSON.stringify(next, null, 2)).toString('base64'),
    message,
    sha
  )
  return result
}

export async function publishCategory(input: PublishCategoryInput): Promise<Category> {
  return withDataJson(async (data) => {
    const category: Category = {
      id: randomId('cat'),
      name: input.name.trim(),
      order: input.order ?? data.categories.length
    }
    const next: RemoteData = {
      ...data,
      categories: [...data.categories, category]
    }
    return { next, result: category, message: `Add category "${category.name}"` }
  })
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await withDataJson(async (data) => {
    const next: RemoteData = {
      categories: data.categories.filter((c) => c.id !== categoryId),
      reduxes: data.reduxes.filter((r) => r.categoryId !== categoryId)
    }
    return { next, result: undefined, message: `Delete category ${categoryId}` }
  })
}

export async function publishRedux(
  input: PublishReduxInput
): Promise<{ downloadUrl: string; coverUrl?: string; id: string }> {
  const { backendRepo, githubToken } = await readConfig()
  if (!githubToken) throw new Error('GitHub token required to publish a redux.')
  const slug = parseRepo(backendRepo)

  const reduxId = randomId('rdx')
  const tag = `redux-${reduxId}`
  const release = await createRelease(slug, githubToken, tag, input.name)

  const zipAssetName = `${reduxId}${extname(input.zipPath) || '.zip'}`
  const zipAsset = await uploadReleaseAsset(
    slug,
    githubToken,
    release.id,
    input.zipPath,
    zipAssetName
  )

  let coverAsset: UploadedAsset | undefined
  if (input.coverPath) {
    const coverName = `cover${extname(input.coverPath) || '.png'}`
    coverAsset = await uploadReleaseAsset(slug, githubToken, release.id, input.coverPath, coverName)
  }

  const stat = await fs.stat(input.zipPath)
  const downloadUrl = zipAsset.browser_download_url
  const coverUrl = coverAsset?.browser_download_url

  await withDataJson(async (data) => {
    const next: RemoteData = {
      ...data,
      reduxes: [
        ...data.reduxes,
        {
          id: reduxId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          coverUrl,
          downloadUrl,
          installTarget: input.installTarget,
          version: input.version,
          author: input.author,
          uploadedAt: new Date().toISOString(),
          fileSize: stat.size
        }
      ]
    }
    return {
      next,
      result: undefined,
      message: `Publish redux "${input.name}" (${reduxId}) [${basename(input.zipPath)}]`
    }
  })

  return { downloadUrl, coverUrl, id: reduxId }
}

interface ExistingRelease {
  id: number
  tag_name: string
  upload_url: string
}

async function getReleaseByTag(
  slug: RepoSlug,
  token: string,
  tag: string
): Promise<ExistingRelease | null> {
  try {
    return await ghRequest<ExistingRelease>(
      `${GH_API}/repos/${slug.owner}/${slug.repo}/releases/tags/${encodeURIComponent(tag)}`,
      { token }
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return null
    throw err
  }
}

export async function updateRedux(
  input: UpdateReduxInput
): Promise<{ downloadUrl?: string; coverUrl?: string }> {
  const { backendRepo, githubToken } = await readConfig()
  if (!githubToken) throw new Error('GitHub token required to update a redux.')
  const slug = parseRepo(backendRepo)

  // The release we created in publishRedux is tagged `redux-<id>` — find it so
  // we can attach new assets without making a brand-new release (keeps the
  // catalog tidy and old install URLs still resolvable in case anyone has them).
  const tag = `redux-${input.reduxId}`
  let release = await getReleaseByTag(slug, githubToken, tag)
  if (!release) {
    if (input.zipPath || input.coverPath) {
      const created = await createRelease(slug, githubToken, tag, input.name ?? input.reduxId)
      release = { id: created.id, tag_name: tag, upload_url: created.upload_url }
    }
  }

  let newDownloadUrl: string | undefined
  let newDownloadSize: number | undefined
  if (input.zipPath) {
    if (!release) throw new Error('Internal error: release missing for asset upload.')
    // Unique asset name so we don't clash with the original asset already on
    // the release; GitHub rejects duplicate names within a single release.
    const stamp = Date.now().toString(36)
    const assetName = `${input.reduxId}-${stamp}${extname(input.zipPath) || '.zip'}`
    const uploaded = await uploadReleaseAsset(
      slug,
      githubToken,
      release.id,
      input.zipPath,
      assetName
    )
    newDownloadUrl = uploaded.browser_download_url
    const stat = await fs.stat(input.zipPath)
    newDownloadSize = stat.size
  }

  let newCoverUrl: string | undefined
  if (input.coverPath) {
    if (!release) throw new Error('Internal error: release missing for cover upload.')
    const stamp = Date.now().toString(36)
    const assetName = `cover-${stamp}${extname(input.coverPath) || '.png'}`
    const uploaded = await uploadReleaseAsset(
      slug,
      githubToken,
      release.id,
      input.coverPath,
      assetName
    )
    newCoverUrl = uploaded.browser_download_url
  }

  await withDataJson(async (data) => {
    const idx = data.reduxes.findIndex((r) => r.id === input.reduxId)
    if (idx === -1) {
      throw new Error(`Redux ${input.reduxId} not found in data.json`)
    }
    const prev = data.reduxes[idx]
    const updated: Redux = {
      ...prev,
      categoryId: input.categoryId ?? prev.categoryId,
      name: input.name?.trim() ? input.name.trim() : prev.name,
      description: input.description !== undefined ? input.description : prev.description,
      installTarget: input.installTarget !== undefined ? input.installTarget : prev.installTarget,
      version: input.version !== undefined ? input.version || undefined : prev.version,
      author: input.author !== undefined ? input.author || undefined : prev.author,
      downloadUrl: newDownloadUrl ?? prev.downloadUrl,
      fileSize: newDownloadSize ?? prev.fileSize,
      coverUrl: input.removeCover ? undefined : (newCoverUrl ?? prev.coverUrl),
      uploadedAt: newDownloadUrl ? new Date().toISOString() : prev.uploadedAt
    }
    const nextReduxes = [...data.reduxes]
    nextReduxes[idx] = updated
    const next: RemoteData = { ...data, reduxes: nextReduxes }
    return { next, result: undefined, message: `Update redux "${updated.name}" (${updated.id})` }
  })

  return { downloadUrl: newDownloadUrl, coverUrl: newCoverUrl }
}

export async function deleteRedux(reduxId: string): Promise<void> {
  await withDataJson(async (data) => {
    const next: RemoteData = {
      ...data,
      reduxes: data.reduxes.filter((r) => r.id !== reduxId)
    }
    return { next, result: undefined, message: `Delete redux ${reduxId}` }
  })
}

export async function verifyToken(): Promise<{ login: string }> {
  const { githubToken } = await readConfig()
  if (!githubToken) throw new Error('No GitHub token configured.')
  return ghRequest<{ login: string }>(`${GH_API}/user`, { token: githubToken })
}
