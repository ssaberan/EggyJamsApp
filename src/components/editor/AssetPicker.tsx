import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Music,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  useAssetStore,
  getFolderPath,
  type Asset,
  type AssetFileType,
} from '../../stores/assetStore';

interface AssetPickerProps {
  /** Which file type to show: 'image' or 'audio' */
  kind: AssetFileType;
  /** Currently selected asset ID (null = none) */
  value: string | null | undefined;
  /** Called when the user selects or clears an asset */
  onChange: (assetId: string | null) => void;
  /** What the asset is used as, e.g. "background", "sprite", "music track" (used in placeholders) */
  assetLabel?: string;
  /** Label shown above the trigger */
  label?: string;
  /** Compact mode for inline use (e.g. next to an input) */
  compact?: boolean;
}

function PlaceholderIcon({ kind, className }: { kind: AssetFileType; className?: string }) {
  return kind === 'audio' ? (
    <Music className={className} />
  ) : (
    <ImageIcon className={className} />
  );
}

interface AssetGroup {
  /** Folder path like "Characters / Heroes" (empty string for root) */
  path: string;
  assets: Asset[];
}

export default function AssetPicker({
  kind,
  value,
  onChange,
  assetLabel,
  label,
  compact = false,
}: AssetPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const assets = useAssetStore((s) => s.assets);
  const folders = useAssetStore((s) => s.folders);

  const kindAssets = useMemo(
    () => assets.filter((a) => a.file_type === kind),
    [assets, kind],
  );

  // Group by folder path: root assets first, then folders alphabetically.
  const groups = useMemo<AssetGroup[]>(() => {
    const byPath = new Map<string, Asset[]>();
    for (const asset of kindAssets) {
      const path = getFolderPath(folders, asset.folder_id);
      const list = byPath.get(path) ?? [];
      list.push(asset);
      byPath.set(path, list);
    }
    return [...byPath.entries()]
      .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
      .map(([path, groupAssets]) => ({ path, assets: groupAssets }));
  }, [kindAssets, folders]);

  const selectedAsset = useMemo(
    () => (value ? kindAssets.find((a) => a.id === value) ?? null : null),
    [value, kindAssets],
  );

  const displayLabel = assetLabel ?? (kind === 'audio' ? 'audio file' : 'image');

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // ── Compact mode (button-only, for inline use) ──
  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-500 hover:border-gray-500 dark:hover:border-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors cursor-pointer overflow-hidden"
          title={selectedAsset ? selectedAsset.file_name : `Select ${displayLabel}`}
        >
          {selectedAsset && kind === 'image' ? (
            <img
              src={selectedAsset.file_url}
              alt={selectedAsset.file_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <PlaceholderIcon kind={kind} className="h-4 w-4" />
          )}
        </button>

        {open && (
          <PickerDropdown
            groups={groups}
            kind={kind}
            displayLabel={displayLabel}
            value={value ?? null}
            onChange={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  // ── Full mode (label + trigger + dropdown) ──
  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left hover:border-gray-500 dark:hover:border-gray-500 transition-colors cursor-pointer"
      >
        {/* Preview thumbnail */}
        {selectedAsset ? (
          kind === 'image' ? (
            <img
              src={selectedAsset.file_url}
              alt={selectedAsset.file_name}
              className="h-8 w-8 rounded object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 dark:bg-gray-800 shrink-0">
              <Music className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
          )
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-700 shrink-0">
            <PlaceholderIcon kind={kind} className="h-4 w-4 text-gray-600" />
          </div>
        )}

        <span className={`flex-1 truncate ${selectedAsset ? 'text-gray-700 dark:text-gray-300' : 'text-gray-600'}`}>
          {selectedAsset ? selectedAsset.file_name : `No ${displayLabel}`}
        </span>

        {selectedAsset ? (
          <X
            className="h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-gray-500" />
        )}
      </button>

      {open && (
        <PickerDropdown
          groups={groups}
          kind={kind}
          displayLabel={displayLabel}
          value={value ?? null}
          onChange={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Dropdown Panel ──

function PickerDropdown({
  groups,
  kind,
  displayLabel,
  value,
  onChange,
}: {
  groups: AssetGroup[];
  kind: AssetFileType;
  displayLabel: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const isEmpty = groups.length === 0;

  return (
    <div className="absolute left-0 z-50 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 shadow-xl">
      {/* Clear / None option */}
      <button
        onClick={() => onChange(null)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
          value === null
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700/50 hover:text-gray-800 dark:text-gray-200'
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-gray-400 dark:border-gray-600 shrink-0">
          <X className="h-3.5 w-3.5 text-gray-600 dark:text-gray-500" />
        </div>
        <span>None</span>
      </button>

      <div className="border-t border-gray-300 dark:border-gray-700" />

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <PlaceholderIcon kind={kind} className="h-6 w-6 text-gray-600" />
          <p className="mt-1.5 px-3 text-[11px] text-gray-600 dark:text-gray-500">
            No {displayLabel}s uploaded yet.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.path || '__root__'}>
            {group.path && (
              <div className="px-2.5 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                {group.path}
              </div>
            )}
            {kind === 'image' ? (
              <div className="grid grid-cols-3 gap-1 p-1.5">
                {group.assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onChange(asset.id)}
                    className={`relative aspect-square overflow-hidden rounded-md border transition-colors cursor-pointer ${
                      asset.id === value
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500'
                    }`}
                    title={asset.file_name}
                  >
                    <img
                      src={asset.file_url}
                      alt={asset.file_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-1">
                {group.assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onChange(asset.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
                      asset.id === value
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Music className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-500" />
                    <span className="flex-1 truncate text-left">{asset.file_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
