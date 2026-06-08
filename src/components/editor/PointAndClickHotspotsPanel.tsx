import { useMemo, useCallback } from 'react';
import { Trash2, Square } from 'lucide-react';
import {
  useGraphStore,
  type SceneNodeData,
  type Hotspot,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import PointAndClickHotspotPropertiesPanel from './PointAndClickHotspotPropertiesPanel';

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface PointAndClickHotspotsPanelProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function PointAndClickHotspotsPanel({ nodeId }: PointAndClickHotspotsPanelProps) {
  const { nodes, edges } = useActiveGraph();
  const variables = useGraphStore((s) => s.variables);
  const updateHotspots = useGraphStore((s) => s.updateHotspots);
  const selectedPacHotspotId = useGraphStore((s) => s.selectedPacHotspotId);
  const setSelectedPacHotspotId = useGraphStore((s) => s.setSelectedPacHotspotId);
  const setSelectedGameplayItem = useGraphStore((s) => s.setSelectedGameplayItem);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;

  const hotspots: Hotspot[] = useMemo(
    () => nodeData?.hotspots ?? [],
    [nodeData?.hotspots],
  );

  // ── CRUD helpers ──

  const removeHotspot = useCallback(
    (hotspotId: string) => {
      updateHotspots(nodeId, hotspots.filter((h) => h.id !== hotspotId));
      if (selectedPacHotspotId === hotspotId) {
        setSelectedPacHotspotId(null);
      }
    },
    [hotspots, nodeId, updateHotspots, selectedPacHotspotId, setSelectedPacHotspotId],
  );

  const updateHotspot = useCallback(
    (hotspotId: string, patch: Partial<Hotspot>) => {
      updateHotspots(
        nodeId,
        hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)),
      );
    },
    [hotspots, nodeId, updateHotspots],
  );

  // ── Selected hotspot ──

  const selectedHotspot = hotspots.find((h) => h.id === selectedPacHotspotId) ?? null;

  return (
    <>
      {/* ── Hotspot list ── */}
      <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
            Hotspots ({hotspots.length})
          </span>
        </div>
        {hotspots.length === 0 && (
          <p className="text-xs text-gray-600 italic">No hotspots yet. Click &quot;Draw Hotspot&quot; and drag on the canvas.</p>
        )}
        {hotspots.map((hs) => (
          <div
            key={hs.id}
            className={`flex items-center justify-between rounded-md px-2 py-1 text-xs mb-1 cursor-pointer transition-colors ${
              selectedPacHotspotId === hs.id
                ? 'bg-yellow-500/15 text-yellow-300'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => { setSelectedPacHotspotId(hs.id); setSelectedGameplayItem(null, null); }}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Square className="h-3 w-3 shrink-0" />
              {hs.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); removeHotspot(hs.id); }}
              className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Selected hotspot properties ── */}
      {selectedHotspot && (
        <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
          <PointAndClickHotspotPropertiesPanel
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
