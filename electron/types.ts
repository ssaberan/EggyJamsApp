/** IPC-serializable types mirroring `src/storage/types.ts`. */

export type VariableType = 'boolean' | 'number' | 'string'

export interface VariableDefinition {
  id: string
  name: string
  type: VariableType
  initialValue: boolean | number | string
}

export interface GraphData {
  nodes: unknown[]
  edges: unknown[]
  variables: VariableDefinition[]
  startNodeId?: string | null
}

export interface ProjectMeta {
  id: string
  title: string
  description: string | null
  thumbnailPath: string | null
  createdAt: string
  lastModified: string
}

export interface ProjectData extends ProjectMeta {
  graphData: GraphData
}

export interface ProjectRegistryEntry {
  id: string
  title: string
  path: string
  lastOpened: string
  lastModified: string
}

export type AssetFileType = 'image' | 'audio'

export type AssetCategory = 'Background' | 'Character' | 'BGM' | 'SFX' | 'Prop'

export interface AssetRecord {
  id: string
  fileName: string
  relativePath: string
  fileType: AssetFileType
  category: AssetCategory
  createdAt?: string
}

export type AssetManifest = AssetRecord[]

export interface ListedAsset extends AssetRecord {
  fileUrl: string
}

export type GameVariables = Record<string, boolean | number | string>

export interface SaveSlotMeta {
  slotIndex: number
  createdAt: string | null
  slotName: string | null
  nodeId?: string
  variables?: GameVariables
}

export interface SaveSlotData {
  nodeId: string
  variables: GameVariables
  slotName: string | null
  createdAt: string
}

export type AppTheme = 'light' | 'dark'

export interface AppPreferences {
  theme: AppTheme
}
