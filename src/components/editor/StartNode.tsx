import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LogIn } from 'lucide-react';

function StartNode({ selected }: NodeProps) {
  return (
    <div
      className={`rounded-lg border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950 shadow-lg min-w-[120px] ${
        selected ? 'ring-2 ring-indigo-400 dark:ring-white/50 ring-offset-2 ring-offset-emerald-50 dark:ring-offset-gray-900' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 text-white">
        <LogIn className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">Start</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-emerald-400 !border-2 !border-emerald-500 dark:!border-emerald-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
      >
        <span className="text-[7px] font-bold select-none pointer-events-none text-emerald-900">out</span>
      </Handle>
    </div>
  );
}

export default memo(StartNode);
