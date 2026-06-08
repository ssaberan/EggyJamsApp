import { useCallback, useRef, useEffect } from 'react';
import { useGraphStore } from '../stores/graphStore';

export function pauseHistory() {
  useGraphStore.temporal.getState().pause();
}

export function resumeHistory() {
  useGraphStore.temporal.getState().resume();
}

/**
 * Returns a callback that pauses undo history on first call, then restarts
 * a timer on each subsequent call.  When the timer fires (after `delayMs` of
 * inactivity), history is resumed — coalescing all intermediate changes into
 * a single undo entry.  Cleans up on unmount.
 */
export function useDebouncedHistory(delayMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        resumeHistory();
      }
    };
  }, []);

  return useCallback(() => {
    pauseHistory();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      resumeHistory();
    }, delayMs);
  }, [delayMs]);
}
