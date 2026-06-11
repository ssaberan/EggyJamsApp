import { create } from 'zustand';
import { assetRepository } from '../storage';
import type { AssetFolder, ListedAsset } from '../storage';
import { setUrlFileType } from '../lib/assetPreloader';
import { convertToWebpIfBeneficial } from '../utils/imageConversion';

// ── Types ──

export type AssetFileType = 'image' | 'audio';

export type { AssetFolder };

export interface Asset {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: AssetFileType;
  folder_id: string | null;
  created_at: string;
}

export interface UploadProgress {
  done: number;
  total: number;
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

/** Human-readable folder path like "Characters / Heroes" (empty string for root). */
export function getFolderPath(
  folders: AssetFolder[],
  folderId: string | null,
): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = folderId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const folder = folders.find((f) => f.id === current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts.join(' / ');
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
    folder_id: listed.folderId,
    created_at: listed.createdAt ?? new Date().toISOString(),
  };
}

// ── Store ──

interface AssetState {
  // State
  assets: Asset[];
  folders: AssetFolder[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: UploadProgress | null;
  selectedAssetId: string | null;
  searchQuery: string;
  error: string | null;
  currentProjectId: string | null;

  // Actions
  fetchAssets: (projectId: string) => Promise<void>;
  uploadAssets: (
    files: File[],
    projectId: string,
    folderId?: string | null,
  ) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  moveAsset: (assetId: string, folderId: string | null) => Promise<void>;
  createFolder: (
    name: string,
    parentId: string | null,
  ) => Promise<AssetFolder | null>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  setSelectedAssetId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  // Initial state
  assets: [],
  folders: [],
  loading: false,
  uploading: false,
  uploadProgress: null,
  selectedAssetId: null,
  searchQuery: '',
  error: null,
  currentProjectId: null,

  // Actions
  fetchAssets: async (projectId) => {
    set({ loading: true, error: null, currentProjectId: projectId });
    try {
      const library = await assetRepository.listAssets(projectId);
      set({
        assets: library.assets.map((item) => listedToAsset(item, projectId)),
        folders: library.folders,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch assets',
        loading: false,
      });
    }
  },

  uploadAssets: async (files, projectId, folderId = null) => {
    if (files.length === 0) return;

    const failures: string[] = [];
    const valid: File[] = [];
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        failures.push(`${file.name}: ${validationError}`);
      } else {
        valid.push(file);
      }
    }

    if (valid.length > 0) {
      set({
        uploading: true,
        uploadProgress: { done: 0, total: valid.length },
        error: null,
      });

      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        try {
          const fileType = detectFileType(file.name)!;
          const converted =
            fileType === 'image'
              ? await convertToWebpIfBeneficial(file, file.name)
              : {
                  blob: file as Blob,
                  fileName: file.name,
                  ext: getFileExtension(file.name),
                  converted: false,
                };

          const uploadFile = new File([converted.blob], converted.fileName, {
            type: converted.blob.type || file.type,
          });

          await assetRepository.uploadAsset(projectId, uploadFile, folderId);
        } catch (err) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`,
          );
        }
        set({ uploadProgress: { done: i + 1, total: valid.length } });
      }

      await get().fetchAssets(projectId);
    }

    set({
      uploading: false,
      uploadProgress: null,
      error:
        failures.length === 0
          ? null
          : failures.length === 1
            ? `Upload failed — ${failures[0]}`
            : `${failures.length} files failed — ${failures.join('; ')}`,
    });
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

  moveAsset: async (assetId, folderId) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    try {
      await assetRepository.moveAsset(currentProjectId, assetId, folderId);
      set({
        assets: get().assets.map((a) =>
          a.id === assetId ? { ...a, folder_id: folderId } : a,
        ),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Move failed',
      });
    }
  },

  createFolder: async (name, parentId) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return null;

    try {
      const folder = await assetRepository.createFolder(
        currentProjectId,
        name,
        parentId,
      );
      set({ folders: [...get().folders, folder] });
      return folder;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to create folder',
      });
      return null;
    }
  },

  renameFolder: async (folderId, name) => {
    const { currentProjectId } = get();
    const trimmed = name.trim();
    if (!currentProjectId || !trimmed) return;

    try {
      await assetRepository.renameFolder(currentProjectId, folderId, trimmed);
      set({
        folders: get().folders.map((f) =>
          f.id === folderId ? { ...f, name: trimmed } : f,
        ),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to rename folder',
      });
    }
  },

  deleteFolder: async (folderId) => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;

    try {
      await assetRepository.deleteFolder(currentProjectId, folderId);
      // Contents are reparented on disk; refetch to pick up the new layout.
      await get().fetchAssets(currentProjectId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to delete folder',
      });
    }
  },

  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearError: () => set({ error: null }),
}));
