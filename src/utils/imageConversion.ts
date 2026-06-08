import { MagicWebpWorker } from 'magic-webp';
import WorkerUrl from 'magic-webp/worker?worker&url';

// ── Types ──

export interface ConvertedImage {
  /** Bytes to upload (converted WebP, or the original blob if conversion was skipped). */
  blob: Blob;
  /** File name with the extension updated to `.webp` if a conversion happened. */
  fileName: string;
  /** Lower-case extension matching `blob` (no leading dot). */
  ext: string;
  /** True if the bytes are a freshly-encoded WebP. */
  converted: boolean;
}

// ── Singleton worker ──

let workerInstance: MagicWebpWorker | null = null;

function getWorker(): MagicWebpWorker {
  if (!workerInstance) {
    workerInstance = new MagicWebpWorker(WorkerUrl);
  }
  return workerInstance;
}

// ── Helpers ──

const CONVERTIBLE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif']);

function getExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function replaceExt(fileName: string, newExt: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return `${fileName}.${newExt}`;
  return `${fileName.slice(0, dot)}.${newExt}`;
}

/**
 * APNG detection: walk the PNG chunks and return true if an `acTL` chunk
 * appears before the first `IDAT`. Reads only the bytes needed.
 *
 * PNG layout: 8-byte signature, then chunks of:
 *   [4-byte big-endian length][4-byte type][length bytes data][4-byte CRC]
 */
function isAnimatedPng(bytes: Uint8Array): boolean {
  // Validate PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 || bytes[4] !== 0x0d || bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a || bytes[7] !== 0x0a
  ) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const t0 = bytes[offset + 4];
    const t1 = bytes[offset + 5];
    const t2 = bytes[offset + 6];
    const t3 = bytes[offset + 7];

    // 'acTL' = 0x61 0x63 0x54 0x4C
    if (t0 === 0x61 && t1 === 0x63 && t2 === 0x54 && t3 === 0x4c) {
      return true;
    }
    // 'IDAT' = 0x49 0x44 0x41 0x54 — acTL must precede the first IDAT in a valid APNG
    if (t0 === 0x49 && t1 === 0x44 && t2 === 0x41 && t3 === 0x54) {
      return false;
    }

    // Advance: 4 (length) + 4 (type) + length (data) + 4 (CRC)
    offset += 12 + length;
  }

  return false;
}

async function readHead(blob: Blob, byteCount: number): Promise<Uint8Array> {
  const slice = blob.slice(0, Math.min(byteCount, blob.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function passthrough(input: File | Blob, fileName: string): ConvertedImage {
  return {
    blob: input,
    fileName,
    ext: getExt(fileName),
    converted: false,
  };
}

// ── Public API ──

/**
 * Convert PNG / JPEG / GIF (including animated GIF) to WebP via libwebp/WASM.
 *
 * Pass-through cases (return the original bytes unchanged):
 *   - already `.webp`
 *   - audio or any other non-image extension
 *   - animated PNG (libwebp would silently drop the animation)
 *   - the encoded WebP turned out larger than the original
 *   - any thrown error during conversion
 */
export async function convertToWebpIfBeneficial(
  input: File | Blob,
  fileName: string,
  quality = 85,
): Promise<ConvertedImage> {
  const ext = getExt(fileName);

  if (!CONVERTIBLE_EXTS.has(ext)) {
    return passthrough(input, fileName);
  }

  // APNG check — read just enough bytes to walk the early chunks
  if (ext === 'png') {
    try {
      const head = await readHead(input, 64 * 1024);
      if (isAnimatedPng(head)) {
        return passthrough(input, fileName);
      }
    } catch (err) {
      console.warn('[imageConversion] APNG detection failed; uploading original.', err);
      return passthrough(input, fileName);
    }
  }

  try {
    const worker = getWorker();
    const webpBlob = await worker.convert(input, quality, false);

    if (!webpBlob || webpBlob.size === 0 || webpBlob.size >= input.size) {
      return passthrough(input, fileName);
    }

    return {
      blob: webpBlob,
      fileName: replaceExt(fileName, 'webp'),
      ext: 'webp',
      converted: true,
    };
  } catch (err) {
    console.warn(
      `[imageConversion] WebP conversion failed for ${fileName}; uploading original.`,
      err,
    );
    return passthrough(input, fileName);
  }
}
