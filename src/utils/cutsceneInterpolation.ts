/**
 * Cutscene keyframe interpolation engine.
 *
 * Provides pure functions to interpolate between keyframes using
 * easing functions from @tweenjs/tween.js.
 */
import { Easing } from '@tweenjs/tween.js';
import type {
  InterpolationMode,
  Keyframe,
  TransformKeyframes,
  CameraKeyframes,
} from '../stores/graphStore';

// ── Resolved state types ──

export interface TransformState {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

// ── Easing resolver ──

function getEasingFn(mode: InterpolationMode): (k: number) => number {
  switch (mode) {
    case 'linear':
      return Easing.Linear.None;
    case 'ease-in':
      return Easing.Quadratic.In;
    case 'ease-out':
      return Easing.Quadratic.Out;
    case 'ease-in-out':
      return Easing.Quadratic.InOut;
    case 'instant':
      return () => 1; // jump to end value immediately
    default:
      return Easing.Linear.None;
  }
}

// ── Core interpolation ──

/**
 * Interpolate a sorted array of keyframes at the given time.
 * Returns the interpolated value.
 *
 * @param keyframes - Sorted by `time` ascending
 * @param time - Current time in seconds
 * @param defaultValue - Fallback if no keyframes exist
 */
export function interpolateKeyframes(
  keyframes: Keyframe[],
  time: number,
  defaultValue: number = 0,
): number {
  if (keyframes.length === 0) return defaultValue;

  // Before first keyframe → use first keyframe's value
  if (time <= keyframes[0].time) return keyframes[0].value;

  // After last keyframe → use last keyframe's value
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return last.value;

  // Find the segment [a, b] containing `time`
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];

    if (time >= a.time && time < b.time) {
      const dt = b.time - a.time;
      if (dt === 0) return b.value;

      const rawProgress = (time - a.time) / dt;
      const easingFn = getEasingFn(b.interpolation);
      const easedProgress = easingFn(rawProgress);
      return a.value + (b.value - a.value) * easedProgress;
    }
  }

  return last.value;
}

// ── Transform interpolation ──

const DEFAULT_TRANSFORM: TransformState = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
};

export function interpolateTransform(
  transform: TransformKeyframes | undefined,
  time: number,
): TransformState {
  if (!transform) return { ...DEFAULT_TRANSFORM };

  return {
    x: interpolateKeyframes(transform.x, time, 0),
    y: interpolateKeyframes(transform.y, time, 0),
    rotation: interpolateKeyframes(transform.rotation, time, 0),
    scaleX: interpolateKeyframes(transform.scaleX, time, 1),
    scaleY: interpolateKeyframes(transform.scaleY, time, 1),
    opacity: interpolateKeyframes(transform.opacity, time, 1),
  };
}

// ── Camera interpolation ──

export function interpolateCamera(
  camera: CameraKeyframes | undefined,
  time: number,
): CameraState {
  if (!camera) return { x: 0, y: 0, zoom: 1 };

  return {
    x: interpolateKeyframes(camera.x, time, 0),
    y: interpolateKeyframes(camera.y, time, 0),
    zoom: interpolateKeyframes(camera.zoom, time, 1),
  };
}

// ── Volume interpolation ──

export function interpolateVolume(
  keyframes: Keyframe[] | undefined,
  time: number,
): number {
  if (!keyframes || keyframes.length === 0) return 80; // default 80%
  return interpolateKeyframes(keyframes, time, 80);
}
