import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Player from './pages/Player';
import { useGameStore } from './stores/gameStore';
import './index.css';

/**
 * Offline runner entry point.
 *
 * Reads pre-loaded game data from window.GAME_DATA (injected at export time)
 * and renders the Player component inside a MemoryRouter
 * (BrowserRouter doesn't work on file:// protocol).
 */
function OfflineRunner() {
  const loadFromData = useGameStore((s) => s.loadFromData);

  useEffect(() => {
    if (window.GAME_DATA) {
      loadFromData(window.GAME_DATA);
    }
  }, [loadFromData]);

  return (
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<Player />} />
      </Routes>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfflineRunner />
  </StrictMode>,
);
