import type { CSSProperties, ReactNode } from 'react';

/** Design-time aspect ratio; must match editor canvases (Point-and-click, Gameplay, Cutscene). */
export const STAGE_ASPECT_WIDTH = 16;
export const STAGE_ASPECT_HEIGHT = 9;

/** Largest 16:9 rectangle that fits in the viewport (same logical box as the editor preview). */
export const gameStageInnerBoxStyle: CSSProperties = {
  width: `min(100vw, calc(100vh * ${STAGE_ASPECT_WIDTH} / ${STAGE_ASPECT_HEIGHT}))`,
  height: `min(100vh, calc(100vw * ${STAGE_ASPECT_HEIGHT} / ${STAGE_ASPECT_WIDTH}))`,
};

/** Height/width of the stage (9/16). Use for % physics that must match the 16:9 coordinate box, not the browser chrome. */
export const STAGE_HEIGHT_OVER_WIDTH = STAGE_ASPECT_HEIGHT / STAGE_ASPECT_WIDTH;

/** Use on editor preview roots so aspect ratio stays in sync with `GameStage`. */
export const editorStageAspectStyle: CSSProperties = {
  aspectRatio: `${STAGE_ASPECT_WIDTH} / ${STAGE_ASPECT_HEIGHT}`,
};

interface GameStageProps {
  children: ReactNode;
}

/**
 * Centers a 16:9 stage in the viewport. Parent should be `relative` with a defined size
 * (e.g. h-screen w-screen). Children are positioned in % of this inner box.
 */
export default function GameStage({ children }: GameStageProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative shrink-0 overflow-hidden" style={gameStageInnerBoxStyle}>
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
