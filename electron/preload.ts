import { contextBridge, ipcRenderer } from 'electron'

import type { UploadAssetPayload } from './storage'
import type {
  AppPreferences,
  AssetFolder,
  AssetLibrary,
  ProjectData,
  ProjectMeta,
  ProjectRegistryEntry,
  SaveSlotData,
  SaveSlotMeta,
} from './types'

export type MenuAction =
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

export interface MenuActionPayload {
  action: MenuAction
  projectId?: string
}

export interface ImportFileResult {
  filePath: string
  buffer: ArrayBuffer
}

export interface PackageOfflineGamePayload {
  platform: 'windows' | 'mac'
  outputPath: string
  title: string
  safeName: string
  files: {
    relativePath: string
    data: ArrayBuffer
  }[]
}

const electronAPI = {
  listProjects: (): Promise<ProjectMeta[]> =>
    ipcRenderer.invoke('project:list'),

  getProject: (id: string): Promise<ProjectData | null> =>
    ipcRenderer.invoke('project:get', id),

  createProject: (title: string, parentDir?: string): Promise<ProjectData> =>
    ipcRenderer.invoke('project:create', title, parentDir),

  saveProject: (data: ProjectData): Promise<void> =>
    ipcRenderer.invoke('project:save', data),

  deleteProject: (id: string): Promise<void> =>
    ipcRenderer.invoke('project:delete', id),

  getProjectPath: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('project:getPath', id),

  openProjectFromFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('project:openFromFolder'),

  saveProjectAs: (projectId: string): Promise<string | null> =>
    ipcRenderer.invoke('project:saveAs', projectId),

  listRecentProjects: (): Promise<ProjectRegistryEntry[]> =>
    ipcRenderer.invoke('project:listRecent'),

  getDefaultProjectsDir: (): Promise<string> =>
    ipcRenderer.invoke('project:getDefaultProjectsDir'),

  getProjectThumbnailUrl: (projectId: string): Promise<string | null> =>
    ipcRenderer.invoke('project:getThumbnailUrl', projectId),

  saveProjectThumbnail: (projectId: string, buffer: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke('project:saveThumbnail', projectId, buffer),

  listAssets: (projectId: string): Promise<AssetLibrary> =>
    ipcRenderer.invoke('asset:list', projectId),

  uploadAsset: (payload: UploadAssetPayload): Promise<string> =>
    ipcRenderer.invoke('asset:upload', payload),

  deleteAsset: (projectId: string, assetId: string): Promise<void> =>
    ipcRenderer.invoke('asset:delete', projectId, assetId),

  moveAsset: (
    projectId: string,
    assetId: string,
    folderId: string | null,
  ): Promise<void> =>
    ipcRenderer.invoke('asset:move', projectId, assetId, folderId),

  createAssetFolder: (
    projectId: string,
    name: string,
    parentId: string | null,
  ): Promise<AssetFolder> =>
    ipcRenderer.invoke('asset:createFolder', projectId, name, parentId),

  renameAssetFolder: (
    projectId: string,
    folderId: string,
    name: string,
  ): Promise<void> =>
    ipcRenderer.invoke('asset:renameFolder', projectId, folderId, name),

  deleteAssetFolder: (projectId: string, folderId: string): Promise<void> =>
    ipcRenderer.invoke('asset:deleteFolder', projectId, folderId),

  getAssetUrl: (projectId: string, assetId: string): Promise<string> =>
    ipcRenderer.invoke('asset:getUrl', projectId, assetId),

  listSlots: (projectId: string): Promise<SaveSlotMeta[]> =>
    ipcRenderer.invoke('save:list', projectId),

  upsertSlot: (
    projectId: string,
    slotIndex: number,
    data: SaveSlotData,
  ): Promise<void> =>
    ipcRenderer.invoke('save:upsert', projectId, slotIndex, data),

  deleteSlot: (projectId: string, slotIndex: number): Promise<void> =>
    ipcRenderer.invoke('save:delete', projectId, slotIndex),

  getPreferences: (): Promise<AppPreferences> =>
    ipcRenderer.invoke('prefs:get'),

  savePreferences: (prefs: AppPreferences): Promise<void> =>
    ipcRenderer.invoke('prefs:save', prefs),

  readOfflineRunnerFile: (relativePath: string): Promise<string> =>
    ipcRenderer.invoke('export:readOfflineRunnerFile', relativePath),

  pickExportZipPath: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickExportZip', defaultName),

  pickExportWindowsExePath: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickExportWindowsExe', defaultName),

  pickExportMacZipPath: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickExportMacZip', defaultName),

  packageOfflineGame: (payload: PackageOfflineGamePayload): Promise<void> =>
    ipcRenderer.invoke('export:packageGame', payload),

  pickImportFile: (): Promise<ImportFileResult | null> =>
    ipcRenderer.invoke('dialog:pickImportFile'),

  pickProjectParentDirectory: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickProjectParentDirectory', title),

  writeFile: (filePath: string, buffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, buffer),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  setDirty: (dirty: boolean): void => {
    ipcRenderer.send('app:setDirty', dirty)
  },

  setProjectTitle: (title: string | null): void => {
    ipcRenderer.send('app:setProjectTitle', title)
  },

  notifySaveFinished: (): void => {
    ipcRenderer.send('app:saveFinished')
  },

  refreshMenu: (): void => {
    ipcRenderer.send('app:refreshMenu')
  },

  onMenuAction: (callback: (payload: MenuActionPayload) => void): (() => void) => {
    const listener = (_event: unknown, payload: MenuActionPayload) => {
      callback(payload)
    }
    ipcRenderer.on('menu:action', listener)
    return () => {
      ipcRenderer.removeListener('menu:action', listener)
    }
  },

  getPlatform: (): Promise<NodeJS.Platform> =>
    ipcRenderer.invoke('app:getPlatform'),

  usesCustomTitleBar: (): Promise<boolean> =>
    ipcRenderer.invoke('app:usesCustomTitleBar'),

  getTitleBarMode: (): Promise<'native' | 'integrated' | 'custom'> =>
    ipcRenderer.invoke('app:getTitleBarMode'),

  setTitleBarTheme: (theme: 'light' | 'dark'): void => {
    ipcRenderer.send('app:setTitleBarTheme', theme)
  },

  setImmersivePlay: (immersive: boolean): void => {
    ipcRenderer.send('app:setImmersivePlay', immersive)
  },

  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),

  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),

  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),

  windowIsMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke('window:isMaximized'),

  onMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: unknown, maximized: boolean) => {
      callback(maximized)
    }
    ipcRenderer.on('window:maximized-changed', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
