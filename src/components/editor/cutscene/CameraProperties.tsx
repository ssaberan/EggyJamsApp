/**
 * CameraProperties — properties panel for camera keyframes.
 *
 * Edits the global camera.x, camera.y, and camera.zoom keyframes
 * stored on CutsceneData.camera.
 */
import { useCallback, useMemo } from 'react';
import { Video } from 'lucide-react';
import type { CutsceneData, CameraKeyframes, Keyframe } from '../../../stores/graphStore';
import { interpolateCamera } from '../../../utils/cutsceneInterpolation';
import { useDebouncedHistory } from '../../../utils/undoHistory';
import KeyframeEditor from './KeyframeEditor';

interface CameraPropertiesProps {
  cutsceneData: CutsceneData;
  currentTime: number;
  onDataChange: (data: CutsceneData) => void;
}

export default function CameraProperties({
  cutsceneData,
  currentTime,
  onDataChange,
}: CameraPropertiesProps) {
  const camera = cutsceneData.camera;
  const debouncedHistory = useDebouncedHistory();
  const camState = useMemo(
    () => interpolateCamera(camera, currentTime),
    [camera, currentTime],
  );

  const handleCameraKfChange = useCallback(
    (prop: keyof CameraKeyframes, keyframes: Keyframe[]) => {
      debouncedHistory();
      onDataChange({
        ...cutsceneData,
        camera: { ...cutsceneData.camera, [prop]: keyframes },
      });
    },
    [cutsceneData, onDataChange, debouncedHistory],
  );

  return (
    <div className="space-y-4 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">
          Camera
        </span>
      </div>

      <p className="text-[11px] text-gray-500 leading-snug">
        Add keyframes to animate the camera's position and zoom over the entire timeline.
      </p>

      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Pan &amp; Zoom
        </h4>
        <KeyframeEditor
          label="Pan X"
          keyframes={camera.x}
          currentTime={currentTime}
          currentValue={camState.x}
          defaultValue={camState.x}
          onChange={(kfs) => handleCameraKfChange('x', kfs)}
          step={1}
        />
        <KeyframeEditor
          label="Pan Y"
          keyframes={camera.y}
          currentTime={currentTime}
          currentValue={camState.y}
          defaultValue={camState.y}
          onChange={(kfs) => handleCameraKfChange('y', kfs)}
          step={1}
        />
        <KeyframeEditor
          label="Zoom"
          keyframes={camera.zoom}
          currentTime={currentTime}
          currentValue={camState.zoom}
          defaultValue={camState.zoom}
          onChange={(kfs) => handleCameraKfChange('zoom', kfs)}
          min={0.1}
          max={5}
          step={0.05}
        />
      </div>
    </div>
  );
}
