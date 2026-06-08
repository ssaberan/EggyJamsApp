import { type DragEvent, useCallback } from 'react';
import { MessageSquare, Film, Puzzle, Gamepad2, Code, Layers } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useGraphStore, type SceneType } from '../../stores/graphStore';

interface NodeTypeItem {
  type: SceneType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgHover: string;
  borderColor: string;
}

const nodeTypes: NodeTypeItem[] = [
  {
    type: 'dialogue',
    label: 'Dialogue',
    icon: MessageSquare,
    color: 'text-blue-400',
    bgHover: 'hover:bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    type: 'cutscene',
    label: 'Cutscene',
    icon: Film,
    color: 'text-emerald-400',
    bgHover: 'hover:bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    type: 'point_and_click',
    label: 'Point-and-Click',
    icon: Puzzle,
    color: 'text-red-400',
    bgHover: 'hover:bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  {
    type: 'gameplay',
    label: 'Gameplay',
    icon: Gamepad2,
    color: 'text-orange-400',
    bgHover: 'hover:bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    type: 'custom',
    label: 'Custom',
    icon: Code,
    color: 'text-purple-400',
    bgHover: 'hover:bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    type: 'subgraph',
    label: 'Subgraph',
    icon: Layers,
    color: 'text-teal-400',
    bgHover: 'hover:bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
];

function onDragStart(event: DragEvent, nodeType: SceneType) {
  event.dataTransfer.setData('application/reactflow-scenetype', nodeType);
  event.dataTransfer.effectAllowed = 'move';
}

export default function NodeToolbar() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useGraphStore((s) => s.addNode);

  const handleClick = useCallback(
    (nodeType: SceneType) => {
      const el = document.querySelector('.react-flow');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      addNode(nodeType, position);
    },
    [screenToFlowPosition, addNode],
  );

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-200/95 dark:bg-gray-800/90 backdrop-blur-sm p-2 shadow-xl">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500">
        Add Scene
      </span>
      {nodeTypes.map(({ type, label, icon: Icon, color, bgHover, borderColor }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          onClick={() => handleClick(type)}
          className={`flex items-center gap-2 rounded-md border ${borderColor} ${bgHover} px-3 py-2 cursor-pointer transition-colors`}
        >
          <Icon className={`h-4 w-4 ${color}`} />
          <span className={`text-xs font-medium ${color}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}
