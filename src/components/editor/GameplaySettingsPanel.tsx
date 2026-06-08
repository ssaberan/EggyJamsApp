import { useState, useEffect, useCallback } from 'react';
import { Gamepad2, Zap } from 'lucide-react';
import AssetPicker from './AssetPicker';
import {
  useGraphStore,
  type SceneNodeData,
  type GameplaySettings,
  type BackgroundPosition,
} from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const DEFAULT_SETTINGS: GameplaySettings = {
  viewMode: 'side',
  backgroundImageId: null,
  backgroundMusicId: null,
  characterSpriteId: null,
  characterStartPosition: { x: 50, y: 90 },
  characterFrontFace: 'right',
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
  resetPositionOnEnter: true,
  characterSpeed: 30,
  gravity: 120,
  jumpStrength: 55,
};

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface GameplaySettingsPanelProps {
  nodeId: string;
}

// ────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────

export default function GameplaySettingsPanel({ nodeId }: GameplaySettingsPanelProps) {
  const { nodes } = useActiveGraph();
  const updateGameplaySettings = useGraphStore((s) => s.updateGameplaySettings);

  const node = nodes.find((n) => n.id === nodeId);
  const settings: GameplaySettings = {
    ...DEFAULT_SETTINGS,
    ...((node?.data as SceneNodeData | undefined)?.gameplaySettings ?? {}),
  };

  // ── Local state for numeric inputs (validate on blur, not on every keystroke) ──
  const storeScale = settings.characterScale ?? 100;
  const storeX = Math.round(settings.characterStartPosition.x);
  const storeY = Math.round(settings.characterStartPosition.y);

  const [scaleInput, setScaleInput] = useState(String(storeScale));
  const [xInput, setXInput] = useState(String(storeX));
  const [yInput, setYInput] = useState(String(storeY));

  useEffect(() => { setScaleInput(String(storeScale)); }, [storeScale]);
  useEffect(() => { setXInput(String(storeX)); }, [storeX]);
  useEffect(() => { setYInput(String(storeY)); }, [storeY]);

  const handleScaleBlur = useCallback(() => {
    const parsed = Number(scaleInput) || 100;
    const clamped = clamp(parsed, 10, 500);
    updateGameplaySettings(nodeId, { characterScale: clamped });
    setScaleInput(String(clamped));
  }, [scaleInput, nodeId, updateGameplaySettings]);

  const handleXBlur = useCallback(() => {
    const parsed = Number(xInput) || 0;
    const clamped = clamp(Math.round(parsed), 0, 100);
    updateGameplaySettings(nodeId, {
      characterStartPosition: { ...settings.characterStartPosition, x: clamped },
    });
    setXInput(String(clamped));
  }, [xInput, nodeId, settings.characterStartPosition, updateGameplaySettings]);

  const handleYBlur = useCallback(() => {
    const parsed = Number(yInput) || 0;
    const clamped = clamp(Math.round(parsed), 0, 100);
    updateGameplaySettings(nodeId, {
      characterStartPosition: { ...settings.characterStartPosition, y: clamped },
    });
    setYInput(String(clamped));
  }, [yInput, nodeId, settings.characterStartPosition, updateGameplaySettings]);

  // ── Physics local state ──
  const storeSpeed = settings.characterSpeed ?? 30;
  const storeGravity = settings.gravity ?? 120;
  const storeJump = settings.jumpStrength ?? 55;

  const [speedInput, setSpeedInput] = useState(String(storeSpeed));
  const [gravityInput, setGravityInput] = useState(String(storeGravity));
  const [jumpInput, setJumpInput] = useState(String(storeJump));

  useEffect(() => { setSpeedInput(String(storeSpeed)); }, [storeSpeed]);
  useEffect(() => { setGravityInput(String(storeGravity)); }, [storeGravity]);
  useEffect(() => { setJumpInput(String(storeJump)); }, [storeJump]);

  const handleSpeedBlur = useCallback(() => {
    const parsed = Number(speedInput) || 30;
    const clamped = clamp(parsed, 1, 200);
    updateGameplaySettings(nodeId, { characterSpeed: clamped });
    setSpeedInput(String(clamped));
  }, [speedInput, nodeId, updateGameplaySettings]);

  const handleGravityBlur = useCallback(() => {
    const parsed = Number(gravityInput) || 120;
    const clamped = clamp(parsed, 1, 500);
    updateGameplaySettings(nodeId, { gravity: clamped });
    setGravityInput(String(clamped));
  }, [gravityInput, nodeId, updateGameplaySettings]);

  const handleJumpBlur = useCallback(() => {
    const parsed = Number(jumpInput) || 55;
    const clamped = clamp(parsed, 1, 200);
    updateGameplaySettings(nodeId, { jumpStrength: clamped });
    setJumpInput(String(clamped));
  }, [jumpInput, nodeId, updateGameplaySettings]);

  // ── Camera tracking local state ──
  const storeCameraSize = settings.cameraSize ?? 50;
  const [cameraSizeInput, setCameraSizeInput] = useState(String(storeCameraSize));
  useEffect(() => { setCameraSizeInput(String(storeCameraSize)); }, [storeCameraSize]);

  const handleCameraSizeBlur = useCallback(() => {
    const parsed = Number(cameraSizeInput) || 50;
    const clamped = clamp(Math.round(parsed), 1, 100);
    updateGameplaySettings(nodeId, { cameraSize: clamped });
    setCameraSizeInput(String(clamped));
  }, [cameraSizeInput, nodeId, updateGameplaySettings]);

  return (
    <div className="space-y-4">
      {/* ── Section header ── */}
      <div className="flex items-center gap-1.5">
        <Gamepad2 className="h-3.5 w-3.5 text-gray-500 dark:text-gray-600 dark:text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500">
          Gameplay Settings
        </span>
      </div>

      {/* View Mode */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
          View Mode
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => {
              const cf = settings.characterFrontFace;
              updateGameplaySettings(nodeId, {
                viewMode: 'side',
                ...(cf === 'up' || cf === 'down' ? { characterFrontFace: 'right' as const } : {}),
              });
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              settings.viewMode === 'side'
                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Side View
          </button>
          <button
            onClick={() => updateGameplaySettings(nodeId, { viewMode: 'top_down' })}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              settings.viewMode === 'top_down'
                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Top Down
          </button>
        </div>
      </div>

      {/* Background */}
      <AssetPicker
        label="Background"
        category="Background"
        value={settings.backgroundImageId}
        onChange={(assetId) => updateGameplaySettings(nodeId, { backgroundImageId: assetId })}
      />

      {/* Background Size */}
      {settings.backgroundImageId && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Background Size
          </label>
          <div className="flex gap-1">
            {(['cover', 'contain', 'fill'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateGameplaySettings(nodeId, { backgroundSize: mode })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer capitalize ${
                  (settings.backgroundSize ?? 'cover') === mode
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                    : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Background Position (for contain and cover) */}
      {settings.backgroundImageId && ((settings.backgroundSize ?? 'cover') === 'contain' || (settings.backgroundSize ?? 'cover') === 'cover') && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Background Position
          </label>
          <div className="flex gap-1">
            {([['start', 'Start'], ['center', 'Center'], ['end', 'End']] as const).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => updateGameplaySettings(nodeId, { backgroundPosition: pos as BackgroundPosition })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  (settings.backgroundPosition ?? 'center') === pos
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                    : 'text-gray-500 dark:text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Background Music */}
      <AssetPicker
        label="Background Music"
        category="BGM"
        value={settings.backgroundMusicId}
        onChange={(assetId) => updateGameplaySettings(nodeId, { backgroundMusicId: assetId })}
      />

      {/* Character Sprite(s) — side: idle / walking / jumping up / falling down; top-down: idle + walking per axis */}
      {settings.viewMode === 'side' ? (
        <>
          <AssetPicker
            label="Character Sprite (idle)"
            category="Character"
            value={settings.characterSpriteIdIdleSide ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdIdleSide: assetId })}
          />
          <AssetPicker
            label="Character Sprite (walking)"
            category="Character"
            value={settings.characterSpriteIdWalkingSide ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdWalkingSide: assetId })}
          />
          <AssetPicker
            label="Character Sprite (jumping up)"
            category="Character"
            value={settings.characterSpriteIdJumpingUpSide ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdJumpingUpSide: assetId })}
          />
          <AssetPicker
            label="Character Sprite (falling down)"
            category="Character"
            value={settings.characterSpriteIdFallingDownSide ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdFallingDownSide: assetId })}
          />
        </>
      ) : (
        <>
          <AssetPicker
            label="Character Sprite — Idle (horizontal)"
            category="Character"
            value={settings.characterSpriteIdIdleHorizontal ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdIdleHorizontal: assetId })}
          />
          <AssetPicker
            label="Character Sprite — Walking (horizontal)"
            category="Character"
            value={settings.characterSpriteIdWalkingHorizontal ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdWalkingHorizontal: assetId })}
          />
          <AssetPicker
            label="Character Sprite — Idle (vertical)"
            category="Character"
            value={settings.characterSpriteIdIdleVertical ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdIdleVertical: assetId })}
          />
          <AssetPicker
            label="Character Sprite — Walking (vertical)"
            category="Character"
            value={settings.characterSpriteIdWalkingVertical ?? null}
            onChange={(assetId) => updateGameplaySettings(nodeId, { characterSpriteIdWalkingVertical: assetId })}
          />
        </>
      )}

      {/* Character Size */}
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
          Character Size
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={500}
            value={scaleInput}
            onChange={(e) => setScaleInput(e.target.value)}
            onBlur={handleScaleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
          />
          <span className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500">%</span>
        </div>
      </div>

      {/* Character Front Face — side: L/R only; top-down: horizontal L/R + vertical U/D */}
      {settings.viewMode === 'side' ? (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Character Front Face
          </label>
          <select
            value={settings.characterFrontFace === 'up' || settings.characterFrontFace === 'down' ? 'right' : settings.characterFrontFace}
            onChange={(e) => updateGameplaySettings(nodeId, { characterFrontFace: e.target.value as 'left' | 'right' })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
              Horizontal Front Face
            </label>
            <select
              value={settings.characterFrontFaceHorizontal ?? 'right'}
              onChange={(e) => updateGameplaySettings(nodeId, { characterFrontFaceHorizontal: e.target.value as 'left' | 'right' })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
              Vertical Front Face
            </label>
            <select
              value={settings.characterFrontFaceVertical ?? 'down'}
              onChange={(e) => updateGameplaySettings(nodeId, { characterFrontFaceVertical: e.target.value as 'up' | 'down' })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </div>
        </>
      )}

      {/* Reset Position on Enter */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.resetPositionOnEnter !== false}
            onChange={(e) => updateGameplaySettings(nodeId, { resetPositionOnEnter: e.target.checked })}
            className="rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 cursor-pointer"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300">Reset position on enter</span>
        </label>
        <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
          When enabled, the character will start at the position below when entering this scene. When disabled, the character keeps its position from the previous scene.
        </p>
      </div>

      {/* Character Start Position — only shown when reset is enabled */}
      {settings.resetPositionOnEnter !== false && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Start Position
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-gray-500 dark:text-gray-600 dark:text-gray-500">X %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={xInput}
                onChange={(e) => setXInput(e.target.value)}
                onBlur={handleXBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-gray-500 dark:text-gray-600 dark:text-gray-500">Y %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={yInput}
                onChange={(e) => setYInput(e.target.value)}
                onBlur={handleYBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">Drag the character marker on canvas to reposition.</p>
        </div>
      )}

      {/* Track Character with Camera */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.trackCharacterWithCamera ?? false}
            onChange={(e) => updateGameplaySettings(nodeId, { trackCharacterWithCamera: e.target.checked })}
            className="rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 cursor-pointer"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300">Track character with camera</span>
        </label>
        <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
          When enabled, the camera follows the character. The view zooms in based on the camera size below and stays clamped within the scene bounds.
        </p>
      </div>

      {/* Camera Size — only shown when tracking is enabled */}
      {settings.trackCharacterWithCamera && (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
            Camera Size
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={cameraSizeInput}
              onChange={(e) => setCameraSizeInput(e.target.value)}
              onBlur={handleCameraSizeBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
            />
            <span className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500">%</span>
          </div>
          <p className="text-[9px] text-gray-500 dark:text-gray-600 mt-1">
            Percentage of the full scene visible at once (smaller = more zoomed in).
          </p>
        </div>
      )}

      {/* ── Physics ── */}
      <div className="border-t border-gray-300 dark:border-gray-700 pt-3 mt-3">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap className="h-3.5 w-3.5 text-gray-500 dark:text-gray-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
            Physics
          </span>
        </div>

        <div className="space-y-3">
          {/* Character Speed */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
              Character Speed
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={speedInput}
              onChange={(e) => setSpeedInput(e.target.value)}
              onBlur={handleSpeedBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
            />
          </div>

          {/* Gravity — side view only */}
          {settings.viewMode === 'side' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
                Gravity
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={gravityInput}
                onChange={(e) => setGravityInput(e.target.value)}
                onBlur={handleGravityBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
              />
            </div>
          )}

          {/* Jump Strength — side view only */}
          {settings.viewMode === 'side' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-600 dark:text-gray-500 mb-1">
                Jump Strength
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onBlur={handleJumpBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="input-no-spinner w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-orange-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
