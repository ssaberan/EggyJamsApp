import { useMemo } from 'react';
import { type Node } from '@xyflow/react';
import { Image as ImageIcon, Music } from 'lucide-react';
import AssetPicker from './AssetPicker';
import { useGraphStore, type SceneNodeData, type BackgroundSizeMode, type BackgroundPosition, BG_POSITION_CSS } from '../../stores/graphStore';
import { useAssetStore } from '../../stores/assetStore';

interface SceneSettingsPanelProps {
  node: Node;
}

export default function SceneSettingsPanel({ node }: SceneSettingsPanelProps) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const assets = useAssetStore((s) => s.assets);
  const nodeData = node.data as SceneNodeData;

  const backgroundImageId = (nodeData.backgroundImageId as string) ?? null;
  const backgroundMusicId = (nodeData.backgroundMusicId as string) ?? null;
  const backgroundSize: BackgroundSizeMode = (nodeData.backgroundSize as BackgroundSizeMode) ?? 'cover';
  const backgroundPosition: BackgroundPosition = (nodeData.backgroundPosition as BackgroundPosition) ?? 'center';

  const objectFitClass = { cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' } as const;

  // Resolve the selected background to its full asset for preview
  const backgroundAsset = useMemo(
    () => (backgroundImageId ? assets.find((a) => a.id === backgroundImageId) ?? null : null),
    [backgroundImageId, assets]
  );

  return (
    <div className="space-y-4">
      {/* ── Section header ── */}
      <div className="flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-600 dark:text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500">
          Scene Settings
        </span>
      </div>

      {/* ── Background Selector ── */}
      <AssetPicker
        label="Background"
        kind="image"
        assetLabel="background"
        value={backgroundImageId}
        onChange={(assetId) => updateNodeData(node.id, { backgroundImageId: assetId })}
      />

      {/* Background Size */}
      {backgroundImageId && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Background Size
          </label>
          <div className="flex gap-1">
            {(['cover', 'contain', 'fill'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateNodeData(node.id, { backgroundSize: mode })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer capitalize ${
                  backgroundSize === mode
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                    : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Background Position (for contain and cover) */}
      {backgroundImageId && (backgroundSize === 'contain' || backgroundSize === 'cover') && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Background Position
          </label>
          <div className="flex gap-1">
            {([['start', 'Start'], ['center', 'Center'], ['end', 'End']] as const).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => updateNodeData(node.id, { backgroundPosition: pos })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  backgroundPosition === pos
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                    : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Background preview */}
      {backgroundAsset ? (
        <div className="overflow-hidden rounded-md border border-gray-300 dark:border-gray-700">
          <img
            src={backgroundAsset.file_url}
            alt={backgroundAsset.file_name}
            className={`w-full max-h-32 ${objectFitClass[backgroundSize]}`}
            style={{ objectPosition: BG_POSITION_CSS[backgroundPosition] }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-6">
          <div className="flex flex-col items-center gap-1.5">
            <ImageIcon className="h-6 w-6 text-gray-500 dark:text-gray-700" />
            <span className="text-[10px] text-gray-500 dark:text-gray-600">No background</span>
          </div>
        </div>
      )}

      {/* ── Music Selector ── */}
      <AssetPicker
        label="Background Music"
        kind="audio"
        assetLabel="music track"
        value={backgroundMusicId}
        onChange={(assetId) => updateNodeData(node.id, { backgroundMusicId: assetId })}
      />

      {/* Music preview / placeholder */}
      {!backgroundMusicId && (
        <div className="flex items-center justify-center rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-4">
          <div className="flex flex-col items-center gap-1.5">
            <Music className="h-5 w-5 text-gray-500 dark:text-gray-700" />
            <span className="text-[10px] text-gray-500 dark:text-gray-600">No music</span>
          </div>
        </div>
      )}
    </div>
  );
}
