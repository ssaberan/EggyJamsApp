import { app } from 'electron'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import originalFs from 'original-fs'
import JSZip from 'jszip'

import type { Configuration } from 'electron-builder'

export type GamePackagePlatform = 'windows' | 'mac'

export interface OfflineGameFilePayload {
  relativePath: string
  data: ArrayBuffer
}

export interface PackageOfflineGameOptions {
  platform: GamePackagePlatform
  outputPath: string
  title: string
  safeName: string
  files: OfflineGameFilePayload[]
}

const SHELLS_DIR_NAME = 'game-player-shells'
const rawFs = originalFs.promises

export async function packageOfflineGame(
  options: PackageOfflineGameOptions,
): Promise<void> {
  const shellPath = await resolveShellPath(options.platform)
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eggyjams-export-'))

  try {
    const projectDir = path.join(tempRoot, 'builder-project')
    const artifactDir = path.join(tempRoot, 'artifacts')
    const prepackagedPath =
      options.platform === 'mac'
        ? path.join(tempRoot, `${options.safeName}.app`)
        : path.join(tempRoot, 'win-unpacked')

    await fs.mkdir(projectDir, { recursive: true })
    await fs.mkdir(artifactDir, { recursive: true })
    await rawFs.cp(shellPath, prepackagedPath, { recursive: true })
    await writeGameFiles(prepackagedPath, options.platform, options.files)

    if (options.platform === 'windows') {
      await writeWindowsPackageZip(prepackagedPath, options.outputPath, options.safeName)
      return
    }

    await writeBuilderPackage(projectDir, options)

    const { build } = await import('electron-builder')
    const artifacts = await build({
      projectDir,
      prepackaged: prepackagedPath,
      publish: 'never',
      ...(options.platform === 'mac'
        ? { mac: ['zip'] }
        : { win: ['portable'] }),
      config: buildConfig(options, artifactDir),
    })

    const artifact = await resolveArtifact(
      artifacts,
      artifactDir,
      options.platform,
    )
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true })
    await fs.copyFile(artifact, options.outputPath)
  } finally {
    await rawFs.rm(tempRoot, { recursive: true, force: true })
  }
}

async function writeWindowsPackageZip(
  prepackagedPath: string,
  outputPath: string,
  safeName: string,
): Promise<void> {
  const zip = new JSZip()
  const root = zip.folder(`${safeName}-windows`)
  if (!root) throw new Error('Could not create Windows package zip.')

  await addDirectoryToZip(root, prepackagedPath)
  root.file(
    'README.txt',
    [
      'How to play this EggyJams game on Windows',
      '',
      '1. Extract this entire zip file first.',
      '2. Open the extracted folder.',
      '3. Run "EggyJams Game.exe" from inside that folder.',
      '',
      'Do not run the exe directly from inside the zip preview. The exe needs',
      'the adjacent resources folder and runtime files to load the game.',
      '',
      'If the game opens to a black screen, please send the debug log from:',
      '%APPDATA%\\eggyjams-game-player\\logs\\player-debug.log',
      '',
    ].join('\r\n'),
  )

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
    platform: 'DOS',
  })

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
}

async function addDirectoryToZip(zip: JSZip, directoryPath: string): Promise<void> {
  const entries = await rawFs.readdir(directoryPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      const child = zip.folder(entry.name)
      if (!child) throw new Error(`Could not add ${entry.name} to Windows zip.`)
      await addDirectoryToZip(child, entryPath)
    } else if (entry.isFile()) {
      zip.file(entry.name, await rawFs.readFile(entryPath), { binary: true })
    }
  }
}

function getResourcesPath(
  prepackagedPath: string,
  platform: GamePackagePlatform,
): string {
  return platform === 'mac'
    ? path.join(prepackagedPath, 'Contents', 'Resources')
    : path.join(prepackagedPath, 'resources')
}

async function resolveShellPath(platform: GamePackagePlatform): Promise<string> {
  const shellRoot = resolveShellRoot()
  if (!shellRoot) {
    throw new Error(
      'Game player shells are not bundled with this EggyJams install. ' +
        'Build the game-player shells first or install a release that includes them.',
    )
  }

  if (platform === 'windows') {
    const winShell = path.join(shellRoot, 'win-unpacked')
    if (existsSync(winShell)) return winShell
    throw new Error(
      'Windows player shell not found. Run npm run build:game-player:win ' +
        'or install a release that includes the Windows shell.',
    )
  }

  const macShell = await findMacApp(path.join(shellRoot, 'mac'))
  if (macShell) return macShell

  throw new Error(
    'Mac player shell not found. Run npm run build:game-player:mac ' +
      'on macOS or install a release that includes the Mac shell.',
  )
}

function resolveShellRoot(): string | null {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, SHELLS_DIR_NAME)]
    : [
        path.join(app.getAppPath(), SHELLS_DIR_NAME),
        path.join(app.getAppPath(), 'dist', SHELLS_DIR_NAME),
      ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function findMacApp(root: string): Promise<string | null> {
  if (!existsSync(root)) return null

  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      return entryPath
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = await findMacApp(path.join(root, entry.name))
    if (nested) return nested
  }

  return null
}

async function writeBuilderPackage(
  projectDir: string,
  options: PackageOfflineGameOptions,
): Promise<void> {
  const pkg = {
    name: options.safeName.toLowerCase(),
    version: '1.0.0',
    private: true,
    main: 'main.js',
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(pkg, null, 2),
    'utf8',
  )
}

async function writeGameFiles(
  prepackagedPath: string,
  platform: GamePackagePlatform,
  files: OfflineGameFilePayload[],
): Promise<void> {
  const resourcesPath = getResourcesPath(prepackagedPath, platform)
  const gameRoot = path.join(resourcesPath, 'game')

  await rawFs.rm(gameRoot, { recursive: true, force: true })
  await rawFs.mkdir(gameRoot, { recursive: true })

  for (const file of files) {
    const filePath = safeJoin(gameRoot, file.relativePath)
    await rawFs.mkdir(path.dirname(filePath), { recursive: true })
    await rawFs.writeFile(filePath, Buffer.from(file.data))
  }
}

function safeJoin(root: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.includes('../')) {
    throw new Error(`Invalid exported game path: ${relativePath}`)
  }

  const resolved = path.resolve(root, ...normalized.split('/'))
  const resolvedRoot = path.resolve(root)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Invalid exported game path: ${relativePath}`)
  }
  return resolved
}

function buildConfig(
  options: PackageOfflineGameOptions,
  artifactDir: string,
): Configuration {
  const productName = sanitizeProductName(options.title)
  const appIdSuffix = options.safeName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'game'

  return {
    appId: `com.eggyjams.exported.${appIdSuffix}`,
    productName,
    electronVersion: process.versions.electron,
    directories: {
      output: artifactDir,
    },
    npmRebuild: false,
    compression: 'store',
    win: {
      target: ['portable' as const],
      signAndEditExecutable: false,
      artifactName: `${options.safeName}.exe`,
    },
    mac: {
      target: ['zip' as const],
      category: 'public.app-category.games',
      identity: null,
      artifactName: `${options.safeName}-mac.zip`,
    },
  }
}

function sanitizeProductName(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return 'EggyJams Game'
  return trimmed.replace(/[\\/:*?"<>|]/g, '_')
}

async function resolveArtifact(
  artifacts: string[],
  artifactDir: string,
  platform: GamePackagePlatform,
): Promise<string> {
  const extension = platform === 'mac' ? '.zip' : '.exe'
  const fromBuilder = artifacts.find((artifact) =>
    artifact.toLowerCase().endsWith(extension),
  )
  if (fromBuilder) return fromBuilder

  const fromDisk = await findFirstFile(artifactDir, (filePath) =>
    filePath.toLowerCase().endsWith(extension),
  )
  if (fromDisk) return fromDisk

  throw new Error(`Could not find generated ${extension} artifact.`)
}

async function findFirstFile(
  root: string,
  predicate: (filePath: string) => boolean,
): Promise<string | null> {
  const entries = await fs.readdir(root, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isFile() && predicate(entryPath)) return entryPath
    if (entry.isDirectory()) {
      const nested = await findFirstFile(entryPath, predicate)
      if (nested) return nested
    }
  }

  return null
}
