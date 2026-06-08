import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  MousePointer2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  useGraphStore,
  BG_POSITION_CSS,
  type SceneNodeData,
  type Hotspot,
  type GameplayStaticAsset,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import { useAssetStore } from '../../stores/assetStore';
import { pauseHistory, resumeHistory } from '../../utils/undoHistory';
import AssetPicker from './AssetPicker';
import { editorStageAspectStyle } from '../player/GameStage';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

type InteractionMode = 'select' | 'draw';

interface DrawState {
  startX: number; // percentage
  startY: number; // percentage
  currentX: number;
  currentY: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  itemId: string;
  kind: 'hotspot' | 'static_asset';
  offsetX: number; // percentage offset from item origin
  offsetY: number;
}

interface ResizeState {
  itemId: string;
  kind: 'hotspot' | 'static_asset';
  handle: ResizeHandle;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getPercentPosition(
  e: React.MouseEvent | MouseEvent,
  canvasRect: DOMRect,
) {
  return {
    px: clamp(((e.clientX - canvasRect.left) / canvasRect.width) * 100, 0, 100),
    py: clamp(((e.clientY - canvasRect.top) / canvasRect.height) * 100, 0, 100),
  };
}

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface PointAndClickEditorProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export default function PointAndClickEditor({ nodeId }: PointAndClickEditorProps) {
  const { nodes } = useActiveGraph();
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const updateHotspots = useGraphStore((s) => s.updateHotspots);
  const updateStaticAssetsStore = useGraphStore((s) => s.updateStaticAssets);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const selectedHotspotId = useGraphStore((s) => s.selectedPacHotspotId);
  const setSelectedHotspotId = useGraphStore((s) => s.setSelectedPacHotspotId);
  const selectedStaticAssetId = useGraphStore((s) => s.selectedGameplayItemId);
  const selectedStaticAssetKind = useGraphStore((s) => s.selectedGameplayItemKind);
  const setSelectedStaticAsset = useGraphStore((s) => s.setSelectedGameplayItem);
  const assets = useAssetStore((s) => s.assets);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;
  const hotspots: Hotspot[] = nodeData?.hotspots ?? [];
  const staticAssets: GameplayStaticAsset[] = useMemo(
    () => nodeData?.staticAssets ?? [],
    [nodeData?.staticAssets],
  );

  // ── Local state ──
  const [mode, setMode] = useState<InteractionMode>('select');
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // When a hotspot is selected from the sidebar, switch to select mode
  useEffect(() => {
    if (selectedHotspotId) {
      setMode('select');
      setDrawState(null);
    }
  }, [selectedHotspotId]);

  // Resolve background image URL
  const backgroundImageUrl = useMemo(() => {
    const bgId = nodeData?.backgroundImageId;
    if (!bgId) return null;
    const asset = assets.find((a) => a.id === bgId);
    return asset?.file_url ?? null;
  }, [nodeData?.backgroundImageId, assets]);

  // Resolve static asset image URLs
  const staticAssetUrls = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const sa of staticAssets) {
      const a = assets.find((x) => x.id === sa.assetId);
      map[sa.id] = a?.file_url ?? null;
    }
    return map;
  }, [staticAssets, assets]);

  // ── Static Asset mutations ──

  const updateStaticAsset = useCallback(
    (id: string, patch: Partial<GameplayStaticAsset>) => {
      updateStaticAssetsStore(
        nodeId,
        staticAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [staticAssets, nodeId, updateStaticAssetsStore],
  );

  // ── Hotspot mutations ──

  const setHotspots = useCallback(
    (next: Hotspot[]) => updateHotspots(nodeId, next),
    [nodeId, updateHotspots],
  );

  const addHotspot = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const newHotspot: Hotspot = {
        id: crypto.randomUUID(),
        name: `Hotspot ${hotspots.length + 1}`,
        x,
        y,
        width,
        height,
        actions: [{ type: 'transition' }],
      };
      setHotspots([...hotspots, newHotspot]);
      setSelectedHotspotId(newHotspot.id);
      setMode('select');
    },
    [hotspots, setHotspots],
  );

  const updateHotspot = useCallback(
    (hotspotId: string, patch: Partial<Hotspot>) => {
      setHotspots(
        hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)),
      );
    },
    [hotspots, setHotspots],
  );

  // ── Canvas mouse handlers ──

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'draw') return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { px, py } = getPercentPosition(e, rect);
      setDrawState({ startX: px, startY: py, currentX: px, currentY: py });
    },
    [mode],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { px, py } = getPercentPosition(e, rect);

      // Drawing
      if (drawState) {
        setDrawState((prev) => (prev ? { ...prev, currentX: px, currentY: py } : null));
        return;
      }

      // Dragging
      if (dragState) {
        const newX = clamp(px - dragState.offsetX, 0, 100);
        const newY = clamp(py - dragState.offsetY, 0, 100);
        if (dragState.kind === 'hotspot') {
          updateHotspot(dragState.itemId, { x: newX, y: newY });
        } else if (dragState.kind === 'static_asset') {
          updateStaticAsset(dragState.itemId, { x: newX, y: newY });
        }
        return;
      }

      // Resizing
      if (resizeState) {
        const { handle, origX, origY, origW, origH, itemId, kind } = resizeState;
        let newX = origX;
        let newY = origY;
        let newW = origW;
        let newH = origH;

        if (handle === 'se') {
          newW = clamp(px - origX, 2, 100 - origX);
          newH = clamp(py - origY, 2, 100 - origY);
        } else if (handle === 'sw') {
          newW = clamp(origX + origW - px, 2, origX + origW);
          newX = origX + origW - newW;
          newH = clamp(py - origY, 2, 100 - origY);
        } else if (handle === 'ne') {
          newW = clamp(px - origX, 2, 100 - origX);
          newH = clamp(origY + origH - py, 2, origY + origH);
          newY = origY + origH - newH;
        } else if (handle === 'nw') {
          newW = clamp(origX + origW - px, 2, origX + origW);
          newX = origX + origW - newW;
          newH = clamp(origY + origH - py, 2, origY + origH);
          newY = origY + origH - newH;
        }

        const patch = { x: newX, y: newY, width: newW, height: newH };
        if (kind === 'hotspot') {
          updateHotspot(itemId, patch);
        } else if (kind === 'static_asset') {
          updateStaticAsset(itemId, patch);
        }
        return;
      }
    },
    [drawState, dragState, resizeState, hotspots, updateHotspot, updateStaticAsset],
  );

  const handleCanvasMouseUp = useCallback(() => {
    // Finish drawing
    if (drawState) {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const w = Math.abs(drawState.currentX - drawState.startX);
      const h = Math.abs(drawState.currentY - drawState.startY);
      if (w > 1 && h > 1) {
        addHotspot(x, y, w, h);
      }
      setDrawState(null);
      return;
    }

    // Finish dragging
    if (dragState) {
      resumeHistory();
      setDragState(null);
      return;
    }

    // Finish resizing
    if (resizeState) {
      resumeHistory();
      setResizeState(null);
      return;
    }
  }, [drawState, dragState, resizeState, addHotspot]);

  // ── Hotspot interaction (in select mode) ──

  const handleHotspotMouseDown = useCallback(
    (e: React.MouseEvent, hotspot: Hotspot) => {
      if (mode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedHotspotId(hotspot.id);
      setSelectedStaticAsset(null, null);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { px, py } = getPercentPosition(e, rect);

      pauseHistory();
      setDragState({
        itemId: hotspot.id,
        kind: 'hotspot',
        offsetX: px - hotspot.x,
        offsetY: py - hotspot.y,
      });
    },
    [mode],
  );

  const handleStaticAssetMouseDown = useCallback(
    (e: React.MouseEvent, sa: GameplayStaticAsset) => {
      if (mode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedStaticAsset(sa.id, 'static_asset');
      setSelectedHotspotId(null);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { px, py } = getPercentPosition(e, rect);

      pauseHistory();
      setDragState({
        itemId: sa.id,
        kind: 'static_asset',
        offsetX: px - sa.x,
        offsetY: py - sa.y,
      });
    },
    [mode],
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: string, kind: 'hotspot' | 'static_asset', item: { x: number; y: number; width: number; height: number }, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();
      pauseHistory();
      setResizeState({
        itemId: id,
        kind,
        handle,
        origX: item.x,
        origY: item.y,
        origW: item.width,
        origH: item.height,
      });
    },
    [],
  );

  useEffect(() => {
    if (!dragState && !resizeState && !drawState) return;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = '';
    };
  }, [dragState, resizeState, drawState]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode === 'select' && !dragState && !resizeState) {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvas) {
          setSelectedHotspotId(null);
          setSelectedStaticAsset(null, null);
        }
      }
    },
    [mode, dragState, resizeState],
  );

  // Add a quick "Add Hotspot" that places one in center
  const handleAddHotspotButton = useCallback(() => {
    setMode('draw');
    setSelectedHotspotId(null);
  }, []);

  // ── Render guard ──
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Node not found.
      </div>
    );
  }

  // ── Drawing preview rect ──
  const drawPreview = drawState
    ? {
        x: Math.min(drawState.startX, drawState.currentX),
        y: Math.min(drawState.startY, drawState.currentY),
        width: Math.abs(drawState.currentX - drawState.startX),
        height: Math.abs(drawState.currentY - drawState.startY),
      }
    : null;

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-4 py-2">
        <button
          onClick={() => setEditingNodeId(null)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />

        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Point-and-Click
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-600">—</span>
        <span className="text-sm text-red-400 font-medium">{nodeData?.label}</span>

        <div className="ml-auto flex items-center gap-2">
          <AssetPicker
            category="Background"
            value={nodeData?.backgroundImageId ?? null}
            onChange={(assetId) => updateNodeData(nodeId, { backgroundImageId: assetId })}
            label="Background"
            compact
          />

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Mode toggle buttons */}
          <button
            onClick={() => { setMode('select'); setDrawState(null); }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'select'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select
          </button>
          <button
            onClick={handleAddHotspotButton}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'draw'
                ? 'bg-red-600 text-white'
                : 'bg-red-600/80 text-white hover:bg-red-500'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Draw Hotspot
          </button>
        </div>
      </div>

      {/* ── Body: Canvas ── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex items-center justify-center p-6 overflow-auto bg-gray-200 dark:bg-gray-950">
          <div
            ref={canvasRef}
            className={`relative select-none bg-gray-300 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-xl ${
              mode === 'draw' ? 'cursor-crosshair' : ''
            }`}
            style={{
              width: '100%',
              maxWidth: '960px',
              ...editorStageAspectStyle,
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onClick={handleCanvasClick}
          >
            {/* Background Image */}
            {backgroundImageUrl ? (
              <img
                src={backgroundImageUrl}
                alt="Scene background"
                className={`absolute inset-0 h-full w-full pointer-events-none ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[nodeData?.backgroundSize ?? 'cover']}`}
                style={{ objectPosition: BG_POSITION_CSS[nodeData?.backgroundPosition ?? 'center'] }}
                draggable={false}
                data-canvas="true"
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none"
                data-canvas="true"
              >
                <ImageIcon className="h-12 w-12 text-gray-500 dark:text-gray-700 pointer-events-none" />
                <p className="text-sm text-gray-500 dark:text-gray-600 pointer-events-none">
                  No background set. Use the toolbar to select one.
                </p>
              </div>
            )}

            {/* Static asset overlays */}
            {staticAssets.map((sa) => {
              const isSelected = sa.id === selectedStaticAssetId && selectedStaticAssetKind === 'static_asset';
              const url = staticAssetUrls[sa.id];
              return (
                <div
                  key={sa.id}
                  className={`absolute transition-colors ${
                    isSelected
                      ? 'ring-2 ring-purple-400'
                      : 'hover:ring-1 hover:ring-purple-400/50'
                  } ${mode === 'select' ? 'cursor-move' : 'pointer-events-none'}`}
                  style={{
                    left: `${sa.x}%`,
                    top: `${sa.y}%`,
                    width: `${sa.width}%`,
                    height: `${sa.height}%`,
                    zIndex: sa.zIndex,
                  }}
                  onMouseDown={(e) => handleStaticAssetMouseDown(e, sa)}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={sa.name}
                      className="h-full w-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full rounded border-2 border-dashed border-purple-400/50 bg-purple-500/10 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-purple-400">No image</span>
                    </div>
                  )}
                  <span className="absolute bottom-0.5 left-1 text-[9px] font-semibold text-purple-300 drop-shadow-md pointer-events-none">
                    {sa.name} (z:{sa.zIndex})
                  </span>
                  {isSelected && mode === 'select' && (
                    <>
                      <ResizeHandleCorner position="nw" onMouseDown={(e) => handleResizeMouseDown(e, sa.id, 'static_asset', sa, 'nw')} />
                      <ResizeHandleCorner position="ne" onMouseDown={(e) => handleResizeMouseDown(e, sa.id, 'static_asset', sa, 'ne')} />
                      <ResizeHandleCorner position="sw" onMouseDown={(e) => handleResizeMouseDown(e, sa.id, 'static_asset', sa, 'sw')} />
                      <ResizeHandleCorner position="se" onMouseDown={(e) => handleResizeMouseDown(e, sa.id, 'static_asset', sa, 'se')} />
                    </>
                  )}
                </div>
              );
            })}

            {/* Hotspot overlays */}
            {hotspots.map((hs) => {
              const isSelected = hs.id === selectedHotspotId;
              return (
                <div
                  key={hs.id}
                  className={`absolute transition-colors ${
                    isSelected
                      ? 'border-2 border-yellow-400 bg-yellow-500/20 z-20'
                      : 'border-2 border-blue-400 bg-blue-500/25 hover:bg-blue-500/35 z-10'
                  } ${mode === 'select' ? 'cursor-move' : 'pointer-events-none'}`}
                  style={{
                    left: `${hs.x}%`,
                    top: `${hs.y}%`,
                    width: `${hs.width}%`,
                    height: `${hs.height}%`,
                  }}
                  onMouseDown={(e) => handleHotspotMouseDown(e, hs)}
                >
                  {/* Hotspot label */}
                  <span className="absolute top-0.5 left-1 text-[10px] font-semibold text-white drop-shadow-md truncate max-w-[90%] pointer-events-none">
                    {hs.name}
                  </span>

                  {/* Resize handles (only when selected) */}
                  {isSelected && mode === 'select' && (
                    <>
                      <ResizeHandleCorner
                        position="nw"
                        onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'nw')}
                      />
                      <ResizeHandleCorner
                        position="ne"
                        onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'ne')}
                      />
                      <ResizeHandleCorner
                        position="sw"
                        onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'sw')}
                      />
                      <ResizeHandleCorner
                        position="se"
                        onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'se')}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* Drawing preview */}
            {drawPreview && drawPreview.width > 0.5 && drawPreview.height > 0.5 && (
              <div
                className="absolute border-2 border-dashed border-white/60 bg-white/10 z-30 pointer-events-none"
                style={{
                  left: `${drawPreview.x}%`,
                  top: `${drawPreview.y}%`,
                  width: `${drawPreview.width}%`,
                  height: `${drawPreview.height}%`,
                }}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────

function ResizeHandleCorner({
  position,
  onMouseDown,
}: {
  position: ResizeHandle;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const positionClasses: Record<ResizeHandle, string> = {
    nw: '-top-1 -left-1 cursor-nw-resize',
    ne: '-top-1 -right-1 cursor-ne-resize',
    sw: '-bottom-1 -left-1 cursor-sw-resize',
    se: '-bottom-1 -right-1 cursor-se-resize',
  };

  return (
    <div
      className={`absolute h-2.5 w-2.5 rounded-sm bg-white border border-gray-400 z-30 ${positionClasses[position]}`}
      onMouseDown={onMouseDown}
    />
  );
}

