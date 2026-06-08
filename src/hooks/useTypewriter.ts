import { useCallback, useEffect, useRef, useState } from 'react';

/** Reveals `text` character by character; `skip` shows the full string and stops the timer. */
export function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed('');
    setIsDone(false);
    if (!text) {
      setIsDone(true);
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index++;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
        timerRef.current = null;
        setIsDone(true);
      }
    }, speed);
    timerRef.current = timer;

    return () => {
      clearInterval(timer);
      timerRef.current = null;
    };
  }, [text, speed]);

  const skip = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDisplayed(text);
    setIsDone(true);
  }, [text]);

  return { displayed, isDone, skip };
}
