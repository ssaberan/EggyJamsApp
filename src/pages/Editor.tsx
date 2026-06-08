import { useCallback, useEffect, useRef, useMemo, type DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

import SceneNode from '../components/editor/SceneNode';
import SubgraphNode from '../components/editor/SubgraphNode';
import EndNode from '../components/editor/EndNode';
import StartNode from '../components/editor/StartNode';
import NodeToolbar from '../components/editor/NodeToolbar';
import DialogueEditor from '../components/editor/DialogueEditor';
import PointAndClickEditor from '../components/editor/PointAndClickEditor';
import GameplayEditor from '../components/editor/GameplayEditor';
import CutsceneEditor from '../components/editor/CutsceneEditor';
import CustomSceneEditor from '../components/editor/CustomSceneEditor';

import {
  useGraphStore,
  getActiveGraph,
  migrateSubgraphEndNodes,
  migrateSubgraphStartNodes,
  type SceneType,
  type SceneNodeData,
} from '../stores/graphStore';
import { useAssetStore } from '../stores/assetStore';
import { useTheme } from '../context/ThemeContext';
import { projectRepository } from '../storage';
import type { ProjectData } from '../storage';

const NODE_TYPES = { scene: SceneNode, subgraph: SubgraphNode, endNode: EndNode, startNode: StartNode };

function EditorContent() {
  const { projectId } = useParams<{ projectId: string }>();

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const variables = useGraphStore((s) => s.variables);
  const subgraphPath = useGraphStore((s) => s.subgraphPath);
  const setNodes = useGraphStore((s) => s.setNodes);
  const setEdges = useGraphStore((s) => s.setEdges);
  const setVariables = useGraphStore((s) => s.setVariables);
  const selectNode = useGraphStore((s) => s.selectNode);
  const startNodeId = useGraphStore((s) => s.startNodeId);
  const saveStatus = useGraphStore((s) => s.saveStatus);
  const setSaveStatus = useGraphStore((s) => s.setSaveStatus);
  const setFlushSave = useGraphStore((s) => s.setFlushSave);
  const editingNodeId = useGraphStore((s) => s.editingNodeId);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const exitToSubgraph = useGraphStore((s) => s.exitToSubgraph);
  const setStartNodeId = useGraphStore((s) => s.setStartNodeId);

  const fetchAssets = useAssetStore((s) => s.fetchAssets);

  const hasLoaded = useRef(false);
  const hasUnsavedChanges = useRef(false);
  const projectRef = useRef<ProjectData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const activeNodes = useMemo(
    () => getActiveGraph(nodes, edges, subgraphPath).nodes,
    [nodes, edges, subgraphPath],
  );

  // ── Load graph data + assets on mount ──
  useEffect(() => {
    const id = projectId;
    if (!id) return;

    async function loadGraph(projectId: string) {
      try {
        const project = await projectRepository.getProject(projectId);

        if (!project) {
          console.error('Failed to load project:', projectId);
          hasLoaded.current = true;
          return;
        }

        projectRef.current = project;

        const { graphData } = project;
        if (graphData) {
          const {
            nodes: savedNodes,
            edges: savedEdges,
            variables: savedVariables,
            startNodeId: savedStartNodeId,
          } = graphData;
          setNodes(migrateSubgraphStartNodes(migrateSubgraphEndNodes(savedNodes ?? [])));
          setEdges(savedEdges ?? []);
          setVariables(savedVariables ?? []);
          setStartNodeId(savedStartNodeId ?? null);
        }
      } catch (err) {
        console.error('Failed to load graph data:', err);
      }

      setTimeout(() => {
        hasLoaded.current = true;
      }, 100);
    }

    loadGraph(id);
    fetchAssets(id);

    return () => {
      hasLoaded.current = false;
      hasUnsavedChanges.current = false;
      projectRef.current = null;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setNodes([]);
      setEdges([]);
      setVariables([]);
      setStartNodeId(null);
      selectNode(null);
      setEditingNodeId(null);
      exitToSubgraph(0);
      setSaveStatus('idle');
      setFlushSave(null);
      window.electronAPI?.setDirty(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fetchAssets]);

  useEffect(() => {
    const dirty =
      hasUnsavedChanges.current ||
      saveStatus === 'saving' ||
      saveStatus === 'error';
    window.electronAPI?.setDirty(dirty);
  }, [saveStatus]);

  // ── Perform save ──
  const performSave = useCallback(async () => {
    if (!projectId) return;

    const project = projectRef.current;
    if (!project) return;

    const currentNodes = useGraphStore.getState().nodes;
    const currentEdges = useGraphStore.getState().edges;
    const currentVariables = useGraphStore.getState().variables;
    const currentStartNodeId = useGraphStore.getState().startNodeId;

    const graphData = {
      nodes: currentNodes,
      edges: currentEdges,
      variables: currentVariables,
      startNodeId: currentStartNodeId,
    };

    try {
      await projectRepository.saveProject({
        ...project,
        graphData,
      });
      projectRef.current = { ...project, graphData };
      hasUnsavedChanges.current = false;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveStatus('error');
    }
  }, [projectId, setSaveStatus]);

  // ── Auto-save (debounced 1.5s) ──
  useEffect(() => {
    if (!hasLoaded.current || !projectId) return;

    hasUnsavedChanges.current = true;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSaveStatus('saving');

    saveTimerRef.current = setTimeout(() => {
      const promise = performSave();
      savePromiseRef.current = promise;
      promise.finally(() => {
        if (savePromiseRef.current === promise) {
          savePromiseRef.current = null;
        }
      });
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, variables, startNodeId, projectId]);

  // ── Register flushSave callback ──
  useEffect(() => {
    const flushSave = async (): Promise<boolean> => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        await performSave();
      } else if (savePromiseRef.current) {
        await savePromiseRef.current;
      } else if (hasUnsavedChanges.current) {
        await performSave();
      }
      return useGraphStore.getState().saveStatus !== 'error';
    };

    setFlushSave(flushSave);
    return () => setFlushSave(null);
  }, [performSave, setFlushSave]);

  // ── View switching ──
  if (editingNodeId) {
    const editingNode = activeNodes.find((n) => n.id === editingNodeId);
    const sceneType = (editingNode?.data as SceneNodeData | undefined)?.sceneType;
    if (sceneType === 'point_and_click') {
      return <PointAndClickEditor nodeId={editingNodeId} />;
    }
    if (sceneType === 'gameplay') {
      return <GameplayEditor nodeId={editingNodeId} />;
    }
    if (sceneType === 'cutscene') {
      return <CutsceneEditor nodeId={editingNodeId} />;
    }
    if (sceneType === 'custom') {
      return <CustomSceneEditor nodeId={editingNodeId} />;
    }

    return <DialogueEditor nodeId={editingNodeId} />;
  }

  return <MacroViewCanvas />;
}

function MacroViewCanvas() {
  const reactFlowInstance = useReactFlow();
  const { theme } = useTheme();

  const topNodes = useGraphStore((s) => s.nodes);
  const topEdges = useGraphStore((s) => s.edges);
  const subgraphPath = useGraphStore((s) => s.subgraphPath);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addNode = useGraphStore((s) => s.addNode);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const enterSubgraph = useGraphStore((s) => s.enterSubgraph);
  const moveNodeIntoSubgraph = useGraphStore((s) => s.moveNodeIntoSubgraph);
  const bulkMoveTargetSubgraphId = useGraphStore((s) => s.bulkMoveTargetSubgraphId);
  const cancelBulkMove = useGraphStore((s) => s.cancelBulkMove);

  const { nodes, edges } = useMemo(
    () => getActiveGraph(topNodes, topEdges, subgraphPath),
    [topNodes, topEdges, subgraphPath],
  );

  useEffect(() => {
    const id = setTimeout(() => reactFlowInstance.fitView({ duration: 300 }), 50);
    return () => clearTimeout(id);
  }, [subgraphPath, reactFlowInstance]);

  // ── Drag-and-drop handlers ──
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const sceneType = event.dataTransfer.getData('application/reactflow-scenetype') as SceneType;
      if (!sceneType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(sceneType, position);
    },
    [reactFlowInstance, addNode]
  );

  // ── Selection handlers ──
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (bulkMoveTargetSubgraphId) return;
      selectNode(node.id);
      selectEdge(null);
    },
    [selectNode, selectEdge, bulkMoveTargetSubgraphId]
  );

  const handlePaneClick = useCallback(() => {
    if (bulkMoveTargetSubgraphId) {
      cancelBulkMove();
    }
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge, bulkMoveTargetSubgraphId, cancelBulkMove]);

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      selectNode(null);
      selectEdge(edge.id);
    },
    [selectNode, selectEdge]
  );

  // ── Pause undo history during drags ──
  const handleNodeDragStart = useCallback(() => {
    useGraphStore.temporal.getState().pause();
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      useGraphStore.temporal.getState().resume();

      if (draggedNode.type === 'subgraph' || draggedNode.type === 'endNode' || draggedNode.type === 'startNode') return;

      const intersecting = reactFlowInstance.getIntersectingNodes(draggedNode);
      const targetSubgraph = intersecting.find((n) => n.type === 'subgraph');
      if (targetSubgraph) {
        moveNodeIntoSubgraph(draggedNode.id, targetSubgraph.id);
      }
    },
    [reactFlowInstance, moveNodeIntoSubgraph],
  );

  // ── Double-click: open editor for scene nodes, enter subgraph nodes ──
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (bulkMoveTargetSubgraphId) return;
      const data = node.data as SceneNodeData;
      if (data.sceneType === 'subgraph') {
        enterSubgraph(node.id);
        return;
      }
      if (data.sceneType === 'dialogue' || data.sceneType === 'point_and_click' || data.sceneType === 'gameplay' || data.sceneType === 'cutscene' || data.sceneType === 'custom') {
        setEditingNodeId(node.id);
      }
    },
    [setEditingNodeId, enterSubgraph, bulkMoveTargetSubgraphId]
  );

  const nodeTypes = useMemo(() => NODE_TYPES, []);

  const defaultEdgeOptions = useMemo(() => ({
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#6b7280',
    },
    style: { stroke: '#6b7280', strokeWidth: 2 },
    interactionWidth: 20,
  }), []);

  const isDark = theme === 'dark';
  const bgDotColor = isDark ? '#374151' : '#9ca3af';
  const minimapMaskColor = isDark ? 'rgba(17, 24, 39, 0.7)' : 'rgba(229, 231, 235, 0.7)';

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        deleteKeyCode={null}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-gray-200 dark:bg-gray-900"
        selectionOnDrag={!!bulkMoveTargetSubgraphId}
        multiSelectionKeyCode={bulkMoveTargetSubgraphId ? ['Meta', 'Control'] : null}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={bgDotColor} />
        <Controls
          className="!bg-gray-200 !dark:bg-gray-800 !border-gray-300 !dark:border-gray-700 !rounded-lg !shadow-lg [&>button]:!bg-gray-200 [&>button]:!dark:bg-gray-800 [&>button]:!border-gray-300 [&>button]:!dark:border-gray-700 [&>button]:!text-gray-600 [&>button]:!dark:text-gray-400 [&>button:hover]:!bg-gray-300 [&>button:hover]:!dark:bg-gray-700"
        />
        <MiniMap
          nodeColor="#6366f1"
          maskColor={minimapMaskColor}
          className="!bg-gray-200 !dark:bg-gray-800 !border-gray-300 !dark:border-gray-700 !rounded-lg"
        />
      </ReactFlow>
      <NodeToolbar />
    </div>
  );
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  );
}
