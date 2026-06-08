/**
 * CutsceneEditor — full video-editor-style timeline editor.
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────┐
 * │ Toolbar (Back, Title, Duration, Skip, Loop)            │
 * ├────────────────────────────────┬───────────────────────┤
 * │ Stage (16:9 preview)           │ Properties Panel      │
 * │                                │ (selected clip or cam) │
 * ├────────────────────────────────┴───────────────────────┤
 * │ Transport: Play │ Pause │ Stop   00:05 / 00:30         │
 * ├────────────────────────────────────────────────────────┤
 * │ Timeline (full width, react-timeline-editor)           │
 * └────────────────────────────────────────────────────────┘
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Play, Pause, Square, Repeat } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { useActiveGraph } from '../../hooks/useActiveGraph';
import type { CutsceneData, CutsceneClip, SceneNodeData } from '../../stores/graphStore';
import { DEFAULT_CUTSCENE_DATA } from '../../stores/graphStore';
import { useAssetStore } from '../../stores/assetStore';
import { interpolateVolume } from '../../utils/cutsceneInterpolation';
import CutsceneStage from './cutscene/CutsceneStage';
import TimelineContainer, { type TimelineContainerRef } from './cutscene/TimelineContainer';
import ClipProperties from './cutscene/ClipProperties';
import CameraProperties from './cutscene/CameraProperties';

interface CutsceneEditorProps {
  nodeId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CutsceneEditor({ nodeId }: CutsceneEditorProps) {
  // ── Store bindings ──
  const { nodes } = useActiveGraph();
  const node = nodes.find((n) => n.id === nodeId);
  const setEditingNodeId = useGraphStore((s) => s.setEditingNodeId);
  const updateCutsceneData = useGraphStore((s) => s.updateCutsceneData);
  const selectedClipId = useGraphStore((s) => s.selectedCutsceneClipId);
  const setSelectedClipId = useGraphStore((s) => s.setSelectedCutsceneClipId);
  const showCameraPanel = useGraphStore((s) => s.showCutsceneCameraPanel);
  const setShowCameraPanel = useGraphStore((s) => s.setShowCutsceneCameraPanel);

  const nodeData = node?.data as SceneNodeData | undefined;
  const cutsceneData: CutsceneData = useMemo(
    () => nodeData?.cutsceneData ?? JSON.parse(JSON.stringify(DEFAULT_CUTSCENE_DATA)),
    [nodeData?.cutsceneData],
  );

  // Build asset map from asset store
  const assets = useAssetStore((s) => s.assets);
  const assetMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of assets) {
      map[a.id] = a.file_url;
    }
    return map;
  }, [assets]);

  // ── Playback state ──
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const timelineRef = useRef<TimelineContainerRef>(null);

  // ── Camera selection state ──
  // showCameraPanel is driven by the store (showCutsceneCameraPanel)
  // so the main EditorLayout properties panel button can also trigger it.

  // ── Audio refs for editor preview ──
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ── Duration input ──
  const [durationInput, setDurationInput] = useState(String(cutsceneData.duration));
  useEffect(() => {
    setDurationInput(String(cutsceneData.duration));
  }, [cutsceneData.duration]);

  // ── Playback loop ──
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      setCurrentTime((prev) => {
        let next = prev + dt;
        if (next >= cutsceneData.duration) {
          if (cutsceneData.loopInEditor) {
            next = 0;
          } else {
            setIsPlaying(false);
            return cutsceneData.duration;
          }
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, cutsceneData.duration, cutsceneData.loopInEditor]);

  // Sync timeline cursor with our currentTime
  useEffect(() => {
    if (timelineRef.current?.timelineState) {
      timelineRef.current.timelineState.setTime(currentTime);
    }
  }, [currentTime]);

  // ── Audio preview engine ──
  useEffect(() => {
    const audioClips = cutsceneData.clips.filter((c) => {
      const track = cutsceneData.tracks.find((t) => t.id === c.trackId);
      return track?.type === 'audio' && c.assetId;
    });

    // Get the set of active audio clip IDs
    const activeIds = new Set<string>();
    for (const clip of audioClips) {
      if (clip.start <= currentTime && clip.end > currentTime) {
        activeIds.add(clip.id);
      }
    }

    // Start/update active audio
    for (const clip of audioClips) {
      if (!activeIds.has(clip.id)) {
        // Stop audio that is no longer active
        const el = audioRefs.current.get(clip.id);
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
        continue;
      }

      const url = clip.assetId ? assetMap[clip.assetId] : null;
      if (!url) continue;

      let el = audioRefs.current.get(clip.id);
      if (!el || el.src !== url) {
        el = new Audio(url);
        el.loop = (clip.audioType ?? 'bgm') === 'bgm';
        audioRefs.current.set(clip.id, el);
      }

      // Set volume from keyframes
      const clipLocalTime = currentTime - clip.start;
      const vol = interpolateVolume(clip.volume, clipLocalTime);
      el.volume = Math.max(0, Math.min(1, vol / 100));

      if (isPlaying && el.paused) {
        el.currentTime = clipLocalTime;
        el.play().catch(() => {/* autoplay blocked */});
      } else if (!isPlaying && !el.paused) {
        el.pause();
      }
    }

    // Clean up audio elements for clips that no longer exist
    for (const [id, el] of audioRefs.current.entries()) {
      if (!audioClips.some((c) => c.id === id)) {
        el.pause();
        audioRefs.current.delete(id);
      }
    }
  }, [currentTime, isPlaying, cutsceneData.clips, cutsceneData.tracks, assetMap]);

  // Stop all audio on unmount or when playback stops
  useEffect(() => {
    if (!isPlaying) {
      for (const el of audioRefs.current.values()) {
        el.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      for (const el of audioRefs.current.values()) {
        el.pause();
      }
      audioRefs.current.clear();
    };
  }, []);

  // ── Data change ──
  const handleDataChange = useCallback(
    (newData: CutsceneData) => {
      updateCutsceneData(nodeId, newData);
    },
    [nodeId, updateCutsceneData],
  );

  // ── Clip operations ──
  const handleUpdateClip = useCallback(
    (clipId: string, patch: Partial<CutsceneClip>) => {
      const updatedClips = cutsceneData.clips.map((c) =>
        c.id === clipId ? { ...c, ...patch } : c,
      );
      handleDataChange({ ...cutsceneData, clips: updatedClips });
    },
    [cutsceneData, handleDataChange],
  );

  const handleDeleteClip = useCallback(
    (clipId: string) => {
      const updatedClips = cutsceneData.clips.filter((c) => c.id !== clipId);
      handleDataChange({ ...cutsceneData, clips: updatedClips });
      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [cutsceneData, handleDataChange, selectedClipId, setSelectedClipId],
  );

  const handleDoubleClickRow = useCallback(
    (trackId: string, time: number) => {
      const track = cutsceneData.tracks.find((t) => t.id === trackId);
      if (!track) return;



      // Create a new clip at the clicked time
      const newClip: CutsceneClip = {
        id: generateId(),
        trackId,
        start: Math.max(0, time),
        end: Math.min(time + 3, cutsceneData.duration), // default 3 seconds
      };

      // Set defaults based on track type
      if (track.type === 'text') {
        newClip.text = 'New text';
        newClip.fontSize = 16;
        newClip.fontColor = '#ffffff';
      } else if (track.type === 'audio') {
        newClip.audioType = 'bgm';
      } else if (track.type === 'character') {
        newClip.zIndex = 0;
      }

      handleDataChange({
        ...cutsceneData,
        clips: [...cutsceneData.clips, newClip],
      });
      setSelectedClipId(newClip.id);
      setShowCameraPanel(false);
    },
    [cutsceneData, handleDataChange, setSelectedClipId],
  );

  const handleClickAction = useCallback(
    (clipId: string) => {
      setSelectedClipId(clipId);
      setShowCameraPanel(false);
    },
    [setSelectedClipId],
  );

  // ── Transport controls ──
  const handlePlay = useCallback(() => {
    if (currentTime >= cutsceneData.duration) setCurrentTime(0);
    setIsPlaying(true);
  }, [currentTime, cutsceneData.duration]);

  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // ── Duration change ──
  const handleDurationBlur = useCallback(() => {
    const val = Math.max(1, Math.min(300, parseInt(durationInput, 10) || 30));
    setDurationInput(String(val));
    handleDataChange({ ...cutsceneData, duration: val });
  }, [durationInput, cutsceneData, handleDataChange]);

  // ── Selected clip data ──
  const selectedClip = useMemo(
    () => cutsceneData.clips.find((c) => c.id === selectedClipId) ?? null,
    [cutsceneData.clips, selectedClipId],
  );
  const selectedTrack = useMemo(
    () => (selectedClip ? cutsceneData.tracks.find((t) => t.id === selectedClip.trackId) ?? null : null),
    [selectedClip, cutsceneData.tracks],
  );

  // ── Back handler ──
  const handleBack = useCallback(() => {
    setEditingNodeId(null);
    setSelectedClipId(null);
    setIsPlaying(false);
  }, [setEditingNodeId, setSelectedClipId]);

  // ── Render properties sidebar content ──
  const renderPropertiesPanel = () => {
    if (selectedClip && selectedTrack) {
      return (
        <ClipProperties
          clip={selectedClip}
          track={selectedTrack}
          cutsceneData={cutsceneData}
          currentTime={currentTime}
          onUpdateClip={handleUpdateClip}
          onDeleteClip={handleDeleteClip}
        />
      );
    }
    if (showCameraPanel) {
      return (
        <CameraProperties
          cutsceneData={cutsceneData}
          currentTime={currentTime}
          onDataChange={handleDataChange}
        />
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-gray-500">
        Double-click a track to add a clip, or click an existing clip to edit its properties.
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 px-4 py-2 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          title="Back to graph"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-sm font-semibold text-gray-200 truncate">
          {nodeData?.label ?? 'Cutscene'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Duration */}
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Duration (s):
            <input
              type="number"
              min={1}
              max={300}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={handleDurationBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="w-16 rounded border border-gray-600 bg-gray-700 px-1.5 py-0.5 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </label>

          {/* Skip toggle */}
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={cutsceneData.skipEnabled}
              onChange={(e) => handleDataChange({ ...cutsceneData, skipEnabled: e.target.checked })}
              className="rounded"
            />
            Skippable
          </label>

          {/* Loop toggle */}
          <button
            onClick={() => handleDataChange({ ...cutsceneData, loopInEditor: !cutsceneData.loopInEditor })}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
              cutsceneData.loopInEditor
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            title="Loop preview playback"
          >
            <Repeat className="h-3 w-3" />
            Loop
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* Top section: Stage + Properties */}
        <div className="flex flex-1 min-h-0 border-b border-gray-700">
          {/* Stage */}
          <div className="flex-1 flex items-center justify-center p-4 min-w-0 overflow-hidden">
            <div className="w-full max-w-[800px]">
              <CutsceneStage
                cutsceneData={cutsceneData}
                currentTime={currentTime}
                assetMap={assetMap}
              />
            </div>
          </div>

          {/* Properties sidebar */}
          <div className="w-72 shrink-0 border-l border-gray-700 bg-gray-850 dark:bg-gray-800/50 overflow-y-auto">
            {renderPropertiesPanel()}
          </div>
        </div>

        {/* Transport bar */}
        <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-1">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="rounded p-1 hover:bg-gray-700 text-gray-300 transition-colors"
                title="Pause"
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="rounded p-1 hover:bg-gray-700 text-gray-300 transition-colors"
                title="Play"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleStop}
              className="rounded p-1 hover:bg-gray-700 text-gray-300 transition-colors"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="font-mono text-xs text-gray-400 tabular-nums">
            {formatTime(currentTime)} / {formatTime(cutsceneData.duration)}
          </span>
        </div>

        {/* Timeline with track labels */}
        <div className="h-[220px] shrink-0 bg-gray-900 overflow-hidden flex">
          {/* Track labels column */}
          <div className="w-28 shrink-0 bg-gray-800 border-r border-gray-700 pt-[42px]">
            {cutsceneData.tracks.filter((t) => t.type !== 'camera').map((track) => (
              <div
                key={track.id}
                className="h-[36px] flex items-center px-2 text-[11px] font-medium text-gray-400 border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors truncate"
                onClick={() => {
                  if (track.type === 'camera') {
                    setSelectedClipId(null);
                    setShowCameraPanel(true);
                  }
                }}
                title={track.label}
              >
                {track.label}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <TimelineContainer
              ref={timelineRef}
              cutsceneData={cutsceneData}
              onTimeChange={setCurrentTime}
              onDataChange={handleDataChange}
              onClickAction={handleClickAction}
              onDoubleClickRow={handleDoubleClickRow}
              selectedClipId={selectedClipId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
