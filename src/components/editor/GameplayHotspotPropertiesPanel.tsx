import { useState, useMemo, useCallback } from 'react';
import {
  Trash2,
  Filter,
  X,
  Plus,
  ArrowRight,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  GitBranch,
} from 'lucide-react';
import {
  type SceneNodeData,
  type GameplayHotspot,
  type HotspotAction,
  type HotspotCondition,
  type ChoiceOption,
  type ChoiceCondition,
  type VariableDefinition,
} from '../../stores/graphStore';
import type { Node, Edge } from '@xyflow/react';

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface GameplayHotspotPropertiesPanelProps {
  hotspot: GameplayHotspot;
  nodes: Node[];
  edges: Edge[];
  variables: VariableDefinition[];
  currentNodeId: string;
  onUpdate: (patch: Partial<GameplayHotspot>) => void;
  onDelete: () => void;
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function GameplayHotspotPropertiesPanel({
  hotspot,
  nodes,
  edges,
  variables,
  currentNodeId,
  onUpdate,
  onDelete,
}: GameplayHotspotPropertiesPanelProps) {
  const [showCondition, setShowCondition] = useState(!!hotspot.condition);

  const actions = hotspot.actions;
  const hasTransition = actions.some((a) => a.type === 'transition');
  const hasShowChoice = actions.some((a) => a.type === 'showChoice');
  const hasTerminalAction = hasTransition || hasShowChoice;

  const connectedEdge = useMemo(() => {
    if (!hasTransition) return null;
    return edges.find(
      (e) => e.source === currentNodeId && e.sourceHandle === hotspot.id,
    );
  }, [edges, currentNodeId, hotspot.id, hasTransition]);

  const targetNodeLabel = useMemo(() => {
    if (!connectedEdge) return null;
    const targetNode = nodes.find((n) => n.id === connectedEdge.target);
    return (targetNode?.data as SceneNodeData | undefined)?.label ?? connectedEdge.target;
  }, [connectedEdge, nodes]);

  const connectionStatus = useMemo(() => {
    if (!hasTransition) return null;
    if (!connectedEdge) return { connected: false as const };
    return { connected: true as const, targetLabel: targetNodeLabel ?? 'Node' };
  }, [hasTransition, connectedEdge, targetNodeLabel]);

  const choiceConnectionStatusMap = useMemo(() => {
    const map = new Map<string, { connected: boolean; targetLabel?: string }>();
    if (!hasShowChoice) return map;
    for (const action of actions) {
      if (action.type !== 'showChoice') continue;
      for (const opt of action.options) {
        const edge = edges.find(
          (e) => e.source === currentNodeId && e.sourceHandle === opt.id,
        );
        if (edge) {
          const targetNode = nodes.find((n) => n.id === edge.target);
          const label = (targetNode?.data as SceneNodeData | undefined)?.label ?? 'Node';
          map.set(opt.id, { connected: true, targetLabel: label });
        } else {
          map.set(opt.id, { connected: false });
        }
      }
    }
    return map;
  }, [hasShowChoice, actions, edges, currentNodeId, nodes]);

  // ── Action helpers ──

  const updateActionAt = useCallback(
    (index: number, updated: HotspotAction) => {
      const next = [...actions];
      next[index] = updated;
      onUpdate({ actions: next });
    },
    [actions, onUpdate],
  );

  const removeActionAt = useCallback(
    (index: number) => {
      const next = actions.filter((_, i) => i !== index);
      onUpdate({ actions: next.length > 0 ? next : [{ type: 'showMessage', message: '' }] });
    },
    [actions, onUpdate],
  );

  const moveAction = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const next = [...actions];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      onUpdate({ actions: next });
    },
    [actions, onUpdate],
  );

  const addAction = useCallback(() => {
    onUpdate({ actions: [...actions, { type: 'showMessage', message: '' }] });
  }, [actions, onUpdate]);

  const handleActionTypeChange = useCallback(
    (index: number, newType: HotspotAction['type']) => {
      let action: HotspotAction;
      if (newType === 'transition') {
        action = { type: 'transition' };
      } else if (newType === 'showChoice') {
        action = {
          type: 'showChoice',
          options: [
            { id: crypto.randomUUID(), label: 'Option A' },
            { id: crypto.randomUUID(), label: 'Option B' },
          ],
        };
      } else if (newType === 'setVariable') {
        action = {
          type: 'setVariable',
          variableId: variables[0]?.id ?? '',
          operator: '=',
          value: true,
        };
      } else {
        action = { type: 'showMessage', message: '' };
      }
      updateActionAt(index, action);
    },
    [variables, updateActionAt],
  );

  // ── Condition helpers ──

  const handleSetCondition = useCallback(
    (condition: HotspotCondition | undefined) => {
      onUpdate({ condition });
    },
    [onUpdate],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
          Hotspot Properties
        </span>
        <button
          onClick={onDelete}
          className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
          title="Delete hotspot"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
          Name
        </label>
        <input
          type="text"
          value={hotspot.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Hotspot name..."
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
      </div>

      {/* Activation Type */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
          Activation
        </label>
        <select
          value={hotspot.activationType}
          onChange={(e) => onUpdate({ activationType: e.target.value as GameplayHotspot['activationType'] })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="collision">On Collision (auto-trigger)</option>
          <option value="interaction_button">Interaction Button (press E)</option>
        </select>
      </div>

      {/* Show Indicator */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`indicator-${hotspot.id}`}
          checked={hotspot.showIndicator}
          onChange={(e) => onUpdate({ showIndicator: e.target.checked })}
          className="rounded border-gray-600 bg-white dark:bg-gray-900 text-blue-500"
        />
        <label htmlFor={`indicator-${hotspot.id}`} className="text-xs text-gray-600 dark:text-gray-400">
          Show indicator when in range
        </label>
      </div>

      {/* Message Position */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
          Message Position
        </label>
        <select
          value={hotspot.messagePosition ?? 'bottom'}
          onChange={(e) => onUpdate({ messagePosition: e.target.value as 'top' | 'bottom' })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="bottom">Bottom of screen</option>
          <option value="top">Top of screen</option>
        </select>
      </div>

      {/* ── Actions list ── */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1.5">
          Actions
        </label>

        <div className="space-y-2">
          {actions.map((action, idx) => (
            <ActionCard
              key={idx}
              index={idx}
              action={action}
              totalActions={actions.length}
              variables={variables}
              connectionStatus={action.type === 'transition' ? connectionStatus : null}
              choiceConnectionStatusMap={action.type === 'showChoice' ? choiceConnectionStatusMap : undefined}
              hasTerminalElsewhere={hasTerminalAction && action.type !== 'transition' && action.type !== 'showChoice'}
              onTypeChange={(newType) => handleActionTypeChange(idx, newType)}
              onUpdate={(updated) => updateActionAt(idx, updated)}
              onRemove={() => removeActionAt(idx)}
              onMove={(dir) => moveAction(idx, dir)}
            />
          ))}
        </div>

        {/* Add Action button — hidden if a terminal action exists */}
        {!hasTerminalAction && (
          <button
            onClick={addAction}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Action
          </button>
        )}
      </div>

      {/* Condition */}
      <div>
        <button
          onClick={() => {
            if (showCondition) {
              handleSetCondition(undefined);
              setShowCondition(false);
            } else {
              setShowCondition(true);
            }
          }}
          className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
            showCondition
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-gray-600 dark:text-gray-500 hover:text-amber-400'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {showCondition ? 'Remove Condition' : 'Add Condition'}
        </button>

        {showCondition && (
          <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-2">
            <select
              value={hotspot.condition?.variableId ?? ''}
              onChange={(e) =>
                handleSetCondition({
                  variableId: e.target.value,
                  comparison: hotspot.condition?.comparison ?? '==',
                  value: hotspot.condition?.value ?? true,
                })
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">Select variable...</option>
              {variables.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <select
                value={hotspot.condition?.comparison ?? '=='}
                onChange={(e) =>
                  handleSetCondition({
                    variableId: hotspot.condition?.variableId ?? '',
                    comparison: e.target.value as HotspotCondition['comparison'],
                    value: hotspot.condition?.value ?? true,
                  })
                }
                className="w-16 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
              </select>
              <input
                type="text"
                value={String(hotspot.condition?.value ?? '')}
                onChange={(e) => {
                  let val: boolean | number | string = e.target.value;
                  if (val === 'true') val = true;
                  else if (val === 'false') val = false;
                  else if (!isNaN(Number(val)) && val !== '') val = Number(val);
                  handleSetCondition({
                    variableId: hotspot.condition?.variableId ?? '',
                    comparison: hotspot.condition?.comparison ?? '==',
                    value: val,
                  });
                }}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500"
                placeholder="Value"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ActionCard — renders a single action in the list
// ────────────────────────────────────────────────────────

interface ActionCardProps {
  index: number;
  action: HotspotAction;
  totalActions: number;
  variables: VariableDefinition[];
  connectionStatus: { connected: false } | { connected: true; targetLabel: string } | null;
  choiceConnectionStatusMap?: Map<string, { connected: boolean; targetLabel?: string }>;
  hasTerminalElsewhere: boolean;
  onTypeChange: (newType: HotspotAction['type']) => void;
  onUpdate: (updated: HotspotAction) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

function ActionCard({
  index,
  action,
  totalActions,
  variables,
  connectionStatus,
  choiceConnectionStatusMap,
  hasTerminalElsewhere,
  onTypeChange,
  onUpdate,
  onRemove,
  onMove,
}: ActionCardProps) {
  const setVarAction = action.type === 'setVariable' ? action : null;
  const actionVarDef = setVarAction
    ? variables.find((v) => v.id === setVarAction.variableId)
    : null;
  const isActionVarNumber = actionVarDef?.type === 'number';

  const addChoiceOption = () => {
    if (action.type !== 'showChoice') return;
    onUpdate({
      ...action,
      options: [...action.options, { id: crypto.randomUUID(), label: `Option ${action.options.length + 1}` }],
    });
  };

  const removeChoiceOption = (optionId: string) => {
    if (action.type !== 'showChoice') return;
    const filtered = action.options.filter((o) => o.id !== optionId);
    if (filtered.length === 0) return;
    onUpdate({ ...action, options: filtered });
  };

  const updateChoiceOption = (optionId: string, patch: Partial<ChoiceOption>) => {
    if (action.type !== 'showChoice') return;
    onUpdate({
      ...action,
      options: action.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
    });
  };

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-800/50 px-2.5 py-2 space-y-2">
      {/* Header row: step number, type selector, move/delete */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-500 w-4 shrink-0 text-center">
          {index + 1}
        </span>
        <select
          value={action.type}
          onChange={(e) => onTypeChange(e.target.value as HotspotAction['type'])}
          className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="showMessage">Show Message</option>
          <option value="setVariable">Set Variable</option>
          {!hasTerminalElsewhere && (
            <option value="showChoice">Show Choices</option>
          )}
          {!hasTerminalElsewhere && (
            <option value="transition">Transition to Node</option>
          )}
        </select>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            title="Move up"
            className="rounded p-0.5 text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalActions - 1}
            title="Move down"
            className="rounded p-0.5 text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={onRemove}
            title="Remove action"
            className="rounded p-0.5 text-gray-600 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors ml-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Action-specific fields */}
      {action.type === 'transition' && connectionStatus && (
        <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/50 px-3 py-2">
          {connectionStatus.connected ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
              <ArrowRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{connectionStatus.targetLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Connect this handle on the graph to a target node.</span>
            </div>
          )}
        </div>
      )}

      {action.type === 'showChoice' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 border-b border-blue-500/30 pb-1.5">
            <GitBranch className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              Player Choice
            </span>
          </div>
          {action.options.map((opt) => {
            const status = choiceConnectionStatusMap?.get(opt.id);
            return (
              <ChoiceOptionRow
                key={opt.id}
                option={opt}
                canRemove={action.options.length > 1}
                connectionStatus={status}
                variables={variables}
                onUpdate={(patch) => updateChoiceOption(opt.id, patch)}
                onRemove={() => removeChoiceOption(opt.id)}
              />
            );
          })}
          <button
            onClick={addChoiceOption}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-700 py-1.5 text-xs text-gray-600 dark:text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Option
          </button>
        </div>
      )}

      {action.type === 'setVariable' && (
        <div className="space-y-1.5">
          <select
            value={action.variableId}
            onChange={(e) => {
              const varDef = variables.find((v) => v.id === e.target.value);
              onUpdate({
                type: 'setVariable',
                variableId: e.target.value,
                operator: '=',
                value: varDef ? varDef.initialValue : '',
              });
            }}
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            {variables.length === 0 && <option value="">No variables defined</option>}
            {variables.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select
              value={action.operator}
              onChange={(e) =>
                onUpdate({ ...action, operator: e.target.value as '=' | '+=' | '-=' })
              }
              className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              <option value="=">=</option>
              {isActionVarNumber && <option value="+=">+=</option>}
              {isActionVarNumber && <option value="-=">-=</option>}
            </select>
            {actionVarDef?.type === 'boolean' ? (
              <select
                value={String(action.value)}
                onChange={(e) =>
                  onUpdate({ ...action, value: e.target.value === 'true' })
                }
                className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={isActionVarNumber ? 'number' : 'text'}
                value={String(action.value)}
                onChange={(e) => {
                  let val: boolean | number | string = e.target.value;
                  if (val === 'true') val = true;
                  else if (val === 'false') val = false;
                  else if (!isNaN(Number(val)) && val !== '') val = Number(val);
                  onUpdate({ ...action, value: val });
                }}
                className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500"
                placeholder="Value"
              />
            )}
          </div>
        </div>
      )}

      {action.type === 'showMessage' && (
        <div className="space-y-1.5">
          <textarea
            value={action.message}
            onChange={(e) =>
              onUpdate({ type: 'showMessage', message: e.target.value, dismissMode: action.dismissMode })
            }
            placeholder="Message to display..."
            rows={2}
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors resize-none"
          />
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-700">
            <button
              type="button"
              onClick={() =>
                onUpdate({ type: 'showMessage', message: action.message, dismissMode: 'onLeave' })
              }
              className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                (action.dismissMode ?? 'onInteraction') === 'onLeave'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-700'
              }`}
            >
              On Leave
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate({ type: 'showMessage', message: action.message, dismissMode: 'onInteraction' })
              }
              className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                (action.dismissMode ?? 'onInteraction') === 'onInteraction'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-700'
              }`}
            >
              On Interaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ChoiceOptionRow — renders a single choice option
// ────────────────────────────────────────────────────────

interface ChoiceOptionRowProps {
  option: ChoiceOption;
  canRemove: boolean;
  connectionStatus?: { connected: boolean; targetLabel?: string };
  variables: VariableDefinition[];
  onUpdate: (patch: Partial<ChoiceOption>) => void;
  onRemove: () => void;
}

function ChoiceOptionRow({ option, canRemove, connectionStatus, variables, onUpdate, onRemove }: ChoiceOptionRowProps) {
  const [showCondition, setShowCondition] = useState(!!option.condition);
  const conditionVariable = option.condition
    ? variables.find((v) => v.id === option.condition!.variableId)
    : null;

  return (
    <div className={`rounded-md transition-colors ${option.condition ? 'border-l-2 border-l-amber-500/60' : ''}`}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={option.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Option label…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
        {connectionStatus && (
          connectionStatus.connected ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400" title={`→ ${connectionStatus.targetLabel}`}>
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400" title="Not connected">
              <AlertTriangle className="h-2.5 w-2.5" />
            </span>
          )
        )}
        <button
          onClick={() => {
            if (showCondition) {
              onUpdate({ condition: undefined });
              setShowCondition(false);
            } else {
              setShowCondition(true);
            }
          }}
          title={showCondition ? 'Remove condition' : 'Add condition'}
          className={`shrink-0 rounded p-0.5 transition-colors cursor-pointer ${
            showCondition ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400'
          }`}
        >
          <Filter className="h-3 w-3" />
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove option"
            className="shrink-0 rounded p-0.5 text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showCondition && (
        <div className="ml-4 mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
          <span className="text-[10px] font-semibold text-amber-400/70 shrink-0">IF</span>
          <select
            value={option.condition?.variableId ?? ''}
            onChange={(e) => {
              const varDef = variables.find((v) => v.id === e.target.value);
              onUpdate({
                condition: {
                  variableId: e.target.value,
                  comparison: option.condition?.comparison ?? '==',
                  value: varDef ? varDef.initialValue : '',
                },
              });
            }}
            className="flex-1 min-w-0 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-[11px] text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">var…</option>
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select
            value={option.condition?.comparison ?? '=='}
            onChange={(e) => {
              if (!option.condition) return;
              onUpdate({ condition: { ...option.condition, comparison: e.target.value as ChoiceCondition['comparison'] } });
            }}
            className="w-10 rounded border border-gray-700 bg-gray-900 px-0.5 py-0.5 text-[11px] text-gray-300 outline-none focus:border-amber-500 cursor-pointer font-mono text-center"
          >
            <option value="==">==</option>
            <option value="!=">!=</option>
            {conditionVariable?.type === 'number' && <option value=">">&gt;</option>}
            {conditionVariable?.type === 'number' && <option value="<">&lt;</option>}
            {conditionVariable?.type === 'number' && <option value=">=">&gt;=</option>}
          </select>
          {conditionVariable?.type === 'boolean' ? (
            <select
              value={String(option.condition?.value ?? 'false')}
              onChange={(e) => {
                if (!option.condition) return;
                onUpdate({ condition: { ...option.condition, value: e.target.value === 'true' } });
              }}
              className="w-14 rounded border border-gray-700 bg-gray-900 px-0.5 py-0.5 text-[11px] text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={conditionVariable?.type === 'number' ? 'number' : 'text'}
              value={String(option.condition?.value ?? '')}
              onChange={(e) => {
                if (!option.condition) return;
                const val = conditionVariable?.type === 'number' ? Number(e.target.value) || 0 : e.target.value;
                onUpdate({ condition: { ...option.condition, value: val } });
              }}
              placeholder="val"
              className="w-14 rounded border border-gray-700 bg-gray-900 px-1 py-0.5 text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-amber-500"
            />
          )}
          <button
            onClick={() => { onUpdate({ condition: undefined }); setShowCondition(false); }}
            title="Remove condition"
            className="rounded p-0.5 text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}
