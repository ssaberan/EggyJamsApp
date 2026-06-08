/**
 * KeyframeEditor — reusable keyframe editing UI for a single property.
 *
 * Shows the current interpolated value, an "add keyframe" button,
 * and a list of existing keyframes with value/interpolation/delete controls.
 */
import { useCallback } from 'react';
import { Diamond, Trash2, Plus } from 'lucide-react';
import type { Keyframe, InterpolationMode } from '../../../stores/graphStore';

const INTERP_OPTIONS: { value: InterpolationMode; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'instant', label: 'Instant' },
];

interface KeyframeEditorProps {
  label: string;
  keyframes: Keyframe[];
  currentTime: number;
  currentValue: number;
  defaultValue: number;
  onChange: (keyframes: Keyframe[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

function generateKfId(): string {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function KeyframeEditor({
  label,
  keyframes,
  currentTime,
  currentValue,
  defaultValue,
  onChange,
  min,
  max,
  step = 0.1,
}: KeyframeEditorProps) {
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Does a keyframe exist at (approximately) the current time?
  const existingAtTime = sorted.find((kf) => Math.abs(kf.time - currentTime) < 0.05);

  const handleAdd = useCallback(() => {
    if (existingAtTime) return;
    const newKf: Keyframe = {
      id: generateKfId(),
      time: Math.round(currentTime * 100) / 100,
      value: defaultValue,
      interpolation: 'linear',
    };
    onChange([...keyframes, newKf]);
  }, [existingAtTime, currentTime, defaultValue, keyframes, onChange]);

  const handleDelete = useCallback(
    (id: string) => {
      onChange(keyframes.filter((kf) => kf.id !== id));
    },
    [keyframes, onChange],
  );

  const handleValueChange = useCallback(
    (id: string, value: number) => {
      onChange(keyframes.map((kf) => (kf.id === id ? { ...kf, value } : kf)));
    },
    [keyframes, onChange],
  );

  const handleTimeChange = useCallback(
    (id: string, time: number) => {
      onChange(keyframes.map((kf) => (kf.id === id ? { ...kf, time: Math.max(0, time) } : kf)));
    },
    [keyframes, onChange],
  );

  const handleInterpChange = useCallback(
    (id: string, interpolation: InterpolationMode) => {
      onChange(keyframes.map((kf) => (kf.id === id ? { ...kf, interpolation } : kf)));
    },
    [keyframes, onChange],
  );

  return (
    <div className="space-y-1">
      {/* Header row: label, current value, add keyframe */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-400 w-14 shrink-0 truncate" title={label}>
          {label}
        </span>
        <span className="text-[11px] font-mono text-gray-300 w-12 text-right tabular-nums">
          {currentValue.toFixed(1)}
        </span>
        <button
          onClick={handleAdd}
          disabled={!!existingAtTime}
          className={`ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            existingAtTime
              ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/50'
          }`}
          title={existingAtTime ? 'Keyframe already exists at this time' : 'Add keyframe at current time'}
        >
          <Plus className="h-2.5 w-2.5" />
          Add
        </button>
      </div>

      {/* Keyframe list */}
      {sorted.length > 0 && (
        <div className="ml-2 space-y-0.5 border-l border-gray-700 pl-2">
          {sorted.map((kf) => (
            <div key={kf.id} className="flex items-center gap-1 text-[10px]">
              <Diamond className={`h-2 w-2 shrink-0 ${
                Math.abs(kf.time - currentTime) < 0.05 ? 'text-amber-400' : 'text-gray-500'
              }`} />
              {/* Time */}
              <input
                type="number"
                value={kf.time}
                onChange={(e) => handleTimeChange(kf.id, Number(e.target.value))}
                className="w-10 rounded border border-gray-700 bg-gray-800 px-1 py-0 text-[10px] text-gray-300 focus:border-indigo-500 focus:outline-none"
                step={0.1}
                min={0}
                title="Time (s)"
              />
              <span className="text-gray-600">s</span>
              {/* Value */}
              <input
                type="number"
                value={kf.value}
                onChange={(e) => handleValueChange(kf.id, Number(e.target.value))}
                className="w-12 rounded border border-gray-700 bg-gray-800 px-1 py-0 text-[10px] text-gray-300 focus:border-indigo-500 focus:outline-none"
                step={step}
                min={min}
                max={max}
                title="Value"
              />
              {/* Interpolation */}
              <select
                value={kf.interpolation}
                onChange={(e) => handleInterpChange(kf.id, e.target.value as InterpolationMode)}
                className="rounded border border-gray-700 bg-gray-800 px-0.5 py-0 text-[10px] text-gray-400 focus:border-indigo-500 focus:outline-none"
                title="Interpolation"
              >
                {INTERP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Delete */}
              <button
                onClick={() => handleDelete(kf.id)}
                className="text-gray-600 hover:text-red-400 transition-colors"
                title="Delete keyframe"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
