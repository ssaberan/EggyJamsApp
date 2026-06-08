import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { assetRepository, projectRepository } from '../storage';
import { useGraphStore } from '../stores/graphStore';
import { flattenSubgraphs } from '../stores/gameStore';

export type GamePackagePlatform = 'windows' | 'mac';

export interface OfflineGameFile {
  relativePath: string;
  data: ArrayBuffer;
}

export interface OfflineGameBundle {
  title: string;
  safeName: string;
  files: OfflineGameFile[];
}

/**
 * Assemble the current project into the same portable files used by all exports.
 *
 * The files contain:
 *   index.html   – self-contained runner HTML with inlined JS/CSS + game data
 *   assets/      – all game images and audio files
 */
export async function assembleOfflineGame(
  projectId: string,
): Promise<OfflineGameBundle> {
  const project = await projectRepository.getProject(projectId);
  const title = project?.title ?? 'Untitled';

  const { nodes, edges, variables, startNodeId } = useGraphStore.getState();

  const assetList = await assetRepository.listAssets(projectId);

  const localAssetMap: Record<string, string> = {};
  const assetFiles: OfflineGameFile[] = [];
  const usedFilenames = new Set<string>();

  await Promise.all(
    assetList.map(async (asset) => {
      try {
        const response = await fetch(asset.fileUrl);
        if (!response.ok) return;

        const blob = await response.blob();

        let filename =
          asset.fileName ||
          asset.relativePath.split('/').pop() ||
          asset.id;

        if (usedFilenames.has(filename)) {
          const ext = filename.includes('.')
            ? '.' + filename.split('.').pop()
            : '';
          const base = filename.includes('.')
            ? filename.slice(0, filename.lastIndexOf('.'))
            : filename;
          let counter = 1;
          while (usedFilenames.has(`${base}_${counter}${ext}`)) counter++;
          filename = `${base}_${counter}${ext}`;
        }
        usedFilenames.add(filename);

        const localPath = `assets/${filename}`;
        localAssetMap[asset.id] = `./${localPath}`;
        assetFiles.push({
          relativePath: localPath,
          data: await blob.arrayBuffer(),
        });
      } catch {
        // Skip assets that fail to fetch
      }
    }),
  );

  let runnerHtml = await loadRunnerHtml();

  const { nodes: flatNodes, edges: flatEdges } = flattenSubgraphs(nodes, edges);

  const gameData = {
    nodes: flatNodes,
    edges: flatEdges,
    variables,
    assetMap: localAssetMap,
    startNodeId,
  };

  const dataScript = `<script>window.GAME_DATA = ${serializeForScript(gameData)};</script>`;
  runnerHtml = runnerHtml.replace(
    '</head>',
    () => `${dataScript}\n</head>`,
  );
  runnerHtml = runnerHtml.replace(
    /<title>[^<]*<\/title>/,
    () => `<title>${escapeHtml(title)}</title>`,
  );
  runnerHtml = await inlineAssets(runnerHtml, readBundledFile);

  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'game';

  return {
    title,
    safeName,
    files: [
      { relativePath: 'index.html', data: textToArrayBuffer(runnerHtml) },
      ...assetFiles,
    ],
  };
}

/**
 * Export the current project as a standalone offline .zip file.
 */
export async function exportGameToZip(projectId: string): Promise<void> {
  const { safeName, files } = await assembleOfflineGame(projectId);

  const zip = new JSZip();

  for (const { relativePath, data } of files) {
    zip.file(relativePath, data);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  if (window.electronAPI?.pickExportZipPath && window.electronAPI.writeFile) {
    const filePath = await window.electronAPI.pickExportZipPath(safeName);
    if (!filePath) return;
    const buffer = await zipBlob.arrayBuffer();
    await window.electronAPI.writeFile(filePath, buffer);
    return;
  }

  saveAs(zipBlob, `${safeName}.zip`);
}

export async function exportGameToWindowsExe(projectId: string): Promise<void> {
  await exportGamePackage(projectId, 'windows');
}

export async function exportGameToMacApp(projectId: string): Promise<void> {
  await exportGamePackage(projectId, 'mac');
}

async function exportGamePackage(
  projectId: string,
  platform: GamePackagePlatform,
): Promise<void> {
  if (!window.electronAPI?.packageOfflineGame) {
    throw new Error('Executable exports are only available in the desktop app.');
  }

  const bundle = await assembleOfflineGame(projectId);
  const outputPath =
    platform === 'windows'
      ? await window.electronAPI.pickExportWindowsExePath(bundle.safeName)
      : await window.electronAPI.pickExportMacZipPath(bundle.safeName);

  if (!outputPath) return;

  await window.electronAPI.packageOfflineGame({
    platform,
    outputPath,
    title: bundle.title,
    safeName: bundle.safeName,
    files: bundle.files,
  });
}

type ReadBundledFile = (relativePath: string) => Promise<string | null>;

function textToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

async function loadRunnerHtml(): Promise<string> {
  if (window.electronAPI?.readOfflineRunnerFile) {
    return window.electronAPI.readOfflineRunnerFile('runner.html');
  }

  const runnerHtmlResponse = await fetch('/offline-runner/runner.html');
  if (!runnerHtmlResponse.ok) {
    throw new Error(
      `Failed to fetch runner HTML (${runnerHtmlResponse.status}). ` +
        'Make sure the project has been built with the runner config.',
    );
  }
  return runnerHtmlResponse.text();
}

async function readBundledFile(relativePath: string): Promise<string | null> {
  const normalized = normalizeRunnerPath(relativePath);

  if (window.electronAPI?.readOfflineRunnerFile) {
    try {
      return await window.electronAPI.readOfflineRunnerFile(normalized);
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(`/offline-runner/${normalized}`);
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

function normalizeRunnerPath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/offline-runner/')) {
    return path.slice('/offline-runner/'.length);
  }
  if (path.startsWith('/')) {
    return path.slice(1);
  }
  return path.replace(/^\.\//, '');
}

/**
 * Parse the HTML for <script> and <link> tags, read their content,
 * and replace the tags with inline equivalents.
 */
async function inlineAssets(
  html: string,
  readFile: ReadBundledFile,
): Promise<string> {
  const scriptRegex =
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
  const scriptMatches = [...html.matchAll(scriptRegex)];

  for (const match of scriptMatches) {
    const [fullTag, srcPath] = match;
    const content = await readFile(srcPath);
    if (content !== null) {
      const isModule =
        fullTag.includes('type="module"') || fullTag.includes("type='module'");
      const inlineTag = isModule
        ? `<script type="module">${escapeScriptContent(content)}</script>`
        : `<script>${escapeScriptContent(content)}</script>`;
      html = html.replace(fullTag, () => inlineTag);
    }
  }

  const linkRegex =
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi;
  const linkMatches = [...html.matchAll(linkRegex)];

  for (const match of linkMatches) {
    const [fullTag, hrefPath] = match;
    const content = await readFile(hrefPath);
    if (content !== null) {
      html = html.replace(fullTag, () => `<style>${content}</style>`);
    }
  }

  const linkRegex2 =
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*\/?>/gi;
  const linkMatches2 = [...html.matchAll(linkRegex2)];

  for (const match of linkMatches2) {
    const [fullTag, hrefPath] = match;
    if (!html.includes(fullTag)) continue;
    const content = await readFile(hrefPath);
    if (content !== null) {
      html = html.replace(fullTag, () => `<style>${content}</style>`);
    }
  }

  return html;
}

function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeScriptContent(content: string): string {
  return content.replace(/<\/script/gi, '<\\/script');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
