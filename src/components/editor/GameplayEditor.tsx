import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowLeft,
  MousePointer2,
  Image as ImageIcon,
  Square,
  Move,
  Layers,
} from 'lucide-react';
import {
  useGraphStore,
  BG_POSITION_CSS,
  type SceneNodeData,
  type GameplayObstacle,
  type GameplayHotspot,
  type GameplayStaticAsset,
  type GameplaySettings,
  type GameplayViewMode,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import { useAssetStore } from '../../stores/assetStore';
import { pauseHistory, resumeHistory } from '../../utils/undoHistory';
import { editorStageAspectStyle } from '../player/GameStage';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

type InteractionMode = 'select' | 'draw_obstacle' | 'draw_hotspot';

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  itemId: string;
  kind: 'obstacle' | 'hotspot' | 'character' | 'static_asset';
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  itemId: string;
  kind: 'obstacle' | 'hotspot' | 'static_asset';
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

interface GameplayEditorProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Resize Handle Component
// ────────────────────────────────────────────────────────

function ResizeHandleCorner({
  position,
  onMouseDown,
}: {
  position: ResizeHandle;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const posClasses: Record<ResizeHandle, string> = {
    nw: '-top-1.5 -left-1.5 cursor-nw-resize',
    ne: '-top-1.5 -right-1.5 cursor-ne-resize',
    sw: '-bottom-1.5 -left-1.5 cursor-sw-resize',
    se: '-bottom-1.5 -right-1.5 cursor-se-resize',
  };

  return (
    <div
      className={`absolute h-3 w-3 rounded-full border-2 border-white bg-gray-800 dark:bg-gray-900 z-30 ${posClasses[position]}`}
      onMouseDown={onMouseDown}
    />
  );
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export default function GameplayEditor({ nodeId }: GameplayEditorProps) {
  const { nodes } = useActiveGraph();
  const updateGameplaySettings = useGraphStore((s) => s.updateGameplaySettings);
  const updateObstacles = useGraphStore((s) => s.updateObstacles);
  const updateGameplayHotspots = useGraphStore((s) => s.updateGameplayHotspots);
  const updateStaticAssetsStore = useGraphStore((s) => s.updateStaticAssets);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const selectedItemId = useGraphStore((s) => s.selectedGameplayItemId);
  const selectedItemKind = useGraphStore((s) => s.selectedGameplayItemKind);
  const setSelectedGameplayItem = useGraphStore((s) => s.setSelectedGameplayItem);
  const assets = useAssetStore((s) => s.assets);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;

  const settings: GameplaySettings = useMemo(
    () => ({
      viewMode: 'side' as GameplayViewMode,
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

  const obstacles: GameplayObstacle[] = useMemo(
    () => nodeData?.obstacles ?? [],
    [nodeData?.obstacles],
  );

  const hotspots: GameplayHotspot[] = useMemo(
    () => nodeData?.gameplayHotspots ?? [],
    [nodeData?.gameplayHotspots],
  );

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

  // ── Background image URL ──
  const backgroundImageUrl = useMemo(() => {
    if (!settings.backgroundImageId) return null;
    const asset = assets.find((a) => a.id === settings.backgroundImageId);
    return asset?.file_url ?? null;
  }, [settings.backgroundImageId, assets]);

  // ── Character sprite URL (preview: prefer idle / first set, fallback to legacy) ──
  const characterSpriteUrl = useMemo(() => {
    const id =
      settings.viewMode === 'side'
        ? (settings.characterSpriteIdIdleSide ??
           settings.characterSpriteIdWalkingSide ??
           settings.characterSpriteId)
        : (settings.characterSpriteIdIdleHorizontal ??
           settings.characterSpriteIdWalkingHorizontal ??
           settings.characterSpriteId);
    if (!id) return null;
    const asset = assets.find((a) => a.id === id);
    return asset?.file_url ?? null;
  }, [
    settings.viewMode,
    settings.characterSpriteIdIdleSide,
    settings.characterSpriteIdWalkingSide,
    settings.characterSpriteIdIdleHorizontal,
    settings.characterSpriteIdWalkingHorizontal,
    settings.characterSpriteId,
    assets,
  ]);

  // ── Obstacle CRUD ──
  const setObstacles = useCallback(
    (next: GameplayObstacle[]) => updateObstacles(nodeId, next),
    [nodeId, updateObstacles],
  );

  const addObstacle = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const newObstacle: GameplayObstacle = {
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
      };
      setObstacles([...obstacles, newObstacle]);
      setSelectedGameplayItem(newObstacle.id, 'obstacle');
      setMode('select');
    },
    [obstacles, setObstacles],
  );

  const updateObstacle = useCallback(
    (obstacleId: string, patch: Partial<GameplayObstacle>) => {
      setObstacles(
        obstacles.map((o) => (o.id === obstacleId ? { ...o, ...patch } : o)),
      );
    },
    [obstacles, setObstacles],
  );

  // ── Hotspot CRUD ──
  const setHotspots = useCallback(
    (next: GameplayHotspot[]) => updateGameplayHotspots(nodeId, next),
    [nodeId, updateGameplayHotspots],
  );

  const addHotspot = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const newHotspot: GameplayHotspot = {
        id: crypto.randomUUID(),
        name: `Hotspot ${hotspots.length + 1}`,
        x,
        y,
        width,
        height,
        actions: [{ type: 'transition' }],
        activationType: 'collision',
        showIndicator: true,
      };
      setHotspots([...hotspots, newHotspot]);
      setSelectedGameplayItem(newHotspot.id, 'hotspot');
      setMode('select');
    },
    [hotspots, setHotspots],
  );

  const updateHotspot = useCallback(
    (hotspotId: string, patch: Partial<GameplayHotspot>) => {
      setHotspots(
        hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)),
      );
    },
    [hotspots, setHotspots],
  );

  // ── Static Asset CRUD ──
  const updateStaticAsset = useCallback(
    (id: string, patch: Partial<GameplayStaticAsset>) => {
      updateStaticAssetsStore(
        nodeId,
        staticAssets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [staticAssets, nodeId, updateStaticAssetsStore],
  );

  const staticAssetUrls = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const sa of staticAssets) {
      const a = assets.find((x) => x.id === sa.assetId);
      map[sa.id] = a?.file_url ?? null;
    }
    return map;
  }, [staticAssets, assets]);

  // ── Canvas Mouse Handlers ──

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'draw_obstacle' && mode !== 'draw_hotspot') return;
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

      // Dragging item
      if (dragState) {
        if (dragState.kind === 'character') {
          updateGameplaySettings(nodeId, {
            characterStartPosition: {
              x: clamp(px, 0, 100),
              y: clamp(py, 0, 100),
            },
          });
          return;
        }
        const newX = clamp(px - dragState.offsetX, 0, 100);
        const newY = clamp(py - dragState.offsetY, 0, 100);
        if (dragState.kind === 'obstacle') {
          updateObstacle(dragState.itemId, { x: newX, y: newY });
        } else if (dragState.kind === 'hotspot') {
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
        if (kind === 'obstacle') {
          updateObstacle(itemId, patch);
        } else if (kind === 'hotspot') {
          updateHotspot(itemId, patch);
        } else if (kind === 'static_asset') {
          updateStaticAsset(itemId, patch);
        }
        return;
      }
    },
    [drawState, dragState, resizeState, nodeId, updateObstacle, updateHotspot, updateStaticAsset, updateGameplaySettings],
  );

  const handleCanvasMouseUp = useCallback(() => {
    // Finish drawing
    if (drawState) {
      const x = Math.min(drawState.startX, drawState.currentX);
      const y = Math.min(drawState.startY, drawState.currentY);
      const w = Math.abs(drawState.currentX - drawState.startX);
      const h = Math.abs(drawState.currentY - drawState.startY);
      if (w > 1 && h > 1) {
        if (mode === 'draw_obstacle') {
          addObstacle(x, y, w, h);
        } else if (mode === 'draw_hotspot') {
          addHotspot(x, y, w, h);
        }
      }
      setDrawState(null);
      return;
    }
    // Finish dragging / resizing
    if (dragState) {
      resumeHistory();
      setDragState(null);
      return;
    }
    if (resizeState) {
      resumeHistory();
      setResizeState(null);
      return;
    }
  }, [drawState, dragState, resizeState, mode, addObstacle, addHotspot]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'select') return;
      const target = e.target as HTMLElement;
      if (target.dataset.canvas === 'true' || target === canvasRef.current) {
        setSelectedGameplayItem(null, null);
      }
    },
    [mode],
  );

  // ── Item interaction handlers ──

  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, id: string, kind: 'obstacle' | 'hotspot' | 'static_asset', item: { x: number; y: number }) => {
      if (mode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedGameplayItem(id, kind);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const { px, py } = getPercentPosition(e, rect);
      pauseHistory();
      setDragState({
        itemId: id,
        kind,
        offsetX: px - item.x,
        offsetY: py - item.y,
      });
    },
    [mode],
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: string, kind: 'obstacle' | 'hotspot' | 'static_asset', item: { x: number; y: number; width: number; height: number }, handle: ResizeHandle) => {
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

  const handleCharacterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'select') return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedGameplayItem(null, null);
      pauseHistory();
      setDragState({
        itemId: 'character',
        kind: 'character',
        offsetX: 0,
        offsetY: 0,
      });
    },
    [mode],
  );

  useEffect(() => {
    if (!dragState && !resizeState && !drawState) return;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = '';
    };
  }, [dragState, resizeState, drawState]);

  // ── Drawing preview ──
  const drawPreview = drawState
    ? {
        x: Math.min(drawState.startX, drawState.currentX),
        y: Math.min(drawState.startY, drawState.currentY),
        width: Math.abs(drawState.currentX - drawState.startX),
        height: Math.abs(drawState.currentY - drawState.startY),
      }
    : null;

  if (!node || !nodeData) return null;

  return (
    <div className="flex h-full w-full bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      {/* ── Left: Canvas Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-3 py-2">
          <button
            onClick={() => setEditingNodeId(null)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="mx-2 h-4 w-px bg-gray-300 dark:bg-gray-700" />

          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate mr-2">
            {nodeData.label}
          </span>

          <div className="mx-2 h-4 w-px bg-gray-300 dark:bg-gray-700" />

          {/* Mode buttons */}
          <button
            onClick={() => setMode('select')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'select'
                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 border border-transparent'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Select
          </button>
          <button
            onClick={() => { setMode('draw_obstacle'); setSelectedGameplayItem(null, null); }}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'draw_obstacle'
                ? 'bg-green-600/20 text-green-400 border border-green-500/40'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 border border-transparent'
            }`}
          >
            <Square className="h-3.5 w-3.5" />
            Draw Obstacle
          </button>
          <button
            onClick={() => { setMode('draw_hotspot'); setSelectedGameplayItem(null, null); }}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              mode === 'draw_hotspot'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 border border-transparent'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Draw Hotspot
          </button>

          <div className="flex-1" />

          <span className="text-[10px] text-gray-600 dark:text-gray-500">
            {staticAssets.length} prop{staticAssets.length !== 1 && 's'} · {obstacles.length} obstacle{obstacles.length !== 1 && 's'} · {hotspots.length} hotspot{hotspots.length !== 1 && 's'}
          </span>
        </div>

        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div
            ref={canvasRef}
            className={`relative select-none bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden shadow-xl ${
              mode === 'draw_obstacle' || mode === 'draw_hotspot' ? 'cursor-crosshair' : ''
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
                className={`absolute inset-0 h-full w-full pointer-events-none ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[settings.backgroundSize ?? 'cover']}`}
                style={{ objectPosition: BG_POSITION_CSS[settings.backgroundPosition ?? 'center'] }}
                draggable={false}
                data-canvas="true"
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                data-canvas="true"
              >
                <ImageIcon className="h-12 w-12 text-gray-500 dark:text-gray-700 pointer-events-none" />
                <p className="text-sm text-gray-500 dark:text-gray-600 pointer-events-none">
                  No background set. Use the settings panel to select one.
                </p>
              </div>
            )}

            {/* Static asset overlays */}
            {staticAssets.map((sa) => {
              const isSelected = sa.id === selectedItemId && selectedItemKind === 'static_asset';
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
                  onMouseDown={(e) => handleItemMouseDown(e, sa.id, 'static_asset', sa)}
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

            {/* Obstacle overlays */}
            {obstacles.map((obs) => {
              const isSelected = obs.id === selectedItemId && selectedItemKind === 'obstacle';
              return (
                <div
                  key={obs.id}
                  className={`absolute transition-colors ${
                    isSelected
                      ? 'border-2 border-green-400 bg-green-500/20 z-20'
                      : 'border-2 border-green-600 bg-green-500/15 hover:bg-green-500/25 z-10'
                  } ${mode === 'select' ? 'cursor-move' : 'pointer-events-none'}`}
                  style={{
                    left: `${obs.x}%`,
                    top: `${obs.y}%`,
                    width: `${obs.width}%`,
                    height: `${obs.height}%`,
                  }}
                  onMouseDown={(e) => handleItemMouseDown(e, obs.id, 'obstacle', obs)}
                >
                  <span className="absolute top-0.5 left-1 text-[10px] font-semibold text-green-300 drop-shadow-md pointer-events-none">
                    Obstacle
                  </span>
                  {isSelected && mode === 'select' && (
                    <>
                      <ResizeHandleCorner position="nw" onMouseDown={(e) => handleResizeMouseDown(e, obs.id, 'obstacle', obs, 'nw')} />
                      <ResizeHandleCorner position="ne" onMouseDown={(e) => handleResizeMouseDown(e, obs.id, 'obstacle', obs, 'ne')} />
                      <ResizeHandleCorner position="sw" onMouseDown={(e) => handleResizeMouseDown(e, obs.id, 'obstacle', obs, 'sw')} />
                      <ResizeHandleCorner position="se" onMouseDown={(e) => handleResizeMouseDown(e, obs.id, 'obstacle', obs, 'se')} />
                    </>
                  )}
                </div>
              );
            })}

            {/* Hotspot overlays */}
            {hotspots.map((hs) => {
              const isSelected = hs.id === selectedItemId && selectedItemKind === 'hotspot';
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
                  onMouseDown={(e) => handleItemMouseDown(e, hs.id, 'hotspot', hs)}
                >
                  <span className="absolute top-0.5 left-1 text-[10px] font-semibold text-white drop-shadow-md truncate max-w-[90%] pointer-events-none">
                    {hs.name}
                  </span>
                  {isSelected && mode === 'select' && (
                    <>
                      <ResizeHandleCorner position="nw" onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'nw')} />
                      <ResizeHandleCorner position="ne" onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'ne')} />
                      <ResizeHandleCorner position="sw" onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'sw')} />
                      <ResizeHandleCorner position="se" onMouseDown={(e) => handleResizeMouseDown(e, hs.id, 'hotspot', hs, 'se')} />
                    </>
                  )}
                </div>
              );
            })}

            {/* Character start position marker */}
            <div
              className={`absolute z-30 flex flex-col items-center ${mode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
              style={{
                left: `${settings.characterStartPosition.x}%`,
                top: `${settings.characterStartPosition.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
              onMouseDown={handleCharacterMouseDown}
            >
              {characterSpriteUrl ? (
                <img
                  src={characterSpriteUrl}
                  alt="Character"
                  className="w-auto object-contain drop-shadow-lg pointer-events-none"
                  style={{ height: `${64 * ((settings.characterScale ?? 100) / 100)}px` }}
                  draggable={false}
                />
              ) : (
                <div
                  className="rounded-md border-2 border-dashed border-orange-400 bg-orange-500/20 flex items-center justify-center"
                  style={{
                    height: `${64 * ((settings.characterScale ?? 100) / 100)}px`,
                    width: `${40 * ((settings.characterScale ?? 100) / 100)}px`,
                  }}
                >
                  <Move className="h-4 w-4 text-orange-400" />
                </div>
              )}
              <span className="text-[9px] font-bold text-orange-400 mt-0.5 drop-shadow-md">
                START
              </span>
            </div>

            {/* Drawing preview */}
            {drawPreview && drawPreview.width > 0.5 && drawPreview.height > 0.5 && (
              <div
                className={`absolute border-2 border-dashed z-30 pointer-events-none ${
                  mode === 'draw_obstacle'
                    ? 'border-green-400/60 bg-green-500/10'
                    : 'border-blue-400/60 bg-blue-500/10'
                }`}
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
