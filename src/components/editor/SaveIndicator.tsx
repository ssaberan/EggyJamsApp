import { useGraphStore, type SaveStatus } from '../../stores/graphStore';

const statusConfig: Record<SaveStatus, { dot: string; text: string; label: string; animate?: boolean }> = {
  idle: {
    dot: 'bg-gray-500',
    text: 'text-gray-600 dark:text-gray-500',
    label: 'All changes saved',
    animate: false,
  },
  saving: {
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    label: 'Saving...',
    animate: true,
  },
  saved: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    label: 'Saved',
    animate: false,
  },
  error: {
    dot: 'bg-red-400',
    text: 'text-red-400',
    label: 'Error saving',
    animate: false,
  },
};

export default function SaveIndicator() {
  const saveStatus = useGraphStore((s) => s.saveStatus);
  const config = statusConfig[saveStatus];

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.dot} ${
          config.animate ? 'animate-pulse' : ''
        }`}
      />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}
