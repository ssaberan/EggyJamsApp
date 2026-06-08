import { useEffect } from 'react';

/** Enter true OS fullscreen while the player route is active (desktop only). */
export function useImmersiveWindow(immersive: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('immersive-play', immersive);

    const api = window.electronAPI;
    if (!api) {
      return () => {
        root.classList.remove('immersive-play');
      };
    }

    api.setImmersivePlay(immersive);
    return () => {
      api.setImmersivePlay(false);
      root.classList.remove('immersive-play');
    };
  }, [immersive]);
}
