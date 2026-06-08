import { app, BrowserWindow, ipcMain } from 'electron'
import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

const GAME_INDEX_PATH = path.join(process.resourcesPath, 'game', 'index.html')
const PRELOAD_PATH = path.join(__dirname, 'preload.js')

let logFilePath = ''

function initializeLogging(): void {
  const logDir = path.join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })
  logFilePath = path.join(logDir, 'player-debug.log')
  log('session-start', {
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    resourcesPath: process.resourcesPath,
    gameIndexPath: GAME_INDEX_PATH,
    preloadPath: PRELOAD_PATH,
  })
}

function log(event: string, details?: unknown): void {
  const line = `[${new Date().toISOString()}] ${event}${
    details === undefined ? '' : ` ${safeJson(details)}`
  }\n`

  try {
    if (logFilePath) {
      appendFileSync(logFilePath, line, 'utf8')
    } else {
      console.info(line.trimEnd())
    }
  } catch (err) {
    console.error('Failed to write EggyJams player log:', err)
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        }
      }
      return item
    })
  } catch {
    return String(value)
  }
}

function createWindow(): void {
  log('create-window')
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'EggyJams Game',
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      preload: PRELOAD_PATH,
    },
  })

  win.webContents.setBackgroundThrottling(false)
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log('renderer-console', { level, message, line, sourceId })
  })
  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log('did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      })
      if (isMainFrame) {
        showLoadError(
          win,
          `Failed to load the exported game (${errorCode}): ${errorDescription}`,
        )
      }
    },
  )
  win.webContents.on('did-start-loading', () => log('did-start-loading'))
  win.webContents.on('dom-ready', () => {
    log('dom-ready')
    captureRendererSnapshot(win, 'dom-ready')
  })
  win.webContents.on('did-finish-load', () => {
    log('did-finish-load')
    captureRendererSnapshot(win, 'did-finish-load')
    setTimeout(() => captureRendererSnapshot(win, 'after-2s'), 2000)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log('render-process-gone', details)
  })
  win.webContents.on('unresponsive', () => log('window-unresponsive'))
  win.webContents.on('responsive', () => log('window-responsive'))

  ipcMain.on('player-log', (_event, details: unknown) => {
    log('renderer-log', details)
  })

  log('game-index-check', getFileInfo(GAME_INDEX_PATH))
  log('preload-check', getFileInfo(PRELOAD_PATH))

  if (!existsSync(GAME_INDEX_PATH)) {
    showLoadError(
      win,
      'Could not find the exported game files. Extract the full Windows zip before running the game exe.',
    )
    return
  }

  void win
    .loadFile(GAME_INDEX_PATH)
    .then(() => log('loadFile-resolved'))
    .catch((err: unknown) => {
      log('loadFile-rejected', err)
      const message = err instanceof Error ? err.message : String(err)
      showLoadError(win, `Failed to open the exported game: ${message}`)
    })
}

function getFileInfo(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return { path: filePath, exists: false }
  const stats = statSync(filePath)
  return {
    path: filePath,
    exists: true,
    size: stats.size,
    mtime: stats.mtime.toISOString(),
  }
}

function captureRendererSnapshot(win: BrowserWindow, label: string): void {
  const script = `
(() => {
  const data = window.GAME_DATA;
  const root = document.getElementById('root');
  return {
    label: ${JSON.stringify(label)},
    location: window.location.href,
    title: document.title,
    readyState: document.readyState,
    bodyText: document.body ? document.body.innerText.slice(0, 500) : null,
    bodyHtmlLength: document.body ? document.body.innerHTML.length : null,
    rootChildCount: root ? root.childElementCount : null,
    rootText: root ? root.innerText.slice(0, 500) : null,
    rootHtmlLength: root ? root.innerHTML.length : null,
    scripts: Array.from(document.scripts).map((script) => ({
      src: script.src,
      type: script.type,
      inlineLength: script.src ? 0 : script.textContent.length,
    })),
    stylesheets: Array.from(document.styleSheets).length,
    gameData: data ? {
      nodes: Array.isArray(data.nodes) ? data.nodes.length : typeof data.nodes,
      edges: Array.isArray(data.edges) ? data.edges.length : typeof data.edges,
      variables: Array.isArray(data.variables) ? data.variables.length : typeof data.variables,
      startNodeId: data.startNodeId ?? null,
      assetCount: data.assetMap && typeof data.assetMap === 'object' ? Object.keys(data.assetMap).length : null,
    } : null,
  };
})()
`

  void win.webContents.executeJavaScript(script, true).then(
    (snapshot: unknown) => log('renderer-snapshot', snapshot),
    (err: unknown) => log('renderer-snapshot-failed', err),
  )
}

function showLoadError(win: BrowserWindow, message: string): void {
  const escapedMessage = escapeHtml(message)
  const escapedPath = escapeHtml(GAME_INDEX_PATH)
  const escapedLogPath = escapeHtml(logFilePath || 'Debug log path unavailable')
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Could not load game</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #111827;
        color: #f9fafb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 680px;
        padding: 32px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        background: rgba(17, 24, 39, 0.9);
        box-shadow: 0 20px 80px rgba(0, 0, 0, 0.35);
      }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { color: #d1d5db; line-height: 1.5; }
      code {
        display: block;
        margin-top: 12px;
        padding: 12px;
        overflow-wrap: anywhere;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.35);
        color: #bfdbfe;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Could not load this EggyJams game</h1>
      <p>${escapedMessage}</p>
      <p>If this game came in a zip file, choose <strong>Extract All</strong> first, then run the exe from the extracted folder.</p>
      <code>${escapedPath}</code>
      <p>Debug log:</p>
      <code>${escapedLogPath}</code>
    </main>
  </body>
</html>`

  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

void app.whenReady().then(() => {
  initializeLogging()
  process.on('uncaughtException', (err) => log('main-uncaught-exception', err))
  process.on('unhandledRejection', (reason) =>
    log('main-unhandled-rejection', reason),
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
