import { useMemo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import {
  useGraphStore,
  type SceneNodeData,
  type GameplayObstacle,
  type GameplayHotspot,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import GameplayHotspotPropertiesPanel from './GameplayHotspotPropertiesPanel';

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface GameplayObjectsPanelProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function GameplayObjectsPanel({ nodeId }: GameplayObjectsPanelProps) {
  const { nodes, edges } = useActiveGraph();
  const variables = useGraphStore((s) => s.variables);
  const updateObstacles = useGraphStore((s) => s.updateObstacles);
  const updateGameplayHotspots = useGraphStore((s) => s.updateGameplayHotspots);
  const selectedGameplayItemId = useGraphStore((s) => s.selectedGameplayItemId);
  const selectedGameplayItemKind = useGraphStore((s) => s.selectedGameplayItemKind);
  const setSelectedGameplayItem = useGraphStore((s) => s.setSelectedGameplayItem);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;

  const obstacles: GameplayObstacle[] = useMemo(
    () => nodeData?.obstacles ?? [],
    [nodeData?.obstacles],
  );

  const hotspots: GameplayHotspot[] = useMemo(
    () => nodeData?.gameplayHotspots ?? [],
    [nodeData?.gameplayHotspots],
  );

  // ── CRUD helpers ──

  const removeObstacle = useCallback(
    (obstacleId: string) => {
      updateObstacles(nodeId, obstacles.filter((o) => o.id !== obstacleId));
      if (selectedGameplayItemId === obstacleId) {
        setSelectedGameplayItem(null, null);
      }
    },
    [obstacles, nodeId, updateObstacles, selectedGameplayItemId, setSelectedGameplayItem],
  );

  const removeHotspot = useCallback(
    (hotspotId: string) => {
      updateGameplayHotspots(nodeId, hotspots.filter((h) => h.id !== hotspotId));
      if (selectedGameplayItemId === hotspotId) {
        setSelectedGameplayItem(null, null);
      }
    },
    [hotspots, nodeId, updateGameplayHotspots, selectedGameplayItemId, setSelectedGameplayItem],
  );

  const updateHotspot = useCallback(
    (hotspotId: string, patch: Partial<GameplayHotspot>) => {
      updateGameplayHotspots(
        nodeId,
        hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)),
      );
    },
    [hotspots, nodeId, updateGameplayHotspots],
  );

  // ── Selected hotspot ──

  const selectedHotspot = selectedGameplayItemKind === 'hotspot'
    ? hotspots.find((h) => h.id === selectedGameplayItemId) ?? null
    : null;

  return (
    <>
      {/* ── Obstacle list ── */}
      <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400">
            Obstacles ({obstacles.length})
          </span>
        </div>
        {obstacles.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-600 italic">No obstacles. Use &quot;Draw Obstacle&quot; mode to add some.</p>
        )}
        {obstacles.map((obs, i) => (
          <div
            key={obs.id}
            className={`flex items-center justify-between rounded-md px-2 py-1 text-xs mb-1 cursor-pointer transition-colors ${
              selectedGameplayItemId === obs.id && selectedGameplayItemKind === 'obstacle'
                ? 'bg-green-600/20 text-green-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setSelectedGameplayItem(obs.id, 'obstacle')}
          >
            <span>Obstacle {i + 1}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeObstacle(obs.id); }}
              className="text-gray-500 dark:text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Hotspot list ── */}
      <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Hotspots ({hotspots.length})
          </span>
        </div>
        {hotspots.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-600 italic">No hotspots. Use &quot;Draw Hotspot&quot; mode to add some.</p>
        )}
        {hotspots.map((hs) => (
          <div
            key={hs.id}
            className={`flex items-center justify-between rounded-md px-2 py-1 text-xs mb-1 cursor-pointer transition-colors ${
              selectedGameplayItemId === hs.id && selectedGameplayItemKind === 'hotspot'
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setSelectedGameplayItem(hs.id, 'hotspot')}
          >
            <span className="truncate">{hs.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeHotspot(hs.id); }}
              className="text-gray-500 dark:text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Selected hotspot properties ── */}
      {selectedHotspot && (
        <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
          <GameplayHotspotPropertiesPanel
            hotspot={selectedHotspot}
            nodes={nodes}
            edges={edges}
            variables={variables}
            currentNodeId={nodeId}
            onUpdate={(patch) => updateHotspot(selectedHotspot.id, patch)}
            onDelete={() => removeHotspot(selectedHotspot.id)}
          />
        </div>
      )}
    </>
  );
}
