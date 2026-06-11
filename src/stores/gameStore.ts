import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import { END_NODE_TYPE, START_NODE_TYPE } from './graphStore';
import type {
  SceneNodeData,
  DialogueBlock,
  TextBlock,
  VariableDefinition,
  ChoiceCondition,
  LogicOperation,
  ChoiceOption,
  Hotspot,
  GameplayHotspot,
  HotspotAction,
  HotspotCondition,
  CutsceneData,

  CharacterPosition,
  CharacterAnimation,
} from './graphStore';
import { setUrlFileType } from '../lib/assetPreloader';
import { assetRepository, projectRepository } from '../storage';

// ── Types ──

type VariableValue = boolean | number | string;

interface GameState {
  // Raw game data (loaded once)
  nodes: Node[];
  edges: Edge[];
  assetMap: Record<string, string>; // assetId -> public URL

  // Runtime
  currentNodeId: string | null;
  currentBlockIndex: number;
  history: string[]; // past node IDs
  variables: Record<string, VariableValue>;
  variableDefinitions: VariableDefinition[];

  // UI flags
  isLoading: boolean;
  error: string | null;
  isEnded: boolean;
  toastMessage: string | null;
  toastDismissMode: 'onLeave' | 'onInteraction' | null;
  toastPosition: 'top' | 'bottom' | null;

  // Hotspot action queue
  actionQueue: HotspotAction[];
  actionQueueSourceHotspot: (Hotspot | GameplayHotspot) | null;

  // Hotspot choice state (when a showChoice action is active)
  hotspotChoiceOptions: ChoiceOption[] | null;

  // Persisted start node override
  startNodeId: string | null;

  // Actions
  loadGame: (gameId: string) => Promise<void>;
  loadFromData: (data: {
    nodes: Node[];
    edges: Edge[];
    variables: VariableDefinition[];
    assetMap: Record<string, string>;
    startNodeId?: string | null;
  }) => void;
  advance: () => void;
  selectChoice: (optionId: string) => void;
  selectHotspotChoice: (optionId: string) => void;
  restart: () => void;
  navigateToNode: (nodeId: string) => void;
  executeHotspotAction: (hotspot: Hotspot | GameplayHotspot) => void;
  processNextAction: () => void;
  clearToast: () => void;
  transitionFromCustom: (handleId?: string) => void;
  getVariableById: (id: string) => VariableValue | undefined;
  setVariableById: (id: string, value: VariableValue) => void;

  // Computed helpers
  isInteractionLocked: () => boolean;
  getCurrentNode: () => Node<SceneNodeData> | null;
  getCurrentBlock: () => DialogueBlock | null;
  getPrecedingTextBlock: () => TextBlock | null;
  getBackgroundUrl: () => string | null;
  getCharacterSprites: () => Array<{ url: string; position: CharacterPosition; enterAnimation: CharacterAnimation; exitAnimation: CharacterAnimation }>;
  getFilteredChoiceOptions: (options: ChoiceOption[]) => ChoiceOption[];
  getCutsceneData: () => CutsceneData | null;
}

// ── Helpers ──

function findStartNode(nodes: Node[], edges: Edge[], startNodeId?: string | null): Node | null {
  if (nodes.length === 0) return null;
  if (startNodeId) {
    const explicit = nodes.find((n) => n.id === startNodeId);
    if (explicit) return explicit;
  }
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  return nodes.find((n) => !nodesWithIncoming.has(n.id)) ?? nodes[0];
}

function getNodeData(node: Node | null): SceneNodeData | null {
  if (!node) return null;
  return node.data as SceneNodeData;
}

/**
 * Recursively expand subgraph nodes so the runtime only sees flat scene nodes.
 * Edges with `entry:<id>:<handle>` target handles are redirected to the internal
 * target node. Edges without entry handles fall back to the heuristic root.
 * Edges from `exit:<id>:<handle>` handles are converted to direct edges from the
 * internal node. Start and End nodes are stripped from the flat graph.
 */
export function flattenSubgraphs(
  inputNodes: Node[],
  inputEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  let flatNodes: Node[] = [];
  let flatEdges: Edge[] = [...inputEdges];

  for (const node of inputNodes) {
    const data = node.data as SceneNodeData;
    if (node.type !== 'subgraph' || !data.subgraphNodes) {
      flatNodes.push(node);
      continue;
    }

    const inner = flattenSubgraphs(
      data.subgraphNodes,
      data.subgraphEdges ?? [],
    );

    const specialNodeIds = new Set(
      inner.nodes
        .filter((n) => n.type === END_NODE_TYPE || n.type === START_NODE_TYPE)
        .map((n) => n.id),
    );
    const innerNodesFiltered = inner.nodes.filter((n) => !specialNodeIds.has(n.id));
    const innerEdgesFiltered = inner.edges.filter(
      (e) => !specialNodeIds.has(e.target) && !specialNodeIds.has(e.source),
    );

    flatNodes = flatNodes.concat(innerNodesFiltered);

    const innerEdges = innerEdgesFiltered;
    const innerNodeIds = new Set(innerNodesFiltered.map((n) => n.id));
    const rootNode = innerNodesFiltered.find(
      (n) => !innerEdges.some((e) => e.target === n.id && innerNodeIds.has(e.source)),
    );
    const rootId = rootNode?.id ?? null;

    const newEdges: Edge[] = [];
    for (const edge of flatEdges) {
      if (edge.target === node.id) {
        if (edge.targetHandle?.startsWith('entry:')) {
          const parts = edge.targetHandle.split(':');
          const internalNodeId = parts[1];
          newEdges.push({ ...edge, target: internalNodeId, targetHandle: null });
        } else if (rootId) {
          newEdges.push({ ...edge, target: rootId, targetHandle: null });
        }
      } else if (edge.source === node.id && edge.sourceHandle?.startsWith('exit:')) {
        const parts = edge.sourceHandle.split(':');
        const internalNodeId = parts[1];
        const internalHandle = parts.slice(2).join(':');
        newEdges.push({
          ...edge,
          source: internalNodeId,
          sourceHandle: internalHandle === 'default' ? 'default' : internalHandle,
        });
      } else if (edge.source !== node.id && edge.target !== node.id) {
        newEdges.push(edge);
      }
    }

    flatEdges = newEdges.concat(innerEdges);
  }

  return { nodes: flatNodes, edges: flatEdges };
}

function initializeVariables(definitions: VariableDefinition[]): Record<string, VariableValue> {
  const vars: Record<string, VariableValue> = {};
  for (const def of definitions) {
    vars[def.name] = def.initialValue;
  }
  return vars;
}

function executeOperation(
  variables: Record<string, VariableValue>,
  definitions: VariableDefinition[],
  op: LogicOperation,
): Record<string, VariableValue> {
  const def = definitions.find((d) => d.id === op.variableId);
  if (!def) return variables;

  const current = variables[def.name];
  let newValue: VariableValue;

  switch (op.operator) {
    case '=':
      newValue = op.value;
      break;
    case '+=':
      if (def.type !== 'number') return variables;
      newValue = (current as number) + (Number(op.value) || 0);
      break;
    case '-=':
      if (def.type !== 'number') return variables;
      newValue = (current as number) - (Number(op.value) || 0);
      break;
    default:
      return variables;
  }

  return { ...variables, [def.name]: newValue };
}

export function evaluateCondition(
  variables: Record<string, VariableValue>,
  definitions: VariableDefinition[],
  condition: ChoiceCondition,
): boolean {
  const def = definitions.find((d) => d.id === condition.variableId);
  if (!def) return true; // No matching variable definition -> show option

  const current = variables[def.name];
  if (current === undefined) return true;

  const { comparison, value } = condition;

  switch (comparison) {
    case '==':
      return current == value;
    case '!=':
      return current != value;
    case '>':
      return (current as number) > (value as number);
    case '<':
      return (current as number) < (value as number);
    case '>=':
      return (current as number) >= (value as number);
    default:
      return true;
  }
}

async function buildAssetMap(projectId: string): Promise<Record<string, string>> {
  const { assets: listed } = await assetRepository.listAssets(projectId);
  const entries = await Promise.all(
    listed.map(async (asset) => {
      const url = await assetRepository.getAssetUrl(projectId, asset.id);
      setUrlFileType(url, asset.fileType);
      return [asset.id, url] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// ── Store ──

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  assetMap: {},
  currentNodeId: null,
  currentBlockIndex: 0,
  history: [],
  variables: {},
  variableDefinitions: [],
  isLoading: false,
  error: null,
  isEnded: false,
  toastMessage: null,
  toastDismissMode: null,
  toastPosition: null,
  actionQueue: [],
  actionQueueSourceHotspot: null,
  hotspotChoiceOptions: null,
  startNodeId: null,

  // ── Load game data from local project folder + assets ──
  loadGame: async (gameId) => {
    set({ isLoading: true, error: null, isEnded: false });

    try {
      const [project, assetMap] = await Promise.all([
        projectRepository.getProject(gameId),
        buildAssetMap(gameId),
      ]);

      if (!project) {
        set({ error: 'Game not found.', isLoading: false });
        return;
      }

      const graphData = project.graphData;

      if (!graphData?.nodes || graphData.nodes.length === 0) {
        set({ error: 'This game has no scenes yet.', isLoading: false });
        return;
      }

      const { variables: varDefs, startNodeId: savedStartNodeId } = graphData;
      const variableDefinitions = varDefs ?? [];

      const { nodes, edges } = flattenSubgraphs(graphData.nodes, graphData.edges);

      const startNode = findStartNode(nodes, edges, savedStartNodeId);

      set({
        nodes,
        edges,
        assetMap,
        currentNodeId: startNode?.id ?? null,
        currentBlockIndex: 0,
        history: [],
        variables: initializeVariables(variableDefinitions),
        variableDefinitions,
        isLoading: false,
        isEnded: false,
        error: null,
        toastMessage: null,
        toastDismissMode: null,
        toastPosition: null,
        actionQueue: [],
        actionQueueSourceHotspot: null,
        hotspotChoiceOptions: null,
        startNodeId: savedStartNodeId ?? null,
      });

      // Auto-advance if the first block of the start node is a logic block
      const startData = startNode?.data as SceneNodeData | undefined;
      const firstBlock = startData?.dialogueBlocks?.[0];
      if (firstBlock && firstBlock.type === 'logic') {
        setTimeout(() => get().advance(), 0);
      }
    } catch {
      set({ error: 'Failed to load game.', isLoading: false });
    }
  },

  // ── Load game data from pre-loaded payload (offline export) ──
  loadFromData: (data) => {
    const { variables: varDefs, assetMap, startNodeId: savedStartNodeId } = data;
    const variableDefinitions = varDefs ?? [];
    const { nodes, edges } = flattenSubgraphs(data.nodes, data.edges);
    const startNode = findStartNode(nodes, edges, savedStartNodeId);

    set({
      nodes,
      edges,
      assetMap,
      currentNodeId: startNode?.id ?? null,
      currentBlockIndex: 0,
      history: [],
      variables: initializeVariables(variableDefinitions),
      variableDefinitions,
      isLoading: false,
      isEnded: false,
      error: null,
      toastMessage: null,
      toastDismissMode: null,
      toastPosition: null,
      actionQueue: [],
      actionQueueSourceHotspot: null,
      hotspotChoiceOptions: null,
      startNodeId: savedStartNodeId ?? null,
    });

    // Auto-advance if the first block of the start node is a logic block
    const startData = startNode?.data as SceneNodeData | undefined;
    const firstBlock = startData?.dialogueBlocks?.[0];
    if (firstBlock && firstBlock.type === 'logic') {
      setTimeout(() => get().advance(), 0);
    }
  },

  // ── Advance to the next block or transition ──
  advance: () => {
    const { currentNodeId, currentBlockIndex, nodes, edges, variables, variableDefinitions } = get();
    if (!currentNodeId) return;

    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) return;

    const data = node.data as SceneNodeData;
    const blocks = data.dialogueBlocks ?? [];

    const currentBlock = blocks[currentBlockIndex];

    // If current block is a choice, do nothing (wait for selectChoice)
    if (currentBlock && currentBlock.type === 'choice') return;

    // If current block is a logic block, execute operations and auto-advance
    if (currentBlock && currentBlock.type === 'logic') {
      let updatedVars = { ...variables };
      for (const op of currentBlock.operations) {
        updatedVars = executeOperation(updatedVars, variableDefinitions, op);
      }
      set({ variables: updatedVars });

      // Auto-advance past the logic block
      if (currentBlockIndex < blocks.length - 1) {
        set({ currentBlockIndex: currentBlockIndex + 1 });
        // Recursively advance if next block is also a logic block
        const nextBlock = blocks[currentBlockIndex + 1];
        if (nextBlock && nextBlock.type === 'logic') {
          // Use setTimeout to avoid deep recursion in a synchronous call
          setTimeout(() => get().advance(), 0);
        }
        return;
      }
      // Fall through to node transition if logic block was the last block
    }

    // If there are more blocks in this node, advance the index
    if (currentBlockIndex < blocks.length - 1) {
      const nextBlock = blocks[currentBlockIndex + 1];
      set({ currentBlockIndex: currentBlockIndex + 1 });

      // If next block is a logic block, auto-execute it
      if (nextBlock && nextBlock.type === 'logic') {
        setTimeout(() => get().advance(), 0);
        return;
      }
      // If next block is a choice, it will render choice buttons and
      // advance() will be blocked until selectChoice is called
      return;
    }

    // Last block (or no blocks) -> transition to next node
    // Look for a default outgoing edge
    const outgoingEdge = edges.find(
      (e) =>
        e.source === currentNodeId &&
        (e.sourceHandle === 'default' || !e.sourceHandle)
    );

    if (outgoingEdge) {
      // Navigate to the next node
      set({
        history: [...get().history, currentNodeId],
        currentNodeId: outgoingEdge.target,
        currentBlockIndex: 0,
      });
      // Check if the first block of the new node is a logic block
      const targetNode = nodes.find((n) => n.id === outgoingEdge.target);
      const targetData = targetNode?.data as SceneNodeData | undefined;
      const firstBlock = targetData?.dialogueBlocks?.[0];
      if (firstBlock && firstBlock.type === 'logic') {
        setTimeout(() => get().advance(), 0);
      }
    } else {
      // No outgoing edges -> end of game
      set({ isEnded: true });
    }
  },

  // ── Handle a player choice ──
  selectChoice: (optionId) => {
    const { currentNodeId, edges } = get();
    if (!currentNodeId) return;

    // Find the edge whose sourceHandle matches the chosen option
    const edge = edges.find(
      (e) => e.source === currentNodeId && e.sourceHandle === optionId
    );

    if (edge) {
      const { nodes } = get();
      set({
        history: [...get().history, currentNodeId],
        currentNodeId: edge.target,
        currentBlockIndex: 0,
      });

      // Auto-advance if the first block of the target node is a logic block
      const targetNode = nodes.find((n) => n.id === edge.target);
      const targetData = targetNode?.data as SceneNodeData | undefined;
      const firstBlock = targetData?.dialogueBlocks?.[0];
      if (firstBlock && firstBlock.type === 'logic') {
        setTimeout(() => get().advance(), 0);
      }
    } else {
      // Dead-end choice -> end of game
      set({ isEnded: true });
    }
  },

  // ── Restart the game from the beginning ──
  restart: () => {
    const { nodes, edges, variableDefinitions, startNodeId } = get();
    const startNode = findStartNode(nodes, edges, startNodeId);
    set({
      currentNodeId: startNode?.id ?? null,
      currentBlockIndex: 0,
      history: [],
      variables: initializeVariables(variableDefinitions),
      isEnded: false,
      toastMessage: null,
      toastDismissMode: null,
      toastPosition: null,
      actionQueue: [],
      actionQueueSourceHotspot: null,
      hotspotChoiceOptions: null,
    });
  },

  // ── Navigate directly to a node (used by point-and-click hotspots) ──
  navigateToNode: (nodeId) => {
    const { currentNodeId, nodes } = get();
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    set({
      history: currentNodeId ? [...get().history, currentNodeId] : get().history,
      currentNodeId: nodeId,
      currentBlockIndex: 0,
      toastMessage: null,
      toastDismissMode: null,
      toastPosition: null,
    });

    // Auto-advance if the first block of the target node is a logic block
    const targetData = targetNode.data as SceneNodeData | undefined;
    const firstBlock = targetData?.dialogueBlocks?.[0];
    if (firstBlock && firstBlock.type === 'logic') {
      setTimeout(() => get().advance(), 0);
    }
  },

  // ── Execute a hotspot action sequence ──
  executeHotspotAction: (hotspot) => {
    if (get().isInteractionLocked()) return;

    const { variables, variableDefinitions } = get();

    // Check condition first
    if (hotspot.condition) {
      const conditionMet = evaluateCondition(
        variables,
        variableDefinitions,
        hotspot.condition as HotspotCondition & ChoiceCondition,
      );
      if (!conditionMet) {
        set({ toastMessage: 'It seems to be locked...', toastDismissMode: 'onInteraction', toastPosition: hotspot.messagePosition ?? 'bottom' });
        return;
      }
    }

    // Populate the action queue and start processing
    set({
      actionQueue: [...hotspot.actions],
      actionQueueSourceHotspot: hotspot,
    });
    get().processNextAction();
  },

  // ── Process the next action in the hotspot action queue ──
  processNextAction: () => {
    const { actionQueue, actionQueueSourceHotspot, currentNodeId, edges, variableDefinitions } = get();

    if (actionQueue.length === 0) {
      set({ actionQueueSourceHotspot: null });
      return;
    }

    const [nextAction, ...remaining] = actionQueue;
    set({ actionQueue: remaining });

    switch (nextAction.type) {
      case 'setVariable': {
        const op: LogicOperation = {
          variableId: nextAction.variableId,
          operator: nextAction.operator,
          value: nextAction.value,
        };
        const updatedVars = executeOperation(get().variables, variableDefinitions, op);
        set({ variables: updatedVars });
        // Immediately process next action
        get().processNextAction();
        break;
      }
      case 'showMessage': {
        if (nextAction.message) {
          set({
            toastMessage: nextAction.message,
            toastDismissMode: nextAction.dismissMode ?? 'onInteraction',
            toastPosition: actionQueueSourceHotspot?.messagePosition ?? 'bottom',
          });
        } else {
          // Empty message, skip to next
          get().processNextAction();
        }
        break;
      }
      case 'showChoice': {
        if (nextAction.options.length > 0) {
          set({ hotspotChoiceOptions: nextAction.options, toastPosition: actionQueueSourceHotspot?.messagePosition ?? 'bottom' });
        } else {
          get().processNextAction();
        }
        break;
      }
      case 'transition': {
        const hotspot = actionQueueSourceHotspot;
        if (!hotspot) break;
        const edge = edges.find(
          (e) => e.source === currentNodeId && e.sourceHandle === hotspot.id,
        );
        if (edge) {
          set({ actionQueue: [], actionQueueSourceHotspot: null });
          get().navigateToNode(edge.target);
        }
        break;
      }
    }
  },

  // ── Clear toast message ──
  clearToast: () => {
    set({ toastMessage: null, toastDismissMode: null, toastPosition: null });
    if (get().actionQueue.length > 0) {
      get().processNextAction();
    } else {
      set({ actionQueueSourceHotspot: null });
    }
  },

  // ── Handle a hotspot choice selection ──
  selectHotspotChoice: (optionId) => {
    const { currentNodeId, edges } = get();
    if (!currentNodeId) return;

    const edge = edges.find(
      (e) => e.source === currentNodeId && e.sourceHandle === optionId,
    );

    set({
      hotspotChoiceOptions: null,
      actionQueue: [],
      actionQueueSourceHotspot: null,
    });

    if (edge) {
      get().navigateToNode(edge.target);
    }
  },

  // ── Custom scene transitions ──
  transitionFromCustom: (handleId) => {
    const { currentNodeId, edges, nodes } = get();
    if (!currentNodeId) return;

    const sourceHandle = handleId ?? 'default';
    const edge = edges.find(
      (e) =>
        e.source === currentNodeId &&
        (sourceHandle === 'default'
          ? e.sourceHandle === 'default' || !e.sourceHandle
          : e.sourceHandle === sourceHandle),
    );

    if (edge) {
      set({
        history: [...get().history, currentNodeId],
        currentNodeId: edge.target,
        currentBlockIndex: 0,
        toastMessage: null,
        toastDismissMode: null,
        toastPosition: null,
      });
      const targetNode = nodes.find((n) => n.id === edge.target);
      const targetData = targetNode?.data as SceneNodeData | undefined;
      const firstBlock = targetData?.dialogueBlocks?.[0];
      if (firstBlock && firstBlock.type === 'logic') {
        setTimeout(() => get().advance(), 0);
      }
    } else {
      set({ isEnded: true });
    }
  },

  getVariableById: (id) => {
    const { variables, variableDefinitions } = get();
    const def = variableDefinitions.find((d) => d.id === id);
    if (!def) return undefined;
    return variables[def.name];
  },

  setVariableById: (id, value) => {
    const { variables, variableDefinitions } = get();
    const def = variableDefinitions.find((d) => d.id === id);
    if (!def) return;
    set({ variables: { ...variables, [def.name]: value } });
  },

  // ── Computed helpers ──

  isInteractionLocked: () => {
    const { actionQueueSourceHotspot, toastMessage, hotspotChoiceOptions } = get();
    return actionQueueSourceHotspot !== null || toastMessage !== null || hotspotChoiceOptions !== null;
  },

  getCurrentNode: () => {
    const { nodes, currentNodeId } = get();
    if (!currentNodeId) return null;
    return (nodes.find((n) => n.id === currentNodeId) as Node<SceneNodeData>) ?? null;
  },

  getCurrentBlock: () => {
    const node = get().getCurrentNode();
    const data = getNodeData(node);
    if (!data) return null;
    const blocks = data.dialogueBlocks ?? [];
    return blocks[get().currentBlockIndex] ?? null;
  },

  getPrecedingTextBlock: () => {
    const node = get().getCurrentNode();
    const data = getNodeData(node);
    if (!data) return null;
    const blocks = data.dialogueBlocks ?? [];
    const idx = get().currentBlockIndex;
    for (let i = idx - 1; i >= 0; i--) {
      if (blocks[i].type === 'text') return blocks[i] as TextBlock;
    }
    return null;
  },

  getBackgroundUrl: () => {
    const node = get().getCurrentNode();
    const data = getNodeData(node);
    if (!data?.backgroundImageId) return null;
    return get().assetMap[data.backgroundImageId] ?? null;
  },

  getCharacterSprites: () => {
    let block: TextBlock | null = null;
    const currentBlock = get().getCurrentBlock();

    if (currentBlock?.type === 'text') {
      block = currentBlock;
    } else if (currentBlock?.type === 'choice' && currentBlock.showOverDialogue) {
      block = get().getPrecedingTextBlock();
    }

    if (!block) return [];
    const { assetMap } = get();

    type SpriteEntry = { url: string; position: CharacterPosition; enterAnimation: CharacterAnimation; exitAnimation: CharacterAnimation };

    if (block.characters && block.characters.length > 0) {
      return block.characters
        .filter((c) => c.spriteId)
        .map((c) => {
          const url = assetMap[c.spriteId!];
          return url ? {
            url,
            position: c.position,
            enterAnimation: c.enterAnimation ?? 'none',
            exitAnimation: c.exitAnimation ?? 'none',
          } : null;
        })
        .filter((entry): entry is SpriteEntry => entry !== null);
    }

    if (block.spriteId) {
      const url = assetMap[block.spriteId];
      if (url) return [{ url, position: 'left-1' as CharacterPosition, enterAnimation: 'none' as CharacterAnimation, exitAnimation: 'none' as CharacterAnimation }];
    }

    return [];
  },

  getFilteredChoiceOptions: (options) => {
    const { variables, variableDefinitions } = get();
    return options.filter((opt) => {
      if (!opt.condition) return true;
      return evaluateCondition(variables, variableDefinitions, opt.condition);
    });
  },

  getCutsceneData: () => {
    const node = get().getCurrentNode();
    const data = getNodeData(node);
    return data?.cutsceneData ?? null;
  },
}));
