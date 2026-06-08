export type {
  AppPreferences,
  AppTheme,
  AssetCategory,
  AssetFileType,
  AssetManifest,
  AssetRecord,
  GameVariables,
  GraphData,
  ListedAsset,
  ProjectData,
  ProjectMeta,
  ProjectRegistryEntry,
  SaveSlotData,
  SaveSlotMeta,
} from './types';

export type { ProjectRepository } from './ProjectRepository';
export type { AssetRepository } from './AssetRepository';
export type { SaveRepository } from './SaveRepository';
export type { PreferencesRepository } from './PreferencesRepository';

import {
  electronAssetRepository,
  electronPreferencesRepository,
  electronProjectRepository,
  electronSaveRepository,
} from './electronStorage';
import type { AssetRepository } from './AssetRepository';
import type { PreferencesRepository } from './PreferencesRepository';
import type { ProjectRepository } from './ProjectRepository';
import type { SaveRepository } from './SaveRepository';

const NOT_IMPLEMENTED = 'Storage not implemented';

function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

const stubProjectRepository: ProjectRepository = {
  listProjects: () => notImplemented(),
  getProject: () => notImplemented(),
  createProject: () => notImplemented(),
  saveProject: () => notImplemented(),
  deleteProject: () => notImplemented(),
  getProjectPath: () => notImplemented(),
  getThumbnailUrl: () => notImplemented(),
  saveThumbnail: () => notImplemented(),
};

const stubAssetRepository: AssetRepository = {
  listAssets: () => notImplemented(),
  uploadAsset: () => notImplemented() as Promise<string>,
  deleteAsset: () => notImplemented(),
  getAssetUrl: () => notImplemented(),
};

const stubSaveRepository: SaveRepository = {
  listSlots: () => notImplemented(),
  upsertSlot: () => notImplemented(),
  deleteSlot: () => notImplemented(),
};

const stubPreferencesRepository: PreferencesRepository = {
  getPreferences: () => notImplemented(),
  savePreferences: () => notImplemented(),
};

const isElectron =
  typeof window !== 'undefined' && window.electronAPI !== undefined;

export const projectRepository: ProjectRepository = isElectron
  ? electronProjectRepository
  : stubProjectRepository;

export const assetRepository: AssetRepository = isElectron
  ? electronAssetRepository
  : stubAssetRepository;

export const saveRepository: SaveRepository = isElectron
  ? electronSaveRepository
  : stubSaveRepository;

export const preferencesRepository: PreferencesRepository = isElectron
  ? electronPreferencesRepository
  : stubPreferencesRepository;
