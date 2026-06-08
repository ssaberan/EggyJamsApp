import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import * as exportGamePackage from './exportGamePackage'
import * as exportRunner from './exportRunner'
import * as storage from './storage'
import type { UploadAssetPayload } from './storage'
import type { AppPreferences, ProjectData, SaveSlotData } from './types'

const isDev =
  process.env.NODE_ENV === 'development' || !app.isPackaged

const APP_NAME = 'EggyJams'
const MAX_RECENT = 10
const MIN_WINDOW_WIDTH = 800
const MIN_WINDOW_HEIGHT = 600
type TitleBarTheme = 'light' | 'dark'
type TitleBarMode = 'native' | 'integrated' | 'custom'

/** WSLg often fails to show frameless Electron windows; use the native title bar there. */
function isWsl(): boolean {
  if (process.platform !== 'linux') return false
  if (process.env.WSL_DISTRO_NAME) return true
  try {
    return readFileSync('/proc/version', 'utf-8')
      .toLowerCase()
      .includes('microsoft')
  } catch {
    return false
  }
}

function usesCustomLinuxTitleBar(): boolean {
  if (process.env.ELECTRON_FORCE_NATIVE_FRAME === '1') return false
  if (process.env.ELECTRON_FORCE_CUSTOM_FRAME === '1') {
    return process.platform === 'linux'
  }
  return process.platform === 'linux' && !isWsl()
}

/** Frameless window with in-app title bar controls (hideable during play). */
function usesCustomWindowFrame(): boolean {
  if (process.platform === 'win32') return true
  return usesCustomLinuxTitleBar()
}

function getTitleBarMode(): TitleBarMode {
  if (process.platform === 'darwin') return 'integrated'
  if (usesCustomWindowFrame()) return 'custom'
  return 'native'
}

if (
  process.env.ELECTRON_OZONE_PLATFORM === 'x11' ||
  (process.env.ELECTRON_OZONE_PLATFORM === undefined && isWsl())
) {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

function getWindowChromeOptions(): Electron.BrowserWindowConstructorOptions {
  const isMac = process.platform === 'darwin'

  return {
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 },
        }
      : {}),
    ...(usesCustomWindowFrame() ? { frame: false } : {}),
  }
}

let immersivePlayActive = false
let wasFullScreenBeforeImmersive = false

function enterImmersiveFullscreen(win: BrowserWindow): void {
  wasFullScreenBeforeImmersive = win.isFullScreen()
  if (!wasFullScreenBeforeImmersive) {
    win.setFullScreen(true)
  }
}

function exitImmersiveFullscreen(win: BrowserWindow): void {
  if (!wasFullScreenBeforeImmersive && win.isFullScreen()) {
    win.setFullScreen(false)
  }
}

function restoreImmersiveFullscreenIfNeeded(win: BrowserWindow): void {
  if (!immersivePlayActive || wasFullScreenBeforeImmersive) return
  if (!win.isFullScreen()) {
    win.setFullScreen(true)
  }
}

function setImmersivePlayMode(win: BrowserWindow, immersive: boolean): void {
  if (immersive === immersivePlayActive) return
  immersivePlayActive = immersive

  if (immersive) {
    enterImmersiveFullscreen(win)
    return
  }

  exitImmersiveFullscreen(win)
}

function disableBackgroundThrottling(win: BrowserWindow): void {
  win.webContents.setBackgroundThrottling(false)
}

function resolveAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'logo.png'),
    path.join(__dirname, '..', 'public', 'logo.png'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? app.getVersion()
  } catch {
    return app.getVersion()
  }
}

type MenuAction =
  | 'new-project'
  | 'open-project'
  | 'save'
  | 'save-as'
  | 'export-zip'
  | 'export-windows'
  | 'export-mac'
  | 'import-project'
  | 'close-project'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'toggle-theme'
  | 'about'
  | 'open-recent'
  | 'save-and-close'

interface MenuActionPayload {
  action: MenuAction
  projectId?: string
}

let mainWindow: BrowserWindow | null = null
let isDirty = false
let closeAfterSave = false

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'eggyjams',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function getMainWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }
  return BrowserWindow.getAllWindows()[0] ?? null
}

function sendMenuAction(action: MenuAction, projectId?: string): void {
  const win = getMainWindow()
  if (!win) return
  const payload: MenuActionPayload = { action }
  if (projectId) payload.projectId = projectId
  win.webContents.send('menu:action', payload)
}

/** Hide the in-window menu bar on Windows/Linux; accelerators still work. */
function hideInWindowMenuBar(): void {
  if (process.platform === 'darwin') return
  getMainWindow()?.setMenuBarVisibility(false)
}

function setWindowTitle(projectTitle: string | null): void {
  const win = getMainWindow()
  if (!win) return
  win.setTitle(
    projectTitle ? `${APP_NAME} — ${projectTitle}` : APP_NAME,
  )
}

async function pickProjectFolder(): Promise<string | null> {
  const win = getMainWindow()
  const options: OpenDialogOptions = {
    title: 'Open Project',
    properties: ['openDirectory'],
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0] ?? null
}

async function pickParentDirectory(title: string): Promise<string | null> {
  const win = getMainWindow()
  const options: OpenDialogOptions = {
    title,
    properties: ['openDirectory', 'createDirectory'],
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0] ?? null
}

async function pickExportZipPath(defaultName: string): Promise<string | null> {
  const win = getMainWindow()
  const options: SaveDialogOptions = {
    title: 'Export Offline Zip',
    defaultPath: `${defaultName}.zip`,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

async function pickExportWindowsExePath(defaultName: string): Promise<string | null> {
  const win = getMainWindow()
  const options: SaveDialogOptions = {
    title: 'Export Windows Package',
    defaultPath: `${defaultName}-windows.zip`,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

async function pickExportMacZipPath(defaultName: string): Promise<string | null> {
  const win = getMainWindow()
  const options: SaveDialogOptions = {
    title: 'Export Mac App',
    defaultPath: `${defaultName}-mac.zip`,
    filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

async function pickImportFile(): Promise<{
  filePath: string
  buffer: ArrayBuffer
} | null> {
  const win = getMainWindow()
  const options: OpenDialogOptions = {
    title: 'Import Project',
    properties: ['openFile'],
    filters: [
      { name: 'Project Files', extensions: ['zip', 'json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  if (!filePath) return null
  const buf = await fs.readFile(filePath)
  return {
    filePath,
    buffer: buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer,
  }
}

async function handleOpenProject(): Promise<string | null> {
  const folder = await pickProjectFolder()
  if (!folder) return null
  const project = await storage.openProjectFromFolder(folder)
  if (!project) {
    await showMessageBox({
      type: 'error',
      title: 'Open Project',
      message: 'Could not open project.',
      detail: 'The selected folder does not contain a valid project.json file.',
    })
    return null
  }
  void rebuildApplicationMenu()
  return project.id
}

async function handleSaveProjectAs(projectId: string): Promise<string | null> {
  const parentDir = await pickParentDirectory('Save Project As')
  if (!parentDir) return null
  try {
    const project = await storage.saveProjectAs(projectId, parentDir)
    void rebuildApplicationMenu()
    return project.id
  } catch (err) {
    await showMessageBox({
      type: 'error',
      title: 'Save As',
      message: 'Failed to save project.',
      detail: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function showMessageBox(
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> {
  const win = getMainWindow()
  return win
    ? dialog.showMessageBox(win, options)
    : dialog.showMessageBox(options)
}

async function showAboutDialog(): Promise<void> {
  const version = readPackageVersion()
  await showMessageBox({
    type: 'info',
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} ${version}`,
    detail:
      'A desktop game builder for narrative and interactive stories.\n\n' +
      `Version ${version}\n` +
      'Create projects, edit story graphs, and export offline playable games.\n\n' +
      '© EggyJams',
  })
}

async function confirmCloseWithUnsaved(): Promise<boolean> {
  const { response } = await showMessageBox({
    type: 'warning',
    title: 'Unsaved Changes',
    message: 'Save changes before closing?',
    detail: 'Your project has unsaved changes.',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  })

  if (response === 2) return false
  if (response === 1) {
    isDirty = false
    return true
  }

  closeAfterSave = true
  sendMenuAction('save-and-close')
  return false
}

async function rebuildApplicationMenu(): Promise<void> {
  const recent = await storage.listRecentProjects(MAX_RECENT)

  const recentSubmenu: Electron.MenuItemConstructorOptions[] =
    recent.length === 0
      ? [{ label: 'No Recent Projects', enabled: false }]
      : recent.map((entry) => ({
          label: entry.title,
          click: () => {
            void (async () => {
              const project = await storage.openProjectFromFolder(entry.path)
              if (!project) {
                await showMessageBox({
                  type: 'error',
                  title: 'Open Project',
                  message: 'Project folder not found.',
                  detail: entry.path,
                })
                void rebuildApplicationMenu()
                return
              }
              sendMenuAction('open-recent', project.id)
            })()
          },
        }))

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: `About ${APP_NAME}`, click: () => void showAboutDialog() },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-project'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void (async () => {
              const id = await handleOpenProject()
              if (id) sendMenuAction('open-recent', id)
            })()
          },
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-as'),
        },
        { type: 'separator' },
        {
          label: 'Export Offline Zip…',
          click: () => sendMenuAction('export-zip'),
        },
        {
          label: 'Export Windows Executable…',
          click: () => sendMenuAction('export-windows'),
        },
        {
          label: 'Export Mac App…',
          click: () => sendMenuAction('export-mac'),
        },
        {
          label: 'Import Project…',
          click: () => sendMenuAction('import-project'),
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuAction('close-project'),
        },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' }
          : {
              label: 'Quit',
              accelerator: 'CmdOrCtrl+Q',
              click: () => {
                const win = getMainWindow()
                win?.close()
              },
            },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo'),
        },
        {
          label: 'Redo',
          accelerator: process.platform === 'darwin' ? 'CmdOrCtrl+Shift+Z' : 'CmdOrCtrl+Y',
          click: () => sendMenuAction('redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendMenuAction('toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => void showAboutDialog(),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  hideInWindowMenuBar()
}

function registerIpcHandlers(): void {
  ipcMain.handle('project:list', () => storage.listProjects())
  ipcMain.handle('project:get', (_event, id: string) => storage.getProject(id))
  ipcMain.handle(
    'project:create',
    (_event, title: string, parentDir?: string) =>
      storage.createProject(title, parentDir),
  )
  ipcMain.handle('project:save', (_event, data: ProjectData) =>
    storage.saveProject(data),
  )
  ipcMain.handle('project:delete', (_event, id: string) =>
    storage.deleteProject(id),
  )
  ipcMain.handle('project:getPath', (_event, id: string) =>
    storage.getProjectPath(id),
  )
  ipcMain.handle('project:openFromFolder', async () => handleOpenProject())
  ipcMain.handle('project:saveAs', async (_event, projectId: string) =>
    handleSaveProjectAs(projectId),
  )
  ipcMain.handle('project:listRecent', () =>
    storage.listRecentProjects(MAX_RECENT),
  )
  ipcMain.handle('project:getDefaultProjectsDir', () =>
    storage.defaultProjectsDir(),
  )

  ipcMain.handle('asset:list', (_event, projectId: string) =>
    storage.listAssets(projectId),
  )
  ipcMain.handle(
    'asset:upload',
    (_event, payload: UploadAssetPayload) => storage.uploadAsset(payload),
  )
  ipcMain.handle(
    'asset:delete',
    (_event, projectId: string, assetId: string) =>
      storage.deleteAsset(projectId, assetId),
  )
  ipcMain.handle(
    'asset:getUrl',
    (_event, projectId: string, assetId: string) =>
      storage.getAssetUrl(projectId, assetId),
  )
  ipcMain.handle('project:getThumbnailUrl', (_event, projectId: string) =>
    storage.getProjectThumbnailUrl(projectId),
  )
  ipcMain.handle(
    'project:saveThumbnail',
    (_event, projectId: string, buffer: ArrayBuffer) =>
      storage.saveProjectThumbnail(projectId, buffer),
  )

  ipcMain.handle('save:list', (_event, projectId: string) =>
    storage.listSlots(projectId),
  )
  ipcMain.handle(
    'save:upsert',
    (
      _event,
      projectId: string,
      slotIndex: number,
      data: SaveSlotData,
    ) => storage.upsertSlot(projectId, slotIndex, data),
  )
  ipcMain.handle(
    'save:delete',
    (_event, projectId: string, slotIndex: number) =>
      storage.deleteSlot(projectId, slotIndex),
  )

  ipcMain.handle('prefs:get', () => storage.getPreferences())
  ipcMain.handle('prefs:save', (_event, prefs: AppPreferences) =>
    storage.savePreferences(prefs),
  )

  ipcMain.handle(
    'export:readOfflineRunnerFile',
    (_event, relativePath: string) =>
      exportRunner.readOfflineRunnerFile(relativePath),
  )

  ipcMain.handle('dialog:pickExportZip', (_event, defaultName: string) =>
    pickExportZipPath(defaultName),
  )
  ipcMain.handle('dialog:pickExportWindowsExe', (_event, defaultName: string) =>
    pickExportWindowsExePath(defaultName),
  )
  ipcMain.handle('dialog:pickExportMacZip', (_event, defaultName: string) =>
    pickExportMacZipPath(defaultName),
  )
  ipcMain.handle(
    'export:packageGame',
    (_event, options: exportGamePackage.PackageOfflineGameOptions) =>
      exportGamePackage.packageOfflineGame(options),
  )
  ipcMain.handle('dialog:pickImportFile', () => pickImportFile())
  ipcMain.handle('dialog:pickProjectParentDirectory', (_event, title?: string) =>
    pickParentDirectory(title ?? 'Choose Project Location'),
  )
  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, buffer: ArrayBuffer) => {
      await fs.writeFile(filePath, Buffer.from(buffer))
    },
  )

  ipcMain.handle('app:getVersion', () => readPackageVersion())
  ipcMain.on('app:setDirty', (_event, dirty: boolean) => {
    isDirty = dirty
  })
  ipcMain.on('app:setProjectTitle', (_event, title: string | null) => {
    setWindowTitle(title)
  })
  ipcMain.on('app:saveFinished', () => {
    isDirty = false
    if (closeAfterSave) {
      closeAfterSave = false
      const win = getMainWindow()
      win?.destroy()
    }
  })
  ipcMain.on('app:refreshMenu', () => {
    void rebuildApplicationMenu()
  })

  ipcMain.handle('app:getPlatform', () => process.platform)

  ipcMain.handle('app:usesCustomTitleBar', () => usesCustomWindowFrame())

  ipcMain.handle('app:getTitleBarMode', () => getTitleBarMode())

  ipcMain.on('app:setTitleBarTheme', (_event, theme: TitleBarTheme) => {
    if (theme !== 'light' && theme !== 'dark') return
    /* In-app title bar follows the renderer theme; no native overlay to sync. */
  })

  ipcMain.on('app:setImmersivePlay', (_event, immersive: boolean) => {
    const win = getMainWindow()
    if (!win) return
    if (typeof immersive === 'boolean') {
      setImmersivePlayMode(win, immersive)
    }
  })

  ipcMain.handle('window:minimize', () => {
    getMainWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    getMainWindow()?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return getMainWindow()?.isMaximized() ?? false
  })
}

function registerAssetProtocol(): void {
  protocol.handle('eggyjams', async (request) => {
    const filePath = await storage.resolveAssetFilePath(request.url)
    if (!filePath) {
      return new Response('Not Found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).href)
  })
}

function createWindow(): void {
  const iconPath = resolveAppIconPath()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: APP_NAME,
    ...(iconPath ? { icon: iconPath } : {}),
    show: false,
    backgroundColor: '#111827',
    roundedCorners: process.platform === 'win32',
    ...(process.platform !== 'darwin' ? { autoHideMenuBar: true } : {}),
    ...getWindowChromeOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })

  disableBackgroundThrottling(mainWindow)
  hideInWindowMenuBar()

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false)
  })
  mainWindow.on('leave-full-screen', () => {
    const win = getMainWindow()
    if (win) restoreImmersiveFullscreenIfNeeded(win)
  })

  mainWindow.on('close', (e) => {
    if (!isDirty) return
    e.preventDefault()
    void (async () => {
      const canClose = await confirmCloseWithUnsaved()
      if (canClose) {
        const win = getMainWindow()
        win?.destroy()
      }
    })()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    isDirty = false
    closeAfterSave = false
  })

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173')
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
    )
  }
}

void app.whenReady().then(() => {
  const iconPath = resolveAppIconPath()
  if (process.platform === 'darwin' && iconPath) {
    app.dock?.setIcon(iconPath)
  }

  registerIpcHandlers()
  registerAssetProtocol()
  void rebuildApplicationMenu()
  createWindow()

  app.on('browser-window-created', (_event, win) => {
    disableBackgroundThrottling(win)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
