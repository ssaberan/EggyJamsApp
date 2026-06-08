import type {
  AppPreferences,
  AssetCategory,
  ListedAsset,
  ProjectData,
  ProjectMeta,
  ProjectRegistryEntry,
  SaveSlotData,
  SaveSlotMeta,
} from '../storage/types';

export interface UploadAssetIpcPayload {
  projectId: string;
  fileName: string;
  category: AssetCategory;
  buffer: ArrayBuffer;
}

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
  | 'save-and-close';

export interface MenuActionPayload {
  action: MenuAction;
  projectId?: string;
}

export interface ImportFileResult {
  filePath: string;
  buffer: ArrayBuffer;
}

export interface OfflineGameFilePayload {
  relativePath: string;
  data: ArrayBuffer;
}

export interface PackageOfflineGamePayload {
  platform: 'windows' | 'mac';
  outputPath: string;
  title: string;
  safeName: string;
  files: OfflineGameFilePayload[];
}

export interface ElectronAPI {
  listProjects(): Promise<ProjectMeta[]>;
  getProject(id: string): Promise<ProjectData | null>;
  createProject(title: string, parentDir?: string): Promise<ProjectData>;
  saveProject(data: ProjectData): Promise<void>;
  deleteProject(id: string): Promise<void>;
  getProjectPath(id: string): Promise<string | null>;
  openProjectFromFolder(): Promise<string | null>;
  saveProjectAs(projectId: string): Promise<string | null>;
  listRecentProjects(): Promise<ProjectRegistryEntry[]>;
  getDefaultProjectsDir(): Promise<string>;

  getProjectThumbnailUrl(projectId: string): Promise<string | null>;
  saveProjectThumbnail(projectId: string, buffer: ArrayBuffer): Promise<string>;

  listAssets(projectId: string): Promise<ListedAsset[]>;
  uploadAsset(payload: UploadAssetIpcPayload): Promise<string>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  getAssetUrl(projectId: string, assetId: string): Promise<string>;

  listSlots(projectId: string): Promise<SaveSlotMeta[]>;
  upsertSlot(
    projectId: string,
    slotIndex: number,
    data: SaveSlotData,
  ): Promise<void>;
  deleteSlot(projectId: string, slotIndex: number): Promise<void>;

  getPreferences(): Promise<AppPreferences>;
  savePreferences(prefs: AppPreferences): Promise<void>;

  readOfflineRunnerFile(relativePath: string): Promise<string>;
  pickExportZipPath(defaultName: string): Promise<string | null>;
  pickExportWindowsExePath(defaultName: string): Promise<string | null>;
  pickExportMacZipPath(defaultName: string): Promise<string | null>;
  packageOfflineGame(payload: PackageOfflineGamePayload): Promise<void>;
  pickImportFile(): Promise<ImportFileResult | null>;
  pickProjectParentDirectory(title?: string): Promise<string | null>;
  writeFile(filePath: string, buffer: ArrayBuffer): Promise<void>;
  getAppVersion(): Promise<string>;

  setDirty(dirty: boolean): void;
  setProjectTitle(title: string | null): void;
  notifySaveFinished(): void;
  refreshMenu(): void;
  onMenuAction(callback: (payload: MenuActionPayload) => void): () => void;

  getPlatform(): Promise<NodeJS.Platform>;
  usesCustomTitleBar(): Promise<boolean>;
  getTitleBarMode(): Promise<'native' | 'integrated' | 'custom'>;
  setTitleBarTheme(theme: 'light' | 'dark'): void;
  setImmersivePlay(immersive: boolean): void;
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  onMaximizedChange(callback: (maximized: boolean) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
