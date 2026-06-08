/**
 * TimelineContainer — adapter between CutsceneData and @xzdarcy/react-timeline-editor.
 *
 * Converts CutsceneTrack/CutsceneClip to TimelineRow/TimelineAction,
 * and propagates changes back to the store.
 */
import React, { useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { Timeline, type TimelineState } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow, TimelineAction, TimelineEffect } from '@xzdarcy/timeline-engine';
import type { CutsceneData, CutsceneClip, CutsceneTrackType, TransformKeyframes } from '../../../stores/graphStore';
import { pauseHistory, resumeHistory } from '../../../utils/undoHistory';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';

const TRANSFORM_PROPS: (keyof TransformKeyframes)[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'];

function collectKeyframeTimes(clip: CutsceneClip): number[] {
  const times = new Set<number>();
  if (clip.transform) {
    for (const prop of TRANSFORM_PROPS) {
      for (const kf of clip.transform[prop]) {
        times.add(kf.time);
      }
    }
  }
  if (clip.volume) {
    for (const kf of clip.volume) {
      times.add(kf.time);
    }
  }
  return [...times].sort((a, b) => a - b);
}

// Track type colors
const TRACK_COLORS: Record<CutsceneTrackType, string> = {
  background: '#6366f1',  // indigo
  character: '#10b981',   // emerald
  camera: '#f59e0b',      // amber
  audio: '#ec4899',       // pink
  text: '#8b5cf6',        // violet
};

// Extend TimelineAction to carry our clip data
interface CutsceneTimelineAction extends TimelineAction {
  clipId: string;
  trackType: CutsceneTrackType;
}

export interface TimelineContainerRef {
  timelineState: TimelineState | null;
}

interface TimelineContainerProps {
  cutsceneData: CutsceneData;
  onTimeChange: (time: number) => void;
  onDataChange: (data: CutsceneData) => void;
  onClickAction: (clipId: string) => void;
  onDoubleClickRow: (trackId: string, time: number) => void;
  selectedClipId: string | null;
}

const TimelineContainer = forwardRef<TimelineContainerRef, TimelineContainerProps>(
  function TimelineContainer(
    { cutsceneData, onTimeChange, onDataChange, onClickAction, onDoubleClickRow, selectedClipId },
    ref,
  ) {
    const timelineRef = useRef<TimelineState>(null);

    useImperativeHandle(ref, () => ({
      get timelineState() {
        return timelineRef.current;
      },
    }));

    // Convert CutsceneData to TimelineRow[]
    const editorData: TimelineRow[] = useMemo(() => {
      return cutsceneData.tracks.filter((t) => t.type !== 'camera').map((track) => {
        const trackClips = cutsceneData.clips.filter((c) => c.trackId === track.id);
        const actions: CutsceneTimelineAction[] = trackClips.map((clip) => ({
          id: clip.id,
          start: clip.start,
          end: clip.end,
          effectId: track.type,
          selected: clip.id === selectedClipId,
          flexible: true,
          movable: !track.locked,
          clipId: clip.id,
          trackType: track.type,
        }));
        return {
          id: track.id,
          actions,
          rowHeight: 36,
        };
      });
    }, [cutsceneData.tracks, cutsceneData.clips, selectedClipId]);

    // Effects (one per track type, for coloring)
    const effects: Record<string, TimelineEffect> = useMemo(() => {
      const result: Record<string, TimelineEffect> = {};
      const trackTypes: CutsceneTrackType[] = ['background', 'character', 'audio', 'text'];
      for (const type of trackTypes) {
        result[type] = {
          id: type,
          name: type,
        };
      }
      return result;
    }, []);

    // onChange from timeline → update clips in CutsceneData
    const handleChange = useCallback(
      (newEditorData: TimelineRow[]) => {
        // Rebuild clips array from the new editor data
        const updatedClips: CutsceneClip[] = [];
        for (const row of newEditorData) {
          for (const action of row.actions) {
            // Find existing clip to preserve its data
            const existingClip = cutsceneData.clips.find((c) => c.id === action.id);
            if (existingClip) {
              updatedClips.push({
                ...existingClip,
                start: action.start,
                end: action.end,
                trackId: row.id,
              });
            }
          }
        }

        onDataChange({
          ...cutsceneData,
          clips: updatedClips,
        });
      },
      [cutsceneData, onDataChange],
    );

    // Custom action rendering
    const getActionRender = useCallback(
      (action: TimelineAction) => {
        const csAction = action as CutsceneTimelineAction;
        const clip = cutsceneData.clips.find((c) => c.id === csAction.clipId);
        const color = TRACK_COLORS[csAction.trackType] || '#666';

        const keyframeTimes = clip ? collectKeyframeTimes(clip) : [];
        const clipDuration = action.end - action.start;

        return (
          <div
            className="h-full rounded-sm flex items-center px-2 text-xs text-white font-medium truncate cursor-pointer select-none"
            style={{
              position: 'relative',
              backgroundColor: color + '80',
              border: action.selected ? `2px solid ${color}` : `1px solid ${color}60`,
            }}
          >
            {keyframeTimes.map((t) => (
              <div
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeChange(action.start + t);
                }}
                title={`Keyframe @ ${t.toFixed(2)}s`}
                className="absolute flex items-center justify-center cursor-pointer group"
                style={{
                  left: `${(t / clipDuration) * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                }}
              >
                <div
                  className="transition-colors group-hover:bg-amber-300"
                  style={{
                    width: 6,
                    height: 6,
                    backgroundColor: '#fbbf24',
                    transform: 'rotate(45deg)',
                    border: '1px solid rgba(0,0,0,0.3)',
                  }}
                />
              </div>
            ))}
          </div>
        );
      },
      [cutsceneData.clips, onTimeChange],
    );

    // Custom scale rendering (show seconds)
    const getScaleRender = useCallback((scale: number) => {
      const mins = Math.floor(scale / 60);
      const secs = Math.floor(scale % 60);
      return <span className="text-[10px] text-gray-400">{mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}</span>;
    }, []);

    // Handle click on action → select clip
    const handleClickAction = useCallback(
      (_e: React.MouseEvent, param: { action: TimelineAction; row: TimelineRow }) => {
        onClickAction(param.action.id);
      },
      [onClickAction],
    );

    // Handle double-click on row → open asset picker
    const handleDoubleClickRow = useCallback(
      (_e: React.MouseEvent, param: { row: TimelineRow; time: number }) => {
        onDoubleClickRow(param.row.id, param.time);
      },
      [onDoubleClickRow],
    );

    // Handle cursor drag → update time
    const handleCursorDrag = useCallback(
      (time: number) => {
        onTimeChange(Math.max(0, Math.min(time, cutsceneData.duration)));
      },
      [onTimeChange, cutsceneData.duration],
    );

    const handleActionMoveStart = useCallback(() => { pauseHistory(); }, []);
    const handleActionMoveEnd = useCallback(() => { resumeHistory(); }, []);
    const handleActionResizeStart = useCallback(() => { pauseHistory(); }, []);
    const handleActionResizeEnd = useCallback(() => { resumeHistory(); }, []);

    return (
      <div className="w-full h-full cutscene-timeline-container">
        <Timeline
          ref={timelineRef}
          editorData={editorData}
          effects={effects}
          scale={1}
          scaleWidth={160}
          scaleSplitCount={10}
          minScaleCount={cutsceneData.duration}
          maxScaleCount={cutsceneData.duration}
          startLeft={20}
          rowHeight={36}
          gridSnap={true}
          dragLine={true}
          autoScroll={true}
          getActionRender={getActionRender}
          getScaleRender={getScaleRender}
          onChange={handleChange}
          onClickAction={handleClickAction}
          onDoubleClickRow={handleDoubleClickRow}
          onActionMoveStart={handleActionMoveStart}
          onActionMoveEnd={handleActionMoveEnd}
          onActionResizeStart={handleActionResizeStart}
          onActionResizeEnd={handleActionResizeEnd}
          onCursorDrag={handleCursorDrag}
          onCursorDragEnd={handleCursorDrag}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  },
);

export default TimelineContainer;
