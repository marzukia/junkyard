import { useState, useCallback } from "react";

/**
 * Shared progress hook — caps display at 95% during active processing
 * so the bar doesn't hit 100% prematurely (e.g. ffmpeg multi-pass encoding,
 * GIF palettegen+paletteuse). Jumps to 100% only when processing completes.
 *
 * Returns [progress, setProgress, resetProgress] where setProgress accepts
 * values 0-1 and clamps display to 95%.
 */
export function useProgress() {
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);

  const onProgress = useCallback((value: number) => {
    setProgress(value);
    if (value >= 1) setComplete(true);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
    setComplete(false);
  }, []);

  const display = complete ? 100 : Math.round(Math.min(progress, 0.95) * 100);
  const label = complete
    ? "100%"
    : `${Math.round(Math.min(progress, 0.95) * 100)}%`;

  return {
    /** Raw progress value (0-1). Pass to setProgress from ffmpeg or similar. */
    progress,
    setProgress: onProgress,
    resetProgress,
    /** Display percentage capped at 95% during processing, 100% when done. */
    display,
    /** Formatted label string. */
    label,
    /** True when processing has reported 100%. */
    complete,
    /** Call when processing finishes to jump display to 100%. */
    finish: () => setComplete(true),
  };
}
