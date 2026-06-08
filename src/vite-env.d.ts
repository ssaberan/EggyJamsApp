/// <reference types="vite/client" />

interface Window {
  GAME_DATA?: {
    nodes: import('@xyflow/react').Node[];
    edges: import('@xyflow/react').Edge[];
    variables: import('./stores/graphStore').VariableDefinition[];
    assetMap: Record<string, string>;
  };
}
