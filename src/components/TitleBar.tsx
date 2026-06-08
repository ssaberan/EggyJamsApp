import { useEffect, useState, type CSSProperties } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const TITLE_BAR_HEIGHT = 40;

type DesktopPlatform = 'win32' | 'darwin' | 'linux';
type TitleBarMode = 'native' | 'integrated' | 'custom';

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

function isDesktopPlatform(
  platform: NodeJS.Platform,
): platform is DesktopPlatform {
  return platform === 'win32' || platform === 'darwin' || platform === 'linux';
}

function WindowControls({ maximized }: { maximized: boolean }) {
  return (
    <div className="flex items-center gap-0.5" style={noDragStyle}>
      <button
        type="button"
        onClick={() => void window.electronAPI?.windowMinimize()}
        className="flex h-7 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/90 dark:text-gray-400 dark:hover:bg-white/10"
        aria-label="Minimize"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => void window.electronAPI?.windowMaximize()}
        className="flex h-7 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/90 dark:text-gray-400 dark:hover:bg-white/10"
        aria-label={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? (
          <Copy className="h-3 w-3" strokeWidth={2.25} />
        ) : (
          <Square className="h-3 w-3" strokeWidth={2.25} />
        )}
      </button>
      <button
        type="button"
        onClick={() => void window.electronAPI?.windowClose()}
        className="flex h-7 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-500 hover:text-white dark:text-gray-400 dark:hover:bg-red-500 dark:hover:text-white"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

interface TitleBarProps {
  hidden?: boolean;
}

export default function TitleBar({ hidden = false }: TitleBarProps) {
  const { theme } = useTheme();
  const [platform, setPlatform] = useState<DesktopPlatform | null>(null);
  const [mode, setMode] = useState<TitleBarMode>('native');
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    void Promise.all([api.getPlatform(), api.getTitleBarMode()]).then(
      ([p, titleBarMode]) => {
        if (isDesktopPlatform(p)) setPlatform(p);
        setMode(titleBarMode);
      },
    );

    void api.windowIsMaximized().then(setMaximized);
    return api.onMaximizedChange(setMaximized);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (hidden || mode === 'native') {
      root.classList.remove('has-titlebar');
      root.style.removeProperty('--electron-title-bar-height');
      return;
    }
    root.classList.add('has-titlebar');
    root.style.setProperty(
      '--electron-title-bar-height',
      `${TITLE_BAR_HEIGHT}px`,
    );
    return () => {
      root.classList.remove('has-titlebar');
      root.style.removeProperty('--electron-title-bar-height');
    };
  }, [mode, hidden]);

  if (hidden || !platform || mode === 'native') return null;

  const showControls = mode === 'custom';
  const macInset = platform === 'darwin';

  return (
    <div
      className={`electron-titlebar z-10 flex shrink-0 items-center border-b ${
        theme === 'dark'
          ? 'border-gray-800/80 bg-gray-900/95'
          : 'border-gray-200/80 bg-gray-50/95'
      } ${showControls ? 'justify-end px-2' : macInset ? 'pl-[76px] pr-3' : 'px-3'}`}
      style={{
        height: TITLE_BAR_HEIGHT,
        ...dragStyle,
      }}
    >
      {showControls && <WindowControls maximized={maximized} />}
    </div>
  );
}
