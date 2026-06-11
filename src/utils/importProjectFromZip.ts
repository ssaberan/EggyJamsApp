import JSZip from 'jszip';
import type { Node } from '@xyflow/react';
import { assetRepository, projectRepository } from '../storage';
import type { GraphData } from '../storage';
import { detectFileType, getFileExtension } from '../stores/assetStore';
import { convertToWebpIfBeneficial } from './imageConversion';

interface GameData {
  nodes: Node[];
  edges: unknown[];
  variables: unknown[];
  assetMap: Record<string, string>;
  startNodeId?: string | null;
}

/**
 * Import a project from a .zip file produced by "Download Offline (.zip)".
 *
 * The zip is expected to contain:
 *   index.html  – with <script>window.GAME_DATA = { nodes, edges, variables, assetMap };</script>
 *   assets/     – referenced image and audio files
 *
 * @returns The new project ID.
 */
export async function importProjectFromZip(
  file: File,
  parentDir?: string,
): Promise<string> {
  const zip = await JSZip.loadAsync(file);

  const indexFile = zip.file('index.html');
  if (!indexFile) {
    throw new Error('Invalid zip: missing index.html');
  }

  const html = await indexFile.async('string');

  const gameData = extractGameData(html);
  if (!gameData) {
    throw new Error(
      'Invalid zip: could not extract game data from index.html',
    );
  }

  const { nodes, edges, variables, assetMap, startNodeId } = gameData;

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : 'Untitled';
  const title = `${rawTitle} (Imported)`;

  const project = await projectRepository.createProject(title, parentDir);
  const projectId = project.id;

  const idMap: Record<string, string> = {};

  const assetEntries = Object.entries(assetMap);
  for (let i = 0; i < assetEntries.length; i++) {
    const [oldAssetId, localPath] = assetEntries[i];

    const zipPath = localPath.replace(/^\.\//, '');
    const assetFile = zip.file(zipPath);

    if (!assetFile) {
      console.warn(`[importProjectFromZip] Missing asset in zip: ${zipPath}`);
      continue;
    }

    const originalName = zipPath.split('/').pop() ?? oldAssetId;
    const fileType = detectFileType(originalName);

    if (!fileType) {
      console.warn(
        `[importProjectFromZip] Unsupported file type for: ${originalName}`,
      );
      continue;
    }

    const rawBlob = await assetFile.async('blob');

    const converted =
      fileType === 'image'
        ? await convertToWebpIfBeneficial(rawBlob, originalName)
        : {
            blob: rawBlob,
            fileName: originalName,
            ext: getFileExtension(originalName),
            converted: false,
          };

    const uploadFile = new File([converted.blob], converted.fileName, {
      type: converted.blob.type || 'application/octet-stream',
    });

    const newAssetId = await assetRepository.uploadAsset(
      projectId,
      uploadFile,
    );
    idMap[oldAssetId] = newAssetId;
  }

  const remappedNodes = remapAssetIds(nodes, idMap);

  const graphData: GraphData = {
    nodes: remappedNodes,
    edges: edges as GraphData['edges'],
    variables: variables as GraphData['variables'],
    startNodeId: startNodeId ?? null,
  };

  await projectRepository.saveProject({
    ...project,
    title,
    graphData,
    lastModified: new Date().toISOString(),
  });

  return projectId;
}

function extractGameData(html: string): GameData | null {
  const match = html.match(
    /<script>\s*window\.GAME_DATA\s*=\s*([\s\S]*?);\s*<\/script>/,
  );
  if (!match?.[1]) return null;

  try {
    const data = JSON.parse(match[1]);
    if (
      !Array.isArray(data.nodes) ||
      !Array.isArray(data.edges) ||
      typeof data.assetMap !== 'object'
    ) {
      return null;
    }
    return data as GameData;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function remapAssetIds(
  nodes: Node[],
  idMap: Record<string, string>,
): Node[] {
  if (Object.keys(idMap).length === 0) return nodes;

  return nodes.map((node) => {
    const d = { ...node.data } as Record<string, unknown>;

    if (
      typeof d.backgroundImageId === 'string' &&
      idMap[d.backgroundImageId]
    ) {
      d.backgroundImageId = idMap[d.backgroundImageId];
    }
    if (
      typeof d.backgroundMusicId === 'string' &&
      idMap[d.backgroundMusicId]
    ) {
      d.backgroundMusicId = idMap[d.backgroundMusicId];
    }

    if (Array.isArray(d.dialogueBlocks)) {
      d.dialogueBlocks = (d.dialogueBlocks as Record<string, unknown>[]).map(
        (block) => {
          if (block.type !== 'text') return block;
          const updated = { ...block };

          if (
            typeof updated.spriteId === 'string' &&
            idMap[updated.spriteId]
          ) {
            updated.spriteId = idMap[updated.spriteId];
          }

          if (Array.isArray(updated.characters)) {
            updated.characters = (
              updated.characters as Record<string, unknown>[]
            ).map((slot) => {
              if (typeof slot.spriteId === 'string' && idMap[slot.spriteId]) {
                return { ...slot, spriteId: idMap[slot.spriteId] };
              }
              return slot;
            });
          }

          return updated;
        },
      );
    }

    if (Array.isArray(d.cutsceneEvents)) {
      d.cutsceneEvents = (d.cutsceneEvents as Record<string, unknown>[]).map(
        (evt) => {
          const props = {
            ...(evt.properties as Record<string, unknown>),
          };
          if (typeof props.assetId === 'string' && idMap[props.assetId]) {
            props.assetId = idMap[props.assetId];
          }
          if (typeof props.spriteId === 'string' && idMap[props.spriteId]) {
            props.spriteId = idMap[props.spriteId];
          }
          return { ...evt, properties: props };
        },
      );
    }

    if (d.cutsceneData && typeof d.cutsceneData === 'object') {
      const cd = d.cutsceneData as Record<string, unknown>;
      if (Array.isArray(cd.clips)) {
        cd.clips = (cd.clips as Record<string, unknown>[]).map((clip) => {
          const updated = { ...clip };
          if (typeof updated.assetId === 'string' && idMap[updated.assetId]) {
            updated.assetId = idMap[updated.assetId];
          }
          return updated;
        });
        d.cutsceneData = cd;
      }
    }

    if (Array.isArray(d.staticAssets)) {
      d.staticAssets = (d.staticAssets as Record<string, unknown>[]).map(
        (sa) => {
          if (typeof sa.assetId === 'string' && idMap[sa.assetId]) {
            return { ...sa, assetId: idMap[sa.assetId] };
          }
          return sa;
        },
      );
    }

    if (d.gameplaySettings && typeof d.gameplaySettings === 'object') {
      const gs = { ...(d.gameplaySettings as Record<string, unknown>) };
      const spriteFields = [
        'backgroundImageId',
        'backgroundMusicId',
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
      for (const field of spriteFields) {
        if (typeof gs[field] === 'string' && idMap[gs[field] as string]) {
          gs[field] = idMap[gs[field] as string];
        }
      }
      d.gameplaySettings = gs;
    }

    return { ...node, data: d };
  });
}
