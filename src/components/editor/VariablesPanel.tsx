import { useState } from 'react';
import { Plus, Trash2, Hash, ToggleLeft, Type } from 'lucide-react';
import {
  useGraphStore,
  type VariableDefinition,
  type VariableType,
} from '../../stores/graphStore';
import { useDebouncedHistory } from '../../utils/undoHistory';

// ── Type badge helpers ──

const typeBadgeConfig: Record<VariableType, { icon: typeof Hash; color: string; label: string }> = {
  number: { icon: Hash, color: 'text-blue-400 bg-blue-500/10', label: 'Num' },
  boolean: { icon: ToggleLeft, color: 'text-emerald-400 bg-emerald-500/10', label: 'Bool' },
  string: { icon: Type, color: 'text-purple-400 bg-purple-500/10', label: 'Str' },
};

// ── Main Component ──

export default function VariablesPanel() {
  const variables = useGraphStore((s) => s.variables);
  const addVariable = useGraphStore((s) => s.addVariable);
  const updateVariable = useGraphStore((s) => s.updateVariable);
  const removeVariable = useGraphStore((s) => s.removeVariable);

  // New variable form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VariableType>('number');
  const [newValue, setNewValue] = useState<string>('0');

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Prevent duplicate names
    if (variables.some((v) => v.name === trimmed)) return;

    let initialValue: boolean | number | string;
    switch (newType) {
      case 'boolean':
        initialValue = newValue === 'true';
        break;
      case 'number':
        initialValue = Number(newValue) || 0;
        break;
      case 'string':
        initialValue = newValue;
        break;
    }

    const variable: VariableDefinition = {
      id: crypto.randomUUID(),
      name: trimmed,
      type: newType,
      initialValue,
    };

    addVariable(variable);
    setNewName('');
    setNewValue(newType === 'number' ? '0' : newType === 'boolean' ? 'false' : '');
  };

  const handleTypeChange = (type: VariableType) => {
    setNewType(type);
    setNewValue(type === 'number' ? '0' : type === 'boolean' ? 'false' : '');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Create Variable Form */}
      <div className="border-b border-gray-300 dark:border-gray-700 p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500">
          New Variable
        </p>

        {/* Name input */}
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value.replace(/\s+/g, '_'))}
          placeholder="variable_name"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />

        {/* Type selector + initial value */}
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => handleTypeChange(e.target.value as VariableType)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="string">String</option>
          </select>

          {/* Value input adapts to type */}
          {newType === 'boolean' ? (
            <select
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          ) : (
            <input
              type={newType === 'number' ? 'number' : 'text'}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Initial value"
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          )}

          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Create variable"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {variables.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-600">
            No variables defined yet.
          </p>
        )}

        {variables.map((variable) => (
          <VariableRow
            key={variable.id}
            variable={variable}
            onUpdate={(patch) => updateVariable(variable.id, patch)}
            onRemove={() => removeVariable(variable.id)}
            allNames={variables.map((v) => v.name)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Variable Row ──

interface VariableRowProps {
  variable: VariableDefinition;
  onUpdate: (patch: Partial<Omit<VariableDefinition, 'id'>>) => void;
  onRemove: () => void;
  allNames: string[];
}

function VariableRow({ variable, onUpdate, onRemove, allNames }: VariableRowProps) {
  const badge = typeBadgeConfig[variable.type];
  const BadgeIcon = badge.icon;
  const debouncedHistory = useDebouncedHistory();

  const handleNameChange = (name: string) => {
    const cleaned = name.replace(/\s+/g, '_');
    if (allNames.some((n) => n === cleaned && n !== variable.name)) return;
    debouncedHistory();
    onUpdate({ name: cleaned });
  };

  const handleValueChange = (raw: string) => {
    debouncedHistory();
    switch (variable.type) {
      case 'boolean':
        onUpdate({ initialValue: raw === 'true' });
        break;
      case 'number':
        onUpdate({ initialValue: Number(raw) || 0 });
        break;
      case 'string':
        onUpdate({ initialValue: raw });
        break;
    }
  };

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700/50 bg-gray-100 dark:bg-gray-800/50 px-2.5 py-2 hover:border-gray-600 transition-colors">
      {/* Type badge */}
      <span
        className={`inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.color}`}
        title={variable.type}
      >
        <BadgeIcon className="h-3 w-3" />
        {badge.label}
      </span>

      {/* Name */}
      <input
        type="text"
        value={variable.name}
        onChange={(e) => handleNameChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-gray-300 outline-none hover:border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:bg-white dark:bg-gray-900 transition-colors"
      />

      {/* Initial value */}
      {variable.type === 'boolean' ? (
        <button
          onClick={() => onUpdate({ initialValue: !variable.initialValue })}
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold cursor-pointer transition-colors ${
            variable.initialValue
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-gray-200 dark:bg-gray-700/50 text-gray-500 dark:text-gray-600 dark:text-gray-500 dark:text-gray-600 dark:text-gray-500'
          }`}
        >
          {String(variable.initialValue)}
        </button>
      ) : (
        <input
          type={variable.type === 'number' ? 'number' : 'text'}
          value={String(variable.initialValue)}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-16 shrink-0 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-0.5 text-[11px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors text-right"
        />
      )}

      {/* Delete */}
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-gray-500 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer transition-all"
        title="Delete variable"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
