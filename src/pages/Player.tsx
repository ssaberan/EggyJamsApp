import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Home, Monitor, RotateCw, RotateCcw, ChevronDown } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import SaveMenu from '../components/player/SaveMenu';
import GameStage from '../components/player/GameStage';
import GameplayViewport from '../components/player/GameplayViewport';
import CustomSceneViewport from '../components/player/CustomSceneViewport';
import {
  BG_POSITION_CSS,
  type SceneNodeData,
  type Hotspot,
  type GameplayHotspot,
  type GameplayStaticAsset,
  type ChoiceOption,
  type SceneTimer,
  type BackgroundSizeMode,
  type BackgroundPosition,
  type CharacterPosition,
  type CharacterAnimation,
} from '../stores/graphStore';
import { interpolateTransform, interpolateCamera, interpolateVolume } from '../utils/cutsceneInterpolation';
import { useTypewriter } from '../hooks/useTypewriter';
import { useNodeAssetsReady } from '../hooks/useNodeAssetsReady';

// ── Character animation helpers ──

const CHAR_ANIM_DURATION = 450;

interface DisplaySprite {
  url: string;
  position: CharacterPosition;
  enterAnimation: CharacterAnimation;
  exitAnimation: CharacterAnimation;
  phase: 'enter' | 'idle' | 'exit';
  started: boolean;
}

function getCharAnimStyle(sprite: DisplaySprite): React.CSSProperties {
  const anim =
    sprite.phase === 'enter' ? sprite.enterAnimation
    : sprite.phase === 'exit' ? sprite.exitAnimation
    : 'none';

  if (anim === 'none' || sprite.phase === 'idle') return {};

  const slideX = (sprite.position === 'left-1' || sprite.position === 'left-2') ? '-30vw' : '30vw';
  const hasFade = anim === 'fade' || anim === 'fade-and-slide';
  const hasSlide = anim === 'slide' || anim === 'fade-and-slide';

  if (sprite.phase === 'enter') {
    if (!sprite.started) {
      return {
        opacity: hasFade ? 0 : 1,
        transform: hasSlide ? `translateX(${slideX})` : undefined,
      };
    }
    return {
      opacity: 1,
      transform: 'translateX(0)',
      transition: `opacity ${CHAR_ANIM_DURATION}ms ease-out, transform ${CHAR_ANIM_DURATION}ms ease-out`,
    };
  }

  if (!sprite.started) {
    return {
      opacity: 1,
      transform: 'translateX(0)',
      transition: `opacity ${CHAR_ANIM_DURATION}ms ease-in, transform ${CHAR_ANIM_DURATION}ms ease-in`,
    };
  }
  return {
    opacity: hasFade ? 0 : 1,
    transform: hasSlide ? `translateX(${slideX})` : 'translateX(0)',
    transition: `opacity ${CHAR_ANIM_DURATION}ms ease-in, transform ${CHAR_ANIM_DURATION}ms ease-in`,
  };
}

// ── Dialogue-style toast for hotspot messages ──

function DialogueToast({ message, onDismiss, position = 'bottom' }: { message: string; onDismiss: () => void; position?: 'top' | 'bottom' }) {
  const { displayed, isDone, skip } = useTypewriter(message, 25);

  // Dismiss on E / Shift key press
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!isDone) {
          skip();
        } else {
          onDismiss();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDone, skip, onDismiss]);

  const handleClick = useCallback(() => {
    if (!isDone) {
      skip();
    } else {
      onDismiss();
    }
  }, [isDone, skip, onDismiss]);

  const isTop = position === 'top';

  return (
    <div
      className={`absolute left-0 right-0 z-20 ${isTop ? 'top-0' : 'bottom-0'}`}
      onClick={handleClick}
    >
      <div className={`mx-auto max-w-4xl px-4 ${isTop ? 'pt-6' : 'pb-6'}`}>
        <div className="rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-6 py-5 shadow-2xl cursor-pointer">
          <div className="min-h-[3.5rem]">
            <p className="text-base leading-relaxed text-gray-100">
              {displayed}
              {!isDone && (
                <span className="inline-block w-0.5 h-4 bg-gray-300 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
            {isDone && (
              <div className="mt-3 flex justify-end">
                <ChevronDown className="h-5 w-5 text-gray-400 animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Point-and-click viewport (hotspots on background, optional timer) ──

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PointAndClickViewportProps {
  backgroundUrl: string | null;
  backgroundSize?: BackgroundSizeMode;
  backgroundPosition?: BackgroundPosition;
  hotspots: Hotspot[];
  staticAssets: GameplayStaticAsset[];
  assetMap: Record<string, string>;
  timer: SceneTimer | null | undefined;
  executeHotspotAction: (hotspot: Hotspot | GameplayHotspot) => void;
  toastMessage: string | null;
  toastPosition: 'top' | 'bottom';
  onClearToast: () => void;
  hotspotChoiceOptions: ChoiceOption[];
  onSelectHotspotChoice: (optionId: string) => void;
  isInteractionLocked: boolean;
  isOffline: boolean;
  gameId: string | undefined;
  SaveMenu: React.ComponentType<{ gameId: string }>;
}

function PointAndClickViewport({
  backgroundUrl,
  backgroundSize = 'cover',
  backgroundPosition = 'center',
  hotspots,
  staticAssets,
  assetMap,
  timer,
  executeHotspotAction,
  toastMessage,
  toastPosition,
  onClearToast,
  hotspotChoiceOptions,
  onSelectHotspotChoice,
  isInteractionLocked,
  isOffline,
  gameId,
  SaveMenu,
}: PointAndClickViewportProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer?.enabled || !timer.durationSeconds) return;

    const durationMs = timer.durationSeconds * 1000;
    const syntheticTimer: Hotspot = {
      id: timer.id,
      name: 'Timer',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      actions: timer.actions,
      condition: timer.condition,
    };

    const clearAll = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      timerStartedAtRef.current = null;
      setCountdownRemaining(null);
    };

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current != null) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timerStartedAtRef.current = null;
      setCountdownRemaining(null);
      executeHotspotAction(syntheticTimer);
    }, durationMs);

    if (timer.showCountdown) {
      timerStartedAtRef.current = Date.now();
      setCountdownRemaining(timer.durationSeconds);
      intervalRef.current = setInterval(() => {
        const start = timerStartedAtRef.current;
        if (start == null) return;
        const elapsed = (Date.now() - start) / 1000;
        const remaining = Math.max(0, timer.durationSeconds - elapsed);
        setCountdownRemaining(remaining);
        if (remaining <= 0 && intervalRef.current != null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 1000);
    }

    return clearAll;
  }, [timer?.id, timer?.enabled, timer?.durationSeconds, timer?.showCountdown, executeHotspotAction]);

  const showCountdownOverlay = timer?.enabled && timer?.showCountdown && countdownRemaining != null && countdownRemaining > 0;

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      {!isOffline && gameId && <SaveMenu gameId={gameId} />}
      <GameStage>
        <div className="absolute inset-0">
          {backgroundUrl ? (
            <img
              key={backgroundUrl}
              src={backgroundUrl}
              alt="Scene background"
              className={`h-full w-full ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[backgroundSize]}`}
              style={{ objectPosition: BG_POSITION_CSS[backgroundPosition] }}
              draggable={false}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-gray-900 to-black" />
          )}
        </div>

        {showCountdownOverlay && (
          <div className="absolute top-4 left-4 z-10 rounded-lg border border-white/20 bg-black/60 px-3 py-2 font-mono text-lg text-white tabular-nums">
            {formatCountdown(countdownRemaining!)}
          </div>
        )}

        {staticAssets.map((sa) => {
          const url = assetMap[sa.assetId];
          if (!url) return null;
          return (
            <div
              key={`static-${sa.id}`}
              className="absolute pointer-events-none"
              style={{
                left: `${sa.x}%`,
                top: `${sa.y}%`,
                width: `${sa.width}%`,
                height: `${sa.height}%`,
                zIndex: sa.zIndex,
              }}
            >
              <img
                src={url}
                alt={sa.name}
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
          );
        })}

        {hotspots.map((hs) => (
          <div
            key={hs.id}
            className={`absolute z-10 transition-colors ${isInteractionLocked ? 'pointer-events-none' : 'cursor-pointer hover:bg-white/5'}`}
            style={{
              left: `${hs.x}%`,
              top: `${hs.y}%`,
              width: `${hs.width}%`,
              height: `${hs.height}%`,
            }}
            onClick={() => !isInteractionLocked && executeHotspotAction(hs)}
            title={hs.name}
          />
        ))}

        {toastMessage && (
          <DialogueToast message={toastMessage} onDismiss={onClearToast} position={toastPosition} />
        )}

        {hotspotChoiceOptions.length > 0 && (
          <div className={`absolute left-0 right-0 z-20 ${toastPosition === 'top' ? 'top-0' : 'bottom-0'}`}>
            <div className={`mx-auto max-w-4xl px-4 ${toastPosition === 'top' ? 'pt-6' : 'pb-6'}`}>
              <div className="rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-6 py-5 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  What will you do?
                </p>
                <div className="space-y-2">
                  {hotspotChoiceOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onSelectHotspotChoice(option.id)}
                      className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-200 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-white transition-all cursor-pointer"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </GameStage>
    </div>
  );
}

// ── Main Player component ──

export default function Player() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromEditor = (location.state as { from?: string } | null)?.from === 'editor';

  // Detect offline mode (runner injects window.GAME_DATA)
  const isOffline = typeof window !== 'undefined' && !!window.GAME_DATA;

  const isLoading = useGameStore((s) => s.isLoading);
  const error = useGameStore((s) => s.error);
  const nodes = useGameStore((s) => s.nodes);
  const edges = useGameStore((s) => s.edges);
  const isEnded = useGameStore((s) => s.isEnded);
  const currentNodeId = useGameStore((s) => s.currentNodeId);
  const currentBlockIndex = useGameStore((s) => s.currentBlockIndex);
  const loadGame = useGameStore((s) => s.loadGame);
  const loadFromData = useGameStore((s) => s.loadFromData);
  const advance = useGameStore((s) => s.advance);
  const selectChoice = useGameStore((s) => s.selectChoice);
  const restart = useGameStore((s) => s.restart);
  const getCurrentNode = useGameStore((s) => s.getCurrentNode);
  const getBackgroundUrl = useGameStore((s) => s.getBackgroundUrl);
  const getCharacterSprites = useGameStore((s) => s.getCharacterSprites);
  const getPrecedingTextBlock = useGameStore((s) => s.getPrecedingTextBlock);
  const getFilteredChoiceOptions = useGameStore((s) => s.getFilteredChoiceOptions);
  const executeHotspotAction = useGameStore((s) => s.executeHotspotAction);
  const isInteractionLocked = useGameStore((s) => s.isInteractionLocked());
  const hotspotChoiceOptions = useGameStore((s) => s.hotspotChoiceOptions);
  const selectHotspotChoice = useGameStore((s) => s.selectHotspotChoice);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const toastDismissMode = useGameStore((s) => s.toastDismissMode);
  const toastPosition = useGameStore((s) => s.toastPosition) ?? 'bottom';
  const clearToast = useGameStore((s) => s.clearToast);
  const assetMap = useGameStore((s) => s.assetMap);
  const transitionFromCustom = useGameStore((s) => s.transitionFromCustom);
  const setVariableById = useGameStore((s) => s.setVariableById);
  const variables = useGameStore((s) => s.variables);
  const variableDefinitions = useGameStore((s) => s.variableDefinitions);

  const initialVariableMap = useMemo(() => {
    const map: Record<string, boolean | number | string> = {};
    for (const def of variableDefinitions) {
      if (variables[def.name] !== undefined) {
        map[def.id] = variables[def.name];
      }
    }
    return map;
  }, [variables, variableDefinitions]);

  // ── Mobile detection (same breakpoint as EditorLayout) ──
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Portrait orientation detection (mobile/tablet only) ──
  const [showRotateOverlay, setShowRotateOverlay] = useState(false);
  useEffect(() => {
    const portrait = window.matchMedia('(orientation: portrait)');
    const narrow = window.matchMedia('(max-width: 1024px)');
    const update = () => setShowRotateOverlay(portrait.matches && narrow.matches);
    update();
    portrait.addEventListener('change', update);
    narrow.addEventListener('change', update);
    return () => {
      portrait.removeEventListener('change', update);
      narrow.removeEventListener('change', update);
    };
  }, []);

  const hasGameplayNodes = nodes.some((n) => (n.data as SceneNodeData)?.sceneType === 'gameplay');

  // Derive current state from store
  const currentNode = getCurrentNode();
  const { ready: nodeAssetsReady, loaded: assetsLoaded, total: assetsTotal } =
    useNodeAssetsReady(currentNode, nodes, edges, assetMap);
  const currentNodeData = currentNode?.data as SceneNodeData | undefined;
  const isCutscene = currentNodeData?.sceneType === 'cutscene';
  const isPointAndClick = currentNodeData?.sceneType === 'point_and_click';
  const isGameplay = currentNodeData?.sceneType === 'gameplay';
  const isCustom = currentNodeData?.sceneType === 'custom';

  const currentBlock = currentNode
    ? ((currentNode.data as SceneNodeData).dialogueBlocks ?? [])[currentBlockIndex] ?? null
    : null;
  const backgroundUrl = getBackgroundUrl();
  const characterSprites = getCharacterSprites();

  // ── Character enter/exit animation state ──
  const prevSpritesRef = useRef(characterSprites);
  const currentSpritesRef = useRef(characterSprites);
  currentSpritesRef.current = characterSprites;
  const [displaySprites, setDisplaySprites] = useState<DisplaySprite[]>([]);
  const spritesKey = characterSprites.map(s => `${s.position}:${s.url}:${s.enterAnimation}:${s.exitAnimation}`).join('|');

  useLayoutEffect(() => {
    const prev = prevSpritesRef.current;
    const curr = currentSpritesRef.current;
    const prevByPos = new Map(prev.map(s => [s.position, s]));
    const currByPos = new Map(curr.map(s => [s.position, s]));

    const next: DisplaySprite[] = [];

    for (const sprite of curr) {
      const prevAtPos = prevByPos.get(sprite.position);
      const wasPresent = !!prevAtPos && prevAtPos.url === sprite.url;
      next.push({
        ...sprite,
        phase: !wasPresent && sprite.enterAnimation !== 'none' ? 'enter' : 'idle',
        started: wasPresent || sprite.enterAnimation === 'none',
      });
    }

    for (const sprite of prev) {
      const currAtPos = currByPos.get(sprite.position);
      const shouldExit = !currAtPos || currAtPos.url !== sprite.url;
      if (shouldExit && sprite.exitAnimation !== 'none') {
        next.push({ ...sprite, phase: 'exit', started: false });
      }
    }

    setDisplaySprites(next);
    prevSpritesRef.current = curr;

    let cancelled = false;

    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setDisplaySprites(ds =>
          ds.map(s => (!s.started ? { ...s, started: true } : s)),
        );
      });
    });

    const timer = setTimeout(() => {
      if (cancelled) return;
      setDisplaySprites(ds =>
        ds
          .filter(s => s.phase !== 'exit')
          .map(s => (s.phase === 'enter' ? { ...s, phase: 'idle' as const } : s)),
      );
    }, CHAR_ANIM_DURATION + 50);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [spritesKey]);

  const isChoiceBlock = currentBlock?.type === 'choice';
  const isTextBlock = currentBlock?.type === 'text';
  const isOverlayChoice = isChoiceBlock && !!currentBlock.showOverDialogue;
  const precedingTextBlock = isOverlayChoice ? getPrecedingTextBlock() : null;

  // Filter choice options by conditions
  const filteredOptions = isChoiceBlock ? getFilteredChoiceOptions(currentBlock.options) : [];
  const filteredHotspotChoices = hotspotChoiceOptions ? getFilteredChoiceOptions(hotspotChoiceOptions) : [];

  // Filter location actions by conditions


  const speakerName = isTextBlock
    ? currentBlock.character
    : precedingTextBlock?.character ?? '';
  const dialogueText = isTextBlock ? currentBlock.dialogue : '';
  const overlayDialogueText = precedingTextBlock?.dialogue ?? '';

  const { displayed, isDone, skip } = useTypewriter(dialogueText, 25);

  // Offline zip runner injects window.GAME_DATA; hub/editor play uses local loadGame.
  useEffect(() => {
    if (isOffline && window.GAME_DATA) {
      loadFromData(window.GAME_DATA);
      return;
    }
    if (gameId) {
      void loadGame(gameId);
    }
  }, [gameId, loadGame, loadFromData, isOffline]);

  // Handle click on the dialogue area
  const handleDialogueClick = useCallback(() => {
    if (isChoiceBlock) return; // choices need explicit button click
    if (!isDone) {
      skip(); // finish the typewriter first
      return;
    }
    advance();
  }, [isChoiceBlock, isDone, skip, advance]);

  // Handle keyboard (space/enter to advance, escape to exit)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isOffline) {
        e.preventDefault();
        navigate(cameFromEditor ? `/editor/${gameId}` : '/');
        return;
      }
      if (isGameplay || isCutscene || isPointAndClick) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleDialogueClick();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDialogueClick, navigate, gameId, cameFromEditor, isGameplay, isCutscene, isPointAndClick]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="h-10 w-10 rounded-full border-2 border-gray-700 border-t-indigo-400 animate-spin" />
        <p className="mt-4 text-sm text-gray-400">Loading Game...</p>
      </div>
    );
  }

  // ── Per-node asset gating ──
  if (currentNode && !nodeAssetsReady) {
    const pct = assetsTotal === 0 ? 0 : (assetsLoaded / assetsTotal) * 100;
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="h-10 w-10 rounded-full border-2 border-gray-700 border-t-indigo-400 animate-spin" />
        <p className="mt-4 text-sm text-gray-400">
          Loading scene… {assetsLoaded}/{assetsTotal}
        </p>
        <div className="mt-3 h-1.5 w-64 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full bg-indigo-400 transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="text-6xl font-bold text-gray-700">404</p>
        <p className="mt-3 text-lg text-gray-400">{error}</p>
        {!isOffline && (
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        )}
      </div>
    );
  }

  // ── Desktop-only gate for games that use gameplay nodes ──
  if (!isLoading && !error && nodes.length > 0 && hasGameplayNodes && isMobile) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white p-8">
        <Monitor className="h-16 w-16 text-gray-500 mb-6" />
        <h1 className="text-2xl font-bold mb-2">Desktop only</h1>
        <p className="text-gray-400 text-center max-w-sm mb-6">
          This game uses keyboard and mouse controls. Please play on a desktop or laptop.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {!isOffline && cameFromEditor && gameId && (
            <Link
              to={`/editor/${gameId}`}
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Editor
            </Link>
          )}
          {!isOffline && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Portrait rotate overlay (mobile/tablet); after desktop-only so we don't ask to rotate for gameplay games ──
  if (showRotateOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white">
        <RotateCw className="h-16 w-16 text-gray-400 mb-6 animate-[spin_3s_ease-in-out_infinite]" />
        <p className="text-lg font-semibold">Please Rotate Your Device</p>
        <p className="text-gray-500 text-sm mt-2">This game is best played in landscape mode.</p>
      </div>
    );
  }

  // ── End screen ──
  if (isEnded) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="text-5xl font-bold tracking-wide text-gray-200">The End</p>
        <p className="mt-3 text-sm text-gray-500">Thank you for playing.</p>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
          {!isOffline && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── No current node (shouldn't happen, but guard) ──
  if (!currentNode || !currentNodeId) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center text-gray-500">
        <p>No scene to display.</p>
      </div>
    );
  }

  // ── Cutscene viewport ──
  if (isCutscene && currentNodeData) {
    return (
      <>
        {!isOffline && <SaveMenu gameId={gameId!} />}
        <CutsceneViewport
          nodeData={currentNodeData}
          assetMap={assetMap}
          onComplete={advance}
        />
      </>
    );
  }

  // ── Gameplay (Physics) viewport ──
  if (isGameplay && currentNodeData) {
    return (
      <>
        {!isOffline && <SaveMenu gameId={gameId!} />}
        <GameplayViewport
          nodeData={currentNodeData}
          assetMap={assetMap}
          onHotspotAction={executeHotspotAction}
          onAdvance={advance}
          toastMessage={toastMessage}
          toastDismissMode={toastDismissMode}
          toastPosition={toastPosition}
          onClearToast={clearToast}
          hotspotChoiceOptions={filteredHotspotChoices}
          onSelectHotspotChoice={selectHotspotChoice}
          isInteractionLocked={isInteractionLocked}
        />
      </>
    );
  }

  // ── Point-and-click viewport ──
  if (isPointAndClick) {
    return (
      <PointAndClickViewport
        backgroundUrl={backgroundUrl}
        backgroundSize={currentNodeData?.backgroundSize ?? 'cover'}
        backgroundPosition={currentNodeData?.backgroundPosition ?? 'center'}
        hotspots={currentNodeData?.hotspots ?? []}
        staticAssets={currentNodeData?.staticAssets ?? []}
        assetMap={assetMap}
        timer={currentNodeData?.timer}
        executeHotspotAction={executeHotspotAction}
        toastMessage={toastMessage}
        toastPosition={toastPosition}
        onClearToast={clearToast}
        hotspotChoiceOptions={filteredHotspotChoices}
        onSelectHotspotChoice={selectHotspotChoice}
        isInteractionLocked={isInteractionLocked}
        isOffline={isOffline}
        gameId={gameId}
        SaveMenu={SaveMenu}
      />
    );
  }

  // ── Custom Scene viewport ──
  if (isCustom && currentNodeData) {
    return (
      <>
        {!isOffline && <SaveMenu gameId={gameId!} />}
        <CustomSceneViewport
          key={currentNodeId ?? undefined}
          nodeData={currentNodeData}
          assetMap={assetMap}
          onComplete={advance}
          onTransitionToHandle={transitionFromCustom}
          setVariable={setVariableById}
          initialVariables={initialVariableMap}
        />
      </>
    );
  }

  // ── Dialogue Game viewport ──
  return (
    <div
      className="relative h-screen w-screen bg-black overflow-hidden select-none"
      style={{ cursor: isChoiceBlock ? 'default' : 'pointer' }}
    >
      {!isOffline && <SaveMenu gameId={gameId!} />}
      <GameStage>
        {/* Layer 1: Background */}
        <div className="absolute inset-0 transition-opacity duration-500">
          {backgroundUrl ? (
            <img
              key={backgroundUrl}
              src={backgroundUrl}
              alt="Scene background"
              className={`h-full w-full ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[currentNodeData?.backgroundSize ?? 'cover']}`}
              style={{ objectPosition: BG_POSITION_CSS[currentNodeData?.backgroundPosition ?? 'center'] }}
              draggable={false}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-gray-900 to-black" />
          )}
        </div>

        {/* Layer 2: Character sprites */}
        <div className="absolute inset-0 pointer-events-none">
          {displaySprites.map((sprite) => {
            const positionStyle: React.CSSProperties =
              sprite.position === 'left-1'
                ? { left: '5%', bottom: '11rem' }
                : sprite.position === 'left-2'
                  ? { left: '22%', bottom: '11rem' }
                  : sprite.position === 'right-1'
                    ? { right: '5%', bottom: '11rem' }
                    : { right: '22%', bottom: '11rem' };
            const animStyle = getCharAnimStyle(sprite);
            return (
              <img
                key={sprite.phase === 'exit' ? `${sprite.position}-exit` : sprite.position}
                src={sprite.url}
                alt={`Character ${sprite.position}`}
                className="absolute max-h-[70%] w-auto object-contain"
                style={{ ...positionStyle, ...animStyle }}
                draggable={false}
              />
            );
          })}
        </div>
      </GameStage>

      {/* Layer 3: Dialogue HUD */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10"
        onClick={!isChoiceBlock ? handleDialogueClick : undefined}
      >
        <div className="mx-auto max-w-4xl px-4 pb-6">
          <div className="rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-6 py-5 shadow-2xl">
            {/* Speaker name */}
            {(isTextBlock || isOverlayChoice) && speakerName && (
              <div className="mb-2">
                <span className="inline-block rounded-md bg-indigo-600/80 px-3 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                  {speakerName}
                </span>
              </div>
            )}

            {/* Text block: dialogue */}
            {isTextBlock && (
              <div className="min-h-[3.5rem]">
                <p className="text-base leading-relaxed text-gray-100">
                  {displayed}
                  {!isDone && (
                    <span className="inline-block w-0.5 h-4 bg-gray-300 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>

                {/* Next indicator */}
                {isDone && (
                  <div className="mt-3 flex justify-end">
                    <ChevronDown className="h-5 w-5 text-gray-400 animate-bounce" />
                  </div>
                )}
              </div>
            )}

            {/* Overlay choice: preceding dialogue text shown fully, then choices */}
            {isOverlayChoice && overlayDialogueText && (
              <div className="mb-3">
                <p className="text-base leading-relaxed text-gray-100">
                  {overlayDialogueText}
                </p>
              </div>
            )}

            {/* Choice block: buttons */}
            {isChoiceBlock && (
              <div className="space-y-2">
                {!isOverlayChoice && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    What will you do?
                  </p>
                )}
                {isOverlayChoice && (
                  <div className="border-t border-white/10 pt-3" />
                )}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => selectChoice(option.id)}
                      className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-200 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-white transition-all cursor-pointer"
                    >
                      {option.label}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic py-2">
                    No options available...
                  </p>
                )}
              </div>
            )}

            {/* No dialogue blocks at all: just show scene label and advance */}
            {!currentBlock && (
              <div onClick={handleDialogueClick}>
                <p className="text-sm text-gray-400 italic">
                  {(currentNode.data as Record<string, unknown>).label as string}
                </p>
                <div className="mt-3 flex justify-end">
                  <ChevronDown className="h-5 w-5 text-gray-400 animate-bounce" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogue-style toast message */}
      {toastMessage && (
        <DialogueToast message={toastMessage} onDismiss={clearToast} position={toastPosition} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Cutscene Viewport (auto-playing cinematic)
// ────────────────────────────────────────────────────────

interface CutsceneViewportProps {
  nodeData: SceneNodeData;
  assetMap: Record<string, string>;
  onComplete: () => void;
}

function CutsceneViewport({ nodeData, assetMap, onComplete }: CutsceneViewportProps) {
  const cutsceneData = nodeData.cutsceneData;
  const duration = cutsceneData?.duration ?? 30;
  const clips = cutsceneData?.clips ?? [];
  const tracks = cutsceneData?.tracks ?? [];
  const camera = cutsceneData?.camera;
  const skipEnabled = cutsceneData?.skipEnabled ?? true;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const hasCompletedRef = useRef(false);

  // Track type lookup helper
  const getTrackType = useCallback(
    (trackId: string) => tracks.find((t) => t.id === trackId)?.type ?? null,
    [tracks],
  );

  // ── Playback engine ──
  useEffect(() => {
    if (!isPlaying) return;
    let lastFrame = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, duration]);

  // ── Auto-advance when playback ends ──
  useEffect(() => {
    if (!isPlaying && currentTime >= duration && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentTime, duration, onComplete]);

  // ── Active clips by track type ──
  const activeClips = useMemo(
    () => clips.filter((c) => c.start <= currentTime && c.end > currentTime),
    [clips, currentTime],
  );

  const activeByType = useMemo(() => {
    const result: Record<string, typeof clips> = {};
    for (const clip of activeClips) {
      const trackType = getTrackType(clip.trackId);
      if (trackType) {
        if (!result[trackType]) result[trackType] = [];
        result[trackType].push(clip);
      }
    }
    return result;
  }, [activeClips, getTrackType]);

  // Background
  const bgArr = activeByType.background ?? [];
  const bgClip = bgArr.length > 0 ? bgArr[bgArr.length - 1] : null;
  const bgUrl = bgClip?.assetId ? assetMap[bgClip.assetId] ?? null : null;

  // Characters sorted by z-index
  const sortedChars = useMemo(
    () => [...(activeByType.character ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [activeByType.character],
  );

  // Text
  const textClips = activeByType.text ?? [];

  // Camera
  const cameraState = useMemo(
    () => interpolateCamera(camera, currentTime),
    [camera, currentTime],
  );

  // ── Audio management ──
  const activeAudioClips = activeByType.audio ?? [];

  useEffect(() => {
    const activeIds = new Set(activeAudioClips.map((c) => c.id));

    // Start new audio
    for (const clip of activeAudioClips) {
      if (!clip.assetId) continue;
      const url = assetMap[clip.assetId];
      if (!url) continue;

      if (!audioRefs.current.has(clip.id)) {
        const audio = new Audio(url);
        const clipLocalTime = currentTime - clip.start;
        const vol = interpolateVolume(clip.volume, clipLocalTime);
        audio.volume = Math.max(0, Math.min(1, vol / 100));
        audio.play().catch(() => {});
        audioRefs.current.set(clip.id, audio);
      } else {
        // Update volume based on keyframes
        const audio = audioRefs.current.get(clip.id)!;
        const clipLocalTime = currentTime - clip.start;
        const vol = interpolateVolume(clip.volume, clipLocalTime);
        audio.volume = Math.max(0, Math.min(1, vol / 100));
      }
    }

    // Stop audio that is no longer active
    for (const [id, audio] of audioRefs.current.entries()) {
      if (!activeIds.has(id)) {
        audio.pause();
        audio.currentTime = 0;
        audioRefs.current.delete(id);
      }
    }
  }, [activeAudioClips, assetMap, currentTime]);

  // Cleanup all audio on unmount
  useEffect(() => {
    return () => {
      for (const audio of audioRefs.current.values()) {
        audio.pause();
        audio.currentTime = 0;
      }
      audioRefs.current.clear();
    };
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      <GameStage>
        {/* Camera wrapper */}
        <div
          className="absolute inset-0 origin-center"
          style={{
            transform: `translate(${-cameraState.x}px, ${-cameraState.y}px) scale(${cameraState.zoom})`,
          }}
        >
          {/* Background layer */}
          <div className="absolute inset-0 transition-opacity duration-500">
            {bgUrl ? (
              <img
                key={bgUrl}
                src={bgUrl}
                alt="Background"
                className={`h-full w-full ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[bgClip?.backgroundSize ?? 'cover']}`}
                style={{ objectPosition: BG_POSITION_CSS[bgClip?.backgroundPosition ?? 'center'] }}
                draggable={false}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-gray-900 to-black" />
            )}
          </div>

          {/* Character sprites */}
          <div className="absolute inset-0 pointer-events-none">
            {sortedChars.map((clip) => {
              const spriteUrl = clip.assetId ? assetMap[clip.assetId] ?? null : null;
              if (!spriteUrl) return null;

              const clipLocalTime = currentTime - clip.start;
              const tfState = interpolateTransform(clip.transform, clipLocalTime);

              return (
                <img
                  key={clip.id}
                  src={spriteUrl}
                  alt="Character"
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    maxHeight: '70%',
                    width: 'auto',
                    objectFit: 'contain',
                    transform: `translate(-50%, -50%) translate(${tfState.x}px, ${tfState.y}px) rotate(${tfState.rotation}deg) scale(${tfState.scaleX}, ${tfState.scaleY})`,
                    opacity: tfState.opacity,
                    zIndex: clip.zIndex ?? 0,
                  }}
                  draggable={false}
                />
              );
            })}
          </div>
        </div>
      </GameStage>

      {/* Text overlays (not affected by camera) */}
      {textClips.map((clip) => (
        <div
          key={clip.id}
          className="absolute inset-x-0 bottom-0 z-10 pb-8"
        >
          <div className="mx-auto max-w-3xl px-4">
            <div
              className="rounded-xl bg-black/70 backdrop-blur-md px-6 py-4 text-center shadow-2xl border border-white/10"
              style={{
                fontFamily: clip.fontFamily || 'inherit',
                fontSize: clip.fontSize ? `${clip.fontSize}px` : '18px',
                color: clip.fontColor || '#ffffff',
                textShadow: clip.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : undefined,
              }}
            >
              <p className="text-lg leading-relaxed">{clip.text || ''}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Skip button */}
      {skipEnabled && (
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 z-20 rounded-lg bg-black/50 backdrop-blur-sm px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
        >
          Skip ▶▶
        </button>
      )}
    </div>
  );
}
