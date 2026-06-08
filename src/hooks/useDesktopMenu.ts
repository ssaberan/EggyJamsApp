import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getDesktopMenuHandlers } from '../desktop/menuBridge';
import type { ElectronAPI, MenuActionPayload } from '../types/electron.d';
import { importProjectFile } from '../utils/importProject';

export function useDesktopMenu(): void {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const raw = window.electronAPI;
    if (!raw?.onMenuAction) return;
    const electron: ElectronAPI = raw;

    async function handleMenuAction({ action, projectId }: MenuActionPayload) {
      const handlers = getDesktopMenuHandlers();
      const activeProjectId =
        projectId ?? handlers.getActiveProjectId?.() ?? routeProjectId;

      switch (action) {
        case 'new-project':
          if (handlers.onNewProject) {
            handlers.onNewProject();
          } else {
            navigate('/', { state: { openNewProject: true } });
          }
          break;

        case 'open-project': {
          const id = await electron.openProjectFromFolder();
          if (id) navigate(`/editor/${id}`);
          break;
        }

        case 'open-recent':
          if (projectId) navigate(`/editor/${projectId}`);
          break;

        case 'save':
          await handlers.flushSave?.();
          break;

        case 'save-as': {
          if (!activeProjectId) break;
          await handlers.flushSave?.();
          const newId = await electron.saveProjectAs(activeProjectId);
          if (newId) {
            electron.refreshMenu();
            navigate(`/editor/${newId}`);
          }
          break;
        }

        case 'save-and-close': {
          const saved = (await handlers.flushSave?.()) ?? false;
          if (saved) {
            electron.notifySaveFinished();
          }
          break;
        }

        case 'export-zip':
          await handlers.exportZip?.();
          break;

        case 'export-windows':
          await handlers.exportWindows?.();
          break;

        case 'export-mac':
          await handlers.exportMac?.();
          break;

        case 'import-project': {
          const picked = await electron.pickImportFile();
          if (!picked) break;
          const baseName =
            picked.filePath.split(/[/\\]/).pop() ?? 'import.zip';
          const file = new File([picked.buffer], baseName);
          try {
            const importedProjectId = await importProjectFile(file);
            electron.refreshMenu();
            navigate(`/editor/${importedProjectId}`);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Import failed';
            console.error('Import failed:', err);
            window.alert(`Import failed: ${message}`);
          }
          break;
        }

        case 'close-project':
          navigate('/');
          electron.setProjectTitle(null);
          electron.setDirty(false);
          break;

        case 'undo':
          handlers.undo?.();
          break;

        case 'redo':
          handlers.redo?.();
          break;

        case 'toggle-theme':
          toggleTheme();
          break;

        case 'about':
          break;

        default:
          break;
      }
    }

    const unsubscribe = electron.onMenuAction((payload: MenuActionPayload) => {
      void handleMenuAction(payload);
    });

    return unsubscribe;
  }, [navigate, routeProjectId, toggleTheme]);
}
