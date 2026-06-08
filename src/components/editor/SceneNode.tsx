import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare, Film, Puzzle, Gamepad2, Code, Layers } from 'lucide-react';
import {
  useGraphStore,
  type SceneNodeData,
  type SceneType,
  type ChoiceBlock,
  type Hotspot,
  type GameplayHotspot,
  type HotspotAction,
} from '../../stores/graphStore';

const iconMap: Record<SceneType, React.ComponentType<{ className?: string }>> = {
  dialogue: MessageSquare,
  cutscene: Film,
  point_and_click: Puzzle,
  gameplay: Gamepad2,
  custom: Code,
  subgraph: Layers,
};

const colorMap: Record<SceneType, { border: string; headerBg: string; headerText: string; accent: string }> = {
  dialogue: {
    border: 'border-blue-500',
    headerBg: 'bg-blue-500',
    headerText: 'text-white',
    accent: 'text-blue-400',
  },
  cutscene: {
    border: 'border-emerald-500',
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    accent: 'text-emerald-400',
  },
  point_and_click: {
    border: 'border-red-500',
    headerBg: 'bg-red-500',
    headerText: 'text-white',
    accent: 'text-red-400',
  },
  gameplay: {
    border: 'border-orange-500',
    headerBg: 'bg-orange-500',
    headerText: 'text-white',
    accent: 'text-orange-400',
  },
  custom: {
    border: 'border-purple-500',
    headerBg: 'bg-purple-500',
    headerText: 'text-white',
    accent: 'text-purple-400',
  },
  subgraph: {
    border: 'border-teal-500',
    headerBg: 'bg-teal-500',
    headerText: 'text-white',
    accent: 'text-teal-400',
  },
};

// Layout constants for handle positioning (px)
const HEADER_HEIGHT = 36;
const BODY_HEIGHT = 32;
const CHOICE_SECTION_OFFSET = 7; // border-t (1px) + py-1.5 top (6px)
const ROW_HEIGHT = 24;

function SceneNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as SceneNodeData;
  const { sceneType, label, summary } = nodeData;
  const updateNodeData = useGraphStore((s) => s.updateNodeData);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = iconMap[sceneType];
  const colors = colorMap[sceneType];

  // Extract all choice options across all ChoiceBlocks in this node's dialogue
  const choiceOptions = useMemo(() => {
    if (!nodeData.dialogueBlocks) return [];
    return nodeData.dialogueBlocks
      .filter((b): b is ChoiceBlock => b.type === 'choice')
      .flatMap((b) => b.options);
  }, [nodeData.dialogueBlocks]);

  // Extract transition-type hotspots for point-and-click nodes
  const transitionHotspots = useMemo(() => {
    if (sceneType !== 'point_and_click' || !nodeData.hotspots) return [];
    return nodeData.hotspots.filter((h: Hotspot) => h.actions.some((a) => a.type === 'transition'));
  }, [sceneType, nodeData.hotspots]);

  // Extract transition-type hotspots for gameplay (physics) nodes
  const gameplayTransitionHotspots = useMemo(() => {
    if (sceneType !== 'gameplay' || !nodeData.gameplayHotspots) return [];
    return nodeData.gameplayHotspots.filter((h: GameplayHotspot) => h.actions.some((a) => a.type === 'transition'));
  }, [sceneType, nodeData.gameplayHotspots]);

  // Extract choice options from showChoice actions in hotspots
  const extractChoiceHandles = (actions: HotspotAction[]) =>
    actions
      .filter((a): a is HotspotAction & { type: 'showChoice' } => a.type === 'showChoice')
      .flatMap((a) => a.options.map((opt) => ({ id: opt.id, name: opt.label, isChoiceOption: true as const })));

  const pointAndClickChoiceHandles = useMemo(() => {
    if (sceneType !== 'point_and_click' || !nodeData.hotspots) return [];
    return nodeData.hotspots.flatMap((h: Hotspot) => extractChoiceHandles(h.actions));
  }, [sceneType, nodeData.hotspots]);

  const gameplayChoiceHandles = useMemo(() => {
    if (sceneType !== 'gameplay' || !nodeData.gameplayHotspots) return [];
    return nodeData.gameplayHotspots.flatMap((h: GameplayHotspot) => extractChoiceHandles(h.actions));
  }, [sceneType, nodeData.gameplayHotspots]);

  // Timer with transition (point-and-click or gameplay) — include in source handles
  const timerWithTransition = useMemo(() => {
    const t = nodeData.timer;
    if (!t?.enabled || sceneType !== 'point_and_click' && sceneType !== 'gameplay') return null;
    if (!t.actions.some((a) => a.type === 'transition')) return null;
    return t;
  }, [nodeData.timer, sceneType]);

  type SourceHandle = { id: string; name?: string; isTimer?: boolean; isChoiceOption?: boolean };

  // Combined source handles for point-and-click (transition hotspots + choice options + timer)
  const pointAndClickSourceHandles = useMemo<SourceHandle[]>(() => {
    if (sceneType !== 'point_and_click') return [];
    const list: SourceHandle[] = [...transitionHotspots];
    list.push(...pointAndClickChoiceHandles);
    if (timerWithTransition) list.push({ id: timerWithTransition.id, isTimer: true });
    return list;
  }, [sceneType, transitionHotspots, pointAndClickChoiceHandles, timerWithTransition]);

  // Combined source handles for gameplay (transition hotspots + choice options + timer)
  const gameplaySourceHandles = useMemo<SourceHandle[]>(() => {
    if (sceneType !== 'gameplay') return [];
    const list: SourceHandle[] = [...gameplayTransitionHotspots];
    list.push(...gameplayChoiceHandles);
    if (timerWithTransition) list.push({ id: timerWithTransition.id, isTimer: true });
    return list;
  }, [sceneType, gameplayTransitionHotspots, gameplayChoiceHandles, timerWithTransition]);

  const customOutputHandles = useMemo(() => {
    if (sceneType !== 'custom' || !nodeData.customSceneConfig?.outputHandles) return [];
    return nodeData.customSceneConfig.outputHandles;
  }, [sceneType, nodeData.customSceneConfig?.outputHandles]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // For dialogue/gameplay/cutscene/location nodes, skip inline editing — let ReactFlow's onNodeDoubleClick navigate
  const handleDoubleClick = useCallback(() => {
    if (sceneType === 'dialogue' || sceneType === 'point_and_click' || sceneType === 'gameplay' || sceneType === 'cutscene' || sceneType === 'custom') return;
    setEditValue(label);
    setEditing(true);
  }, [label, sceneType]);

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
    [commitEdit]
  );

  return (
    <div
      className={`rounded-lg border-2 ${colors.border} bg-gray-200 dark:bg-gray-800 shadow-lg min-w-[180px] max-w-[240px] ${
        selected ? 'ring-2 ring-indigo-400 dark:ring-white/50 ring-offset-2 ring-offset-gray-200 dark:ring-offset-gray-900' : ''
      }`}
    >
      {/* Input Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-gray-400 !border-2 !border-gray-500 dark:!border-gray-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
      >
        <span className="text-[7px] font-bold select-none pointer-events-none text-gray-700 dark:text-gray-900">in</span>
      </Handle>

      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${colors.headerBg} ${colors.headerText} group/header`}
        onDoubleClick={handleDoubleClick}
      >
        <Icon className="h-4 w-4 shrink-0" />
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
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{summary}</p>
      </div>

      {/* Choice option labels (visible on the node) */}
      {choiceOptions.length > 0 && (
        <div className="border-t border-gray-300 dark:border-gray-700 px-3 py-1.5">
          {choiceOptions.map((opt) => (
            <div key={opt.id} className="flex items-center justify-end py-1">
              <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate">{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transition hotspot + timer labels (point-and-click) */}
      {pointAndClickSourceHandles.length > 0 && (
        <div className="border-t border-gray-300 dark:border-gray-700 px-3 py-1.5">
          {pointAndClickSourceHandles.map((item) => (
            <div key={item.id} className="flex items-center justify-end py-1">
              <span className="text-[10px] text-red-400 truncate">
                {item.isTimer ? 'Timer' : item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Gameplay transition hotspot + timer labels */}
      {gameplaySourceHandles.length > 0 && (
        <div className="border-t border-gray-300 dark:border-gray-700 px-3 py-1.5">
          {gameplaySourceHandles.map((item) => (
            <div key={item.id} className="flex items-center justify-end py-1">
              <span className="text-[10px] text-orange-400 truncate">
                {item.isTimer ? 'Timer' : item.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Custom scene output handle labels */}
      {customOutputHandles.length > 0 && (
        <div className="border-t border-gray-300 dark:border-gray-700 px-3 py-1.5">
          {customOutputHandles.map((h) => (
            <div key={h.id} className="flex items-center justify-end py-1">
              <span className="text-[10px] text-purple-400 truncate">{h.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Output Handle(s) — dynamic when choices, hotspots, timer, or location actions exist */}
      {choiceOptions.length > 0 ? (
        choiceOptions.map((opt, i) => (
          <Handle
            key={opt.id}
            id={opt.id}
            type="source"
            position={Position.Right}
            className="!w-5 !h-5 !bg-blue-400 !border-2 !border-blue-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + CHOICE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-blue-900">out</span>
          </Handle>
        ))
      ) : pointAndClickSourceHandles.length > 0 ? (
        pointAndClickSourceHandles.map((item, i) => (
          <Handle
            key={item.id}
            id={item.id}
            type="source"
            position={Position.Right}
            className="!w-5 !h-5 !bg-red-400 !border-2 !border-red-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + CHOICE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-red-900">out</span>
          </Handle>
        ))
      ) : gameplaySourceHandles.length > 0 ? (
        gameplaySourceHandles.map((item, i) => (
          <Handle
            key={item.id}
            id={item.id}
            type="source"
            position={Position.Right}
            className="!w-5 !h-5 !bg-orange-400 !border-2 !border-orange-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + CHOICE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-orange-900">out</span>
          </Handle>
        ))

      ) : customOutputHandles.length > 0 ? (
        customOutputHandles.map((h, i) => (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            position={Position.Right}
            className="!w-5 !h-5 !bg-purple-400 !border-2 !border-purple-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
            style={{
              top: HEADER_HEIGHT + BODY_HEIGHT + CHOICE_SECTION_OFFSET + i * ROW_HEIGHT + ROW_HEIGHT / 2,
            }}
          >
            <span className="text-[7px] font-bold select-none pointer-events-none text-purple-900">out</span>
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

export default memo(SceneNode);
