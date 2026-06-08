import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Code, Plus, X, Copy, Check } from 'lucide-react';
import { useGraphStore, type SceneNodeData, type CustomSceneConfig } from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';

interface CustomSceneEditorProps {
  nodeId: string;
}

export const API_DOCS = [
  {
    name: 'api.onComplete()',
    desc: 'Leave this scene via the default exit edge.',
  },
  {
    name: 'api.transitionToHandle(handleId)',
    desc: 'Leave via a named exit (e.g. "win", "lose"). The handleId must match a source handle on an outgoing edge.',
  },
  {
    name: 'api.getVariable(id)',
    desc: 'Returns the current value of a game variable by its ID. Returns undefined if not found.',
  },
  {
    name: 'api.setVariable(id, value)',
    desc: 'Sets a game variable by ID. Value can be boolean, number, or string.',
  },
  {
    name: 'api.getAssetUrl(assetId)',
    desc: 'Returns the URL for a project asset by its ID, or null if not found. Find the asset ID by clicking any asset in the Assets panel. Use the URL in <img src>, <audio src>, CSS background-image, etc.',
  },
  {
    name: 'api.onCleanup(fn)',
    desc: 'Register a cleanup function that runs when the scene unmounts. Use to cancel timers, remove event listeners, etc.',
  },
  {
    name: 'container',
    desc: 'A DOM element (div) where your scene UI should be rendered. Append elements to it or set innerHTML.',
  },
];

export default function CustomSceneEditor({ nodeId }: CustomSceneEditorProps) {
  const { nodes } = useActiveGraph();
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);

  const node = nodes.find((n) => n.id === nodeId);
  const nodeData = node?.data as SceneNodeData | undefined;
  const config = nodeData?.customSceneConfig as CustomSceneConfig | undefined;

  const [script, setScript] = useState(config?.script ?? '');
  const [label, setLabel] = useState(nodeData?.label ?? '');
  const [summary, setSummary] = useState(nodeData?.summary ?? '');
  const [copiedHandleId, setCopiedHandleId] = useState<string | null>(null);
  const [handlesSectionHeight, setHandlesSectionHeight] = useState(120);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync local state when the node changes externally
  useEffect(() => {
    setScript(config?.script ?? '');
  }, [config?.script]);

  useEffect(() => {
    setLabel(nodeData?.label ?? '');
  }, [nodeData?.label]);

  useEffect(() => {
    setSummary(nodeData?.summary ?? '');
  }, [nodeData?.summary]);

  const outputHandles = config?.outputHandles ?? [];

  const saveScript = useCallback(
    (value: string) => {
      setScript(value);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNodeData(nodeId, {
          customSceneConfig: { ...config, script: value, language: 'javascript' as const },
        });
      }, 500);
    },
    [nodeId, updateNodeData, config],
  );

  const addOutputHandle = useCallback(() => {
    const newHandle = { id: crypto.randomUUID(), label: 'New Exit' };
    const updated = [...outputHandles, newHandle];
    updateNodeData(nodeId, {
      customSceneConfig: { ...config, script: config?.script ?? '', language: 'javascript' as const, outputHandles: updated },
    });
  }, [nodeId, updateNodeData, config, outputHandles]);

  const removeOutputHandle = useCallback((handleId: string) => {
    const updated = outputHandles.filter((h) => h.id !== handleId);
    updateNodeData(nodeId, {
      customSceneConfig: { ...config, script: config?.script ?? '', language: 'javascript' as const, outputHandles: updated },
    });
  }, [nodeId, updateNodeData, config, outputHandles]);

  const updateHandleLabel = useCallback((handleId: string, newLabel: string) => {
    const updated = outputHandles.map((h) => h.id === handleId ? { ...h, label: newLabel } : h);
    updateNodeData(nodeId, {
      customSceneConfig: { ...config, script: config?.script ?? '', language: 'javascript' as const, outputHandles: updated },
    });
  }, [nodeId, updateNodeData, config, outputHandles]);

  const commitLabel = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== nodeData?.label) {
      updateNodeData(nodeId, { label: trimmed });
    }
  }, [label, nodeData?.label, nodeId, updateNodeData]);

  const commitSummary = useCallback(() => {
    const trimmed = summary.trim();
    if (trimmed !== nodeData?.summary) {
      updateNodeData(nodeId, { summary: trimmed });
    }
  }, [summary, nodeData?.summary, nodeId, updateNodeData]);

  const copyHandleId = useCallback((id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedHandleId(id);
      setTimeout(() => setCopiedHandleId(null), 2000);
    });
  }, []);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startHeight = handlesSectionHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const containerHeight = containerRef.current?.clientHeight ?? 600;
      const maxHeight = containerHeight * 0.6;
      const delta = ev.clientY - startY;
      setHandlesSectionHeight(Math.max(60, Math.min(maxHeight, startHeight + delta)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [handlesSectionHeight]);

  // Handle tab key in textarea to insert spaces instead of changing focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = script.substring(0, start) + '  ' + script.substring(end);
        saveScript(newValue);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [script, saveScript],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!nodeData) return null;

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-4 py-2">
        <button
          onClick={() => setEditingNodeId(null)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-amber-400" />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
            className="bg-transparent text-sm font-semibold text-gray-800 dark:text-gray-200 outline-none border-b border-transparent hover:border-gray-400 dark:hover:border-gray-500 focus:border-amber-400 transition-colors"
          />
        </div>
      </div>

      {/* Main content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Code editor area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Summary */}
          <div className="px-4 py-2 border-b border-gray-300 dark:border-gray-700">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Summary
            </label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={commitSummary}
              onKeyDown={(e) => e.key === 'Enter' && commitSummary()}
              placeholder="Describe this scene..."
              className="w-full bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none border-b border-transparent hover:border-gray-400 dark:hover:border-gray-500 focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Output handles */}
          <div className="flex flex-col" style={{ height: handlesSectionHeight }}>
            <div className="flex items-center justify-between px-4 pt-2 pb-1 shrink-0">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Output Handles
              </label>
              <button
                onClick={addOutputHandle}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {outputHandles.length === 0 ? (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                  No named exits. The node will use a single default output.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {outputHandles.map((h) => (
                    <div key={h.id} className="group">
                      <div className="flex items-center gap-1.5">
                        <input
                          defaultValue={h.label}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== h.label) updateHandleLabel(h.id, v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none border-b border-transparent hover:border-gray-400 dark:hover:border-gray-500 focus:border-purple-400 transition-colors"
                        />
                        <button
                          onClick={() => removeOutputHandle(h.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-gray-400 dark:text-gray-600 font-mono truncate select-all">{h.id}</span>
                        <button
                          onClick={() => copyHandleId(h.id)}
                          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
                          title="Copy handle ID"
                        >
                          {copiedHandleId === h.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drag divider */}
          <div
            onMouseDown={onDividerMouseDown}
            className="h-1.5 shrink-0 cursor-row-resize border-y border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors flex items-center justify-center"
          >
            <div className="w-8 h-0.5 rounded-full bg-gray-400 dark:bg-gray-600" />
          </div>

          {/* Script editor */}
          <div className="flex-1 overflow-hidden p-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Scene Script (JavaScript)
            </label>
            <div className="relative h-[calc(100%-1.5rem)] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">
              <div className="absolute top-2 right-2 text-[10px] text-gray-400 dark:text-gray-600 font-mono select-none z-10">
                JS
              </div>
              <textarea
                value={script}
                onChange={(e) => saveScript(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="w-full h-full resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200 font-mono p-4 outline-none leading-relaxed"
                placeholder="// Write your scene code here..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
