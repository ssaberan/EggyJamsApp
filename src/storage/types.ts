import type { Edge, Node } from '@xyflow/react';

// ── Graph / project ──

export type VariableType = 'boolean' | 'number' | 'string';

export interface VariableDefinition {
  id: string;
  name: string;
  type: VariableType;
  initialValue: boolean | number | string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  variables: VariableDefinition[];
  startNodeId?: string | null;
}

/** Summary fields for project lists (hub, registry). */
export interface ProjectMeta {
  id: string;
  title: string;
  description: string | null;
  /** Relative path within the project folder, or a resolved display URL. */
  thumbnailPath: string | null;
  createdAt: string;
  lastModified: string;
}

/** Full project payload read/written via `project.json`. */
export interface ProjectData extends ProjectMeta {
  graphData: GraphData;
}

/** Entry in `userData/registry.json` (recent projects). */
export interface ProjectRegistryEntry {
  id: string;
  title: string;
  /** Absolute path to the project folder on disk. */
  path: string;
  lastOpened: string;
  lastModified: string;
}

// ── Assets ──

export type AssetFileType = 'image' | 'audio';

/** Virtual folder in the asset library (manifest-only; files on disk stay flat). */
export interface AssetFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: string;
}

/** Single asset row in `assets/manifest.json`. */
export interface AssetRecord {
  id: string;
  fileName: string;
  relativePath: string;
  fileType: AssetFileType;
  folderId: string | null;
  createdAt?: string;
}

/** v2 `assets/manifest.json` shape. */
export interface AssetManifest {
  version: 2;
  folders: AssetFolder[];
  assets: AssetRecord[];
}

/** Asset metadata plus a URL suitable for `<img>` / `<audio>` (custom protocol in Electron). */
export interface ListedAsset extends AssetRecord {
  fileUrl: string;
}

/** Full asset library: folder tree plus listed assets. */
export interface AssetLibrary {
  folders: AssetFolder[];
  assets: ListedAsset[];
}

// ── Player saves ──

export type GameVariables = Record<string, boolean | number | string>;

/** Per-slot summary for the save menu (slots 1–3). */
export interface SaveSlotMeta {
  slotIndex: number;
  createdAt: string | null;
  slotName: string | null;
  /** Present when the slot file exists (used for load/rename without a separate fetch). */
  nodeId?: string;
  variables?: GameVariables;
}

/** Payload stored in `saves/slot-N.json`. */
export interface SaveSlotData {
  nodeId: string;
  variables: GameVariables;
  slotName: string | null;
  createdAt: string;
}

// ── App preferences ──

export type AppTheme = 'light' | 'dark';

/** Stored in `userData/preferences.json`. */
export interface AppPreferences {
  theme: AppTheme;
}
