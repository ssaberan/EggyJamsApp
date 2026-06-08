export interface DesktopMenuHandlers {
  flushSave?: () => Promise<boolean>;
  exportZip?: () => Promise<void>;
  exportWindows?: () => Promise<void>;
  exportMac?: () => Promise<void>;
  undo?: () => void;
  redo?: () => void;
  getActiveProjectId?: () => string | undefined;
  onNewProject?: () => void;
}

const handlers: DesktopMenuHandlers = {};

export function setDesktopMenuHandlers(patch: Partial<DesktopMenuHandlers>): void {
  Object.assign(handlers, patch);
}

export function clearDesktopMenuHandlers(
  keys: (keyof DesktopMenuHandlers)[],
): void {
  for (const key of keys) {
    delete handlers[key];
  }
}

export function getDesktopMenuHandlers(): DesktopMenuHandlers {
  return handlers;
}
