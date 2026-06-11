import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Search,
} from 'lucide-react';
import {
  useAssetStore,
  getFolderPath,
  type Asset,
  type AssetFolder,
} from '../../stores/assetStore';

const ASSET_DRAG_TYPE = 'application/x-eggyjams-asset';

/** Drop target: a folder id, 'root', or null (no active target). */
type DropTarget = string | 'root' | null;

export default function AssetsPanel() {
  const { projectId } = useParams<{ projectId: string }>();

  const assets = useAssetStore((s) => s.assets);
  const folders = useAssetStore((s) => s.folders);
  const loading = useAssetStore((s) => s.loading);
  const uploading = useAssetStore((s) => s.uploading);
  const uploadProgress = useAssetStore((s) => s.uploadProgress);
  const selectedAssetId = useAssetStore((s) => s.selectedAssetId);
  const searchQuery = useAssetStore((s) => s.searchQuery);
  const error = useAssetStore((s) => s.error);
  const fetchAssets = useAssetStore((s) => s.fetchAssets);
  const uploadAssets = useAssetStore((s) => s.uploadAssets);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const moveAsset = useAssetStore((s) => s.moveAsset);
  const createFolder = useAssetStore((s) => s.createFolder);
  const renameFolder = useAssetStore((s) => s.renameFolder);
  const deleteFolder = useAssetStore((s) => s.deleteFolder);
  const setSelectedAssetId = useAssetStore((s) => s.setSelectedAssetId);
  const setSearchQuery = useAssetStore((s) => s.setSearchQuery);
  const clearError = useAssetStore((s) => s.clearError);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [uploadZoneActive, setUploadZoneActive] = useState(false);
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
      const timer = setTimeout(clearError, 8000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Reset stale folder selection (e.g. after folder delete)
  useEffect(() => {
    if (selectedFolderId && !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(null);
    }
  }, [folders, selectedFolderId]);

  const childFolders = useMemo(() => {
    const map = new Map<string | null, AssetFolder[]>();
    for (const folder of folders) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  const assetsByFolder = useMemo(() => {
    const map = new Map<string | null, Asset[]>();
    for (const asset of assets) {
      const list = map.get(asset.folder_id) ?? [];
      list.push(asset);
      map.set(asset.folder_id, list);
    }
    return map;
  }, [assets]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return assets.filter((a) => a.file_name.toLowerCase().includes(query));
  }, [assets, searchQuery]);

  const handleUploadFiles = useCallback(
    (files: File[], folderId: string | null) => {
      if (files.length > 0 && projectId) {
        uploadAssets(files, projectId, folderId);
      }
    },
    [projectId, uploadAssets],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleUploadFiles(Array.from(e.target.files ?? []), selectedFolderId);
      // Reset so the same files can be re-selected
      e.target.value = '';
    },
    [handleUploadFiles, selectedFolderId],
  );

  // ── Folder actions ──

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleNewFolder = useCallback(async () => {
    const folder = await createFolder('New Folder', selectedFolderId);
    if (folder) {
      if (folder.parentId) {
        setExpandedIds((prev) => new Set(prev).add(folder.parentId!));
      }
      setRenamingFolderId(folder.id);
    }
  }, [createFolder, selectedFolderId]);

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      if (selectedFolderId === folderId) {
        toggleExpanded(folderId);
      } else {
        setSelectedFolderId(folderId);
        setExpandedIds((prev) => new Set(prev).add(folderId));
      }
    },
    [selectedFolderId, toggleExpanded],
  );

  const handleDeleteFolder = useCallback(
    (folder: AssetFolder) => {
      const hasContents =
        assets.some((a) => a.folder_id === folder.id) ||
        folders.some((f) => f.parentId === folder.id);
      const message = hasContents
        ? `Delete folder "${folder.name}"? Its contents will move up one level.`
        : `Delete folder "${folder.name}"?`;
      if (window.confirm(message)) {
        deleteFolder(folder.id);
      }
    },
    [assets, folders, deleteFolder],
  );

  // ── Drag & drop ──

  const handleDropOn = useCallback(
    (e: React.DragEvent, folderId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      setUploadZoneActive(false);

      const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE);
      if (assetId) {
        const asset = assets.find((a) => a.id === assetId);
        if (asset && asset.folder_id !== folderId) {
          moveAsset(assetId, folderId);
        }
        return;
      }

      handleUploadFiles(Array.from(e.dataTransfer.files), folderId);
    },
    [assets, moveAsset, handleUploadFiles],
  );

  const isDraggable = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(ASSET_DRAG_TYPE) ||
    e.dataTransfer.types.includes('Files');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const rootFolders = childFolders.get(null) ?? [];
  const rootAssets = assetsByFolder.get(null) ?? [];

  // ── Recursive folder node ──

  const renderFolder = (folder: AssetFolder, depth: number) => {
    const isExpanded = expandedIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isDropTarget = dropTarget === folder.id;
    const subfolders = childFolders.get(folder.id) ?? [];
    const folderAssets = assetsByFolder.get(folder.id) ?? [];
    const isRenaming = renamingFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          onClick={() => handleSelectFolder(folder.id)}
          onDragOver={(e) => {
            if (!isDraggable(e)) return;
            e.preventDefault();
            e.stopPropagation();
            setDropTarget(folder.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            setDropTarget((prev) => (prev === folder.id ? null : prev));
          }}
          onDrop={(e) => handleDropOn(e, folder.id)}
          style={{ paddingLeft: `${4 + depth * 12}px` }}
          className={`group/folder flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1 transition-colors ${
            isDropTarget
              ? 'bg-indigo-600/30 ring-1 ring-inset ring-indigo-500'
              : isSelected
                ? 'bg-indigo-600/15'
                : 'hover:bg-gray-300/60 dark:hover:bg-gray-700/50'
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(folder.id);
            }}
            className="shrink-0 cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {isExpanded ? (
            <FolderOpen
              className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}
            />
          ) : (
            <Folder
              className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}
            />
          )}

          {isRenaming ? (
            <FolderNameInput
              initialValue={folder.name}
              onCommit={(name) => {
                setRenamingFolderId(null);
                renameFolder(folder.id, name);
              }}
              onCancel={() => setRenamingFolderId(null)}
            />
          ) : (
            <>
              <span
                className={`flex-1 truncate text-[11px] font-medium ${
                  isSelected
                    ? 'text-indigo-500 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {folder.name}
              </span>
              <span className="shrink-0 text-[9px] text-gray-500 dark:text-gray-600">
                {folderAssets.length > 0 ? folderAssets.length : ''}
              </span>
              <span className="hidden shrink-0 items-center gap-0.5 group-hover/folder:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFolderId(folder.id);
                  }}
                  title="Rename folder"
                  className="cursor-pointer rounded p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder);
                  }}
                  title="Delete folder"
                  className="cursor-pointer rounded p-0.5 text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </>
          )}
        </div>

        {isExpanded && (
          <div>
            {subfolders.map((sub) => renderFolder(sub, depth + 1))}
            {folderAssets.length > 0 ? (
              <div
                className="grid grid-cols-3 gap-1.5 py-1 pr-1"
                style={{ paddingLeft: `${16 + depth * 12}px` }}
              >
                {folderAssets.map((asset) => (
                  <AssetThumbnail
                    key={asset.id}
                    asset={asset}
                    isSelected={asset.id === selectedAssetId}
                    onSelect={() => setSelectedAssetId(asset.id)}
                    onDelete={() => deleteAsset(asset.id)}
                  />
                ))}
              </div>
            ) : subfolders.length === 0 ? (
              <p
                className="py-1 text-[10px] italic text-gray-500 dark:text-gray-600"
                style={{ paddingLeft: `${24 + depth * 12}px` }}
              >
                Empty
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar: search + new folder ── */}
      <div className="flex items-center gap-1.5 border-b border-gray-300 dark:border-gray-700 px-2 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 pl-6 pr-6 text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          onClick={handleNewFolder}
          title={
            selectedFolder
              ? `New folder in "${selectedFolder.name}"`
              : 'New folder'
          }
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 p-1.5 text-gray-600 dark:text-gray-400 transition-colors hover:border-indigo-500 hover:text-indigo-400"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-2 mt-2 flex items-center gap-2 rounded-md bg-red-900/30 px-2.5 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 break-words">{error}</span>
          <button onClick={clearError} className="cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Upload area ── */}
      <div className="px-2 pt-2">
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.stopPropagation();
            setUploadZoneActive(true);
          }}
          onDragLeave={() => setUploadZoneActive(false)}
          onDrop={(e) => handleDropOn(e, selectedFolderId)}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-3 transition-colors ${
            uploadZoneActive
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading && uploadProgress ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              <span className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                Uploading {Math.min(uploadProgress.done + 1, uploadProgress.total)} of{' '}
                {uploadProgress.total}...
              </span>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-gray-600 dark:text-gray-500" />
              <span className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                Drop files or click to upload
              </span>
              <span className="text-[10px] text-gray-600">
                {selectedFolder
                  ? `Uploads to "${selectedFolder.name}"`
                  : 'Images & Audio (max 10 MB each)'}
              </span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* ── Library body ── */}
      <div
        className={`mt-2 flex-1 overflow-y-auto px-2 pb-2 transition-colors ${
          dropTarget === 'root' ? 'bg-indigo-600/10' : ''
        }`}
        onClick={(e) => {
          // Clicking empty space deselects the current folder (back to root)
          if (e.target === e.currentTarget) setSelectedFolderId(null);
        }}
        onDragOver={(e) => {
          if (!isDraggable(e)) return;
          e.preventDefault();
          setDropTarget('root');
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) {
            setDropTarget((prev) => (prev === 'root' ? null : prev));
          }
        }}
        onDrop={(e) => handleDropOn(e, null)}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-500" />
          </div>
        ) : searchResults ? (
          // ── Search results (flat) ──
          searchResults.length === 0 ? (
            <EmptyState message={`No assets match "${searchQuery.trim()}".`} />
          ) : (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {searchResults.map((asset) => (
                <AssetThumbnail
                  key={asset.id}
                  asset={asset}
                  isSelected={asset.id === selectedAssetId}
                  onSelect={() => setSelectedAssetId(asset.id)}
                  onDelete={() => deleteAsset(asset.id)}
                />
              ))}
            </div>
          )
        ) : folders.length === 0 && assets.length === 0 ? (
          <EmptyState message="No assets yet. Upload your first files!" />
        ) : (
          // ── Folder tree ──
          <div className="space-y-0.5 pt-0.5">
            {rootFolders.map((folder) => renderFolder(folder, 0))}
            {rootAssets.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {rootAssets.map((asset) => (
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
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              {selectedAsset.file_type}
            </span>
            <span className="flex items-center gap-1 rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
              <Folder className="h-2.5 w-2.5" />
              {getFolderPath(folders, selectedAsset.folder_id) || 'Root'}
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

// ── Empty state ──

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <ImageIcon className="h-8 w-8 text-gray-700" />
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">{message}</p>
    </div>
  );
}

// ── Inline folder rename input ──

function FolderNameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => (value.trim() ? onCommit(value) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (value.trim()) onCommit(value);
          else onCancel();
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      className="w-full min-w-0 flex-1 rounded border border-indigo-500 bg-white dark:bg-gray-900 px-1 py-0.5 text-[11px] text-gray-800 dark:text-gray-200 focus:outline-none"
    />
  );
}

// ── Thumbnail sub-component ──

function AssetThumbnail({
  asset,
  isSelected,
  onSelect,
  onDelete,
}: {
  asset: Asset;
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={asset.file_name}
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
          draggable={false}
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
    </button>
  );
}
