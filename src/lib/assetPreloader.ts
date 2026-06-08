/**
 * Module-level singleton that preloads images/audio by URL, tracks readiness,
 * holds strong references to decoded media so the browser keeps them resident,
 * and notifies subscribers on any change.
 */

type Status = 'loading' | 'ready' | 'error';
type MediaFileType = 'image' | 'audio';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac']);
const CUSTOM_PROTOCOL = 'eggyjams:';

/** Hint file type for URLs without a path extension (e.g. eggyjams://). */
const urlFileTypes = new Map<string, MediaFileType>();

export function setUrlFileType(url: string, type: MediaFileType): void {
  urlFileTypes.set(url, type);
}

const status = new Map<string, Status>();
const inflight = new Map<string, Promise<void>>();
const cache = new Map<string, HTMLImageElement | HTMLAudioElement>();

let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version++;
  for (const listener of listeners) listener();
}

function getExtension(url: string): string {
  try {
    const parsed = new URL(url, 'http://placeholder.local');
    const path = parsed.pathname;
    const dot = path.lastIndexOf('.');
    if (dot === -1) return '';
    return path.slice(dot + 1).toLowerCase();
  } catch {
    return '';
  }
}

function preloadImage(url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(url, img);
      status.set(url, 'ready');
      notify();
      resolve();
    };
    img.onerror = () => {
      status.set(url, 'error');
      notify();
      resolve();
    };
    img.src = url;
  });
}

function preloadAudio(url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';
    const onReady = () => {
      cleanup();
      cache.set(url, audio);
      status.set(url, 'ready');
      notify();
      resolve();
    };
    const onError = () => {
      cleanup();
      status.set(url, 'error');
      notify();
      resolve();
    };
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };
    audio.addEventListener('canplaythrough', onReady);
    audio.addEventListener('error', onError);
    audio.src = url;
    // Some browsers require an explicit load() to start fetching when not in DOM.
    audio.load();
  });
}

function preloadGeneric(url: string): Promise<void> {
  return fetch(url)
    .then(() => {
      status.set(url, 'ready');
      notify();
    })
    .catch(() => {
      status.set(url, 'error');
      notify();
    });
}

/** eggyjams:// URLs have no extension; try image then audio. */
function preloadCustomProtocol(url: string): Promise<void> {
  return preloadImage(url).then(() => {
    if (status.get(url) === 'ready') return;
    status.delete(url);
    cache.delete(url);
    return preloadAudio(url);
  });
}

function resolveMediaType(url: string): 'image' | 'audio' | 'generic' {
  const hinted = urlFileTypes.get(url);
  if (hinted) return hinted;

  const ext = getExtension(url);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';

  try {
    if (new URL(url).protocol === CUSTOM_PROTOCOL) return 'image';
  } catch {
    // ignore
  }

  return 'generic';
}

/**
 * Idempotently preload a single URL. Returns the existing promise if a load is
 * already in flight, or a resolved promise if the URL is already ready.
 */
export function preload(url: string): Promise<void> {
  const existing = inflight.get(url);
  if (existing) return existing;
  if (status.get(url) === 'ready') return Promise.resolve();

  status.set(url, 'loading');
  notify();

  const mediaType = resolveMediaType(url);
  let promise: Promise<void>;
  if (mediaType === 'image') {
    promise =
      urlFileTypes.get(url) === undefined &&
      new URL(url, 'http://placeholder.local').protocol === CUSTOM_PROTOCOL
        ? preloadCustomProtocol(url)
        : preloadImage(url);
  } else if (mediaType === 'audio') {
    promise = preloadAudio(url);
  } else {
    promise = preloadGeneric(url);
  }

  const tracked = promise.finally(() => {
    inflight.delete(url);
  });
  inflight.set(url, tracked);
  return tracked;
}

export function preloadMany(urls: Iterable<string>): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const url of urls) promises.push(preload(url));
  return Promise.allSettled(promises).then(() => undefined);
}

export function isReady(url: string): boolean {
  return status.get(url) === 'ready';
}

export function areAllReady(urls: Iterable<string>): boolean {
  for (const url of urls) {
    if (status.get(url) !== 'ready') return false;
  }
  return true;
}

export function countReady(urls: Iterable<string>): number {
  let count = 0;
  for (const url of urls) {
    if (status.get(url) === 'ready') count++;
  }
  return count;
}

/**
 * Drop status, in-flight, and cached entries for any URL not in `keep`. This
 * frees the strong refs to decoded image/audio elements so the browser can
 * reclaim memory. Errored URLs not in the keep set are also cleared so future
 * navigation retries them. In-flight loads are left to resolve and are dropped
 * on completion.
 */
export function retain(keep: Iterable<string>): void {
  const keepSet = keep instanceof Set ? keep : new Set(keep);
  let changed = false;

  for (const url of Array.from(status.keys())) {
    if (!keepSet.has(url)) {
      status.delete(url);
      cache.delete(url);
      changed = true;
    }
  }

  if (changed) notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}
