import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { useGraphStore, type SceneNodeData, END_NODE_TYPE, START_NODE_TYPE } from '../../stores/graphStore';
import type { Node, Edge } from '@xyflow/react';

const HEADER_HEIGHT = 36;
const BODY_HEIGHT = 32;
const HANDLE_SECTION_OFFSET = 7;
const ROW_HEIGHT = 24;

interface ExitHandle {
  id: string;
  label: string;
}

interface EntryHandle {
  id: string;
  label: string;
}

function computeExitHandles(
  internalNodes: Node[],
  internalEdges: Edge[],
): ExitHandle[] {
  const endNode = internalNodes.find((n) => n.type === END_NODE_TYPE);
  if (!endNode) return [];

  const exits: ExitHandle[] = [];
  for (const edge of internalEdges) {
    if (edge.target === endNode.id) {
      const sourceNode = internalNodes.find((n) => n.id === edge.source);
      const sourceLabel = (sourceNode?.data as SceneNodeData)?.label ?? 'Untitled';
      const handleId = edge.sourceHandle ?? 'default';
      const label = handleId === 'default' ? sourceLabel : `${sourceLabel} > ${handleId}`;
      exits.push({
        id: `exit:${edge.source}:${handleId}`,
        label,
      });
    }
  }
  return exits;
}

function computeEntryHandles(
  internalNodes: Node[],
  internalEdges: Edge[],
): EntryHandle[] {
  const startNode = internalNodes.find((n) => n.type === START_NODE_TYPE);
  if (!startNode) return [];

  const entries: EntryHandle[] = [];
  for (const edge of internalEdges) {
    if (edge.source === startNode.id) {
      const targetNode = internalNodes.find((n) => n.id === edge.target);
      const targetLabel = (targetNode?.data as SceneNodeData)?.label ?? 'Untitled';
      entries.push({
        id: `entry:${edge.target}:${edge.targetHandle ?? 'default'}`,
        label: targetLabel,
      });
    }
  }
  return entries;
}

function SubgraphNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SceneNodeData;
  const { label, subgraphNodes = [], subgraphEdges = [] } = nodeData;
  const updateNodeData = useGraphStore((s) => s.updateNodeData);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const exitHandles = useMemo(
    () => computeExitHandles(subgraphNodes, subgraphEdges),
    [subgraphNodes, subgraphEdges],
  );

  const entryHandles = useMemo(
    () => computeEntryHandles(subgraphNodes, subgraphEdges),
    [subgraphNodes, subgraphEdges],
  );

  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [exitHandles, entryHandles, id, updateNodeInternals]);

  const sceneCount = subgraphNodes.filter(
    (n) => n.type !== 'subgraph' && n.type !== END_NODE_TYPE && n.type !== START_NODE_TYPE,
  ).length;
  const sgCount = subgraphNodes.filter((n) => n.type === 'subgraph').length;
  const summaryParts: string[] = [];
  if (sceneCount > 0) summaryParts.push(`${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`);
  if (sgCount > 0) summaryParts.push(`${sgCount} subgraph${sgCount !== 1 ? 's' : ''}`);
  const summaryText = summaryParts.join(', ') || '0 scenes';

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      updateNodeData(id, { label: trimmed });
    }
    setEditing(false);
  }, [editValue, label, id, updateNodeData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      else if (e.key === 'Escape') setEditing(false);
    },
    [commitEdit],
  );

  const handleRows = Math.max(entryHandles.length, exitHandles.length);

  return (
    <div
      className={`rounded-lg border-2 border-teal-500 bg-gray-200 dark:bg-gray-800 shadow-lg min-w-[180px] max-w-[240px] ${
        selected ? 'ring-2 ring-indigo-400 dark:ring-white/50 ring-offset-2 ring-offset-gray-200 dark:ring-offset-gray-900' : ''
      }`}
    >
      {/* Input Handles */}
      {entryHandles.length > 0 ? (
        entryHandles.map((entry, i) => (
          <Handle
            key={entry.id}
            id={entry.id}
            type="target"
            position={Position.Left}
            className="!w-5 !h-5 !bg-emerald-400 !border-2 !border-emerald-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + HANDLE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-emerald-900">in</span>
          </Handle>
        ))
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-5 !h-5 !bg-gray-400 !border-2 !border-gray-500 dark:!border-gray-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
        >
          <span className="text-[7px] font-bold select-none pointer-events-none text-gray-700 dark:text-gray-900">in</span>
        </Handle>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md bg-teal-500 text-white"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditValue(label);
          setEditing(true);
        }}
      >
        <Layers className="h-4 w-4 shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white/20 rounded px-1 py-0.5 text-sm font-semibold text-white outline-none placeholder-white/50 min-w-0"
          />
        ) : (
          <span className="text-sm font-semibold truncate">{label}</span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{summaryText}</p>
      </div>

      {/* Entry/Exit handle labels */}
      {handleRows > 0 && (
        <div className="border-t border-gray-300 dark:border-gray-700 px-3 py-1.5">
          {Array.from({ length: handleRows }, (_, i) => (
            <div key={i} className="flex items-center justify-between py-1 gap-2">
              <span className="text-[10px] text-emerald-400 truncate">
                {entryHandles[i]?.label ?? ''}
              </span>
              <span className="text-[10px] text-teal-400 truncate">
                {exitHandles[i]?.label ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Output Handles */}
      {exitHandles.length > 0 ? (
        exitHandles.map((exit, i) => (
          <Handle
            key={exit.id}
            id={exit.id}
            type="source"
            position={Position.Right}
            className="!w-5 !h-5 !bg-teal-400 !border-2 !border-teal-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + HANDLE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-teal-900">out</span>
          </Handle>
        ))
      ) : (
        <Handle
          id="default"
          type="source"
          position={Position.Right}
          className="!w-5 !h-5 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
        >
          <span className="text-[7px] font-bold select-none pointer-events-none text-gray-700 dark:text-gray-900">out</span>
        </Handle>
      )}
    </div>
  );
}

export default memo(SubgraphNode);
