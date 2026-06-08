/**
 * CutsceneStage — 16:9 preview viewport for the cutscene editor.
 *
 * Renders active clips at the given time, applying camera transforms
 * and sprite transforms via interpolation.
 */
import { useMemo } from 'react';
import {
  BG_POSITION_CSS,
  type CutsceneData,
  type CutsceneClip,
  type CutsceneTrack,
} from '../../../stores/graphStore';
import {
  interpolateTransform,
  interpolateCamera,
} from '../../../utils/cutsceneInterpolation';
import { editorStageAspectStyle } from '../../player/GameStage';

interface CutsceneStageProps {
  cutsceneData: CutsceneData;
  currentTime: number;
  assetMap: Record<string, string>;
}

function getTrackForClip(tracks: CutsceneTrack[], clip: CutsceneClip): CutsceneTrack | undefined {
  return tracks.find((t) => t.id === clip.trackId);
}

export default function CutsceneStage({ cutsceneData, currentTime, assetMap }: CutsceneStageProps) {
  const { tracks, clips, camera } = cutsceneData;

  // Get active clips (clips whose [start, end) contains currentTime)
  const activeClips = useMemo(() => {
    return clips.filter((c) => c.start <= currentTime && c.end > currentTime);
  }, [clips, currentTime]);

  // Separate by track type
  const activeByType = useMemo(() => {
    const result: Record<string, CutsceneClip[]> = {
      background: [],
      character: [],
      audio: [],
      text: [],
      camera: [],
    };
    for (const clip of activeClips) {
      const track = getTrackForClip(tracks, clip);
      if (track) {
        if (!result[track.type]) result[track.type] = [];
        result[track.type].push(clip);
      }
    }
    return result;
  }, [activeClips, tracks]);

  // Camera transform
  const cameraState = useMemo(() => interpolateCamera(camera, currentTime), [camera, currentTime]);

  // Active background (last one wins)
  const bgClip = activeByType.background.length > 0
    ? activeByType.background[activeByType.background.length - 1]
    : null;
  const bgUrl = bgClip?.assetId ? assetMap[bgClip.assetId] ?? null : null;

  // Sort characters by z-index
  const sortedCharacters = useMemo(() => {
    return [...activeByType.character].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }, [activeByType.character]);

  // Text clips
  const textClips = activeByType.text;

  return (
    <div className="relative w-full overflow-hidden bg-gray-950 rounded-lg border border-gray-700" style={editorStageAspectStyle}>
      {/* Camera wrapper — applies pan & zoom */}
      <div
        className="absolute inset-0 origin-center"
        style={{
          transform: `translate(${-cameraState.x}px, ${-cameraState.y}px) scale(${cameraState.zoom})`,
          transition: 'none',
        }}
      >
        {/* Background */}
        {bgUrl ? (
          <img
            key={bgUrl}
            src={bgUrl}
            alt="Background"
            className={`absolute inset-0 h-full w-full ${{ cover: 'object-cover', contain: 'object-contain', fill: 'object-fill' }[bgClip?.backgroundSize ?? 'cover']}`}
            style={{ objectPosition: BG_POSITION_CSS[bgClip?.backgroundPosition ?? 'center'] }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-950" />
        )}

        {/* Character sprites */}
        {sortedCharacters.map((clip) => {
          const spriteUrl = clip.assetId ? assetMap[clip.assetId] ?? null : null;
          if (!spriteUrl) return null;

          const clipLocalTime = currentTime - clip.start;
          const tfState = interpolateTransform(clip.transform, clipLocalTime);

          return (
            <img
              key={clip.id}
              src={spriteUrl}
              alt="Character"
              className="absolute pointer-events-none"
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

      {/* Text overlays (not affected by camera) */}
      {textClips.map((clip) => (
        <div
          key={clip.id}
          className="absolute inset-x-0 bottom-0 z-20 pb-4 pointer-events-none"
        >
          <div className="mx-auto max-w-[80%] px-4">
            <div
              className="rounded-lg bg-black/70 backdrop-blur-sm px-4 py-3 text-center border border-white/10"
              style={{
                fontFamily: clip.fontFamily || 'inherit',
                fontSize: clip.fontSize ? `${clip.fontSize}px` : '16px',
                color: clip.fontColor || '#ffffff',
                textShadow: clip.textShadow ? '2px 2px 4px rgba(0,0,0,0.8)' : undefined,
                WebkitTextStroke: clip.textOutline ? '1px rgba(0,0,0,0.5)' : undefined,
              }}
            >
              {clip.text || ''}
            </div>
          </div>
        </div>
      ))}

      {/* No content indicator */}
      {activeClips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
          No active clips at this time
        </div>
      )}
    </div>
  );
}
