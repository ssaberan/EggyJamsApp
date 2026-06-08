import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import GameStage, { STAGE_HEIGHT_OVER_WIDTH } from './GameStage';
import { useTypewriter } from '../../hooks/useTypewriter';
import {
  BG_POSITION_CSS,
  type SceneNodeData,
  type GameplaySettings,
  type GameplayObstacle,
  type GameplayHotspot,
  type GameplayStaticAsset,
  type GameplayViewMode,
  type ChoiceOption,
  type SceneTimer,
} from '../../stores/graphStore';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const MOVE_SPEED = 30;        // % of viewport per second
const GRAVITY = 120;           // % per second squared (side view)
const JUMP_IMPULSE = -55;      // % per second (upward, side view)
const PLAYER_WIDTH = 5;        // % of viewport
const PLAYER_HEIGHT = 8;       // % of viewport
const GROUND_Y = 100;          // bottom of viewport (%)
const INTERACTION_KEY = 'KeyE';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlayerState {
  x: number;       // % (left edge)
  y: number;       // % (top edge)
  vx: number;      // % per second
  vy: number;      // % per second
  isGrounded: boolean;
  facingDirection: 'left' | 'right' | 'up' | 'down';
}

interface GameplayViewportProps {
  nodeData: SceneNodeData;
  assetMap: Record<string, string>;
  onHotspotAction: (hotspot: GameplayHotspot) => void;
  onAdvance: () => void;
  toastMessage: string | null;
  toastDismissMode: 'onLeave' | 'onInteraction' | null;
  toastPosition: 'top' | 'bottom';
  onClearToast: () => void;
  hotspotChoiceOptions: ChoiceOption[];
  onSelectHotspotChoice: (optionId: string) => void;
  isInteractionLocked: boolean;
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ────────────────────────────────────────────────────────
// Keyboard Input Hook
// ────────────────────────────────────────────────────────

function useKeyboardInput() {
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      // Prevent scrolling with arrow keys / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const handleBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return keysRef;
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export default function GameplayViewport({
  nodeData,
  assetMap,
  onHotspotAction,
  toastMessage,
  toastDismissMode,
  toastPosition,
  onClearToast,
  hotspotChoiceOptions,
  onSelectHotspotChoice,
  isInteractionLocked,
}: GameplayViewportProps) {
  const settings: GameplaySettings = useMemo(
    () => ({
      viewMode: 'side' as GameplayViewMode,
      backgroundImageId: null,
      backgroundMusicId: null,
      characterSpriteId: null,
      characterStartPosition: { x: 50, y: 90 },
      characterFrontFace: 'right' as const,
      characterScale: 100,
      characterSpriteIdVertical: null,
      characterFrontFaceHorizontal: 'right',
      characterFrontFaceVertical: 'down',
      characterSpriteIdIdleSide: null,
      characterSpriteIdWalkingSide: null,
      characterSpriteIdJumpingUpSide: null,
      characterSpriteIdFallingDownSide: null,
      characterSpriteIdIdleHorizontal: null,
      characterSpriteIdWalkingHorizontal: null,
      characterSpriteIdIdleVertical: null,
      characterSpriteIdWalkingVertical: null,
      ...nodeData.gameplaySettings,
    }),
    [nodeData.gameplaySettings],
  );

  // ── Scaled player dimensions ──
  const scaleFactor = (settings.characterScale ?? 100) / 100;
  const playerHeight = PLAYER_HEIGHT * scaleFactor;

  const obstacles: GameplayObstacle[] = useMemo(
    () => nodeData.obstacles ?? [],
    [nodeData.obstacles],
  );

  const hotspots: GameplayHotspot[] = useMemo(
    () => nodeData.gameplayHotspots ?? [],
    [nodeData.gameplayHotspots],
  );

  const staticAssets: GameplayStaticAsset[] = useMemo(
    () => nodeData.staticAssets ?? [],
    [nodeData.staticAssets],
  );

  const timer: SceneTimer | null | undefined = nodeData.timer;

  const backgroundUrl = useMemo(() => {
    if (!settings.backgroundImageId) return null;
    return assetMap[settings.backgroundImageId] ?? null;
  }, [settings.backgroundImageId, assetMap]);

  // Resolve sprite URL by asset ID (with fallback to null)
  const getSpriteUrl = useCallback(
    (id: string | null | undefined) => (id ? (assetMap[id] ?? null) : null),
    [assetMap],
  );

  // Legacy URL for fallback when state-specific sprites are not set
  const characterSpriteUrl = useMemo(
    () => getSpriteUrl(settings.characterSpriteId),
    [settings.characterSpriteId, getSpriteUrl],
  );

  // Primary sprite URL for aspect ratio: one consistent source so hitbox size stays stable
  const primarySpriteUrl = useMemo(() => {
    if (settings.viewMode === 'side') {
      return (
        getSpriteUrl(settings.characterSpriteIdIdleSide) ??
        getSpriteUrl(settings.characterSpriteIdWalkingSide) ??
        characterSpriteUrl
      );
    }
    return (
      getSpriteUrl(settings.characterSpriteIdIdleHorizontal) ??
      getSpriteUrl(settings.characterSpriteIdWalkingHorizontal) ??
      characterSpriteUrl
    );
  }, [settings.viewMode, settings.characterSpriteIdIdleSide, settings.characterSpriteIdWalkingSide, settings.characterSpriteIdIdleHorizontal, settings.characterSpriteIdWalkingHorizontal, characterSpriteUrl, getSpriteUrl]);

  // ── Load character sprite aspect ratio from primary sprite ──
  const [imageRatio, setImageRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!primarySpriteUrl) {
      setImageRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImageRatio(img.naturalWidth / img.naturalHeight);
    img.src = primarySpriteUrl;
  }, [primarySpriteUrl]);

  // Compute playerWidth to match the sprite's natural aspect ratio
  const playerWidth = imageRatio !== null
    ? playerHeight * imageRatio * STAGE_HEIGHT_OVER_WIDTH
    : PLAYER_WIDTH * scaleFactor;

  // ── Player state ──
  const playerRef = useRef<PlayerState>({
    x: settings.characterStartPosition.x - playerWidth / 2,
    y: settings.characterStartPosition.y - playerHeight,
    vx: 0,
    vy: 0,
    isGrounded: false,
    facingDirection: settings.characterFrontFace === 'left' ? 'left' : 'right',
  });

  type MovementStateSide = 'idle' | 'walking' | 'jumping_up' | 'falling_down';

  const [playerPos, setPlayerPos] = useState<{
    x: number;
    y: number;
    facingDirection: 'left' | 'right' | 'up' | 'down';
    movementState?: MovementStateSide;
    isMoving?: boolean;
  }>({
    x: playerRef.current.x,
    y: playerRef.current.y,
    facingDirection: playerRef.current.facingDirection,
    movementState: 'idle',
    isMoving: false,
  });

  // Which sprite to show: state-specific (idle/walking/jumping/falling for side; idle/walking per axis for top-down)
  const displaySpriteUrl = useMemo(() => {
    const facing = playerPos.facingDirection;
    if (settings.viewMode === 'side') {
      const state = playerPos.movementState ?? 'idle';
      const id =
        (state === 'idle' && (settings.characterSpriteIdIdleSide ?? settings.characterSpriteId)) ||
        (state === 'walking' && (settings.characterSpriteIdWalkingSide ?? settings.characterSpriteId)) ||
        (state === 'jumping_up' && (settings.characterSpriteIdJumpingUpSide ?? settings.characterSpriteId)) ||
        (state === 'falling_down' && (settings.characterSpriteIdFallingDownSide ?? settings.characterSpriteId)) ||
        settings.characterSpriteId;
      return getSpriteUrl(id);
    }
    const isHorizontal = facing === 'left' || facing === 'right';
    const isMoving = playerPos.isMoving ?? false;
    const id = isHorizontal
      ? (isMoving ? (settings.characterSpriteIdWalkingHorizontal ?? settings.characterSpriteId) : (settings.characterSpriteIdIdleHorizontal ?? settings.characterSpriteId))
      : (isMoving ? (settings.characterSpriteIdWalkingVertical ?? settings.characterSpriteIdVertical ?? settings.characterSpriteId) : (settings.characterSpriteIdIdleVertical ?? settings.characterSpriteIdVertical ?? settings.characterSpriteId));
    return getSpriteUrl(id);
  }, [settings.viewMode, settings.characterSpriteId, settings.characterSpriteIdIdleSide, settings.characterSpriteIdWalkingSide, settings.characterSpriteIdJumpingUpSide, settings.characterSpriteIdFallingDownSide, settings.characterSpriteIdIdleHorizontal, settings.characterSpriteIdWalkingHorizontal, settings.characterSpriteIdIdleVertical, settings.characterSpriteIdWalkingVertical, settings.characterSpriteIdVertical, playerPos.facingDirection, playerPos.movementState, playerPos.isMoving, getSpriteUrl]);

  // Debounce set for collision-activated hotspots
  const triggeredHotspotsRef = useRef<Set<string>>(new Set());

  // Hotspot currently overlapping for interaction_button type
  const [nearbyHotspot, setNearbyHotspot] = useState<GameplayHotspot | null>(null);

  // ── Reset player position when entering a new gameplay node ──
  // We track nodeData by reference; when the game navigates to a different node,
  // nodeData changes and this effect fires.
  const nodeDataRef = useRef(nodeData);
  useEffect(() => {
    // Skip the initial render (nodeDataRef already equals nodeData)
    if (nodeDataRef.current === nodeData) return;
    nodeDataRef.current = nodeData;

    // Only reset if the target node's settings say so (default true)
    if (settings.resetPositionOnEnter === false) return;

    const startX = settings.characterStartPosition.x - playerWidth / 2;
    const startY = settings.characterStartPosition.y - playerHeight;
    const startFacing = settings.characterFrontFace === 'left' ? 'left' as const : 'right' as const;

    playerRef.current = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      isGrounded: false,
      facingDirection: startFacing,
    };
    setPlayerPos({
      x: startX,
      y: startY,
      facingDirection: startFacing,
      movementState: 'idle',
      isMoving: false,
    });
    triggeredHotspotsRef.current.clear();
    setNearbyHotspot(null);
  }, [nodeData, settings.resetPositionOnEnter, settings.characterStartPosition.x, settings.characterStartPosition.y, settings.characterFrontFace, playerWidth, playerHeight]);

  const keysRef = useKeyboardInput();
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const isLockedRef = useRef(isInteractionLocked);
  isLockedRef.current = isInteractionLocked;

  // ── Game loop ──
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05); // cap dt
      lastTimeRef.current = timestamp;

      const keys = keysRef.current;
      const player = playerRef.current;
      const isSideView = settings.viewMode === 'side';
      const locked = isLockedRef.current;

      // ── Input (suppressed while interaction is locked) ──
      let moveX = 0;
      let moveY = 0;

      if (!locked) {
        if (keys.has('ArrowLeft') || keys.has('KeyA')) moveX -= 1;
        if (keys.has('ArrowRight') || keys.has('KeyD')) moveX += 1;
      }

      const moveSpeed = settings.characterSpeed ?? MOVE_SPEED;
      const gravity = settings.gravity ?? GRAVITY;
      const jumpImpulse = -(settings.jumpStrength ?? -JUMP_IMPULSE);

      if (isSideView) {
        if (!locked && (keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')) && player.isGrounded) {
          player.vy = jumpImpulse;
          player.isGrounded = false;
        }
      } else {
        if (!locked) {
          if (keys.has('ArrowUp') || keys.has('KeyW')) moveY -= 1;
          if (keys.has('ArrowDown') || keys.has('KeyS')) moveY += 1;
        }
      }

      // ── Update velocity ──
      // Scale horizontal speed to the 16:9 stage (same box as % positions), not the full window
      player.vx = moveX * moveSpeed * STAGE_HEIGHT_OVER_WIDTH;

      if (isSideView) {
        player.vy += gravity * dt;
      } else {
        player.vy = moveY * moveSpeed;
      }

      // ── Update position ──
      let newX = player.x + player.vx * dt;
      let newY = player.y + player.vy * dt;

      // Clamp to viewport
      newX = clamp(newX, 0, 100 - playerWidth);
      newY = clamp(newY, 0, 100 - playerHeight);

      // ── Collision with obstacles ──
      const playerRect: Rect = { x: newX, y: newY, width: playerWidth, height: playerHeight };

      for (const obs of obstacles) {
        if (!rectsOverlap(playerRect, obs)) continue;

        if (isSideView) {
          // Determine overlap from each side
          const overlapLeft = (playerRect.x + playerRect.width) - obs.x;
          const overlapRight = (obs.x + obs.width) - playerRect.x;
          const overlapTop = (playerRect.y + playerRect.height) - obs.y;
          const overlapBottom = (obs.y + obs.height) - playerRect.y;

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapTop && player.vy >= 0) {
            // Landing on top
            newY = obs.y - playerHeight;
            player.vy = 0;
            player.isGrounded = true;
          } else if (minOverlap === overlapBottom && player.vy < 0) {
            // Hitting from below
            newY = obs.y + obs.height;
            player.vy = 0;
          } else if (minOverlap === overlapLeft) {
            newX = obs.x - playerWidth;
          } else if (minOverlap === overlapRight) {
            newX = obs.x + obs.width;
          }
        } else {
          // Top-down: push out from smallest overlap
          const overlapLeft = (playerRect.x + playerRect.width) - obs.x;
          const overlapRight = (obs.x + obs.width) - playerRect.x;
          const overlapTop = (playerRect.y + playerRect.height) - obs.y;
          const overlapBottom = (obs.y + obs.height) - playerRect.y;

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapTop) {
            newY = obs.y - playerHeight;
          } else if (minOverlap === overlapBottom) {
            newY = obs.y + obs.height;
          } else if (minOverlap === overlapLeft) {
            newX = obs.x - playerWidth;
          } else if (minOverlap === overlapRight) {
            newX = obs.x + obs.width;
          }
        }

        // Update playerRect for next obstacle
        playerRect.x = newX;
        playerRect.y = newY;
      }

      // ── Ground check (side view) ──
      if (isSideView) {
        if (newY + playerHeight >= GROUND_Y) {
          newY = GROUND_Y - playerHeight;
          player.vy = 0;
          player.isGrounded = true;
        } else if (!obstacles.some((obs) => {
          const feetRect: Rect = { x: newX, y: newY + playerHeight, width: playerWidth, height: 0.5 };
          return rectsOverlap(feetRect, obs);
        })) {
          player.isGrounded = false;
        }
      }

      // ── Update facing direction ──
      if (moveX < 0) player.facingDirection = 'left';
      else if (moveX > 0) player.facingDirection = 'right';
      if (!isSideView) {
        if (moveY < 0) player.facingDirection = 'up';
        else if (moveY > 0) player.facingDirection = 'down';
      }

      player.x = newX;
      player.y = newY;

      // ── Hotspot collision detection (skipped while locked) ──
      const finalPlayerRect: Rect = { x: newX, y: newY, width: playerWidth, height: playerHeight };
      let currentNearby: GameplayHotspot | null = null;

      if (!locked) {
        for (const hs of hotspots) {
          const overlapping = rectsOverlap(finalPlayerRect, hs);

          if (overlapping) {
            if (hs.activationType === 'collision') {
              if (!triggeredHotspotsRef.current.has(hs.id)) {
                triggeredHotspotsRef.current.add(hs.id);
                onHotspotAction(hs);
              }
            }
            if (hs.activationType === 'interaction_button' || !currentNearby) {
              currentNearby = hs;
            }
          } else {
            triggeredHotspotsRef.current.delete(hs.id);
          }
        }
      }

      setNearbyHotspot(locked ? null : currentNearby);

      // ── Movement state for sprite selection ──
      let movementState: 'idle' | 'walking' | 'jumping_up' | 'falling_down' = 'idle';
      let isMoving = false;
      if (isSideView) {
        if (player.isGrounded) {
          movementState = moveX !== 0 ? 'walking' : 'idle';
        } else {
          movementState = player.vy < 0 ? 'jumping_up' : 'falling_down';
        }
      } else {
        isMoving = moveX !== 0 || moveY !== 0;
      }

      // ── Update render state ──
      setPlayerPos({
        x: player.x,
        y: player.y,
        facingDirection: player.facingDirection,
        movementState,
        isMoving,
      });

      animFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [settings.viewMode, playerWidth, playerHeight, obstacles, hotspots, keysRef, onHotspotAction],
  );

  // ── Start/stop game loop ──
  useEffect(() => {
    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameLoop]);

  // ── Interaction key handler (disabled while locked) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInteractionLocked) return;
      if (e.code === INTERACTION_KEY || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (nearbyHotspot && nearbyHotspot.activationType === 'interaction_button') {
          onHotspotAction(nearbyHotspot);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nearbyHotspot, onHotspotAction, isInteractionLocked]);

  // ── Toast typewriter ──
  const toastTypewriter = useTypewriter(toastMessage ?? '', 25);

  // ── Dismiss toast when player leaves hotspot (onLeave mode) ──
  const prevNearbyRef = useRef<GameplayHotspot | null>(null);
  useEffect(() => {
    const prev = prevNearbyRef.current;
    prevNearbyRef.current = nearbyHotspot;

    // If the player was near a hotspot and now moved away, dismiss if mode is onLeave
    if (prev && !nearbyHotspot && toastMessage && toastDismissMode === 'onLeave') {
      onClearToast();
    }
  }, [nearbyHotspot, toastMessage, toastDismissMode, onClearToast]);

  // ── Dismiss toast on interaction (onInteraction mode) ──
  useEffect(() => {
    if (!toastMessage || toastDismissMode !== 'onInteraction') return;

    const handler = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!toastTypewriter.isDone) {
          toastTypewriter.skip();
        } else {
          onClearToast();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toastMessage, toastDismissMode, toastTypewriter.isDone, toastTypewriter.skip, onClearToast]);

  // ── Scene timer (trigger actions after duration) ──
  const timerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerCountdownRemaining, setTimerCountdownRemaining] = useState<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer?.enabled || !timer.durationSeconds) return;

    const durationMs = timer.durationSeconds * 1000;
    const syntheticHotspot: GameplayHotspot = {
      id: timer.id,
      name: 'Timer',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      actions: timer.actions,
      condition: timer.condition,
      activationType: 'interaction_button',
      showIndicator: false,
    };

    const clearAll = () => {
      if (timerTimeoutRef.current != null) {
        clearTimeout(timerTimeoutRef.current);
        timerTimeoutRef.current = null;
      }
      if (timerIntervalRef.current != null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      timerStartedAtRef.current = null;
      setTimerCountdownRemaining(null);
    };

    timerTimeoutRef.current = setTimeout(() => {
      if (timerIntervalRef.current != null) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      timerStartedAtRef.current = null;
      setTimerCountdownRemaining(null);
      onHotspotAction(syntheticHotspot);
    }, durationMs);

    if (timer.showCountdown) {
      timerStartedAtRef.current = Date.now();
      setTimerCountdownRemaining(timer.durationSeconds);
      timerIntervalRef.current = setInterval(() => {
        const start = timerStartedAtRef.current;
        if (start == null) return;
        const elapsed = (Date.now() - start) / 1000;
        const remaining = Math.max(0, timer.durationSeconds - elapsed);
        setTimerCountdownRemaining(remaining);
        if (remaining <= 0 && timerIntervalRef.current != null) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }, 1000);
    }

    return clearAll;
  }, [timer?.id, timer?.enabled, timer?.durationSeconds, timer?.showCountdown, onHotspotAction]);

  const showTimerCountdown = timer?.enabled && timer?.showCountdown && timerCountdownRemaining != null && timerCountdownRemaining > 0;

  const handleToastClick = useCallback(() => {
    if (!toastTypewriter.isDone) {
      toastTypewriter.skip();
    } else {
      onClearToast();
    }
  }, [toastTypewriter.isDone, toastTypewriter.skip, onClearToast]);

  // ── Background music ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmUrl = useMemo(() => {
    if (!settings.backgroundMusicId) return null;
    return assetMap[settings.backgroundMusicId] ?? null;
  }, [settings.backgroundMusicId, assetMap]);

  useEffect(() => {
    if (!bgmUrl) return;
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.volume = 0.3;
    audio.play().catch(() => {/* autoplay blocked */});
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [bgmUrl]);

  // ── Determine sprite flip ──
  const facing = playerPos.facingDirection;
  const isSideView = settings.viewMode === 'side';

  const shouldFlipX = useMemo(() => {
    if (isSideView) {
      const front = settings.characterFrontFace === 'up' || settings.characterFrontFace === 'down' ? 'right' : settings.characterFrontFace;
      if (front === 'right') return facing === 'left';
      if (front === 'left') return facing === 'right';
      return false;
    }
    // Top-down: only flip X when facing left/right (horizontal sprite)
    if (facing !== 'left' && facing !== 'right') return false;
    const front = settings.characterFrontFaceHorizontal ?? 'right';
    if (front === 'right') return facing === 'left';
    if (front === 'left') return facing === 'right';
    return false;
  }, [isSideView, settings.characterFrontFace, settings.characterFrontFaceHorizontal, facing]);

  const shouldFlipY = useMemo(() => {
    if (isSideView || (facing !== 'up' && facing !== 'down')) return false;
    const front = settings.characterFrontFaceVertical ?? 'down';
    return (front === 'up' && facing === 'down') || (front === 'down' && facing === 'up');
  }, [isSideView, settings.characterFrontFaceVertical, facing]);

  // ── Camera tracking ──
  const trackCamera = settings.trackCharacterWithCamera ?? false;
  const cameraSize = clamp(settings.cameraSize ?? 50, 1, 100);

  const cameraTransform = useMemo(() => {
    if (!trackCamera || cameraSize >= 100) return undefined;
    const zoom = 100 / cameraSize;
    const charCenterX = playerPos.x + playerWidth / 2;
    const charCenterY = playerPos.y + playerHeight / 2;
    const offsetX = clamp(charCenterX - cameraSize / 2, 0, 100 - cameraSize);
    const offsetY = clamp(charCenterY - cameraSize / 2, 0, 100 - cameraSize);
    return {
      transformOrigin: '0 0',
      transform: `scale(${zoom}) translate(-${offsetX}%, -${offsetY}%)`,
    } as React.CSSProperties;
  }, [trackCamera, cameraSize, playerPos.x, playerPos.y, playerWidth, playerHeight]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      <GameStage>
        {/* Camera wrapper — applies zoom + translate when tracking is enabled */}
        <div className="absolute inset-0" style={cameraTransform}>
          {/* Background */}
          <div className="absolute inset-0">
            {backgroundUrl ? (
              <img
                src={backgroundUrl}
                alt="Scene background"
                className={`h-full w-full ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[settings.backgroundSize ?? 'cover']}`}
                style={{ objectPosition: BG_POSITION_CSS[settings.backgroundPosition ?? 'center'] }}
                draggable={false}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-gray-900 to-black" />
            )}
          </div>

          {/* Obstacles (invisible at runtime) */}
          {obstacles.map((obs) => (
            <div
              key={obs.id}
              className="absolute pointer-events-none"
              style={{
                left: `${obs.x}%`,
                top: `${obs.y}%`,
                width: `${obs.width}%`,
                height: `${obs.height}%`,
              }}
            />
          ))}

          {/* Static assets */}
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

          {/* Hotspot indicators */}
          {hotspots.map((hs) => {
            if (!hs.showIndicator) return null;
            const isNearby = nearbyHotspot?.id === hs.id;
            if (!isNearby) return null;
            return (
              <div
                key={`indicator-${hs.id}`}
                className="absolute flex flex-col items-center pointer-events-none animate-bounce"
                style={{ left: `${hs.x + hs.width / 2}%`, top: `${hs.y - 5}%`, transform: 'translateX(-50%)', zIndex: 999 }}
              >
                <div className="bg-white/90 text-black text-xs font-bold px-2 py-0.5 rounded shadow-lg">
                  {hs.activationType === 'interaction_button' ? 'Press E / Shift' : hs.name}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/90" />
              </div>
            );
          })}

          {/* Character */}
          <div
            className="absolute pointer-events-none transition-none"
            style={{
              left: `${playerPos.x}%`,
              top: `${playerPos.y}%`,
              width: `${playerWidth}%`,
              height: `${playerHeight}%`,
              zIndex: settings.characterZIndex ?? 10,
              transform: [shouldFlipX && 'scaleX(-1)', shouldFlipY && 'scaleY(-1)'].filter(Boolean).join(' ') || 'none',
            }}
          >
            {displaySpriteUrl ? (
              <img
                src={displaySpriteUrl}
                alt="Player character"
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="h-full w-full rounded-md bg-orange-500/80 border-2 border-orange-300 shadow-lg" />
            )}
          </div>
        </div>
      </GameStage>

      {/* HUD elements — outside camera wrapper so they stay fixed on screen */}

      {/* Timer countdown (top-left) */}
      {showTimerCountdown && (
        <div className="absolute top-4 left-4 z-10 rounded-lg border border-white/20 bg-black/60 px-3 py-2 font-mono text-lg text-white tabular-nums">
          {formatCountdown(timerCountdownRemaining!)}
        </div>
      )}

      {/* Dialogue-style toast message */}
      {toastMessage && (
        <div
          className={`absolute left-0 right-0 z-40 ${toastPosition === 'top' ? 'top-0' : 'bottom-0'}`}
          onClick={toastDismissMode === 'onInteraction' ? handleToastClick : undefined}
        >
          <div className={`mx-auto max-w-4xl px-4 ${toastPosition === 'top' ? 'pt-6' : 'pb-6'}`}>
            <div className={`rounded-xl border border-white/10 bg-black/70 backdrop-blur-md px-6 py-5 shadow-2xl ${toastDismissMode === 'onInteraction' ? 'cursor-pointer' : ''}`}>
              <div className="min-h-[3.5rem]">
                <p className="text-base leading-relaxed text-gray-100">
                  {toastTypewriter.displayed}
                  {!toastTypewriter.isDone && (
                    <span className="inline-block w-0.5 h-4 bg-gray-300 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
                {toastTypewriter.isDone && toastDismissMode === 'onInteraction' && (
                  <div className="mt-3 flex justify-end">
                    <ChevronDown className="h-5 w-5 text-gray-400 animate-bounce" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotspot choice overlay */}
      {hotspotChoiceOptions.length > 0 && (
        <div className={`absolute left-0 right-0 z-40 ${toastPosition === 'top' ? 'top-0' : 'bottom-0'}`}>
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

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-30 text-[10px] text-white/40 space-y-0.5">
        <p>Arrow keys / WASD to move</p>
        {settings.viewMode === 'side' && <p>Space to jump</p>}
        <p>E / Shift to interact</p>
      </div>
    </div>
  );
}
