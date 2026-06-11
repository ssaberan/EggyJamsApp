import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { projectRepository } from '../storage';
import {
  setDesktopMenuHandlers,
  clearDesktopMenuHandlers,
} from '../desktop/menuBridge';
import { Outlet, Link, useParams, useNavigate } from 'react-router-dom';
import { APP_LOGO_URL } from '../lib/branding';
import {
  Gamepad2,
  Play,
  Download,
  GitBranch,
  Image,
  Braces,
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  MessageSquare,
  Film,
  Puzzle,
  Code,
  Layers,
  Monitor,
  Undo2,
  Redo2,
  Trash2,
  ArrowRight,
  Sparkles,
  ClipboardCopy,
  Check,
  LogOut,
  LogIn,
  Ungroup,
  MousePointerSquareDashed,
} from 'lucide-react';
import SaveIndicator from '../components/editor/SaveIndicator';
import AssetsPanel from '../components/editor/AssetsPanel';
import VariablesPanel from '../components/editor/VariablesPanel';
import SceneSettingsPanel from '../components/editor/SceneSettingsPanel';
import GameplaySettingsPanel from '../components/editor/GameplaySettingsPanel';
import GameplayStaticAssetsPanel from '../components/editor/GameplayStaticAssetsPanel';
import GameplayObjectsPanel from '../components/editor/GameplayObjectsPanel';
// CutsceneEventPanel removed — properties are now inline in CutsceneEditor
import PointAndClickHotspotsPanel from '../components/editor/PointAndClickHotspotsPanel';
import { API_DOCS } from '../components/editor/CustomSceneEditor';
import { DEFAULT_CUSTOM_SCRIPT } from '../constants/defaultCustomScript';
import { PLATFORMER_SHOOTER_SCRIPT } from '../constants/platformerShooterScript';
import { WHACK_A_MOLE_SCRIPT } from '../constants/whackAMoleScript';

import TimerPanel from '../components/editor/TimerPanel';
import { useStore } from 'zustand';
import { useGraphStore, getActiveGraph, resolveSubgraphNode, type SceneType, type SceneNodeData } from '../stores/graphStore';
import { useAssetStore, getFolderPath } from '../stores/assetStore';
import ThemeToggle from '../components/ThemeToggle';

const sidebarItems = [
  { icon: GitBranch, label: 'Story Graph' },
  { icon: Image, label: 'Assets' },
  { icon: Braces, label: 'Variables' },
];

const sceneTypeLabels: Record<SceneType, string> = {
  dialogue: 'Dialogue',
  cutscene: 'Cutscene',
  point_and_click: 'Point-and-Click',
  gameplay: 'Gameplay',
  custom: 'Custom',
  subgraph: 'Subgraph',
};

const sceneTypeIcons: Record<SceneType, React.ComponentType<{ className?: string }>> = {
  dialogue: MessageSquare,
  cutscene: Film,
  point_and_click: Puzzle,
  gameplay: Gamepad2,
  custom: Code,
  subgraph: Layers,
};

const sceneTypeColors: Record<SceneType, string> = {
  dialogue: 'text-blue-400',
  cutscene: 'text-emerald-400',
  point_and_click: 'text-red-400',
  gameplay: 'text-orange-400',
  custom: 'text-purple-400',
  subgraph: 'text-teal-400',
};

const PROPERTIES_PANEL_WIDTH_KEY = 'eggyjams.propertiesPanelWidth';
const PROPERTIES_PANEL_MIN = 200;
const PROPERTIES_PANEL_MAX = 600;
const PROPERTIES_PANEL_DEFAULT = 288;
const MIN_EDITOR_WIDTH = 800;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function EditorLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(PROPERTIES_PANEL_WIDTH_KEY);
      if (stored != null) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n)) return clamp(n, PROPERTIES_PANEL_MIN, PROPERTIES_PANEL_MAX);
      }
    } catch {
      /* ignore */
    }
    return PROPERTIES_PANEL_DEFAULT;
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [navigatingToPlay, setNavigatingToPlay] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('Story Graph');
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const editingNodeId = useGraphStore((s) => s.editingNodeId);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const subgraphPath = useGraphStore((s) => s.subgraphPath);
  const exitToSubgraph = useGraphStore((s) => s.exitToSubgraph);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const updateTimer = useGraphStore((s) => s.updateTimer);
  const removeNode = useGraphStore((s) => s.removeNode);
  const removeEdge = useGraphStore((s) => s.removeEdge);
  const dissolveSubgraph = useGraphStore((s) => s.dissolveSubgraph);
  const variables = useGraphStore((s) => s.variables);
  const startNodeId = useGraphStore((s) => s.startNodeId);
  const setStartNodeId = useGraphStore((s) => s.setStartNodeId);
  const bulkMoveTargetSubgraphId = useGraphStore((s) => s.bulkMoveTargetSubgraphId);
  const startBulkMove = useGraphStore((s) => s.startBulkMove);
  const cancelBulkMove = useGraphStore((s) => s.cancelBulkMove);
  const executeBulkMove = useGraphStore((s) => s.executeBulkMove);
  const assets = useAssetStore((s) => s.assets);
  const assetFolders = useAssetStore((s) => s.folders);
  const activeGraph = useMemo(
    () => getActiveGraph(nodes, edges, subgraphPath),
    [nodes, edges, subgraphPath],
  );
  const selectedNode = activeGraph.nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = activeGraph.edges.find((e) => e.id === selectedEdgeId);
  const editingNode = activeGraph.nodes.find((n) => n.id === editingNodeId);

  const [aiPromptCopied, setAiPromptCopied] = useState(false);

  const aiPrompt = useMemo(() => {
    const lines: string[] = [];

    lines.push(
      'Write a custom scene script for a browser-based game engine.',
      'The script is executed as the body of `function(container, api) { ... }` — do NOT include the function wrapper, just the body code.',
      'Use plain JavaScript only (no TypeScript, no imports, no modules).',
      ''
    );

    lines.push('## API Reference', '');
    for (const doc of API_DOCS) {
      lines.push(`- \`${doc.name}\` — ${doc.desc}`);
    }
    lines.push('');

    if (assets.length > 0) {
      lines.push(
        '## Available Assets',
        '',
        'Use `api.getAssetUrl(assetId)` with these IDs to load images or audio:',
        '',
        '| ID | Filename | Type | Folder |',
        '|----|----------|------|--------|'
      );
      for (const a of assets) {
        const folder = getFolderPath(assetFolders, a.folder_id) || '—';
        lines.push(`| ${a.id} | ${a.file_name} | ${a.file_type} | ${folder} |`);
      }
      lines.push('');
    }

    if (variables.length > 0) {
      lines.push(
        '## Game Variables',
        '',
        'Read with `api.getVariable(id)`, write with `api.setVariable(id, value)`:',
        '',
        '| ID | Name | Type | Initial Value |',
        '|----|------|------|---------------|'
      );
      for (const v of variables) {
        lines.push(`| ${v.id} | ${v.name} | ${v.type} | ${JSON.stringify(v.initialValue)} |`);
      }
      lines.push('');
    }

    const outputHandles = (editingNode?.data as SceneNodeData)?.customSceneConfig?.outputHandles ?? [];

    if (outputHandles.length > 0) {
      lines.push(
        '## Output Handles',
        '',
        'Use `api.transitionToHandle(handleId)` with these handle IDs to exit the scene:',
        '',
        '| Handle ID | Label |',
        '|-----------|-------|'
      );
      for (const h of outputHandles) {
        lines.push(`| ${h.id} | ${h.label} |`);
      }
      lines.push('');
    }

    lines.push(
      '## Guidelines',
      '',
      '- Render into `container` (a DOM div). You can use Canvas, DOM elements, or both.',
      '- Call `api.onCleanup(fn)` to register cleanup (cancel timers, remove event listeners, etc.).',
      outputHandles.length > 0
        ? '- Call `api.transitionToHandle(handleId)` when the scene should end, using one of the handle IDs above.'
        : '- Call `api.onComplete()` or `api.transitionToHandle(handleId)` when the scene should end.',
      '- The script must be fully self-contained — no external imports or network requests.',
      ''
    );

    lines.push(
      '## Game Description',
      '',
      '[DESCRIBE THE GAME YOU WANT HERE]',
      ''
    );

    return lines.join('\n');
  }, [assets, assetFolders, variables, editingNode]);

  // ── Undo / Redo reactive state ──
  const canUndo = useStore(useGraphStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useGraphStore.temporal, (s) => s.futureStates.length > 0);

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs / textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useGraphStore.temporal.getState().undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useGraphStore.temporal.getState().redo();
      } else if (e.key === 'y') {
        e.preventDefault();
        useGraphStore.temporal.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Persist properties panel width ──
  useEffect(() => {
    try {
      localStorage.setItem(PROPERTIES_PANEL_WIDTH_KEY, String(propertiesPanelWidth));
    } catch {
      /* ignore */
    }
  }, [propertiesPanelWidth]);

  // ── Properties panel resize (mousemove / mouseup) ──
  useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = clamp(
        resizeStartWidth + (resizeStartX - e.clientX),
        PROPERTIES_PANEL_MIN,
        PROPERTIES_PANEL_MAX,
      );
      setPropertiesPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingPanel(false);
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingPanel, resizeStartX, resizeStartWidth]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // ── Export handlers ──
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingPackage, setExportingPackage] = useState<
    'windows' | 'mac' | null
  >(null);
  const exportingZipRef = useRef(false);
  const exportingPackageRef = useRef(false);
  const canExportDesktopPackages =
    typeof window !== 'undefined' && !!window.electronAPI?.packageOfflineGame;

  const handleExportZip = useCallback(async () => {
    if (!projectId || exportingZipRef.current) return;
    exportingZipRef.current = true;
    setExportingZip(true);
    try {
      const { exportGameToZip } = await import('../utils/exportGame');
      await exportGameToZip(projectId);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      exportingZipRef.current = false;
      setExportingZip(false);
    }
  }, [projectId]);

  const handleExportPackage = useCallback(
    async (platform: 'windows' | 'mac') => {
      if (!projectId || exportingPackageRef.current) return;
      exportingPackageRef.current = true;
      setExportingPackage(platform);
      try {
        const { exportGameToWindowsExe, exportGameToMacApp } = await import(
          '../utils/exportGame'
        );
        if (platform === 'windows') {
          await exportGameToWindowsExe(projectId);
        } else {
          await exportGameToMacApp(projectId);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Executable export failed.';
        console.error('Executable export failed:', err);
        window.alert(`Export failed: ${message}`);
      } finally {
        exportingPackageRef.current = false;
        setExportingPackage(null);
      }
    },
    [projectId],
  );

  const handleExportWindows = useCallback(
    () => handleExportPackage('windows'),
    [handleExportPackage],
  );

  const handleExportMac = useCallback(
    () => handleExportPackage('mac'),
    [handleExportPackage],
  );

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void projectRepository.getProject(projectId).then((project) => {
      if (cancelled) return;
      const title = project?.title ?? 'Untitled Project';
      window.electronAPI?.setProjectTitle(title);
      window.electronAPI?.refreshMenu();
    });
    return () => {
      cancelled = true;
      window.electronAPI?.setProjectTitle(null);
    };
  }, [projectId]);

  useEffect(() => {
    setDesktopMenuHandlers({
      getActiveProjectId: () => projectId,
      flushSave: async () => {
        const flush = useGraphStore.getState().flushSave;
        if (flush) return flush();
        return true;
      },
      exportZip: () => handleExportZip(),
      exportWindows: () => handleExportWindows(),
      exportMac: () => handleExportMac(),
      undo: () => useGraphStore.temporal.getState().undo(),
      redo: () => useGraphStore.temporal.getState().redo(),
    });
    return () => {
      clearDesktopMenuHandlers([
        'getActiveProjectId',
        'flushSave',
        'exportZip',
        'exportWindows',
        'exportMac',
        'undo',
        'redo',
      ]);
    };
  }, [projectId, handleExportZip, handleExportWindows, handleExportMac]);

  // ── Play: flush any pending save before navigating ──
  const handlePlay = async () => {
    if (!projectId || navigatingToPlay) return;
    setNavigatingToPlay(true);
    try {
      const { flushSave } = useGraphStore.getState();
      if (flushSave) await flushSave();
    } catch (err) {
      console.error('Flush save before play failed:', err);
    }
    navigate(`/play/${projectId}`, { state: { from: 'editor' } });
  };

  // ── Minimum viewport width ──
  const [viewportTooSmall, setViewportTooSmall] = useState(false);
  useEffect(() => {
    const check = () => setViewportTooSmall(window.innerWidth < MIN_EDITOR_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (viewportTooSmall) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white">
        <div className="flex flex-1 flex-col items-center justify-center p-8">
        <Monitor className="h-16 w-16 text-gray-500 dark:text-gray-500 mb-6" />
        <h1 className="text-2xl font-bold mb-2">Window Too Small</h1>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-sm">
          Resize the window to at least {MIN_EDITOR_WIDTH}px wide to use the editor.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          Back to Home
        </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      {/* ── Top Bar ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-3">
        {/* Left: Logo + breadcrumbs */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <img src={APP_LOGO_URL} alt="" className="h-5 w-5 object-contain" />
            <span className="text-sm font-bold">EggyJams</span>
          </Link>

          <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-600" />

          {(() => {
            const hasSubgraph = subgraphPath.length > 0;
            const hasEditing = !!editingNode;

            if (!hasSubgraph && !hasEditing) {
              return <span className="text-sm text-gray-600 dark:text-gray-400">{activeSidebarItem}</span>;
            }

            return (
              <>
                {/* "Story Graph" — always clickable when we have depth */}
                <button
                  onClick={() => {
                    setEditingNodeId(null);
                    exitToSubgraph(0);
                  }}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Story Graph
                </button>

                {/* Subgraph path segments */}
                {subgraphPath.map((sgId, idx) => {
                  const sgNode = resolveSubgraphNode(nodes, edges, subgraphPath, idx);
                  const sgLabel = (sgNode?.data as SceneNodeData | undefined)?.label ?? 'Subgraph';
                  const isLast = idx === subgraphPath.length - 1 && !hasEditing;

                  return (
                    <span key={sgId} className="flex items-center gap-3">
                      <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-600" />
                      {isLast ? (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{sgLabel}</span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNodeId(null);
                            exitToSubgraph(idx + 1);
                          }}
                          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          {sgLabel}
                        </button>
                      )}
                    </span>
                  );
                })}

                {/* Editing node label (if editing a scene inside the current graph) */}
                {hasEditing && (
                  <>
                    <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {(editingNode.data as { label?: string })?.label ?? 'Untitled'}
                    </span>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Center: Undo/Redo + Save status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => useGraphStore.temporal.getState().undo()}
              disabled={!canUndo}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 dark:text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => useGraphStore.temporal.getState().redo()}
              disabled={!canRedo}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 dark:text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
          <SaveIndicator />
        </div>

        {/* Right: Theme toggle + Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleExportZip}
            disabled={exportingZip}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Download offline game as .zip"
          >
            <Download className="h-3.5 w-3.5" />
            {exportingZip ? 'Packaging...' : 'Download Offline (.zip)'}
          </button>
          {canExportDesktopPackages && (
            <>
              <button
                onClick={handleExportWindows}
                disabled={exportingPackage !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Build a shareable Windows .zip containing a playable .exe. Output size includes the Electron runtime."
              >
                <Download className="h-3.5 w-3.5" />
                {exportingPackage === 'windows'
                  ? 'Building Windows...'
                  : 'Download for Windows'}
              </button>
              <button
                onClick={handleExportMac}
                disabled={exportingPackage !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-400 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Build a shareable Mac .app zip. Output size includes the Electron runtime."
              >
                <Download className="h-3.5 w-3.5" />
                {exportingPackage === 'mac'
                  ? 'Building Mac...'
                  : 'Download for Mac'}
              </button>
            </>
          )}
          <button
            onClick={handlePlay}
            disabled={navigatingToPlay}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {navigatingToPlay ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Play
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 py-3">
          {sidebarItems.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() =>
                setActiveSidebarItem(
                  label === activeSidebarItem && label !== 'Story Graph'
                    ? 'Story Graph'
                    : label
                )
              }
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                activeSidebarItem === label
                  ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </aside>

        {/* Left Panel (collapsible – shown for Assets, Variables, etc.) */}
        {activeSidebarItem === 'Assets' && (
          <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 flex flex-col overflow-hidden">
            <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Assets
              </span>
              <button
                onClick={() => setActiveSidebarItem('Story Graph')}
                className="text-gray-600 dark:text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors cursor-pointer"
                title="Close panel"
              >
                <PanelRightClose className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AssetsPanel />
            </div>
          </aside>
        )}

        {activeSidebarItem === 'Variables' && (
          <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 flex flex-col overflow-hidden">
            <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Variables
              </span>
              <button
                onClick={() => setActiveSidebarItem('Story Graph')}
                className="text-gray-600 dark:text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors cursor-pointer"
                title="Close panel"
              >
                <PanelRightClose className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <VariablesPanel />
            </div>
          </aside>
        )}

        {/* Center – editor / canvas */}
        <main className="relative flex-1 overflow-hidden">
          <Outlet />
        </main>

        {/* Right Panel (collapsible) */}
        {rightPanelOpen && (
          <aside
            className="relative shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 flex flex-col"
            style={{ width: propertiesPanelWidth, minWidth: PROPERTIES_PANEL_MIN }}
          >
            {/* Resize handle (left edge) */}
            <div
              role="separator"
              aria-label="Resize properties panel"
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-gray-400 dark:hover:bg-gray-600 z-10"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizeStartX(e.clientX);
                setResizeStartWidth(propertiesPanelWidth);
                setIsResizingPanel(true);
              }}
            />
            <div className="flex h-10 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Properties
              </span>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="text-gray-600 dark:text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors cursor-pointer"
                title="Collapse panel"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto p-3">
              {(() => {
                // Determine context: editing a cutscene/gameplay/point-and-click/location, or viewing a selected graph node
                const isEditingCutscene = editingNode &&
                  (editingNode.data as SceneNodeData)?.sceneType === 'cutscene';
                const isEditingGameplay = editingNode &&
                  (editingNode.data as SceneNodeData)?.sceneType === 'gameplay';
                const isEditingPointAndClick = editingNode &&
                  (editingNode.data as SceneNodeData)?.sceneType === 'point_and_click';
                const isEditingCustom = editingNode &&
                  (editingNode.data as SceneNodeData)?.sceneType === 'custom';
                const propertiesNode = (isEditingCutscene || isEditingGameplay || isEditingPointAndClick || isEditingCustom) ? editingNode : selectedNode;

                if (isEditingGameplay && editingNode && editingNodeId) {
                  const nodeData = editingNode.data as SceneNodeData;
                  return (
                    <div className="space-y-4">
                      {/* Node type badge */}
                      <div className="flex items-center gap-2">
                        <Gamepad2 className={`h-4 w-4 ${sceneTypeColors.gameplay}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${sceneTypeColors.gameplay}`}>
                          Gameplay
                        </span>
                      </div>

                      {/* Node title (editable) */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={nodeData?.label ?? ''}
                          onChange={(e) => updateNodeData(editingNode.id, { label: e.target.value })}
                          placeholder="Untitled"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                        />
                      </div>

                      {/* Node ID */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Node ID
                        </label>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                          {editingNode.id}
                        </p>
                      </div>

                      {/* Starting Node */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={startNodeId === editingNode.id}
                            onChange={(e) => setStartNodeId(e.target.checked ? editingNode.id : null)}
                            className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Starting node</span>
                        </label>
                        <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
                          The game will begin at this node when played.
                        </p>
                      </div>

                      {/* Gameplay Settings */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <GameplaySettingsPanel nodeId={editingNodeId} />
                      </div>

                      {/* Static Assets */}
                      <GameplayStaticAssetsPanel nodeId={editingNodeId} />

                      {/* Obstacles & Hotspots */}
                      <GameplayObjectsPanel nodeId={editingNodeId} />

                      {/* Timer */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <TimerPanel
                          nodeId={editingNodeId}
                          timer={nodeData?.timer}
                          nodes={activeGraph.nodes}
                          edges={activeGraph.edges}
                          variables={variables}
                          onUpdate={(t) => updateTimer(editingNode.id, t)}
                          onRemove={() => updateTimer(editingNode.id, null)}
                          accentColor="text-orange-400"
                        />
                      </div>
                    </div>
                  );
                }

                if (isEditingPointAndClick && editingNode && editingNodeId) {
                  const nodeData = editingNode.data as SceneNodeData;
                  return (
                    <div className="space-y-4">
                      {/* Node type badge */}
                      <div className="flex items-center gap-2">
                        <Puzzle className={`h-4 w-4 ${sceneTypeColors.point_and_click}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${sceneTypeColors.point_and_click}`}>
                          Point-and-Click
                        </span>
                      </div>

                      {/* Node title (editable) */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={nodeData?.label ?? ''}
                          onChange={(e) => updateNodeData(editingNode.id, { label: e.target.value })}
                          placeholder="Untitled"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                        />
                      </div>

                      {/* Node ID */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Node ID
                        </label>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                          {editingNode.id}
                        </p>
                      </div>

                      {/* Starting Node */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={startNodeId === editingNode.id}
                            onChange={(e) => setStartNodeId(e.target.checked ? editingNode.id : null)}
                            className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Starting node</span>
                        </label>
                        <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
                          The game will begin at this node when played.
                        </p>
                      </div>

                      {/* Scene Settings */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <SceneSettingsPanel node={editingNode} />
                      </div>

                      {/* Hotspots */}
                      <PointAndClickHotspotsPanel nodeId={editingNodeId} />

                      {/* Static Assets */}
                      <GameplayStaticAssetsPanel nodeId={editingNodeId} showCharacterZIndex={false} />

                      {/* Timer */}
                      <TimerPanel
                        nodeId={editingNodeId}
                        timer={nodeData?.timer}
                        nodes={activeGraph.nodes}
                        edges={activeGraph.edges}
                        variables={variables}
                        onUpdate={(t) => updateTimer(editingNode.id, t)}
                        onRemove={() => updateTimer(editingNode.id, null)}
                        accentColor="text-red-400"
                      />
                    </div>
                  );
                }

                if (isEditingCutscene && editingNode && editingNodeId) {
                  const nodeData = editingNode.data as SceneNodeData;
                  return (
                    <div className="space-y-4">
                      {/* Node type badge */}
                      <div className="flex items-center gap-2">
                        <Film className={`h-4 w-4 ${sceneTypeColors.cutscene}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${sceneTypeColors.cutscene}`}>
                          Cutscene
                        </span>
                      </div>

                      {/* Node title (editable) */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={nodeData?.label ?? ''}
                          onChange={(e) => updateNodeData(editingNode.id, { label: e.target.value })}
                          placeholder="Untitled"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                        />
                      </div>

                      {/* Node ID */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Node ID
                        </label>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                          {editingNode.id}
                        </p>
                      </div>

                      {/* Starting Node */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={startNodeId === editingNode.id}
                            onChange={(e) => setStartNodeId(e.target.checked ? editingNode.id : null)}
                            className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Starting node</span>
                        </label>
                        <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
                          The game will begin at this node when played.
                        </p>
                      </div>

                      {/* Clip properties are now managed within the CutsceneEditor itself */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Use the timeline properties panel inside the cutscene editor.
                      </div>

                      {/* Camera keyframe editor button */}
                      <button
                        onClick={() => {
                          useGraphStore.getState().setSelectedCutsceneClipId(null);
                          useGraphStore.getState().setShowCutsceneCameraPanel(true);
                        }}
                        className="flex items-center gap-2 rounded-md bg-amber-600/20 px-3 py-2 text-xs font-medium text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 transition-colors w-full justify-center"
                      >
                        <Film className="h-4 w-4" />
                        Edit Camera
                      </button>
                    </div>
                  );
                }

                if (propertiesNode) {
                  if (propertiesNode.type === 'startNode') {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <LogIn className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                            Start Node
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                            Node ID
                          </label>
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                            {propertiesNode.id}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Connect this Start node to internal nodes to create entry points on the parent subgraph.
                        </p>
                      </div>
                    );
                  }

                  if (propertiesNode.type === 'endNode') {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-rose-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                            End Node
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                            Node ID
                          </label>
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                            {propertiesNode.id}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Connect nodes to this End node to create exit points on the parent subgraph.
                        </p>
                      </div>
                    );
                  }

                  const sceneType = (propertiesNode.data as { sceneType?: SceneType })?.sceneType;
                  return (
                    <div className="space-y-4">
                      {/* Node type badge */}
                      {sceneType && (() => {
                        const Icon = sceneTypeIcons[sceneType];
                        return (
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${sceneTypeColors[sceneType]}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wide ${sceneTypeColors[sceneType]}`}>
                              {sceneTypeLabels[sceneType]}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Node title (editable) */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={(propertiesNode.data as SceneNodeData)?.label ?? ''}
                          onChange={(e) => updateNodeData(propertiesNode.id, { label: e.target.value })}
                          placeholder="Untitled"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                        />
                      </div>

                      {/* Node ID */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Node ID
                        </label>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                          {propertiesNode.id}
                        </p>
                      </div>

                      {/* Starting Node (skip for subgraph nodes) */}
                      {sceneType !== 'subgraph' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={startNodeId === propertiesNode.id}
                              onChange={(e) => setStartNodeId(e.target.checked ? propertiesNode.id : null)}
                              className="rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="text-xs text-gray-700 dark:text-gray-300">Starting node</span>
                          </label>
                          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
                            The game will begin at this node when played.
                          </p>
                        </div>
                      )}

                      {/* Scene Settings (skip for cutscene, gameplay, custom & subgraph nodes) */}
                      {sceneType !== 'cutscene' && sceneType !== 'gameplay' && sceneType !== 'custom' && sceneType !== 'subgraph' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                          <SceneSettingsPanel node={propertiesNode} />
                        </div>
                      )}

                      {/* API Reference (custom scenes only) */}
                      {sceneType === 'custom' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3">
                          <div className="flex items-center gap-1.5">
                            <Code className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                              API Reference
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            Your script runs as <code className="text-amber-500 dark:text-amber-400 bg-gray-200 dark:bg-gray-700 px-1 rounded text-[10px]">function(container, api)</code>. Use these to build your scene:
                          </p>
                          {API_DOCS.map((item) => (
                            <div key={item.name} className="space-y-0.5">
                              <code className="block text-[11px] font-mono text-amber-600 dark:text-amber-400">
                                {item.name}
                              </code>
                              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reference Scripts (custom scenes only, shown when editing) */}
                      {sceneType === 'custom' && isEditingCustom && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3">
                          <div className="flex items-center gap-1.5">
                            <Code className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                              Reference Scripts
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            Load a reference script into the scene editor.
                          </p>
                          <button
                            onClick={() =>
                              updateNodeData(propertiesNode.id, {
                                customSceneConfig: { script: DEFAULT_CUSTOM_SCRIPT, language: 'javascript' },
                              })
                            }
                            className="w-full rounded-md border border-amber-500/30 px-3 py-1.5 text-[11px] font-medium text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                          >
                            Chess (Player vs AI)
                          </button>
                          <button
                            onClick={() =>
                              updateNodeData(propertiesNode.id, {
                                customSceneConfig: { script: PLATFORMER_SHOOTER_SCRIPT, language: 'javascript' },
                              })
                            }
                            className="w-full rounded-md border border-amber-500/30 px-3 py-1.5 text-[11px] font-medium text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                          >
                            Platformer Shooter (Player vs AI)
                          </button>
                          <button
                            onClick={() =>
                              updateNodeData(propertiesNode.id, {
                                customSceneConfig: { script: WHACK_A_MOLE_SCRIPT, language: 'javascript' },
                              })
                            }
                            className="w-full rounded-md border border-amber-500/30 px-3 py-1.5 text-[11px] font-medium text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                          >
                            Whack-a-Mole
                          </button>
                        </div>
                      )}

                      {/* AI Prompt Helper (custom scenes only, shown when editing) */}
                      {sceneType === 'custom' && isEditingCustom && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
                              Using AI? Try this prompt!
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                            Copy this prompt and paste it into your favorite AI assistant. Fill in the game description at the bottom.
                          </p>
                          <pre className="max-h-48 overflow-auto rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-[10px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-mono select-all">
                            {aiPrompt}
                          </pre>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(aiPrompt).then(() => {
                                setAiPromptCopied(true);
                                setTimeout(() => setAiPromptCopied(false), 2000);
                              });
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-purple-500/30 px-3 py-1.5 text-[11px] font-medium text-purple-500 dark:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
                          >
                            {aiPromptCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <ClipboardCopy className="h-3.5 w-3.5" />
                                Copy to Clipboard
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Gameplay Settings (only for gameplay nodes) */}
                      {sceneType === 'gameplay' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                          <GameplaySettingsPanel nodeId={propertiesNode.id} />
                        </div>
                      )}

                      {/* Subgraph-specific controls */}
                      {sceneType === 'subgraph' && !editingNodeId && (() => {
                        const isBulkMoveActive = bulkMoveTargetSubgraphId === propertiesNode.id;
                        const eligibleSelected = activeGraph.nodes.filter(
                          (n) =>
                            n.selected &&
                            n.id !== propertiesNode.id &&
                            n.type !== 'endNode' &&
                            n.type !== 'startNode' &&
                            n.type !== 'subgraph',
                        );

                        return (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3">
                            {isBulkMoveActive ? (
                              <>
                                <div className="rounded-md bg-teal-500/10 border border-teal-500/30 px-3 py-2">
                                  <p className="text-[11px] text-teal-600 dark:text-teal-400 leading-relaxed">
                                    Click to select nodes. Hold <kbd className="px-1 py-0.5 rounded bg-teal-500/20 text-[10px] font-mono">Ctrl</kbd> / <kbd className="px-1 py-0.5 rounded bg-teal-500/20 text-[10px] font-mono">Cmd</kbd> to add more.
                                  </p>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {eligibleSelected.length === 0
                                    ? 'No nodes selected'
                                    : `${eligibleSelected.length} node${eligibleSelected.length !== 1 ? 's' : ''} selected`}
                                </p>
                                <button
                                  onClick={() => executeBulkMove()}
                                  disabled={eligibleSelected.length === 0}
                                  className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <MousePointerSquareDashed className="h-4 w-4" />
                                  Move {eligibleSelected.length > 0 ? `${eligibleSelected.length} ` : ''}into Subgraph
                                </button>
                                <button
                                  onClick={() => cancelBulkMove()}
                                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => startBulkMove(propertiesNode.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-md border border-teal-500/30 px-3 py-2 text-sm font-medium text-teal-500 dark:text-teal-400 transition-colors hover:bg-teal-500/10 cursor-pointer"
                              >
                                <MousePointerSquareDashed className="h-4 w-4" />
                                Select Nodes to Add
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Dissolve subgraph */}
                      {sceneType === 'subgraph' && !editingNodeId && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                          <button
                            onClick={() => dissolveSubgraph(propertiesNode.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-md border border-teal-500/30 px-3 py-2 text-sm font-medium text-teal-500 dark:text-teal-400 transition-colors hover:bg-teal-500/10 cursor-pointer"
                          >
                            <Ungroup className="h-4 w-4" />
                            Dissolve Subgraph
                          </button>
                          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
                            Inline the contents back into the parent graph.
                          </p>
                        </div>
                      )}

                      {!editingNodeId && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                          <button
                            onClick={() => removeNode(propertiesNode.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Node
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                if (selectedEdge) {
                  const sourceNode = activeGraph.nodes.find((n) => n.id === selectedEdge.source);
                  const targetNode = activeGraph.nodes.find((n) => n.id === selectedEdge.target);
                  const sourceLabel = (sourceNode?.data as SceneNodeData)?.label ?? selectedEdge.source;
                  const targetLabel = (targetNode?.data as SceneNodeData)?.label ?? selectedEdge.target;

                  return (
                    <div className="space-y-4">
                      {/* Edge type badge */}
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-indigo-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
                          Edge
                        </span>
                      </div>

                      {/* Source node */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Source
                        </label>
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{sourceLabel}</p>
                      </div>

                      {/* Target node */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Target
                        </label>
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{targetLabel}</p>
                      </div>

                      {/* Edge ID */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 mb-1">
                          Edge ID
                        </label>
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-500 break-all">
                          {selectedEdge.id}
                        </p>
                      </div>

                      {/* Delete Edge */}
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <button
                          onClick={() => removeEdge(selectedEdge.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Edge
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <p className="text-sm text-gray-600 dark:text-gray-500">
                    Select an element to view its properties.
                  </p>
                );
              })()}
            </div>
          </aside>
        )}

        {/* Toggle button when panel is collapsed */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="flex w-10 shrink-0 items-center justify-center border-l border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors cursor-pointer"
            title="Expand panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>

    </div>
  );
}
