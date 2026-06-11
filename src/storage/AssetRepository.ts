import type { AssetFolder, AssetLibrary } from './types';

export interface AssetRepository {
  listAssets(projectId: string): Promise<AssetLibrary>;
  uploadAsset(
    projectId: string,
    file: File,
    folderId?: string | null,
  ): Promise<string>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  moveAsset(
    projectId: string,
    assetId: string,
    folderId: string | null,
  ): Promise<void>;
  createFolder(
    projectId: string,
    name: string,
    parentId: string | null,
  ): Promise<AssetFolder>;
  renameFolder(
    projectId: string,
    folderId: string,
    name: string,
  ): Promise<void>;
  deleteFolder(projectId: string, folderId: string): Promise<void>;
  getAssetUrl(projectId: string, assetId: string): Promise<string>;
}
