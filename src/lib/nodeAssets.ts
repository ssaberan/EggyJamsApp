import type { Node, Edge } from '@xyflow/react';
import type { SceneNodeData, GameplaySettings } from '../stores/graphStore';

/**
 * BFS depth for predictive prefetching from the current node. Depth 1 prefetches
 * only direct successors; higher values reach further ahead at the cost of
 * bandwidth/memory. Gating still only blocks on the current node (depth 0).
 */
export const PREFETCH_DEPTH = 2;

const GAMEPLAY_SPRITE_KEYS: Array<keyof GameplaySettings> = [
  'characterSpriteId',
  'characterSpriteIdVertical',
  'characterSpriteIdIdleSide',
  'characterSpriteIdWalkingSide',
  'characterSpriteIdJumpingUpSide',
  'characterSpriteIdFallingDownSide',
  'characterSpriteIdIdleHorizontal',
  'characterSpriteIdWalkingHorizontal',
  'characterSpriteIdIdleVertical',
  'characterSpriteIdWalkingVertical',
];

function pushUrl(out: Set<string>, assetMap: Record<string, string>, id: unknown): void {
  if (typeof id !== 'string' || id.length === 0) return;
  const url = assetMap[id];
  if (url) out.add(url);
}

/**
 * Walk a flattened scene node and resolve every statically-known asset reference
 * to its loadable URL (https, eggyjams://, etc.). Returns a deduplicated array.
 *
 * Custom scenes (`sceneType === 'custom'`) cannot be statically introspected
 * because user scripts call `api.getAssetUrl(id)` at runtime; for those we
 * return an empty list so they fall back to on-demand loading.
 */
export function collectNodeAssetUrls(
  node: Node | null | undefined,
  assetMap: Record<string, string>,
): string[] {
  if (!node) return [];
  const data = node.data as SceneNodeData | undefined;
  if (!data) return [];
  if (data.sceneType === 'custom') return [];

  const urls = new Set<string>();

  pushUrl(urls, assetMap, data.backgroundImageId);
  pushUrl(urls, assetMap, data.backgroundMusicId);

  if (data.dialogueBlocks) {
    for (const block of data.dialogueBlocks) {
      if (block.type !== 'text') continue;
      pushUrl(urls, assetMap, block.spriteId);
      if (block.characters) {
        for (const c of block.characters) {
          pushUrl(urls, assetMap, c.spriteId);
        }
      }
    }
  }

  if (data.cutsceneData?.clips) {
    for (const clip of data.cutsceneData.clips) {
      pushUrl(urls, assetMap, clip.assetId);
    }
  }

  if (data.gameplaySettings) {
    pushUrl(urls, assetMap, data.gameplaySettings.backgroundImageId);
    pushUrl(urls, assetMap, data.gameplaySettings.backgroundMusicId);
    for (const key of GAMEPLAY_SPRITE_KEYS) {
      pushUrl(urls, assetMap, data.gameplaySettings[key]);
    }
  }

  if (data.staticAssets) {
    for (const asset of data.staticAssets) {
      pushUrl(urls, assetMap, asset.assetId);
    }
  }

  return Array.from(urls);
}

/**
 * BFS over the flat edge list starting from `startNodeId` up to `depth` hops.
 * Excludes the starting node itself. Cycle-safe via a visited set. Includes
 * every syntactically-reachable target across all source handle types
 * (default / choice / hotspot / custom outputs) regardless of variable state.
 */
export function getReachableNodeIds(
  startNodeId: string,
  edges: Edge[],
  depth: number,
): string[] {
  if (depth <= 0) return [];

  const visited = new Set<string>([startNodeId]);
  const result: string[] = [];
  let frontier: string[] = [startNodeId];

  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const sourceId of frontier) {
      for (const edge of edges) {
        if (edge.source !== sourceId) continue;
        if (visited.has(edge.target)) continue;
        visited.add(edge.target);
        result.push(edge.target);
        next.push(edge.target);
      }
    }
    frontier = next;
  }

  return result;
}
