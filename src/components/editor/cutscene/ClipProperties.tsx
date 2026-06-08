/**
 * ClipProperties — properties panel for a selected cutscene clip.
 *
 * Shows track-type-specific editors with keyframe controls for
 * transform, volume, and other animatable properties.
 */
import React, { useCallback, useMemo } from 'react';
import {
  Trash2,
  Image as ImageIcon,
  User,
  Music,
  Type,
  Video,
} from 'lucide-react';
import type {
  CutsceneClip,
  CutsceneData,
  CutsceneTrack,
  CutsceneTrackType,
  TransformKeyframes,
  Keyframe,
  BackgroundPosition,
} from '../../../stores/graphStore';
import { interpolateTransform, interpolateVolume } from '../../../utils/cutsceneInterpolation';
import AssetPicker from '../AssetPicker';
import type { AssetCategory } from '../../../stores/assetStore';
import { useDebouncedHistory } from '../../../utils/undoHistory';
import KeyframeEditor from './KeyframeEditor';

interface ClipPropertiesProps {
  clip: CutsceneClip;
  track: CutsceneTrack;
  cutsceneData: CutsceneData;
  currentTime: number;
  onUpdateClip: (clipId: string, patch: Partial<CutsceneClip>) => void;
  onDeleteClip: (clipId: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
      {children}
    </h4>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
      <span className="text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-20 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

const TRACK_ICONS: Record<CutsceneTrackType, React.ComponentType<{ className?: string }>> = {
  background: ImageIcon,
  character: User,
  camera: Video,
  audio: Music,
  text: Type,
};

const TRACK_ASSET_CATEGORY: Partial<Record<CutsceneTrackType, AssetCategory>> = {
  background: 'Background',
  character: 'Character',
  audio: 'BGM',
};

const EMPTY_KFS: Keyframe[] = [];

export default function ClipProperties({
  clip,
  track,
  cutsceneData,
  currentTime,
  onUpdateClip,
  onDeleteClip,
}: ClipPropertiesProps) {
  const Icon = TRACK_ICONS[track.type] || Video;
  const debouncedHistory = useDebouncedHistory();

  // Clip-local time for transform interpolation
  const clipLocalTime = Math.max(0, currentTime - clip.start);

  const handleTimingChange = useCallback(
    (field: 'start' | 'end', value: number) => {
      debouncedHistory();
      const clamped = Math.max(0, Math.min(value, cutsceneData.duration));
      onUpdateClip(clip.id, { [field]: clamped });
    },
    [clip.id, cutsceneData.duration, onUpdateClip, debouncedHistory],
  );

  const assetCategory = TRACK_ASSET_CATEGORY[track.type];

  // ── Transform keyframe helpers ──
  const transform = clip.transform;
  const tfState = useMemo(
    () => interpolateTransform(transform, clipLocalTime),
    [transform, clipLocalTime],
  );

  const handleTransformKfChange = useCallback(
    (prop: keyof TransformKeyframes, keyframes: Keyframe[]) => {
      debouncedHistory();
      const existing = clip.transform ?? {
        x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      };
      onUpdateClip(clip.id, {
        transform: { ...existing, [prop]: keyframes },
      });
    },
    [clip.id, clip.transform, onUpdateClip, debouncedHistory],
  );

  // ── Volume keyframe helper ──
  const volumeValue = useMemo(
    () => interpolateVolume(clip.volume, clipLocalTime),
    [clip.volume, clipLocalTime],
  );

  const handleVolumeKfChange = useCallback(
    (keyframes: Keyframe[]) => {
      debouncedHistory();
      onUpdateClip(clip.id, { volume: keyframes });
    },
    [clip.id, onUpdateClip, debouncedHistory],
  );

  const debouncedUpdateClip = useCallback(
    (patch: Partial<CutsceneClip>) => {
      debouncedHistory();
      onUpdateClip(clip.id, patch);
    },
    [clip.id, onUpdateClip, debouncedHistory],
  );

  return (
    <div className="space-y-4 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
          {track.label} Clip
        </span>
      </div>

      {/* Timing */}
      <div className="space-y-1.5">
        <SectionLabel>Timing</SectionLabel>
        <NumberField
          label="Start (s)"
          value={clip.start}
          onChange={(v) => handleTimingChange('start', v)}
          min={0}
          max={clip.end}
        />
        <NumberField
          label="End (s)"
          value={clip.end}
          onChange={(v) => handleTimingChange('end', v)}
          min={clip.start}
          max={cutsceneData.duration}
        />
      </div>

      {/* Asset picker (for bg, character, audio) */}
      {assetCategory && (
        <div className="space-y-1.5">
          <SectionLabel>Asset</SectionLabel>
          <AssetPicker
            category={assetCategory}
            value={clip.assetId ?? null}
            onChange={(assetId) => onUpdateClip(clip.id, { assetId })}
            compact
          />
        </div>
      )}

      {/* ── Background Size Mode ── */}
      {track.type === 'background' && clip.assetId && (
        <div className="space-y-1.5">
          <SectionLabel>Background Size</SectionLabel>
          <div className="flex gap-1">
            {(['cover', 'contain', 'fill'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onUpdateClip(clip.id, { backgroundSize: mode })}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer capitalize ${
                  (clip.backgroundSize ?? 'cover') === mode
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

      {/* ── Background Position (for contain and cover) ── */}
      {track.type === 'background' && clip.assetId && ((clip.backgroundSize ?? 'cover') === 'contain' || (clip.backgroundSize ?? 'cover') === 'cover') && (
        <div className="space-y-1.5">
          <SectionLabel>Background Position</SectionLabel>
          <div className="flex gap-1">
            {([['start', 'Start'], ['center', 'Center'], ['end', 'End']] as const).map(([pos, label]) => (
              <button
                key={pos}
                onClick={() => onUpdateClip(clip.id, { backgroundPosition: pos as BackgroundPosition })}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  (clip.backgroundPosition ?? 'center') === pos
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

      {/* ── Character: Transform Keyframes ── */}
      {(track.type === 'character' || track.type === 'background') && (
        <div className="space-y-2">
          <SectionLabel>Transform</SectionLabel>
          <KeyframeEditor
            label="X"
            keyframes={transform?.x ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.x}
            defaultValue={tfState.x}
            onChange={(kfs) => handleTransformKfChange('x', kfs)}
          />
          <KeyframeEditor
            label="Y"
            keyframes={transform?.y ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.y}
            defaultValue={tfState.y}
            onChange={(kfs) => handleTransformKfChange('y', kfs)}
          />
          <KeyframeEditor
            label="Rotation"
            keyframes={transform?.rotation ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.rotation}
            defaultValue={tfState.rotation}
            onChange={(kfs) => handleTransformKfChange('rotation', kfs)}
            min={-360}
            max={360}
            step={1}
          />
          <KeyframeEditor
            label="Scale X"
            keyframes={transform?.scaleX ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.scaleX}
            defaultValue={tfState.scaleX}
            onChange={(kfs) => handleTransformKfChange('scaleX', kfs)}
            min={0}
            max={10}
            step={0.05}
          />
          <KeyframeEditor
            label="Scale Y"
            keyframes={transform?.scaleY ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.scaleY}
            defaultValue={tfState.scaleY}
            onChange={(kfs) => handleTransformKfChange('scaleY', kfs)}
            min={0}
            max={10}
            step={0.05}
          />
          <KeyframeEditor
            label="Opacity"
            keyframes={transform?.opacity ?? EMPTY_KFS}
            currentTime={clipLocalTime}
            currentValue={tfState.opacity}
            defaultValue={tfState.opacity}
            onChange={(kfs) => handleTransformKfChange('opacity', kfs)}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      )}

      {/* Character: Z-Index */}
      {track.type === 'character' && (
        <div className="space-y-1.5">
          <SectionLabel>Layer</SectionLabel>
          <NumberField
            label="Z-Index"
            value={clip.zIndex ?? 0}
            onChange={(v) => debouncedUpdateClip({ zIndex: v })}
            min={-100}
            max={100}
            step={1}
          />
        </div>
      )}

      {/* ── Audio: Type + Volume Keyframes ── */}
      {track.type === 'audio' && (
        <>
          <div className="space-y-1.5">
            <SectionLabel>Audio Type</SectionLabel>
            <div className="flex gap-1">
              {(['bgm', 'sfx'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onUpdateClip(clip.id, { audioType: type })}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium uppercase transition-colors ${
                    (clip.audioType ?? 'bgm') === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <SectionLabel>Volume</SectionLabel>
            <KeyframeEditor
              label="Volume"
              keyframes={clip.volume ?? EMPTY_KFS}
              currentTime={clipLocalTime}
              currentValue={volumeValue}
              defaultValue={80}
              onChange={handleVolumeKfChange}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </>
      )}

      {/* ── Text ── */}
      {track.type === 'text' && (
        <div className="space-y-2">
          <SectionLabel>Text Content</SectionLabel>
          <textarea
            value={clip.text ?? ''}
            onChange={(e) => debouncedUpdateClip({ text: e.target.value })}
            rows={3}
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none resize-none"
            placeholder="Enter text..."
          />

          <SectionLabel>Font</SectionLabel>
          <input
            type="text"
            value={clip.fontFamily ?? ''}
            onChange={(e) => debouncedUpdateClip({ fontFamily: e.target.value })}
            placeholder="e.g. Inter, serif"
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
          />

          <div className="flex gap-2">
            <NumberField
              label="Size"
              value={clip.fontSize ?? 16}
              onChange={(v) => debouncedUpdateClip({ fontSize: v })}
              min={8}
              max={72}
              step={1}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Color</label>
            <input
              type="color"
              value={clip.fontColor ?? '#ffffff'}
              onChange={(e) => debouncedUpdateClip({ fontColor: e.target.value })}
              className="h-6 w-8 rounded border border-gray-600 bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={clip.typewriterEnabled ?? false}
                onChange={(e) => onUpdateClip(clip.id, { typewriterEnabled: e.target.checked })}
                className="rounded"
              />
              Typewriter
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={clip.textShadow ?? false}
                onChange={(e) => onUpdateClip(clip.id, { textShadow: e.target.checked })}
                className="rounded"
              />
              Shadow
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={clip.textOutline ?? false}
                onChange={(e) => onUpdateClip(clip.id, { textOutline: e.target.checked })}
                className="rounded"
              />
              Outline
            </label>
          </div>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDeleteClip(clip.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 transition-colors"
      >
        <Trash2 className="h-3 w-3" />
        Delete Clip
      </button>
    </div>
  );
}
