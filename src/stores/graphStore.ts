import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { DEFAULT_CUSTOM_SCRIPT } from '../constants/defaultCustomScript';

export type SceneType = 'dialogue' | 'cutscene' | 'point_and_click' | 'gameplay' | 'custom' | 'subgraph';

export const END_NODE_TYPE = 'endNode' as const;
export const START_NODE_TYPE = 'startNode' as const;

// ── Dialogue Block types ──

export type CharacterPosition = 'left-1' | 'left-2' | 'right-1' | 'right-2';

export type CharacterAnimation = 'none' | 'fade' | 'slide' | 'fade-and-slide';

export interface CharacterSlot {
  spriteId: string | null;
  position: CharacterPosition;
  enterAnimation?: CharacterAnimation;
  exitAnimation?: CharacterAnimation;
}

export interface TextBlock {
  id: string;
  type: 'text';
  character: string;
  dialogue: string;
  /** @deprecated Use `characters` array instead. Kept for backward compat with old saved data. */
  spriteId?: string | null;
  characters?: CharacterSlot[];
}

// ── Variable types ──

export type VariableType = 'boolean' | 'number' | 'string';

export interface VariableDefinition {
  id: string;
  name: string;
  type: VariableType;
  initialValue: boolean | number | string;
}

// ── Logic Block types ──

export interface LogicOperation {
  variableId: string;
  operator: '=' | '+=' | '-=';
  value: boolean | number | string;
}

export interface LogicBlock {
  id: string;
  type: 'logic';
  operations: LogicOperation[];
}

// ── Condition for choice options ──

export interface ChoiceCondition {
  variableId: string;
  comparison: '==' | '!=' | '>' | '<' | '>=';
  value: boolean | number | string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  condition?: ChoiceCondition;
}

export interface ChoiceBlock {
  id: string;
  type: 'choice';
  options: ChoiceOption[];
  showOverDialogue?: boolean;
}

export type DialogueBlock = TextBlock | ChoiceBlock | LogicBlock;

// ── Hotspot types (point-and-click) ──

export interface HotspotCondition {
  variableId: string;
  comparison: '==' | '!=' | '>' | '<' | '>=';
  value: boolean | number | string;
}

export type HotspotAction =
  | { type: 'transition' }
  | { type: 'setVariable'; variableId: string; operator: '=' | '+=' | '-='; value: boolean | number | string }
  | { type: 'showMessage'; message: string; dismissMode?: 'onLeave' | 'onInteraction' }
  | { type: 'showChoice'; options: ChoiceOption[] };

export interface Hotspot {
  id: string;
  name: string;
  x: number;      // percentage (0-100)
  y: number;      // percentage (0-100)
  width: number;   // percentage (0-100)
  height: number;  // percentage (0-100)
  actions: HotspotAction[];
  condition?: HotspotCondition;
  messagePosition?: 'top' | 'bottom';
}

// ── Gameplay (Physics) types ──

export type GameplayViewMode = 'side' | 'top_down';

export interface GameplayObstacle {
  id: string;
  x: number;      // percentage (0-100)
  y: number;
  width: number;
  height: number;
}

export interface GameplayHotspot {
  id: string;
  name: string;
  x: number;      // percentage (0-100)
  y: number;
  width: number;
  height: number;
  actions: HotspotAction[];
  condition?: HotspotCondition;
  activationType: 'collision' | 'interaction_button';
  showIndicator: boolean;
  messagePosition?: 'top' | 'bottom';
}

export interface GameplayStaticAsset {
  id: string;
  name: string;
  assetId: string;
  x: number;       // percentage (0-100)
  y: number;
  width: number;   // percentage
  height: number;
  zIndex: number;   // integer, default 0
}

export interface GameplaySettings {
  viewMode: GameplayViewMode;
  backgroundImageId: string | null;
  backgroundSize?: BackgroundSizeMode;
  backgroundPosition?: BackgroundPosition;
  backgroundMusicId: string | null;
  characterSpriteId: string | null;
  characterStartPosition: { x: number; y: number };
  characterFrontFace: 'left' | 'right' | 'up' | 'down';
  characterScale: number; // percentage, default 100
  characterZIndex?: number; // default 10
  characterSpriteIdVertical?: string | null;
  characterFrontFaceHorizontal?: 'left' | 'right';
  characterFrontFaceVertical?: 'up' | 'down';
  characterSpriteIdIdleSide?: string | null;
  characterSpriteIdWalkingSide?: string | null;
  characterSpriteIdJumpingUpSide?: string | null;
  characterSpriteIdFallingDownSide?: string | null;
  characterSpriteIdIdleHorizontal?: string | null;
  characterSpriteIdWalkingHorizontal?: string | null;
  characterSpriteIdIdleVertical?: string | null;
  characterSpriteIdWalkingVertical?: string | null;
  resetPositionOnEnter?: boolean;
  characterSpeed?: number;   // % of viewport per second, default 30
  gravity?: number;          // % per second squared (side view only), default 120
  jumpStrength?: number;     // % per second (side view only), default 55
  trackCharacterWithCamera?: boolean;
  cameraSize?: number;       // 0-100, % of screen dimensions shown, default 50
}

// ── Scene Timer (point-and-click / gameplay) ──

export interface SceneTimer {
  id: string;
  enabled: boolean;
  durationSeconds: number;
  showCountdown: boolean;
  actions: HotspotAction[];
  condition?: HotspotCondition;
}



export type BackgroundSizeMode = 'cover' | 'contain' | 'fill';

export type BackgroundPosition = 'start' | 'center' | 'end';

export const BG_POSITION_CSS: Record<BackgroundPosition, string> = {
  start: 'left bottom',
  center: 'center',
  end: 'right top',
};

// ── Cutscene types ──

export type CutsceneTrackType = 'background' | 'character' | 'camera' | 'audio' | 'text';

export type InterpolationMode = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'instant';

export interface Keyframe {
  id: string;
  time: number;         // seconds from clip start (or global for camera)
  value: number;
  interpolation: InterpolationMode;
}

export interface TransformKeyframes {
  x: Keyframe[];
  y: Keyframe[];
  rotation: Keyframe[];
  scaleX: Keyframe[];
  scaleY: Keyframe[];
  opacity: Keyframe[];
}

export interface CutsceneClip {
  id: string;
  trackId: string;       // references CutsceneTrack.id
  start: number;         // seconds
  end: number;           // seconds
  assetId?: string | null;
  backgroundSize?: BackgroundSizeMode;
  backgroundPosition?: BackgroundPosition;
  zIndex?: number;
  transform?: TransformKeyframes;
  animationState?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textOutline?: boolean;
  textShadow?: boolean;
  typewriterEnabled?: boolean;
  typewriterSpeed?: number;
  volume?: Keyframe[];
  audioType?: 'bgm' | 'sfx';
}

export interface CameraKeyframes {
  x: Keyframe[];
  y: Keyframe[];
  zoom: Keyframe[];
}

export interface CutsceneTrack {
  id: string;
  type: CutsceneTrackType;
  label: string;
  muted?: boolean;
  locked?: boolean;
}

export interface CutsceneData {
  duration: number;
  tracks: CutsceneTrack[];
  clips: CutsceneClip[];
  camera: CameraKeyframes;
  skipEnabled: boolean;
  loopInEditor: boolean;
}

export const DEFAULT_CUTSCENE_DATA: CutsceneData = {
  duration: 30,
  tracks: [
    { id: 'track-bg', type: 'background', label: 'Background' },
    { id: 'track-char', type: 'character', label: 'Characters' },
    { id: 'track-cam', type: 'camera', label: 'Camera' },
    { id: 'track-audio', type: 'audio', label: 'Audio' },
    { id: 'track-text', type: 'text', label: 'Text' },
  ],
  clips: [],
  camera: { x: [], y: [], zoom: [] },
  skipEnabled: true,
  loopInEditor: false,
};

// ── Custom Scene types ──

export interface CustomSceneConfig {
  script: string;
  language?: 'javascript';
  outputHandles?: { id: string; label: string }[];
}

export { DEFAULT_CUSTOM_SCRIPT } from '../constants/defaultCustomScript';

export interface SceneNodeData {
  label: string;
  sceneType: SceneType;
  summary: string;
  dialogueBlocks?: DialogueBlock[];
  hotspots?: Hotspot[];
  cutsceneData?: CutsceneData;

  backgroundImageId?: string | null;
  backgroundSize?: BackgroundSizeMode;
  backgroundPosition?: BackgroundPosition;
  backgroundMusicId?: string | null;
  gameplaySettings?: GameplaySettings;
  obstacles?: GameplayObstacle[];
  gameplayHotspots?: GameplayHotspot[];
  staticAssets?: GameplayStaticAsset[];
  timer?: SceneTimer | null;
  customSceneConfig?: CustomSceneConfig;
  subgraphNodes?: Node[];
  subgraphEdges?: Edge[];
  [key: string]: unknown;
}

export type SceneNode = Node<SceneNodeData, 'scene'>;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Subgraph navigation helpers ──

export function getActiveGraph(
  topNodes: Node[],
  topEdges: Edge[],
  path: string[],
): { nodes: Node[]; edges: Edge[] } {
  let activeNodes = topNodes;
  let activeEdges = topEdges;
  for (const sgId of path) {
    const sgNode = activeNodes.find((n) => n.id === sgId);
    const sgData = sgNode?.data as SceneNodeData | undefined;
    activeNodes = sgData?.subgraphNodes ?? [];
    activeEdges = sgData?.subgraphEdges ?? [];
  }
  return { nodes: activeNodes, edges: activeEdges };
}

function setActiveGraph(
  topNodes: Node[],
  topEdges: Edge[],
  path: string[],
  activeNodes: Node[],
  activeEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (path.length === 0) {
    return { nodes: activeNodes, edges: activeEdges };
  }

  const [headId, ...tail] = path;
  const newTopNodes = topNodes.map((node) => {
    if (node.id !== headId) return node;
    const data = node.data as SceneNodeData;

    if (tail.length === 0) {
      return {
        ...node,
        data: { ...data, subgraphNodes: activeNodes, subgraphEdges: activeEdges },
      };
    }

    const inner = setActiveGraph(
      data.subgraphNodes ?? [],
      data.subgraphEdges ?? [],
      tail,
      activeNodes,
      activeEdges,
    );
    return {
      ...node,
      data: { ...data, subgraphNodes: inner.nodes, subgraphEdges: inner.edges },
    };
  });

  return { nodes: newTopNodes, edges: topEdges };
}

/**
 * After internal edges of a subgraph change, remove parent-level exit edges
 * whose exit handle no longer corresponds to an edge targeting the End node.
 */
function syncExitEdges(
  topNodes: Node[],
  topEdges: Edge[],
  subgraphPath: string[],
): { nodes: Node[]; edges: Edge[] } {
  if (subgraphPath.length === 0) return { nodes: topNodes, edges: topEdges };

  const parentPath = subgraphPath.slice(0, -1);
  const subgraphId = subgraphPath[subgraphPath.length - 1];

  const parentGraph = getActiveGraph(topNodes, topEdges, parentPath);

  const sgNode = parentGraph.nodes.find((n) => n.id === subgraphId);
  if (!sgNode) return { nodes: topNodes, edges: topEdges };

  const sgData = sgNode.data as SceneNodeData;
  const internalNodes = sgData.subgraphNodes ?? [];
  const internalEdges = sgData.subgraphEdges ?? [];

  const endNode = internalNodes.find((n) => n.type === END_NODE_TYPE);
  const validExitHandles = new Set<string>();
  if (endNode) {
    for (const edge of internalEdges) {
      if (edge.target === endNode.id) {
        validExitHandles.add(`exit:${edge.source}:${edge.sourceHandle ?? 'default'}`);
      }
    }
  }

  const newParentEdges = parentGraph.edges.filter((e) => {
    if (e.source !== subgraphId || !e.sourceHandle?.startsWith('exit:')) return true;
    return validExitHandles.has(e.sourceHandle);
  });

  if (newParentEdges.length === parentGraph.edges.length) {
    return { nodes: topNodes, edges: topEdges };
  }

  return setActiveGraph(topNodes, topEdges, parentPath, parentGraph.nodes, newParentEdges);
}

/**
 * After internal edges of a subgraph change, remove parent-level entry edges
 * whose entry handle no longer corresponds to an edge from the Start node.
 */
function syncEntryEdges(
  topNodes: Node[],
  topEdges: Edge[],
  subgraphPath: string[],
): { nodes: Node[]; edges: Edge[] } {
  if (subgraphPath.length === 0) return { nodes: topNodes, edges: topEdges };

  const parentPath = subgraphPath.slice(0, -1);
  const subgraphId = subgraphPath[subgraphPath.length - 1];

  const parentGraph = getActiveGraph(topNodes, topEdges, parentPath);

  const sgNode = parentGraph.nodes.find((n) => n.id === subgraphId);
  if (!sgNode) return { nodes: topNodes, edges: topEdges };

  const sgData = sgNode.data as SceneNodeData;
  const internalNodes = sgData.subgraphNodes ?? [];
  const internalEdges = sgData.subgraphEdges ?? [];

  const startNode = internalNodes.find((n) => n.type === START_NODE_TYPE);
  const validEntryHandles = new Set<string>();
  if (startNode) {
    for (const edge of internalEdges) {
      if (edge.source === startNode.id) {
        validEntryHandles.add(`entry:${edge.target}:${edge.targetHandle ?? 'default'}`);
      }
    }
  }

  const newParentEdges = parentGraph.edges.filter((e) => {
    if (e.target !== subgraphId || !e.targetHandle?.startsWith('entry:')) return true;
    return validEntryHandles.has(e.targetHandle);
  });

  if (newParentEdges.length === parentGraph.edges.length) {
    return { nodes: topNodes, edges: topEdges };
  }

  return setActiveGraph(topNodes, topEdges, parentPath, parentGraph.nodes, newParentEdges);
}

/** Resolve a node at a specific subgraph depth (for breadcrumb labels). */
export function resolveSubgraphNode(
  topNodes: Node[],
  topEdges: Edge[],
  path: string[],
  depth: number,
): Node | undefined {
  const parent = getActiveGraph(topNodes, topEdges, path.slice(0, depth));
  return parent.nodes.find((n) => n.id === path[depth]);
}

/**
 * Migrate legacy subgraphs that lack End nodes. For each subgraph:
 * 1. Add an End node if missing
 * 2. Convert implicit exits (unconnected output handles) to explicit edges to the End node
 */
export function migrateSubgraphEndNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'subgraph') return node;
    const data = node.data as SceneNodeData;
    let internalNodes = data.subgraphNodes ?? [];
    const internalEdges = data.subgraphEdges ?? [];

    internalNodes = migrateSubgraphEndNodes(internalNodes);

    const hasEndNode = internalNodes.some((n) => n.type === END_NODE_TYPE);
    if (hasEndNode) {
      return { ...node, data: { ...data, subgraphNodes: internalNodes, subgraphEdges: internalEdges } };
    }

    const maxX = internalNodes.reduce((max, n) => Math.max(max, n.position?.x ?? 0), 0);
    const endNode: Node = {
      id: crypto.randomUUID(),
      type: END_NODE_TYPE,
      position: { x: maxX + 300, y: 100 },
      data: { label: 'End', isEndNode: true },
    };

    const internalNodeIds = new Set(internalNodes.map((n) => n.id));
    const newEdges = [...internalEdges];

    for (const iNode of internalNodes) {
      const iData = iNode.data as SceneNodeData;
      const outputHandles = collectOutputHandleIds(iData);

      for (const handleId of outputHandles) {
        const normalizedId = handleId ?? 'default';
        const isConnectedInternally = internalEdges.some(
          (e) =>
            e.source === iNode.id &&
            (e.sourceHandle ?? 'default') === normalizedId &&
            internalNodeIds.has(e.target),
        );
        if (!isConnectedInternally) {
          newEdges.push({
            id: crypto.randomUUID(),
            source: iNode.id,
            sourceHandle: normalizedId,
            target: endNode.id,
            targetHandle: null,
          });
        }
      }
    }

    return {
      ...node,
      data: {
        ...data,
        subgraphNodes: [...internalNodes, endNode],
        subgraphEdges: newEdges,
      },
    };
  });
}

function collectOutputHandleIds(data: SceneNodeData): (string | null)[] {
  if (data.sceneType === 'dialogue' && data.dialogueBlocks) {
    const choiceHandles: string[] = [];
    for (const block of data.dialogueBlocks) {
      if (block.type === 'choice') {
        for (const opt of block.options) {
          choiceHandles.push(opt.id);
        }
      }
    }
    if (choiceHandles.length > 0) return choiceHandles;
  }

  if (data.sceneType === 'point_and_click' && data.hotspots) {
    const handles = data.hotspots
      .filter((h) => h.actions.some((a) => a.type === 'transition'))
      .map((h) => h.id);
    if (data.timer?.enabled && data.timer.actions.some((a) => a.type === 'transition')) {
      handles.push(data.timer.id);
    }
    if (handles.length > 0) return handles;
  }

  if (data.sceneType === 'gameplay' && data.gameplayHotspots) {
    const handles = data.gameplayHotspots
      .filter((h) => h.actions.some((a) => a.type === 'transition'))
      .map((h) => h.id);
    if (data.timer?.enabled && data.timer.actions.some((a) => a.type === 'transition')) {
      handles.push(data.timer.id);
    }
    if (handles.length > 0) return handles;
  }

  if (data.sceneType === 'custom' && data.customSceneConfig?.outputHandles?.length) {
    return data.customSceneConfig.outputHandles.map((h) => h.id);
  }

  return [null];
}

/**
 * Migrate legacy subgraphs that lack Start nodes. For each subgraph:
 * 1. Add a Start node if missing
 * 2. Wire the Start node to nodes that have no internal incoming edges (root candidates)
 */
export function migrateSubgraphStartNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'subgraph') return node;
    const data = node.data as SceneNodeData;
    let internalNodes = data.subgraphNodes ?? [];
    const internalEdges = data.subgraphEdges ?? [];

    internalNodes = migrateSubgraphStartNodes(internalNodes);

    const hasStartNode = internalNodes.some((n) => n.type === START_NODE_TYPE);
    if (hasStartNode) {
      return { ...node, data: { ...data, subgraphNodes: internalNodes, subgraphEdges: internalEdges } };
    }

    const minX = internalNodes.reduce((min, n) => Math.min(min, n.position?.x ?? 0), Infinity);
    const startNode: Node = {
      id: crypto.randomUUID(),
      type: START_NODE_TYPE,
      position: { x: (Number.isFinite(minX) ? minX : 0) - 200, y: 100 },
      data: { label: 'Start', isStartNode: true },
    };

    const internalNodeIds = new Set(internalNodes.map((n) => n.id));
    const nodesWithIncoming = new Set<string>();
    for (const e of internalEdges) {
      if (internalNodeIds.has(e.source)) {
        nodesWithIncoming.add(e.target);
      }
    }

    const newEdges = [...internalEdges];
    for (const iNode of internalNodes) {
      if (iNode.type === END_NODE_TYPE) continue;
      if (!nodesWithIncoming.has(iNode.id)) {
        newEdges.push({
          id: crypto.randomUUID(),
          source: startNode.id,
          sourceHandle: null,
          target: iNode.id,
          targetHandle: null,
        });
      }
    }

    return {
      ...node,
      data: {
        ...data,
        subgraphNodes: [startNode, ...internalNodes],
        subgraphEdges: newEdges,
      },
    };
  });
}

/**
 * Pure function: move a single node into a subgraph, returning the new active
 * graph (nodes + edges) without touching the store. Used by both the
 * single-move action and the bulk-move action.
 */
function moveNodeIntoSubgraphCore(
  activeNodes: Node[],
  activeEdges: Edge[],
  nodeId: string,
  subgraphId: string,
): { nodes: Node[]; edges: Edge[] } | null {
  const movingNode = activeNodes.find((n) => n.id === nodeId);
  const subgraphNode = activeNodes.find((n) => n.id === subgraphId);
  if (!movingNode || !subgraphNode) return null;

  const sgData = subgraphNode.data as SceneNodeData;
  const sgInternalNodes = sgData.subgraphNodes ?? [];
  const sgInternalEdges = sgData.subgraphEdges ?? [];
  const sgInternalNodeIds = new Set(sgInternalNodes.map((n) => n.id));

  const endNode = sgInternalNodes.find((n) => n.type === END_NODE_TYPE);
  const startNode = sgInternalNodes.find((n) => n.type === START_NODE_TYPE);

  const edgesFromMoving: Edge[] = [];
  const edgesToMoving: Edge[] = [];
  const otherEdges: Edge[] = [];

  for (const edge of activeEdges) {
    if (edge.source === nodeId) {
      edgesFromMoving.push(edge);
    } else if (edge.target === nodeId) {
      edgesToMoving.push(edge);
    } else {
      otherEdges.push(edge);
    }
  }

  const newSgInternalEdges = [...sgInternalEdges];
  const newParentEdges = [...otherEdges];

  for (const edge of edgesFromMoving) {
    if (edge.target === nodeId) {
      newSgInternalEdges.push(edge);
    } else if (sgInternalNodeIds.has(edge.target)) {
      newSgInternalEdges.push(edge);
    } else if (edge.target === subgraphId && edge.targetHandle?.startsWith('entry:')) {
      const parts = edge.targetHandle.split(':');
      const internalTargetId = parts[1];
      const internalHandle = parts.slice(2).join(':');
      newSgInternalEdges.push({
        id: crypto.randomUUID(),
        source: nodeId,
        sourceHandle: edge.sourceHandle ?? null,
        target: internalTargetId,
        targetHandle: internalHandle === 'default' ? null : internalHandle,
      });
    } else if (edge.target === subgraphId) {
      // Generic connection to S is meaningless now that A is inside S; drop it.
    } else if (endNode) {
      const exitHandle = `exit:${nodeId}:${edge.sourceHandle ?? 'default'}`;
      newSgInternalEdges.push({
        id: crypto.randomUUID(),
        source: nodeId,
        sourceHandle: edge.sourceHandle ?? 'default',
        target: endNode.id,
        targetHandle: null,
      });
      newParentEdges.push({
        ...edge,
        id: crypto.randomUUID(),
        source: subgraphId,
        sourceHandle: exitHandle,
      });
    }
  }

  for (const edge of edgesToMoving) {
    if (edge.source === subgraphId && edge.sourceHandle?.startsWith('exit:')) {
      const parts = edge.sourceHandle.split(':');
      const internalSourceId = parts[1];
      const internalHandle = parts.slice(2).join(':');
      newSgInternalEdges.push({
        ...edge,
        id: crypto.randomUUID(),
        source: internalSourceId,
        sourceHandle: internalHandle === 'default' ? 'default' : internalHandle,
        target: nodeId,
        targetHandle: null,
      });
    } else if (edge.source === subgraphId) {
      // Generic connection from S is meaningless now that A is inside S; drop it.
    } else if (sgInternalNodeIds.has(edge.source)) {
      newSgInternalEdges.push(edge);
    } else if (startNode) {
      const entryHandle = `entry:${nodeId}:${edge.targetHandle ?? 'default'}`;
      newSgInternalEdges.push({
        id: crypto.randomUUID(),
        source: startNode.id,
        sourceHandle: null,
        target: nodeId,
        targetHandle: edge.targetHandle ?? null,
      });
      newParentEdges.push({
        ...edge,
        id: crypto.randomUUID(),
        target: subgraphId,
        targetHandle: entryHandle,
      });
    } else {
      newParentEdges.push({
        ...edge,
        id: crypto.randomUUID(),
        target: subgraphId,
        targetHandle: null,
      });
    }
  }

  const nonSpecialCount = sgInternalNodes.filter(
    (n) => n.type !== END_NODE_TYPE && n.type !== START_NODE_TYPE,
  ).length;
  const newMovingNode = {
    ...movingNode,
    position: { x: (nonSpecialCount + 1) * 250, y: 100 },
  };

  const newInternalNodes = [...sgInternalNodes, newMovingNode];
  const sceneCount = newInternalNodes.filter(
    (n) => n.type !== 'subgraph' && n.type !== END_NODE_TYPE && n.type !== START_NODE_TYPE,
  ).length;
  const sgCount = newInternalNodes.filter((n) => n.type === 'subgraph').length;
  const summaryParts: string[] = [];
  if (sceneCount > 0) summaryParts.push(`${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`);
  if (sgCount > 0) summaryParts.push(`${sgCount} subgraph${sgCount !== 1 ? 's' : ''}`);

  const newSubgraphData: SceneNodeData = {
    ...sgData,
    subgraphNodes: newInternalNodes,
    subgraphEdges: newSgInternalEdges,
    summary: summaryParts.join(', ') || '0 scenes',
  };

  const newActiveNodes = activeNodes
    .filter((n) => n.id !== nodeId)
    .map((n) => n.id === subgraphId ? { ...n, data: newSubgraphData } : n);

  return { nodes: newActiveNodes, edges: newParentEdges };
}

interface GraphState {
  // State
  nodes: Node[];
  edges: Edge[];
  variables: VariableDefinition[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  editingNodeId: string | null;
  selectedCutsceneClipId: string | null;
  showCutsceneCameraPanel: boolean;
  selectedGameplayItemId: string | null;
  selectedGameplayItemKind: 'obstacle' | 'hotspot' | 'static_asset' | null;
  selectedPacHotspotId: string | null;
  startNodeId: string | null;
  subgraphPath: string[];
  saveStatus: SaveStatus;
  flushSave: (() => Promise<boolean>) | null;
  bulkMoveTargetSubgraphId: string | null;

  // Node/Edge change handlers (for React Flow)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  // Setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setVariables: (variables: VariableDefinition[]) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setFlushSave: (fn: (() => Promise<boolean>) | null) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setSelectedCutsceneClipId: (id: string | null) => void;
  setShowCutsceneCameraPanel: (show: boolean) => void;
  setSelectedGameplayItem: (id: string | null, kind: 'obstacle' | 'hotspot' | 'static_asset' | null) => void;
  setSelectedPacHotspotId: (id: string | null) => void;
  setStartNodeId: (id: string | null) => void;

  // Actions
  addNode: (sceneType: SceneType, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<SceneNodeData>) => void;
  updateDialogueBlocks: (nodeId: string, blocks: DialogueBlock[]) => void;
  updateHotspots: (nodeId: string, hotspots: Hotspot[]) => void;
  updateCutsceneData: (nodeId: string, data: CutsceneData) => void;
  updateObstacles: (nodeId: string, obstacles: GameplayObstacle[]) => void;
  updateGameplayHotspots: (nodeId: string, hotspots: GameplayHotspot[]) => void;
  updateStaticAssets: (nodeId: string, staticAssets: GameplayStaticAsset[]) => void;
  updateGameplaySettings: (nodeId: string, settings: Partial<GameplaySettings>) => void;
  updateTimer: (nodeId: string, timer: SceneTimer | null) => void;

  // Subgraph navigation
  enterSubgraph: (subgraphId: string) => void;
  exitSubgraph: () => void;
  exitToSubgraph: (depth: number) => void;
  moveNodeIntoSubgraph: (nodeId: string, subgraphId: string) => void;
  dissolveSubgraph: (subgraphId: string) => void;

  // Bulk move
  startBulkMove: (subgraphId: string) => void;
  cancelBulkMove: () => void;
  executeBulkMove: () => void;

  // Variable CRUD
  addVariable: (variable: VariableDefinition) => void;
  updateVariable: (id: string, patch: Partial<Omit<VariableDefinition, 'id'>>) => void;
  removeVariable: (id: string) => void;
}

export const useGraphStore = create<GraphState>()(
  temporal(
    (set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  variables: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  selectedCutsceneClipId: null,
  showCutsceneCameraPanel: false,
  selectedGameplayItemId: null,
  selectedGameplayItemKind: null,
  selectedPacHotspotId: null,
  startNodeId: null,
  subgraphPath: [],
  saveStatus: 'idle',
  flushSave: null,
  bulkMoveTargetSubgraphId: null,

  // React Flow change handlers — operate on the active graph level
  onNodesChange: (changes) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveNodes = applyNodeChanges(changes, active.nodes);
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  onEdgesChange: (changes) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveEdges = applyEdgeChanges(changes, active.edges);
    let result = setActiveGraph(nodes, edges, subgraphPath, active.nodes, newActiveEdges);
    result = syncExitEdges(result.nodes, result.edges, subgraphPath);
    result = syncEntryEdges(result.nodes, result.edges, subgraphPath);
    set({ nodes: result.nodes, edges: result.edges });
  },

  onConnect: (connection) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveEdges = addEdge(connection, active.edges);
    let result = setActiveGraph(nodes, edges, subgraphPath, active.nodes, newActiveEdges);
    result = syncExitEdges(result.nodes, result.edges, subgraphPath);
    result = syncEntryEdges(result.nodes, result.edges, subgraphPath);
    set({ nodes: result.nodes, edges: result.edges });
  },

  // Setters
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setVariables: (variables) => set({ variables }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setFlushSave: (fn) => set({ flushSave: fn }),
  selectNode: (id) => {
    const { bulkMoveTargetSubgraphId } = get();
    if (bulkMoveTargetSubgraphId && id !== bulkMoveTargetSubgraphId) {
      const { nodes, edges, subgraphPath } = get();
      const active = getActiveGraph(nodes, edges, subgraphPath);
      const deselectedNodes = active.nodes.map((n) => ({ ...n, selected: false }));
      const result = setActiveGraph(nodes, edges, subgraphPath, deselectedNodes, active.edges);
      set({ selectedNodeId: id, bulkMoveTargetSubgraphId: null, nodes: result.nodes, edges: result.edges });
    } else {
      set({ selectedNodeId: id });
    }
  },
  selectEdge: (id) => set({ selectedEdgeId: id }),
  setEditingNodeId: (id) => set({ editingNodeId: id, selectedGameplayItemId: null, selectedGameplayItemKind: null, selectedPacHotspotId: null }),
  setSelectedCutsceneClipId: (id) => set({ selectedCutsceneClipId: id }),
  setShowCutsceneCameraPanel: (show) => set({ showCutsceneCameraPanel: show }),
  setSelectedGameplayItem: (id, kind) => set({ selectedGameplayItemId: id, selectedGameplayItemKind: kind }),
  setSelectedPacHotspotId: (id) => set({ selectedPacHotspotId: id }),
  setStartNodeId: (id) => set({ startNodeId: id }),

  // Actions
  addNode: (sceneType, position) => {
    const id = crypto.randomUUID();

    const defaultLabels: Record<SceneType, string> = {
      dialogue: 'New Dialogue',
      cutscene: 'New Cutscene',
      point_and_click: 'New Point-and-Click',
      gameplay: 'New Gameplay',
      custom: 'New Custom Scene',
      subgraph: 'New Subgraph',
    };

    const defaultSummaries: Record<SceneType, string> = {
      dialogue: 'Character conversation',
      cutscene: 'Cinematic sequence',
      point_and_click: 'Basic UI interaction',
      gameplay: 'Physics-based gameplay',
      custom: 'Custom scripting for advanced users',
      subgraph: '0 scenes',
    };

    const data: SceneNodeData = {
      label: defaultLabels[sceneType],
      sceneType,
      summary: defaultSummaries[sceneType],
    };
    if (sceneType === 'subgraph') {
      data.subgraphNodes = [
        {
          id: crypto.randomUUID(),
          type: START_NODE_TYPE,
          position: { x: 0, y: 100 },
          data: { label: 'Start', isStartNode: true },
        },
        {
          id: crypto.randomUUID(),
          type: END_NODE_TYPE,
          position: { x: 400, y: 100 },
          data: { label: 'End', isEndNode: true },
        },
      ];
      data.subgraphEdges = [];
    }
    if (sceneType === 'cutscene') {
      data.cutsceneData = JSON.parse(JSON.stringify(DEFAULT_CUTSCENE_DATA));
    }
    if (sceneType === 'custom') {
      data.customSceneConfig = { script: DEFAULT_CUSTOM_SCRIPT, language: 'javascript' };
    }
    const newNode: Node<SceneNodeData> = {
      id,
      type: sceneType === 'subgraph' ? 'subgraph' : 'scene',
      position,
      data,
    };

    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const result = setActiveGraph(nodes, edges, subgraphPath, [...active.nodes, newNode], active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  removeNode: (nodeId) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const node = active.nodes.find((n) => n.id === nodeId);
    if (node?.type === END_NODE_TYPE || node?.type === START_NODE_TYPE) return;
    const newActiveNodes = active.nodes.filter((n) => n.id !== nodeId);
    const newActiveEdges = active.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    let result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    result = syncExitEdges(result.nodes, result.edges, subgraphPath);
    result = syncEntryEdges(result.nodes, result.edges, subgraphPath);
    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      editingNodeId: get().editingNodeId === nodeId ? null : get().editingNodeId,
    });
  },

  removeEdge: (edgeId) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveEdges = active.edges.filter((e) => e.id !== edgeId);
    let result = setActiveGraph(nodes, edges, subgraphPath, active.nodes, newActiveEdges);
    result = syncExitEdges(result.nodes, result.edges, subgraphPath);
    result = syncEntryEdges(result.nodes, result.edges, subgraphPath);
    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedEdgeId: get().selectedEdgeId === edgeId ? null : get().selectedEdgeId,
    });
  },

  updateNodeData: (nodeId, data) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } }
        : node
    );
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateDialogueBlocks: (nodeId, blocks) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const currentNode = active.nodes.find((n) => n.id === nodeId);
    const currentBlocks = (currentNode?.data as SceneNodeData | undefined)
      ?.dialogueBlocks ?? [];

    const currentOptionIds = new Set<string>();
    for (const block of currentBlocks) {
      if (block.type === 'choice') {
        for (const opt of block.options) {
          currentOptionIds.add(opt.id);
        }
      }
    }

    const newOptionIds = new Set<string>();
    for (const block of blocks) {
      if (block.type === 'choice') {
        for (const opt of block.options) {
          newOptionIds.add(opt.id);
        }
      }
    }

    const removedIds = new Set<string>();
    for (const id of currentOptionIds) {
      if (!newOptionIds.has(id)) {
        removedIds.add(id);
      }
    }

    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, dialogueBlocks: blocks } }
        : node
    );

    const newActiveEdges =
      removedIds.size > 0
        ? active.edges.filter(
            (edge) =>
              !(
                edge.source === nodeId &&
                edge.sourceHandle != null &&
                removedIds.has(edge.sourceHandle)
              )
          )
        : active.edges;

    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateHotspots: (nodeId, hotspots) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const currentNode = active.nodes.find((n) => n.id === nodeId);
    const currentHotspots = (currentNode?.data as SceneNodeData | undefined)
      ?.hotspots ?? [];

    const currentIds = new Set(currentHotspots.map((h) => h.id));
    const newIds = new Set(hotspots.map((h) => h.id));

    const removedIds = new Set<string>();
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        removedIds.add(id);
      }
    }

    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, hotspots } }
        : node
    );

    const newActiveEdges =
      removedIds.size > 0
        ? active.edges.filter(
            (edge) =>
              !(
                edge.source === nodeId &&
                edge.sourceHandle != null &&
                removedIds.has(edge.sourceHandle)
              )
          )
        : active.edges;

    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateCutsceneData: (nodeId, data) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, cutsceneData: data } }
        : node
    );
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateObstacles: (nodeId, obstacles) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, obstacles } }
        : node
    );
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateGameplayHotspots: (nodeId, hotspots) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const currentNode = active.nodes.find((n) => n.id === nodeId);
    const currentHotspots = (currentNode?.data as SceneNodeData | undefined)
      ?.gameplayHotspots ?? [];

    const currentIds = new Set(currentHotspots.map((h) => h.id));
    const newIds = new Set(hotspots.map((h) => h.id));

    const removedIds = new Set<string>();
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        removedIds.add(id);
      }
    }

    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, gameplayHotspots: hotspots } }
        : node
    );

    const newActiveEdges =
      removedIds.size > 0
        ? active.edges.filter(
            (edge) =>
              !(
                edge.source === nodeId &&
                edge.sourceHandle != null &&
                removedIds.has(edge.sourceHandle)
              )
          )
        : active.edges;

    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateStaticAssets: (nodeId, staticAssets) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, staticAssets } }
        : node
    );
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateGameplaySettings: (nodeId, settings) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const currentNode = active.nodes.find((n) => n.id === nodeId);
    const currentSettings = (currentNode?.data as SceneNodeData | undefined)
      ?.gameplaySettings;

    const merged: GameplaySettings = {
      viewMode: 'side',
      backgroundImageId: null,
      backgroundMusicId: null,
      characterSpriteId: null,
      characterStartPosition: { x: 50, y: 90 },
      characterFrontFace: 'right',
      characterScale: 100,
      characterSpriteIdVertical: null,
      characterSpriteIdIdleSide: null,
      characterSpriteIdWalkingSide: null,
      characterSpriteIdJumpingUpSide: null,
      characterSpriteIdFallingDownSide: null,
      characterSpriteIdIdleHorizontal: null,
      characterSpriteIdWalkingHorizontal: null,
      characterSpriteIdIdleVertical: null,
      characterSpriteIdWalkingVertical: null,
      resetPositionOnEnter: true,
      characterSpeed: 30,
      gravity: 120,
      jumpStrength: 55,
      ...currentSettings,
      ...settings,
    };
    const cf = merged.characterFrontFace;
    merged.characterFrontFaceHorizontal = merged.characterFrontFaceHorizontal ?? ((cf === 'left' || cf === 'right') ? cf : 'right');
    merged.characterFrontFaceVertical = merged.characterFrontFaceVertical ?? ((cf === 'up' || cf === 'down') ? cf : 'down');

    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, gameplaySettings: merged } }
        : node
    );
    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, active.edges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  updateTimer: (nodeId, timer) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const currentNode = active.nodes.find((n) => n.id === nodeId);
    const currentData = currentNode?.data as SceneNodeData | undefined;
    const previousTimerId = currentData?.timer?.id ?? null;

    const newActiveNodes = active.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, timer } }
        : node
    );

    let newActiveEdges = active.edges;
    if (timer === null && previousTimerId != null) {
      newActiveEdges = active.edges.filter(
        (edge) =>
          !(
            edge.source === nodeId &&
            edge.sourceHandle != null &&
            edge.sourceHandle === previousTimerId
          )
      );
    }

    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    set({ nodes: result.nodes, edges: result.edges });
  },

  // ── Subgraph navigation ──

  enterSubgraph: (subgraphId) => {
    set({
      subgraphPath: [...get().subgraphPath, subgraphId],
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      bulkMoveTargetSubgraphId: null,
    });
  },

  exitSubgraph: () => {
    const path = get().subgraphPath;
    if (path.length === 0) return;
    set({
      subgraphPath: path.slice(0, -1),
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      bulkMoveTargetSubgraphId: null,
    });
  },

  exitToSubgraph: (depth) => {
    set({
      subgraphPath: get().subgraphPath.slice(0, depth),
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      bulkMoveTargetSubgraphId: null,
    });
  },

  moveNodeIntoSubgraph: (nodeId, subgraphId) => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const moved = moveNodeIntoSubgraphCore(active.nodes, active.edges, nodeId, subgraphId);
    if (!moved) return;
    const result = setActiveGraph(nodes, edges, subgraphPath, moved.nodes, moved.edges);
    set({ nodes: result.nodes, edges: result.edges, selectedNodeId: null });
  },

  dissolveSubgraph: (subgraphId) => {
    const { nodes, edges, subgraphPath, startNodeId } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);

    const sgNode = active.nodes.find((n) => n.id === subgraphId);
    if (!sgNode || sgNode.type !== 'subgraph') return;

    const sgData = sgNode.data as SceneNodeData;
    const internalNodes = sgData.subgraphNodes ?? [];
    const internalEdges = sgData.subgraphEdges ?? [];

    const specialNodeIds = new Set(
      internalNodes
        .filter((n) => n.type === END_NODE_TYPE || n.type === START_NODE_TYPE)
        .map((n) => n.id),
    );

    const extractedNodes = internalNodes
      .filter((n) => !specialNodeIds.has(n.id))
      .map((n) => ({
        ...n,
        position: {
          x: (n.position?.x ?? 0) + (sgNode.position?.x ?? 0),
          y: (n.position?.y ?? 0) + (sgNode.position?.y ?? 0),
        },
      }));

    const extractedEdges = internalEdges.filter(
      (e) => !specialNodeIds.has(e.source) && !specialNodeIds.has(e.target),
    );

    const newParentEdges: Edge[] = [];
    for (const edge of active.edges) {
      if (edge.target === subgraphId) {
        if (edge.targetHandle?.startsWith('entry:')) {
          const parts = edge.targetHandle.split(':');
          const internalNodeId = parts[1];
          const internalHandle = parts.slice(2).join(':');
          newParentEdges.push({
            ...edge,
            target: internalNodeId,
            targetHandle: internalHandle === 'default' ? null : internalHandle,
          });
        }
      } else if (edge.source === subgraphId) {
        if (edge.sourceHandle?.startsWith('exit:')) {
          const parts = edge.sourceHandle.split(':');
          const internalNodeId = parts[1];
          const internalHandle = parts.slice(2).join(':');
          newParentEdges.push({
            ...edge,
            source: internalNodeId,
            sourceHandle: internalHandle,
          });
        }
      } else {
        newParentEdges.push(edge);
      }
    }

    const newActiveNodes = active.nodes
      .filter((n) => n.id !== subgraphId)
      .concat(extractedNodes);
    const newActiveEdges = newParentEdges.concat(extractedEdges);

    const result = setActiveGraph(nodes, edges, subgraphPath, newActiveNodes, newActiveEdges);
    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: null,
      startNodeId: startNodeId === subgraphId ? null : startNodeId,
    });
  },

  // ── Bulk move ──

  startBulkMove: (subgraphId) => set({ bulkMoveTargetSubgraphId: subgraphId }),

  cancelBulkMove: () => {
    const { nodes, edges, subgraphPath } = get();
    const active = getActiveGraph(nodes, edges, subgraphPath);
    const deselectedNodes = active.nodes.map((n) => ({ ...n, selected: false }));
    const result = setActiveGraph(nodes, edges, subgraphPath, deselectedNodes, active.edges);
    set({ bulkMoveTargetSubgraphId: null, nodes: result.nodes, edges: result.edges });
  },

  executeBulkMove: () => {
    const { nodes, edges, subgraphPath, bulkMoveTargetSubgraphId } = get();
    if (!bulkMoveTargetSubgraphId) return;

    let active = getActiveGraph(nodes, edges, subgraphPath);
    const selectedIds = active.nodes
      .filter(
        (n) =>
          n.selected &&
          n.id !== bulkMoveTargetSubgraphId &&
          n.type !== END_NODE_TYPE &&
          n.type !== START_NODE_TYPE &&
          n.type !== 'subgraph',
      )
      .map((n) => n.id);

    if (selectedIds.length === 0) return;

    for (const nodeId of selectedIds) {
      const moved = moveNodeIntoSubgraphCore(active.nodes, active.edges, nodeId, bulkMoveTargetSubgraphId);
      if (moved) active = moved;
    }

    const result = setActiveGraph(nodes, edges, subgraphPath, active.nodes, active.edges);
    set({
      nodes: result.nodes,
      edges: result.edges,
      selectedNodeId: null,
      bulkMoveTargetSubgraphId: null,
    });
  },

  // ── Variable CRUD ──

  addVariable: (variable) => {
    set({ variables: [...get().variables, variable] });
  },

  updateVariable: (id, patch) => {
    set({
      variables: get().variables.map((v) =>
        v.id === id ? { ...v, ...patch } : v
      ),
    });
  },

  removeVariable: (id) => {
    set({ variables: get().variables.filter((v) => v.id !== id) });
  },
    }),
    {
      // Only track the data fields, not UI state
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        variables: state.variables,
        startNodeId: state.startNodeId,
      }),
      // Cap history at 50 entries to limit memory usage
      limit: 50,
      // Use equality check to avoid duplicate history entries
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes &&
        pastState.edges === currentState.edges &&
        pastState.variables === currentState.variables &&
        pastState.startNodeId === currentState.startNodeId,
    }
  )
);
