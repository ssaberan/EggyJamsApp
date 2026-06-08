import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

function offlineRunnerRoot(): string {
  return path.join(app.getAppPath(), 'dist', 'offline-runner')
}

/**
 * Read a file from `dist/offline-runner/` (e.g. `runner.html`, `assets/runner-*.js`).
 */
export async function readOfflineRunnerFile(relativePath: string): Promise<string> {
  const normalized = relativePath.replace(/^\.\//, '').replace(/^\/+/, '')
  const root = path.resolve(offlineRunnerRoot())
  const filePath = path.resolve(root, normalized)

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    throw new Error(`Invalid offline runner path: ${relativePath}`)
  }

  return fs.readFile(filePath, 'utf8')
}
