import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload,
  Trash2,
  Music,
  Loader2,
  X,
  Image as ImageIcon,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import {
  useAssetStore,
  detectFileType,
  validateFile,
  type AssetCategory,
  type FilterCategory,
} from '../../stores/assetStore';

const FILTER_TABS: FilterCategory[] = ['All', 'Characters', 'Backgrounds', 'Props', 'Audio'];

const IMAGE_CATEGORIES: AssetCategory[] = ['Character', 'Background', 'Prop'];
const AUDIO_CATEGORIES: AssetCategory[] = ['BGM', 'SFX'];

export default function AssetsPanel() {
  const { projectId } = useParams<{ projectId: string }>();

  const assets = useAssetStore((s) => s.assets);
  const loading = useAssetStore((s) => s.loading);
  const uploading = useAssetStore((s) => s.uploading);
  const uploadProgress = useAssetStore((s) => s.uploadProgress);
  const filterCategory = useAssetStore((s) => s.filterCategory);
  const selectedAssetId = useAssetStore((s) => s.selectedAssetId);
  const error = useAssetStore((s) => s.error);
  const filteredAssets = useAssetStore((s) => s.filteredAssets);
  const fetchAssets = useAssetStore((s) => s.fetchAssets);
  const uploadAsset = useAssetStore((s) => s.uploadAsset);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const setFilterCategory = useAssetStore((s) => s.setFilterCategory);
  const setSelectedAssetId = useAssetStore((s) => s.setSelectedAssetId);
  const clearError = useAssetStore((s) => s.clearError);

  // Category picker state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch assets on mount
  useEffect(() => {
    if (projectId) {
      fetchAssets(projectId);
    }
  }, [projectId, fetchAssets]);

  // Auto-dismiss errors
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleFileSelected = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        useAssetStore.setState({ error: validationError });
        return;
      }

      const fileType = detectFileType(file.name);
      if (fileType === 'audio') {
        // Default audio to BGM, show picker for BGM/SFX choice
        setPendingFile(file);
        setShowCategoryPicker(true);
      } else if (fileType === 'image') {
        // Images need Character/Background choice
        setPendingFile(file);
        setShowCategoryPicker(true);
      }
    },
    []
  );

  const handleCategoryConfirm = useCallback(
    (category: AssetCategory) => {
      if (pendingFile && projectId) {
        uploadAsset(pendingFile, projectId, category);
      }
      setPendingFile(null);
      setShowCategoryPicker(false);
    },
    [pendingFile, projectId, uploadAsset]
  );

  const handleCategoryCancel = useCallback(() => {
    setPendingFile(null);
    setShowCategoryPicker(false);
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelected(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [handleFileSelected]
  );

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const displayedAssets = filteredAssets();
  const pendingFileType = pendingFile ? detectFileType(pendingFile.name) : null;
  const categoryOptions =
    pendingFileType === 'audio' ? AUDIO_CATEGORIES : IMAGE_CATEGORIES;

  return (
    <div className="flex h-full flex-col">
      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 border-b border-gray-300 dark:border-gray-700 px-2 py-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterCategory(tab)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              filterCategory === tab
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-gray-600 dark:text-gray-500 hover:bg-gray-700 hover:text-gray-700 dark:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-red-900/30 px-2.5 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Upload area ── */}
      <div className="px-2 pt-2">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
            dragOver
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                Uploading... {uploadProgress}%
              </span>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-gray-600 dark:text-gray-500" />
              <span className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                Drop files or click to upload
              </span>
              <span className="text-[10px] text-gray-600">
                Images &amp; Audio (max 10 MB)
              </span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* ── Category picker modal ── */}
      {showCategoryPicker && (
        <div className="mx-2 mt-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-800 p-3">
          <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            Choose category for{' '}
            <span className="text-indigo-400">
              {pendingFile?.name}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryConfirm(cat)}
                className="rounded-md bg-gray-700 px-3 py-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-indigo-600 hover:text-white cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={handleCategoryCancel}
            className="mt-2 text-[11px] text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Asset grid ── */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-500" />
          </div>
        ) : displayedAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon className="h-8 w-8 text-gray-700" />
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">
              {assets.length === 0
                ? 'No assets yet. Upload your first file!'
                : 'No assets match this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {displayedAssets.map((asset) => (
              <AssetThumbnail
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onSelect={() => setSelectedAssetId(asset.id)}
                onDelete={() => deleteAsset(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Preview pane ── */}
      {selectedAsset && (
        <div className="border-t border-gray-300 dark:border-gray-700 p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
              {selectedAsset.file_name}
            </span>
            <button
              onClick={() => setSelectedAssetId(null)}
              className="text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedAsset.file_type === 'image' ? (
            <img
              src={selectedAsset.file_url}
              alt={selectedAsset.file_name}
              className="w-full rounded-md object-contain max-h-32 bg-gray-800"
            />
          ) : (
            <audio
              controls
              src={selectedAsset.file_url}
              className="w-full h-8"
            />
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              {selectedAsset.category}
            </span>
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              {selectedAsset.file_type}
            </span>
          </div>
          <div className="mt-2">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
              Asset ID
            </span>
            <div className="flex items-center gap-1.5 rounded bg-gray-100 dark:bg-gray-800 px-2 py-1">
              <span className="flex-1 truncate font-mono text-[10px] text-gray-600 dark:text-gray-400">
                {selectedAsset.id}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedAsset.id);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                title="Copy asset ID"
                className="shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                {copiedId ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Thumbnail sub-component ──

function AssetThumbnail({
  asset,
  isSelected,
  onSelect,
  onDelete,
}: {
  asset: { id: string; file_name: string; file_url: string; file_type: string; category: string };
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative aspect-square overflow-hidden rounded-md border transition-colors cursor-pointer ${
        isSelected
          ? 'border-indigo-500 ring-1 ring-indigo-500/50'
          : 'border-gray-300 dark:border-gray-700 hover:border-gray-600'
      }`}
    >
      {asset.file_type === 'image' ? (
        <img
          src={asset.file_url}
          alt={asset.file_name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-800">
          <Music className="h-5 w-5 text-gray-600 dark:text-gray-500" />
          <span className="mt-1 px-1 text-[9px] text-gray-600 dark:text-gray-500 truncate max-w-full">
            {asset.file_name}
          </span>
        </div>
      )}

      {/* Hover overlay with delete */}
      {hovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/80 text-white hover:bg-red-600 transition-colors cursor-pointer"
            title="Delete asset"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </div>
        </div>
      )}

      {/* Category badge */}
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] text-gray-700 dark:text-gray-300">
        {asset.category}
      </span>
    </button>
  );
}
