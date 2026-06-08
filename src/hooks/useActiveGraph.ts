import { useMemo } from 'react';
import { useGraphStore, getActiveGraph } from '../stores/graphStore';

/** Current story graph level (root or nested subgraph per `subgraphPath`). */
export function useActiveGraph() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const subgraphPath = useGraphStore((s) => s.subgraphPath);
  return useMemo(
    () => getActiveGraph(nodes, edges, subgraphPath),
    [nodes, edges, subgraphPath],
  );
}
