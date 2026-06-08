import { create } from 'zustand';
import { assetRepository } from '../storage';
import type { ListedAsset } from '../storage';
import { setUrlFileType } from '../lib/assetPreloader';
import { convertToWebpIfBeneficial } from '../utils/imageConversion';

// ── Types ──

export type AssetFileType = 'image' | 'audio';
export type AssetCategory = 'Background' | 'Character' | 'BGM' | 'SFX' | 'Prop';
export type FilterCategory = 'All' | 'Characters' | 'Backgrounds' | 'Audio' | 'Props';

export interface Asset {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: AssetFileType;
  category: AssetCategory;
  created_at: string;
}

// ── Helpers ──

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function detectFileType(fileName: string): AssetFileType | null {
  const ext = getFileExtension(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  return null;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds 10 MB limit.';
  }
  const fileType = detectFileType(file.name);
  if (!fileType) {
    const allowed = [...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS].join(', ');
    return `Unsupported file type. Allowed: ${allowed}`;
  }
  return null;
}

function listedToAsset(listed: ListedAsset, projectId: string): Asset {
  setUrlFileType(listed.fileUrl, listed.fileType);
  return {
    id: listed.id,
    project_id: projectId,
    user_id: '',
    file_name: listed.fileName,
    file_url: listed.fileUrl,
    file_type: listed.fileType,
    category: listed.category,
    created_at: listed.createdAt ?? new Date().toISOString(),
  };
}

/** Map the UI filter tabs to asset categories */
function filterMatches(asset: Asset, filter: FilterCategory): boolean {
  if (filter === 'All') return true;
  if (filter === 'Characters') return asset.category === 'Character';
  if (filter === 'Backgrounds') return asset.category === 'Background';
  if (filter === 'Audio') return asset.file_type === 'audio';
  if (filter === 'Props') return asset.category === 'Prop';
  return true;
}

// ── Store ──

interface AssetState {
  // State
  assets: Asset[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  selectedAssetId: string | null;
  filterCategory: FilterCategory;
  error: string | null;
  currentProjectId: string | null;

  // Computed
  filteredAssets: () => Asset[];

  // Actions
  fetchAssets: (projectId: string) => Promise<void>;
  uploadAsset: (
    file: File,
    projectId: string,
    category: AssetCategory
  ) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  setFilterCategory: (category: FilterCategory) => void;
  setSelectedAssetId: (id: string | null) => void;
  clearError: () => void;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  // Initial state
  assets: [],
  loading: false,
  uploading: false,
  uploadProgress: 0,
  selectedAssetId: null,
  filterCategory: 'All',
  error: null,
  currentProjectId: null,

  // Computed
  filteredAssets: () => {
    const { assets, filterCategory } = get();
    return assets.filter((a) => filterMatches(a, filterCategory));
  },

  // Actions
  fetchAssets: async (projectId) => {
    set({ loading: true, error: null, currentProjectId: projectId });
    try {
      const listed = await assetRepository.listAssets(projectId);
      const assets = listed.map((item) => listedToAsset(item, projectId));
      set({ assets, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch assets',
        loading: false,
      });
    }
  },

  uploadAsset: async (file, projectId, category) => {
    const validationError = validateFile(file);
    if (validationError) {
      set({ error: validationError });
      return;
    }

    const fileType = detectFileType(file.name)!;

    set({ uploading: true, uploadProgress: 0, error: null });

    try {
      const converted = fileType === 'image'
        ? await convertToWebpIfBeneficial(file, file.name)
        : {
            blob: file,
            fileName: file.name,
            ext: getFileExtension(file.name),
            converted: false,
          };

      set({ uploadProgress: 40 });

      const uploadFile = new File([converted.blob], converted.fileName, {
        type: converted.blob.type || file.type,
      });

      await assetRepository.uploadAsset(projectId, uploadFile, category);

      set({ uploadProgress: 100 });

      await get().fetchAssets(projectId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      set({ uploading: false, uploadProgress: 0 });
    }
  },

  deleteAsset: async (assetId) => {
    const { assets, currentProjectId } = get();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset || !currentProjectId) return;

    set({ error: null });

    try {
      await assetRepository.deleteAsset(currentProjectId, assetId);

      set({
        assets: assets.filter((a) => a.id !== assetId),
        selectedAssetId:
          get().selectedAssetId === assetId ? null : get().selectedAssetId,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  },

  setFilterCategory: (category) => set({ filterCategory: category }),
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  clearError: () => set({ error: null }),
}));
