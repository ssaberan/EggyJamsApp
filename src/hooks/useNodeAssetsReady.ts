import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Node, Edge } from '@xyflow/react';
import {
  PREFETCH_DEPTH,
  collectNodeAssetUrls,
  getReachableNodeIds,
} from '../lib/nodeAssets';
import * as assetPreloader from '../lib/assetPreloader';

interface NodeAssetsReady {
  ready: boolean;
  loaded: number;
  total: number;
}

/**
 * On every change of the current node, kicks off preloads for the current
 * node's assets plus all assets reachable within `PREFETCH_DEPTH` hops, evicts
 * cached assets that fall outside that active set, and reports per-current-node
 * readiness (used to gate scene rendering with a loading screen).
 */
export function useNodeAssetsReady(
  currentNode: Node | null,
  nodes: Node[],
  edges: Edge[],
  assetMap: Record<string, string>,
): NodeAssetsReady {
  const currentUrls = useMemo(
    () => collectNodeAssetUrls(currentNode, assetMap),
    [currentNode, assetMap],
  );

  const activeUrls = useMemo(() => {
    if (!currentNode) return currentUrls;
    const reachableIds = getReachableNodeIds(currentNode.id, edges, PREFETCH_DEPTH);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const set = new Set<string>(currentUrls);
    for (const id of reachableIds) {
      const node = nodeById.get(id);
      for (const url of collectNodeAssetUrls(node, assetMap)) {
        set.add(url);
      }
    }
    return Array.from(set);
  }, [currentNode, nodes, edges, assetMap, currentUrls]);

  useEffect(() => {
    if (!currentNode) return;
    assetPreloader.retain(activeUrls);
    void assetPreloader.preloadMany(activeUrls);
  }, [currentNode, activeUrls]);

  useSyncExternalStore(
    assetPreloader.subscribe,
    assetPreloader.getVersion,
    assetPreloader.getVersion,
  );

  const total = currentUrls.length;
  const loaded = assetPreloader.countReady(currentUrls);
  const ready = total === 0 || loaded === total;

  return { ready, loaded, total };
}
