import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  AppPreferences,
  AssetFileType,
  AssetFolder,
  AssetLibrary,
  AssetManifest,
  AssetRecord,
  ListedAsset,
  ProjectData,
  ProjectMeta,
  ProjectRegistryEntry,
  SaveSlotData,
  SaveSlotMeta,
} from './types'

const REGISTRY_FILE = 'registry.json'
const PREFS_FILE = 'preferences.json'
const SLOT_COUNT = 3

interface RegistryFile {
  projects: ProjectRegistryEntry[]
}

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
}

const EMPTY_GRAPH = {
  nodes: [],
  edges: [],
  variables: [],
  startNodeId: null,
}

function userDataDir(): string {
  return app.getPath('userData')
}

function registryPath(): string {
  return path.join(userDataDir(), REGISTRY_FILE)
}

function preferencesPath(): string {
  return path.join(userDataDir(), PREFS_FILE)
}

export function defaultProjectsDir(): string {
  return path.join(userDataDir(), 'projects')
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return fallback
    throw err
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function readRegistry(): Promise<RegistryFile> {
  return readJson<RegistryFile>(registryPath(), { projects: [] })
}

async function writeRegistry(registry: RegistryFile): Promise<void> {
  await writeJson(registryPath(), registry)
}

function registryEntry(
  registry: RegistryFile,
  id: string,
): ProjectRegistryEntry | undefined {
  return registry.projects.find((p) => p.id === id)
}

function projectJsonPath(projectDir: string): string {
  return path.join(projectDir, 'project.json')
}

function assetsDir(projectDir: string): string {
  return path.join(projectDir, 'assets')
}

function manifestPath(projectDir: string): string {
  return path.join(assetsDir(projectDir), 'manifest.json')
}

function savesDir(projectDir: string): string {
  return path.join(projectDir, 'saves')
}

function slotPath(projectDir: string, slotIndex: number): string {
  return path.join(savesDir(projectDir), `slot-${slotIndex}.json`)
}

async function ensureProjectScaffold(projectDir: string): Promise<void> {
  await fs.mkdir(assetsDir(projectDir), { recursive: true })
  await fs.mkdir(savesDir(projectDir), { recursive: true })
  const manifest = manifestPath(projectDir)
  try {
    await fs.access(manifest)
  } catch {
    await writeJson(manifest, emptyManifest())
  }
}

function detectFileType(fileName: string): AssetFileType | null {
  const ext = path.extname(fileName).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image'
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) return 'audio'
  return null
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

const THUMBNAIL_ASSET_ID = '_thumbnail'
const THUMBNAIL_FILE_NAME = 'thumbnail.webp'

export function assetUrl(projectId: string, assetId: string): string {
  return `eggyjams://${projectId}/${assetId}`
}

export function projectThumbnailUrl(projectId: string): string {
  return `eggyjams://${projectId}/${THUMBNAIL_ASSET_ID}`
}

function emptyManifest(): AssetManifest {
  return { version: 2, folders: [], assets: [] }
}

/** Legacy (v1) manifest entry: a bare array of records with a category. */
interface LegacyAssetRecord {
  id: string
  fileName: string
  relativePath: string
  fileType: AssetFileType
  category?: string
  createdAt?: string
}

const LEGACY_CATEGORY_FOLDERS: Record<string, string> = {
  Character: 'Characters',
  Background: 'Backgrounds',
  Prop: 'Props',
  BGM: 'Audio',
  SFX: 'Audio',
}

/** Convert a v1 manifest (flat array with categories) into v2 folders + assets. */
function migrateLegacyManifest(records: LegacyAssetRecord[]): AssetManifest {
  const now = new Date().toISOString()
  const foldersByName = new Map<string, AssetFolder>()

  const assets: AssetRecord[] = records.map((record) => {
    const folderName = record.category
      ? LEGACY_CATEGORY_FOLDERS[record.category]
      : undefined

    let folderId: string | null = null
    if (folderName) {
      let folder = foldersByName.get(folderName)
      if (!folder) {
        folder = { id: randomUUID(), name: folderName, parentId: null, createdAt: now }
        foldersByName.set(folderName, folder)
      }
      folderId = folder.id
    }

    return {
      id: record.id,
      fileName: record.fileName,
      relativePath: record.relativePath,
      fileType: record.fileType,
      folderId,
      createdAt: record.createdAt,
    }
  })

  return { version: 2, folders: [...foldersByName.values()], assets }
}

async function readManifest(projectDir: string): Promise<AssetManifest> {
  const raw = await readJson<unknown>(manifestPath(projectDir), null)
  if (raw === null) return emptyManifest()

  if (Array.isArray(raw)) {
    const migrated = migrateLegacyManifest(raw as LegacyAssetRecord[])
    await writeManifest(projectDir, migrated)
    return migrated
  }

  const manifest = raw as Partial<AssetManifest>
  return {
    version: 2,
    folders: manifest.folders ?? [],
    assets: manifest.assets ?? [],
  }
}

async function writeManifest(
  projectDir: string,
  manifest: AssetManifest,
): Promise<void> {
  await writeJson(manifestPath(projectDir), manifest)
}

async function getProjectDir(id: string): Promise<string | null> {
  const registry = await readRegistry()
  const entry = registryEntry(registry, id)
  return entry?.path ?? null
}

async function readProjectData(projectDir: string): Promise<ProjectData> {
  return readJson<ProjectData>(projectJsonPath(projectDir), {
    id: '',
    title: 'Untitled',
    description: null,
    graphData: EMPTY_GRAPH,
    thumbnailPath: null,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  })
}

function toListedAsset(projectId: string, record: AssetRecord): ListedAsset {
  return {
    ...record,
    fileUrl: assetUrl(projectId, record.id),
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const registry = await readRegistry()
  const metas: ProjectMeta[] = []

  for (const entry of registry.projects) {
    try {
      const data = await readProjectData(entry.path)
      metas.push({
        id: data.id,
        title: data.title,
        description: data.description,
        thumbnailPath: data.thumbnailPath,
        createdAt: data.createdAt,
        lastModified: data.lastModified,
      })
    } catch {
      metas.push({
        id: entry.id,
        title: entry.title,
        description: null,
        thumbnailPath: null,
        createdAt: entry.lastModified,
        lastModified: entry.lastModified,
      })
    }
  }

  return metas.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
  )
}

export async function getProject(id: string): Promise<ProjectData | null> {
  const projectDir = await getProjectDir(id)
  if (!projectDir) return null

  try {
    const data = await readProjectData(projectDir)
    const registry = await readRegistry()
    const entry = registryEntry(registry, id)
    if (entry) {
      entry.lastOpened = new Date().toISOString()
      await writeRegistry(registry)
    }
    return data
  } catch {
    return null
  }
}

export async function createProject(
  title: string,
  parentDir?: string,
): Promise<ProjectData> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const baseDir = parentDir ?? defaultProjectsDir()
  const projectDir = path.join(baseDir, id)

  await fs.mkdir(projectDir, { recursive: true })
  await ensureProjectScaffold(projectDir)

  const data: ProjectData = {
    id,
    title: title.trim() || 'Untitled',
    description: null,
    graphData: { ...EMPTY_GRAPH },
    thumbnailPath: null,
    createdAt: now,
    lastModified: now,
  }

  await writeJson(projectJsonPath(projectDir), data)

  const registry = await readRegistry()
  registry.projects.push({
    id,
    title: data.title,
    path: projectDir,
    lastOpened: now,
    lastModified: now,
  })
  await writeRegistry(registry)

  return data
}

export async function saveProject(data: ProjectData): Promise<void> {
  const projectDir = await getProjectDir(data.id)
  if (!projectDir) {
    throw new Error(`Project not found: ${data.id}`)
  }

  const updated: ProjectData = {
    ...data,
    lastModified: new Date().toISOString(),
  }

  await writeJson(projectJsonPath(projectDir), updated)

  const registry = await readRegistry()
  const entry = registryEntry(registry, data.id)
  if (entry) {
    entry.title = updated.title
    entry.lastModified = updated.lastModified
    await writeRegistry(registry)
  }
}

export async function deleteProject(id: string): Promise<void> {
  const registry = await readRegistry()
  const entry = registryEntry(registry, id)
  if (!entry) return

  await fs.rm(entry.path, { recursive: true, force: true })
  registry.projects = registry.projects.filter((p) => p.id !== id)
  await writeRegistry(registry)
}

export async function getProjectPath(id: string): Promise<string | null> {
  return getProjectDir(id)
}

export async function listRecentProjects(
  max = 10,
): Promise<ProjectRegistryEntry[]> {
  const registry = await readRegistry()
  return [...registry.projects]
    .sort(
      (a, b) =>
        new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime(),
    )
    .slice(0, max)
}

/** Register and load a project from an on-disk folder containing project.json. */
export async function openProjectFromFolder(
  folderPath: string,
): Promise<ProjectData | null> {
  const projectDir = path.resolve(folderPath)
  const jsonPath = projectJsonPath(projectDir)

  try {
    await fs.access(jsonPath)
  } catch {
    return null
  }

  const data = await readProjectData(projectDir)
  if (!data.id) {
    return null
  }

  const now = new Date().toISOString()
  const registry = await readRegistry()
  let entry = registryEntry(registry, data.id)

  if (!entry) {
    entry = {
      id: data.id,
      title: data.title,
      path: projectDir,
      lastOpened: now,
      lastModified: data.lastModified,
    }
    registry.projects.push(entry)
  } else {
    entry.path = projectDir
    entry.title = data.title
    entry.lastModified = data.lastModified
    entry.lastOpened = now
  }

  await writeRegistry(registry)
  return data
}

/** Copy project to a new folder under parentDir and register it. */
export async function saveProjectAs(
  projectId: string,
  parentDir: string,
): Promise<ProjectData> {
  const sourceDir = await getProjectDir(projectId)
  if (!sourceDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const newId = randomUUID()
  const destDir = path.join(parentDir, newId)

  await fs.cp(sourceDir, destDir, { recursive: true })

  const data = await readProjectData(destDir)
  const now = new Date().toISOString()
  const updated: ProjectData = {
    ...data,
    id: newId,
    lastModified: now,
  }
  await writeJson(projectJsonPath(destDir), updated)

  const registry = await readRegistry()
  registry.projects.push({
    id: newId,
    title: updated.title,
    path: destDir,
    lastOpened: now,
    lastModified: now,
  })
  await writeRegistry(registry)

  return updated
}

export async function listAssets(projectId: string): Promise<AssetLibrary> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return { folders: [], assets: [] }

  const manifest = await readManifest(projectDir)
  return {
    folders: manifest.folders,
    assets: manifest.assets.map((record) => toListedAsset(projectId, record)),
  }
}

export interface UploadAssetPayload {
  projectId: string
  fileName: string
  folderId?: string | null
  buffer: ArrayBuffer
}

export async function uploadAsset(payload: UploadAssetPayload): Promise<string> {
  const { projectId, fileName, folderId, buffer } = payload
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const fileType = detectFileType(fileName)
  if (!fileType) {
    throw new Error(`Unsupported file type: ${fileName}`)
  }

  await ensureProjectScaffold(projectDir)

  const assetId = randomUUID()
  const ext = path.extname(fileName) || (fileType === 'image' ? '.webp' : '.mp3')
  const storedName = `${assetId}-${sanitizeFileName(path.basename(fileName, path.extname(fileName)))}${ext}`
  const relativePath = path.join('assets', storedName).replace(/\\/g, '/')
  const absolutePath = path.join(projectDir, relativePath)

  await fs.writeFile(absolutePath, Buffer.from(buffer))

  const manifest = await readManifest(projectDir)

  const record: AssetRecord = {
    id: assetId,
    fileName,
    relativePath,
    fileType,
    // Guard against stale folder ids so assets never become invisible orphans.
    folderId:
      folderId && manifest.folders.some((f) => f.id === folderId)
        ? folderId
        : null,
    createdAt: new Date().toISOString(),
  }

  manifest.assets.unshift(record)
  await writeManifest(projectDir, manifest)

  const registry = await readRegistry()
  const entry = registryEntry(registry, projectId)
  if (entry) {
    entry.lastModified = new Date().toISOString()
    await writeRegistry(registry)
  }

  return assetId
}

export async function deleteAsset(
  projectId: string,
  assetId: string,
): Promise<void> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return

  const manifest = await readManifest(projectDir)
  const record = manifest.assets.find((a) => a.id === assetId)
  if (!record) return

  const absolutePath = path.join(projectDir, record.relativePath)
  await fs.rm(absolutePath, { force: true })

  await writeManifest(projectDir, {
    ...manifest,
    assets: manifest.assets.filter((a) => a.id !== assetId),
  })
}

export async function moveAsset(
  projectId: string,
  assetId: string,
  folderId: string | null,
): Promise<void> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const manifest = await readManifest(projectDir)
  const record = manifest.assets.find((a) => a.id === assetId)
  if (!record) {
    throw new Error(`Asset not found: ${assetId}`)
  }
  if (folderId && !manifest.folders.some((f) => f.id === folderId)) {
    throw new Error(`Folder not found: ${folderId}`)
  }

  record.folderId = folderId
  await writeManifest(projectDir, manifest)
}

export async function createAssetFolder(
  projectId: string,
  name: string,
  parentId: string | null,
): Promise<AssetFolder> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const manifest = await readManifest(projectDir)
  if (parentId && !manifest.folders.some((f) => f.id === parentId)) {
    throw new Error(`Parent folder not found: ${parentId}`)
  }

  const folder: AssetFolder = {
    id: randomUUID(),
    name: name.trim() || 'New Folder',
    parentId,
    createdAt: new Date().toISOString(),
  }

  manifest.folders.push(folder)
  await writeManifest(projectDir, manifest)
  return folder
}

export async function renameAssetFolder(
  projectId: string,
  folderId: string,
  name: string,
): Promise<void> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const manifest = await readManifest(projectDir)
  const folder = manifest.folders.find((f) => f.id === folderId)
  if (!folder) {
    throw new Error(`Folder not found: ${folderId}`)
  }

  const trimmed = name.trim()
  if (!trimmed) return

  folder.name = trimmed
  await writeManifest(projectDir, manifest)
}

/** Delete a folder. Its assets and subfolders move up to the deleted folder's parent. */
export async function deleteAssetFolder(
  projectId: string,
  folderId: string,
): Promise<void> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return

  const manifest = await readManifest(projectDir)
  const folder = manifest.folders.find((f) => f.id === folderId)
  if (!folder) return

  for (const asset of manifest.assets) {
    if (asset.folderId === folderId) asset.folderId = folder.parentId
  }
  for (const child of manifest.folders) {
    if (child.parentId === folderId) child.parentId = folder.parentId
  }

  await writeManifest(projectDir, {
    ...manifest,
    folders: manifest.folders.filter((f) => f.id !== folderId),
  })
}

export async function getAssetUrl(
  projectId: string,
  assetId: string,
): Promise<string> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const manifest = await readManifest(projectDir)
  if (!manifest.assets.some((a) => a.id === assetId)) {
    throw new Error(`Asset not found: ${assetId}`)
  }

  return assetUrl(projectId, assetId)
}

export async function getProjectThumbnailUrl(
  projectId: string,
): Promise<string | null> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return null

  const data = await readProjectData(projectDir)
  if (!data.thumbnailPath) return null

  const absolutePath = path.resolve(projectDir, data.thumbnailPath)
  try {
    await fs.access(absolutePath)
    return projectThumbnailUrl(projectId)
  } catch {
    return null
  }
}

export async function saveProjectThumbnail(
  projectId: string,
  buffer: ArrayBuffer,
): Promise<string> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const relativePath = THUMBNAIL_FILE_NAME
  const absolutePath = path.join(projectDir, relativePath)
  await fs.writeFile(absolutePath, Buffer.from(buffer))

  const data = await readProjectData(projectDir)
  const updated: ProjectData = {
    ...data,
    thumbnailPath: relativePath,
    lastModified: new Date().toISOString(),
  }
  await writeJson(projectJsonPath(projectDir), updated)

  const registry = await readRegistry()
  const entry = registryEntry(registry, projectId)
  if (entry) {
    entry.lastModified = updated.lastModified
    await writeRegistry(registry)
  }

  return projectThumbnailUrl(projectId)
}

export async function listSlots(projectId: string): Promise<SaveSlotMeta[]> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    return Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slotIndex: i + 1,
      createdAt: null,
      slotName: null,
    }))
  }

  const slots: SaveSlotMeta[] = []
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const filePath = slotPath(projectDir, i)
    try {
      const data = await readJson<SaveSlotData>(filePath, {
        nodeId: '',
        variables: {},
        slotName: null,
        createdAt: '',
      })
      if (data.createdAt && data.nodeId) {
        slots.push({
          slotIndex: i,
          createdAt: data.createdAt,
          slotName: data.slotName,
          nodeId: data.nodeId,
          variables: data.variables ?? {},
        })
      } else {
        slots.push({ slotIndex: i, createdAt: null, slotName: null })
      }
    } catch {
      slots.push({ slotIndex: i, createdAt: null, slotName: null })
    }
  }
  return slots
}

export async function upsertSlot(
  projectId: string,
  slotIndex: number,
  data: SaveSlotData,
): Promise<void> {
  if (slotIndex < 1 || slotIndex > SLOT_COUNT) {
    throw new Error(`Invalid slot index: ${slotIndex}`)
  }

  const projectDir = await getProjectDir(projectId)
  if (!projectDir) {
    throw new Error(`Project not found: ${projectId}`)
  }

  await fs.mkdir(savesDir(projectDir), { recursive: true })
  await writeJson(slotPath(projectDir, slotIndex), data)
}

export async function deleteSlot(
  projectId: string,
  slotIndex: number,
): Promise<void> {
  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return

  await fs.rm(slotPath(projectDir, slotIndex), { force: true })
}

export async function getPreferences(): Promise<AppPreferences> {
  const prefs = await readJson<Partial<AppPreferences>>(
    preferencesPath(),
    DEFAULT_PREFERENCES,
  )
  return {
    theme: prefs.theme === 'light' ? 'light' : 'dark',
  }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  await writeJson(preferencesPath(), prefs)
}

/** Resolve eggyjams://projectId/assetId to an absolute file path. */
export async function resolveAssetFilePath(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== 'eggyjams:') return null

  const host = parsed.hostname
  const assetId = parsed.pathname.replace(/^\//, '')

  const projectId = host
  if (!projectId || !assetId) return null

  const projectDir = await getProjectDir(projectId)
  if (!projectDir) return null

  if (assetId === THUMBNAIL_ASSET_ID) {
    const data = await readProjectData(projectDir)
    if (!data.thumbnailPath) return null
    const absolutePath = path.resolve(projectDir, data.thumbnailPath)
    const projectRoot = path.resolve(projectDir)
    if (
      !absolutePath.startsWith(projectRoot + path.sep) &&
      absolutePath !== projectRoot
    ) {
      return null
    }
    try {
      await fs.access(absolutePath)
      return absolutePath
    } catch {
      return null
    }
  }

  const manifest = await readManifest(projectDir)
  const record = manifest.assets.find((a) => a.id === assetId)
  if (!record) return null

  const absolutePath = path.resolve(projectDir, record.relativePath)
  const assetsRoot = path.resolve(assetsDir(projectDir))
  if (!absolutePath.startsWith(assetsRoot + path.sep) && absolutePath !== assetsRoot) {
    return null
  }

  try {
    await fs.access(absolutePath)
    return absolutePath
  } catch {
    return null
  }
}
