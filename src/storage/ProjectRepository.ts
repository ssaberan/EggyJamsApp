import type { ProjectData, ProjectMeta } from './types';

export interface ProjectRepository {
  listProjects(): Promise<ProjectMeta[]>;
  getProject(id: string): Promise<ProjectData | null>;
  createProject(title: string, parentDir?: string): Promise<ProjectData>;
  saveProject(data: ProjectData): Promise<void>;
  deleteProject(id: string): Promise<void>;
  getProjectPath(id: string): Promise<string | null>;
  openProjectFromFolder?(): Promise<string | null>;
  saveProjectAs?(projectId: string): Promise<string | null>;
  getThumbnailUrl(projectId: string): Promise<string | null>;
  saveThumbnail(projectId: string, file: File | Blob): Promise<string>;
}
