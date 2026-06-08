import { ipcRenderer } from 'electron'

type GameDataLike = {
  nodes?: unknown
  edges?: unknown
  variables?: unknown
  startNodeId?: unknown
  assetMap?: unknown
}

function sendLog(event: string, details?: unknown): void {
  try {
    ipcRenderer.send('player-log', { event, details })
  } catch {
    // Logging must never break the exported game.
  }
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  return value
}

function summarizeGameData(data: GameDataLike | undefined): Record<string, unknown> | null {
  if (!data) return null
  return {
    nodes: Array.isArray(data.nodes) ? data.nodes.length : typeof data.nodes,
    edges: Array.isArray(data.edges) ? data.edges.length : typeof data.edges,
    variables: Array.isArray(data.variables)
      ? data.variables.length
      : typeof data.variables,
    startNodeId: data.startNodeId ?? null,
    assetCount:
      data.assetMap && typeof data.assetMap === 'object'
        ? Object.keys(data.assetMap).length
        : null,
  }
}

function captureDomSnapshot(label: string): void {
  const data = (window as typeof window & { GAME_DATA?: GameDataLike }).GAME_DATA
  const root = document.getElementById('root')
  sendLog('dom-snapshot', {
    label,
    location: window.location.href,
    readyState: document.readyState,
    bodyText: document.body?.innerText.slice(0, 500) ?? null,
    bodyHtmlLength: document.body?.innerHTML.length ?? null,
    rootChildCount: root?.childElementCount ?? null,
    rootText: root?.innerText.slice(0, 500) ?? null,
    rootHtmlLength: root?.innerHTML.length ?? null,
    gameData: summarizeGameData(data),
  })
}

sendLog('preload-ready', {
  location: window.location.href,
  readyState: document.readyState,
})

window.addEventListener('error', (event) => {
  sendLog('window-error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: serializeError(event.error),
  })
})

window.addEventListener('unhandledrejection', (event) => {
  sendLog('unhandled-rejection', serializeError(event.reason))
})

window.addEventListener('DOMContentLoaded', () => {
  captureDomSnapshot('dom-content-loaded')
  setTimeout(() => captureDomSnapshot('after-1s'), 1000)
  setTimeout(() => captureDomSnapshot('after-5s'), 5000)
})
