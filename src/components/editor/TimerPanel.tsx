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
  Clock,
} from 'lucide-react';
import {
  type SceneTimer,
  type HotspotAction,
  type HotspotCondition,
  type SceneNodeData,
  type VariableDefinition,
} from '../../stores/graphStore';

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface TimerPanelProps {
  nodeId: string;
  timer: SceneTimer | null | undefined;
  nodes: Array<{ id: string; data: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; sourceHandle?: string | null }>;
  variables: VariableDefinition[];
  onUpdate: (timer: SceneTimer) => void;
  onRemove: () => void;
  accentColor?: string;
}

const DEFAULT_ACCENT = 'text-cyan-400';

// ────────────────────────────────────────────────────────
// ActionCard — renders a single action in the list
// ────────────────────────────────────────────────────────

interface TimerActionCardProps {
  index: number;
  action: HotspotAction;
  totalActions: number;
  variables: VariableDefinition[];
  connectionStatus: { connected: false } | { connected: true; targetLabel: string } | null;
  hasTransitionElsewhere: boolean;
  onTypeChange: (newType: HotspotAction['type']) => void;
  onUpdate: (updated: HotspotAction) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

function TimerActionCard({
  index,
  action,
  totalActions,
  variables,
  connectionStatus,
  hasTransitionElsewhere,
  onTypeChange,
  onUpdate,
  onRemove,
  onMove,
}: TimerActionCardProps) {
  const setVarAction = action.type === 'setVariable' ? action : null;
  const actionVarDef = setVarAction
    ? variables.find((v) => v.id === setVarAction.variableId)
    : null;
  const isActionVarNumber = actionVarDef?.type === 'number';

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-800/50 px-2.5 py-2 space-y-2">
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
          {!hasTransitionElsewhere && (
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
      {action.type === 'transition' && connectionStatus && (
        <div>
          {connectionStatus.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <ArrowRight className="h-3 w-3" />
              Connected to: {connectionStatus.targetLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Not connected — draw an edge in the graph
            </span>
          )}
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
            <option value="">Select variable…</option>
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
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 cursor-pointer font-mono w-12 text-center"
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
                  const val = isActionVarNumber ? Number(e.target.value) || 0 : e.target.value;
                  onUpdate({ ...action, value: val });
                }}
                placeholder="value"
                className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
              />
            )}
          </div>
        </div>
      )}
      {action.type === 'showMessage' && (
        <textarea
          value={action.message}
          onChange={(e) =>
            onUpdate({ type: 'showMessage', message: e.target.value, dismissMode: action.dismissMode })
          }
          placeholder="Message to show…"
          rows={2}
          className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none resize-y focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function TimerPanel({
  nodeId,
  timer,
  nodes,
  edges,
  variables,
  onUpdate,
  onRemove,
  accentColor = DEFAULT_ACCENT,
}: TimerPanelProps) {
  const [showCondition, setShowCondition] = useState(!!timer?.condition);

  const handleEnable = useCallback(() => {
    onUpdate({
      id: crypto.randomUUID(),
      enabled: true,
      durationSeconds: 120,
      showCountdown: false,
      actions: [{ type: 'showMessage', message: '' }],
    });
  }, [onUpdate]);

  // Derived values (safe when timer is null)
  const actions = timer?.actions ?? [];
  const hasTransition = actions.some((a) => a.type === 'transition');

  const connectionStatus = useMemo(() => {
    if (!timer || !hasTransition) return null;
    const edge = edges.find(
      (e) => e.source === nodeId && e.sourceHandle === timer.id,
    );
    if (!edge) return { connected: false as const };
    const targetNode = nodes.find((n) => n.id === edge.target);
    const targetLabel = (targetNode?.data as SceneNodeData | undefined)?.label ?? 'Node';
    return { connected: true as const, targetLabel };
  }, [timer, hasTransition, edges, nodeId, nodes]);

  const updateActionAt = useCallback(
    (index: number, updated: HotspotAction) => {
      if (!timer) return;
      const next = [...actions];
      next[index] = updated;
      onUpdate({ ...timer, actions: next });
    },
    [actions, timer, onUpdate],
  );

  const removeActionAt = useCallback(
    (index: number) => {
      if (!timer) return;
      const next = actions.filter((_, i) => i !== index);
      onUpdate({
        ...timer,
        actions: next.length > 0 ? next : [{ type: 'showMessage', message: '' }],
      });
    },
    [actions, timer, onUpdate],
  );

  const moveAction = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (!timer) return;
      const next = [...actions];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      onUpdate({ ...timer, actions: next });
    },
    [actions, timer, onUpdate],
  );

  const addAction = useCallback(() => {
    if (!timer) return;
    onUpdate({ ...timer, actions: [...actions, { type: 'showMessage', message: '' }] });
  }, [actions, timer, onUpdate]);

  const handleActionTypeChange = useCallback(
    (index: number, newType: HotspotAction['type']) => {
      if (!timer) return;
      let action: HotspotAction;
      switch (newType) {
        case 'transition':
          action = { type: 'transition' };
          break;
        case 'setVariable':
          action = {
            type: 'setVariable',
            variableId: variables[0]?.id ?? '',
            operator: '=',
            value: variables[0]?.initialValue ?? '',
          };
          break;
        default:
          action = { type: 'showMessage', message: '' };
          break;
      }
      updateActionAt(index, action);
    },
    [timer, variables, updateActionAt],
  );

  const handleSetCondition = useCallback(
    (condition: HotspotCondition | undefined) => {
      if (!timer) return;
      onUpdate({ ...timer, condition });
    },
    [timer, onUpdate],
  );

  if (timer == null || !timer.enabled) {
    return (
      <div className="border-t border-gray-300 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${accentColor}`}>
            Timer
          </span>
        </div>
        <p className="text-xs text-gray-600 italic mb-2">
          Trigger actions after a set time (e.g. 2 minutes). Optional.
        </p>
        <button
          onClick={handleEnable}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-gray-200 transition-colors cursor-pointer"
        >
          <Clock className="h-3.5 w-3.5" />
          Enable Timer
        </button>
      </div>
    );
  }

  const conditionVariable = timer.condition
    ? variables.find((v) => v.id === timer.condition!.variableId)
    : null;

  const durationMinutes = Math.floor(timer.durationSeconds / 60);
  const durationSecs = timer.durationSeconds % 60;

  return (
    <div className="border-t border-gray-300 dark:border-gray-700 pt-3 space-y-4">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${accentColor}`}>
          Timer
        </span>
        <button
          onClick={onRemove}
          title="Remove timer"
          className="rounded p-1 text-gray-600 dark:text-gray-500 hover:text-red-400 cursor-pointer transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
          Duration
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            value={durationMinutes}
            onChange={(e) => {
              const m = Math.max(0, parseInt(String(e.target.value), 10) || 0);
              const s = Math.min(59, Math.max(0, durationSecs));
              onUpdate({ ...timer, durationSeconds: m * 60 + s });
            }}
            className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-500">min</span>
          <input
            type="number"
            min={0}
            max={59}
            value={durationSecs}
            onChange={(e) => {
              const s = Math.min(59, Math.max(0, parseInt(String(e.target.value), 10) || 0));
              onUpdate({ ...timer, durationSeconds: durationMinutes * 60 + s });
            }}
            className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-500">sec</span>
        </div>
      </div>

      {/* Show countdown */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="timer-show-countdown"
          checked={timer.showCountdown}
          onChange={(e) => onUpdate({ ...timer, showCountdown: e.target.checked })}
          className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
        />
        <label htmlFor="timer-show-countdown" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          Show countdown on screen (top-left)
        </label>
      </div>

      {/* Actions */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1.5">
          When timer triggers
        </label>
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <TimerActionCard
              key={idx}
              index={idx}
              action={action}
              totalActions={actions.length}
              variables={variables}
              connectionStatus={action.type === 'transition' ? connectionStatus : null}
              hasTransitionElsewhere={hasTransition && action.type !== 'transition'}
              onTypeChange={(newType) => handleActionTypeChange(idx, newType)}
              onUpdate={(updated) => updateActionAt(idx, updated)}
              onRemove={() => removeActionAt(idx)}
              onMove={(dir) => moveAction(idx, dir)}
            />
          ))}
        </div>
        {!hasTransition && (
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
            <span className="text-[10px] font-semibold text-amber-400/70">
              Only trigger when:
            </span>
            <select
              value={timer.condition?.variableId ?? ''}
              onChange={(e) => {
                const varDef = variables.find((v) => v.id === e.target.value);
                handleSetCondition({
                  variableId: e.target.value,
                  comparison: timer.condition?.comparison ?? '==',
                  value: varDef ? varDef.initialValue : '',
                });
              }}
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">Select variable…</option>
              {variables.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <select
                value={timer.condition?.comparison ?? '=='}
                onChange={(e) => {
                  if (!timer.condition) return;
                  handleSetCondition({
                    ...timer.condition,
                    comparison: e.target.value as HotspotCondition['comparison'],
                  });
                }}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer font-mono"
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                {conditionVariable?.type === 'number' && (
                  <>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                  </>
                )}
              </select>
              {conditionVariable?.type === 'boolean' ? (
                <select
                  value={String(timer.condition?.value ?? 'false')}
                  onChange={(e) => {
                    if (!timer.condition) return;
                    handleSetCondition({ ...timer.condition, value: e.target.value === 'true' });
                  }}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={conditionVariable?.type === 'number' ? 'number' : 'text'}
                  value={String(timer.condition?.value ?? '')}
                  onChange={(e) => {
                    if (!timer.condition) return;
                    const val =
                      conditionVariable?.type === 'number'
                        ? Number(e.target.value) || 0
                        : e.target.value;
                    handleSetCondition({ ...timer.condition, value: val });
                  }}
                  placeholder="value"
                  className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-amber-500 transition-colors"
                />
              )}
              <button
                onClick={() => {
                  handleSetCondition(undefined);
                  setShowCondition(false);
                }}
                title="Remove condition"
                className="rounded p-0.5 text-gray-600 hover:text-red-400 cursor-pointer transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
