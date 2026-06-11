import { useMemo, useCallback, useState, useEffect } from 'react';
import { Trash2, Plus, Box } from 'lucide-react';
import {
  useGraphStore,
  type SceneNodeData,
  type GameplayStaticAsset,
  type GameplaySettings,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import { useAssetStore } from '../../stores/assetStore';
import AssetPicker from './AssetPicker';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface GameplayStaticAssetsPanelProps {
  nodeId: string;
  showCharacterZIndex?: boolean;
}

export default function GameplayStaticAssetsPanel({ nodeId, showCharacterZIndex = true }: GameplayStaticAssetsPanelProps) {
  const { nodes } = useActiveGraph();
  const updateStaticAssets = useGraphStore((s) => s.updateStaticAssets);
  const updateGameplaySettings = useGraphStore((s) => s.updateGameplaySettings);
  const selectedGameplayItemId = useGraphStore((s) => s.selectedGameplayItemId);
  const selectedGameplayItemKind = useGraphStore((s) => s.selectedGameplayItemKind);
  const setSelectedGameplayItem = useGraphStore((s) => s.setSelectedGameplayItem);
  const setSelectedPacHotspotId = useGraphStore((s) => s.setSelectedPacHotspotId);
  const assets = useAssetStore((s) => s.assets);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;

  const staticAssets: GameplayStaticAsset[] = useMemo(
    () => nodeData?.staticAssets ?? [],
    [nodeData?.staticAssets],
  );

  const settings: GameplaySettings = useMemo(
    () => ({
      viewMode: 'side',
      backgroundImageId: null,
      backgroundMusicId: null,
      characterSpriteId: null,
      characterStartPosition: { x: 50, y: 90 },
      characterFrontFace: 'right' as const,
      characterScale: 100,
      ...nodeData?.gameplaySettings,
    }),
    [nodeData?.gameplaySettings],
  );

  const characterZIndex = settings.characterZIndex ?? 10;

  const [showAddPicker, setShowAddPicker] = useState(false);

  const addStaticAsset = useCallback(
    (assetId: string | null) => {
      if (!assetId) {
        setShowAddPicker(false);
        return;
      }
      const asset = assets.find((a) => a.id === assetId);
      const newAsset: GameplayStaticAsset = {
        id: crypto.randomUUID(),
        name: asset?.file_name ?? `Prop ${staticAssets.length + 1}`,
        assetId,
        x: 40,
        y: 40,
        width: 15,
        height: 15,
        zIndex: 0,
      };
      updateStaticAssets(nodeId, [...staticAssets, newAsset]);
      setSelectedGameplayItem(newAsset.id, 'static_asset');
      setSelectedPacHotspotId(null);
      setShowAddPicker(false);
    },
    [staticAssets, nodeId, updateStaticAssets, setSelectedGameplayItem, setSelectedPacHotspotId, assets],
  );

  const removeStaticAsset = useCallback(
    (assetId: string) => {
      updateStaticAssets(nodeId, staticAssets.filter((a) => a.id !== assetId));
      if (selectedGameplayItemId === assetId) {
        setSelectedGameplayItem(null, null);
      }
    },
    [staticAssets, nodeId, updateStaticAssets, selectedGameplayItemId, setSelectedGameplayItem],
  );

  const updateStaticAsset = useCallback(
    (id: string, patch: Partial<GameplayStaticAsset>) => {
      updateStaticAssets(
        nodeId,
        staticAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [staticAssets, nodeId, updateStaticAssets],
  );

  const selectedAsset = selectedGameplayItemKind === 'static_asset'
    ? staticAssets.find((a) => a.id === selectedGameplayItemId) ?? null
    : null;

  // Local state for numeric inputs on selected asset
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [wInput, setWInput] = useState('');
  const [hInput, setHInput] = useState('');
  const [zInput, setZInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [charZInput, setCharZInput] = useState(String(characterZIndex));

  useEffect(() => {
    if (selectedAsset) {
      setXInput(String(Math.round(selectedAsset.x)));
      setYInput(String(Math.round(selectedAsset.y)));
      setWInput(String(Math.round(selectedAsset.width)));
      setHInput(String(Math.round(selectedAsset.height)));
      setZInput(String(selectedAsset.zIndex));
      setNameInput(selectedAsset.name);
    }
  }, [selectedAsset?.id, selectedAsset?.x, selectedAsset?.y, selectedAsset?.width, selectedAsset?.height, selectedAsset?.zIndex, selectedAsset?.name]);

  useEffect(() => {
    setCharZInput(String(characterZIndex));
  }, [characterZIndex]);

  const commitField = useCallback(
    (field: 'x' | 'y' | 'width' | 'height' | 'zIndex', raw: string, setter: (v: string) => void) => {
      if (!selectedAsset) return;
      const parsed = Number(raw);
      if (isNaN(parsed)) {
        setter(String(field === 'zIndex' ? selectedAsset.zIndex : Math.round(selectedAsset[field])));
        return;
      }
      if (field === 'zIndex') {
        const clamped = Math.round(parsed);
        updateStaticAsset(selectedAsset.id, { zIndex: clamped });
        setter(String(clamped));
      } else {
        const clamped = clamp(Math.round(parsed), 0, 100);
        updateStaticAsset(selectedAsset.id, { [field]: clamped });
        setter(String(clamped));
      }
    },
    [selectedAsset, updateStaticAsset],
  );

  const commitCharZ = useCallback(() => {
    const parsed = Number(charZInput);
    if (isNaN(parsed)) {
      setCharZInput(String(characterZIndex));
      return;
    }
    const clamped = Math.round(parsed);
    updateGameplaySettings(nodeId, { characterZIndex: clamped });
    setCharZInput(String(clamped));
  }, [charZInput, characterZIndex, nodeId, updateGameplaySettings]);

  const getThumbUrl = useCallback(
    (assetId: string) => {
      const a = assets.find((x) => x.id === assetId);
      return a?.file_url ?? null;
    },
    [assets],
  );

  return (
    <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Box className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            Static Assets ({staticAssets.length})
          </span>
        </div>
        <button
          onClick={() => setShowAddPicker(!showAddPicker)}
          className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-purple-400 hover:bg-purple-600/20 transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* Add picker */}
      {showAddPicker && (
        <div className="mb-2">
          <AssetPicker
            label="Select prop to add"
            kind="image"
            assetLabel="prop"
            value={null}
            onChange={addStaticAsset}
          />
        </div>
      )}

      {/* Asset list */}
      {staticAssets.length === 0 && !showAddPicker && (
        <p className="text-xs text-gray-500 dark:text-gray-600 italic">
          No static assets. Click &quot;Add&quot; to place props on the scene.
        </p>
      )}
      {staticAssets.map((sa) => {
        const thumbUrl = getThumbUrl(sa.assetId);
        const isSelected = selectedGameplayItemId === sa.id && selectedGameplayItemKind === 'static_asset';
        return (
          <div
            key={sa.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs mb-1 cursor-pointer transition-colors ${
              isSelected
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => { setSelectedGameplayItem(sa.id, 'static_asset'); setSelectedPacHotspotId(null); }}
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt={sa.name} className="h-6 w-6 rounded object-cover shrink-0" />
            ) : (
              <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center">
                <Box className="h-3 w-3 text-gray-500" />
              </div>
            )}
            <span className="flex-1 truncate">{sa.name}</span>
            <span className="text-[9px] text-gray-500 shrink-0">z:{sa.zIndex}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeStaticAsset(sa.id); }}
              className="text-gray-500 dark:text-gray-600 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* Selected asset properties */}
      {selectedAsset && (
        <div className="border-t border-gray-300 dark:border-gray-700 pt-3 mt-2 space-y-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            Prop Properties
          </span>

          {/* Asset picker to change the image */}
          <AssetPicker
            label="Image"
            kind="image"
            assetLabel="prop"
            value={selectedAsset.assetId}
            onChange={(assetId) => {
              if (assetId) updateStaticAsset(selectedAsset.id, { assetId });
            }}
          />

          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
              Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => updateStaticAsset(selectedAsset.id, { name: nameInput || selectedAsset.name })}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
              Position
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500">X %</label>
                <input
                  type="number" min={0} max={100}
                  value={xInput}
                  onChange={(e) => setXInput(e.target.value)}
                  onBlur={() => commitField('x', xInput, setXInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500">Y %</label>
                <input
                  type="number" min={0} max={100}
                  value={yInput}
                  onChange={(e) => setYInput(e.target.value)}
                  onBlur={() => commitField('y', yInput, setYInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
              Size
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-500">W %</label>
                <input
                  type="number" min={1} max={100}
                  value={wInput}
                  onChange={(e) => setWInput(e.target.value)}
                  onBlur={() => commitField('width', wInput, setWInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-500">H %</label>
                <input
                  type="number" min={1} max={100}
                  value={hInput}
                  onChange={(e) => setHInput(e.target.value)}
                  onBlur={() => commitField('height', hInput, setHInput)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Z-Index */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
              Z-Index
            </label>
            <input
              type="number"
              value={zInput}
              onChange={(e) => setZInput(e.target.value)}
              onBlur={() => commitField('zIndex', zInput, setZInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-purple-500"
            />
            <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
              {showCharacterZIndex ? `Character z-index: ${characterZIndex}. ` : ''}Higher values appear on top.
            </p>
          </div>
        </div>
      )}

      {/* Character Z-Index */}
      {showCharacterZIndex && (
        <div className="border-t border-gray-300 dark:border-gray-700 pt-3 mt-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-1">
            Character Z-Index
          </label>
          <input
            type="number"
            value={charZInput}
            onChange={(e) => setCharZInput(e.target.value)}
            onBlur={commitCharZ}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
          />
          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
            Props with z-index above this value appear in front of the character.
          </p>
        </div>
      )}
    </div>
  );
}
