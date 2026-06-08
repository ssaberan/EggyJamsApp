import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Music,
  User,
  Box,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAssetStore, type AssetCategory } from '../../stores/assetStore';

interface AssetPickerProps {
  /** Which asset category to filter by */
  category: AssetCategory;
  /** Currently selected asset ID (null = none) */
  value: string | null | undefined;
  /** Called when the user selects or clears an asset */
  onChange: (assetId: string | null) => void;
  /** Label shown above the trigger */
  label?: string;
  /** Compact mode for inline use (e.g. next to an input) */
  compact?: boolean;
}

/** Placeholder icon for each category type */
function PlaceholderIcon({ category, className }: { category: AssetCategory; className?: string }) {
  switch (category) {
    case 'Background':
      return <ImageIcon className={className} />;
    case 'Character':
      return <User className={className} />;
    case 'Prop':
      return <Box className={className} />;
    case 'BGM':
    case 'SFX':
      return <Music className={className} />;
    default:
      return <ImageIcon className={className} />;
  }
}

const categoryLabels: Record<AssetCategory, string> = {
  Background: 'background',
  Character: 'sprite',
  Prop: 'prop',
  BGM: 'music track',
  SFX: 'sound effect',
};

export default function AssetPicker({
  category,
  value,
  onChange,
  label,
  compact = false,
}: AssetPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const assets = useAssetStore((s) => s.assets);
  const categoryAssets = useMemo(
    () => assets.filter((a) => a.category === category),
    [assets, category]
  );

  const selectedAsset = useMemo(
    () => (value ? categoryAssets.find((a) => a.id === value) ?? null : null),
    [value, categoryAssets]
  );

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

  const isImageCategory = category === 'Background' || category === 'Character' || category === 'Prop';

  // ── Compact mode (button-only, for inline use) ──
  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-500 hover:border-gray-500 dark:hover:border-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors cursor-pointer overflow-hidden"
          title={selectedAsset ? selectedAsset.file_name : `Select ${categoryLabels[category]}`}
        >
          {selectedAsset && isImageCategory ? (
            <img
              src={selectedAsset.file_url}
              alt={selectedAsset.file_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <PlaceholderIcon category={category} className="h-4 w-4" />
          )}
        </button>

        {open && (
          <PickerDropdown
            assets={categoryAssets}
            isImageCategory={isImageCategory}
            category={category}
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
          isImageCategory ? (
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
            <PlaceholderIcon category={category} className="h-4 w-4 text-gray-600" />
          </div>
        )}

        <span className={`flex-1 truncate ${selectedAsset ? 'text-gray-700 dark:text-gray-300' : 'text-gray-600'}`}>
          {selectedAsset ? selectedAsset.file_name : `No ${categoryLabels[category]}`}
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
          assets={categoryAssets}
          isImageCategory={isImageCategory}
          category={category}
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
  assets,
  isImageCategory,
  category,
  value,
  onChange,
}: {
  assets: { id: string; file_name: string; file_url: string; file_type: string }[];
  isImageCategory: boolean;
  category: AssetCategory;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
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

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <PlaceholderIcon category={category} className="h-6 w-6 text-gray-600" />
          <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-500">
            No {categoryLabels[category]}s uploaded yet.
          </p>
        </div>
      ) : isImageCategory ? (
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {assets.map((asset) => (
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
          {assets.map((asset) => (
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
  );
}
