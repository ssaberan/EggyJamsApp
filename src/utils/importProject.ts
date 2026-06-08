import { projectRepository } from '../storage';
import type { GraphData } from '../storage';
import { importProjectFromZip } from './importProjectFromZip';

export async function importProjectFile(
  file: File,
  parentDir?: string,
): Promise<string> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    return importProjectFromZip(file, parentDir);
  }

  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      graph_data?: GraphData;
      project_metadata?: { title?: string; description?: string | null };
    };

    if (
      !parsed.graph_data ||
      !Array.isArray(parsed.graph_data.nodes) ||
      !Array.isArray(parsed.graph_data.edges)
    ) {
      throw new Error(
        'Invalid project file: missing graph_data with nodes and edges arrays.',
      );
    }

    const title = parsed.project_metadata?.title
      ? `${parsed.project_metadata.title} (Imported)`
      : 'Imported Project';

    const project = await projectRepository.createProject(title, parentDir);
    await projectRepository.saveProject({
      ...project,
      description: parsed.project_metadata?.description ?? null,
      graphData: parsed.graph_data,
    });

    return project.id;
  }

  throw new Error('Unsupported file type. Please select a .zip or .json file.');
}
