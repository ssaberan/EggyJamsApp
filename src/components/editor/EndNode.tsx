import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { LogOut } from 'lucide-react';

function EndNode({ selected }: NodeProps) {
  return (
    <div
      className={`rounded-lg border-2 border-rose-400 dark:border-rose-500 bg-gray-200 dark:bg-gray-800 shadow-lg min-w-[120px] ${
        selected ? 'ring-2 ring-indigo-400 dark:ring-white/50 ring-offset-2 ring-offset-gray-200 dark:ring-offset-gray-900' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-rose-400 !border-2 !border-rose-500 dark:!border-rose-600 hover:!bg-white transition-colors !flex !items-center !justify-center"
      >
        <span className="text-[7px] font-bold select-none pointer-events-none text-rose-900">in</span>
      </Handle>

      <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-rose-500 text-white">
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">End</span>
      </div>
    </div>
  );
}

export default memo(EndNode);
