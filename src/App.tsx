import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { useDesktopMenu } from './hooks/useDesktopMenu';
import { useImmersiveWindow } from './hooks/useImmersiveWindow';
import TitleBar from './components/TitleBar';
import MainLayout from './layouts/MainLayout';
import EditorLayout from './layouts/EditorLayout';

import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Player from './pages/Player';

function AppRoutes() {
  useDesktopMenu();

  return (
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
          </Route>

          <Route path="editor/:projectId" element={<EditorLayout />}>
            <Route index element={<Editor />} />
          </Route>

          <Route path="play/:gameId" element={<Player />} />
        </Routes>
  );
}

function ElectronShell() {
  const { pathname } = useLocation();
  const immersive = pathname.startsWith('/play/');

  useImmersiveWindow(immersive);

  return (
    <div className="electron-shell">
      <TitleBar hidden={immersive} />
      <div className="electron-shell-content">
        <AppRoutes />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <ElectronShell />
      </HashRouter>
    </ThemeProvider>
  );
}
