import type { AssetRepository } from './AssetRepository';
import type { PreferencesRepository } from './PreferencesRepository';
import type { ProjectRepository } from './ProjectRepository';
import type { SaveRepository } from './SaveRepository';

function api() {
  const electron = window.electronAPI;
  if (!electron) {
    throw new Error('electronAPI is not available');
  }
  return electron;
}

export const electronProjectRepository: ProjectRepository = {
  listProjects: () => api().listProjects(),
  getProject: (id) => api().getProject(id),
  createProject: (title, parentDir) => api().createProject(title, parentDir),
  saveProject: (data) => api().saveProject(data),
  deleteProject: (id) => api().deleteProject(id),
  getProjectPath: (id) => api().getProjectPath(id),
  openProjectFromFolder: () => api().openProjectFromFolder(),
  saveProjectAs: (projectId) => api().saveProjectAs(projectId),
  getThumbnailUrl: (projectId) => api().getProjectThumbnailUrl(projectId),
  saveThumbnail: async (projectId, file) => {
    const buffer = await file.arrayBuffer();
    return api().saveProjectThumbnail(projectId, buffer);
  },
};

export const electronAssetRepository: AssetRepository = {
  listAssets: (projectId) => api().listAssets(projectId),
  uploadAsset: async (
    projectId: string,
    file: File,
    folderId?: string | null,
  ) => {
    const buffer = await file.arrayBuffer();
    return api().uploadAsset({
      projectId,
      fileName: file.name,
      folderId: folderId ?? null,
      buffer,
    });
  },
  deleteAsset: (projectId, assetId) =>
    api().deleteAsset(projectId, assetId),
  moveAsset: (projectId, assetId, folderId) =>
    api().moveAsset(projectId, assetId, folderId),
  createFolder: (projectId, name, parentId) =>
    api().createAssetFolder(projectId, name, parentId),
  renameFolder: (projectId, folderId, name) =>
    api().renameAssetFolder(projectId, folderId, name),
  deleteFolder: (projectId, folderId) =>
    api().deleteAssetFolder(projectId, folderId),
  getAssetUrl: (projectId, assetId) =>
    api().getAssetUrl(projectId, assetId),
};

export const electronSaveRepository: SaveRepository = {
  listSlots: (projectId) => api().listSlots(projectId),
  upsertSlot: (projectId, slotIndex, data) =>
    api().upsertSlot(projectId, slotIndex, data),
  deleteSlot: (projectId, slotIndex) =>
    api().deleteSlot(projectId, slotIndex),
};

export const electronPreferencesRepository: PreferencesRepository = {
  getPreferences: () => api().getPreferences(),
  savePreferences: (prefs) => api().savePreferences(prefs),
};
