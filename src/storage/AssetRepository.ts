import type { AssetCategory, ListedAsset } from './types';

export interface AssetRepository {
  listAssets(projectId: string): Promise<ListedAsset[]>;
  uploadAsset(
    projectId: string,
    file: File,
    category: AssetCategory,
  ): Promise<string>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  getAssetUrl(projectId: string, assetId: string): Promise<string>;
}
