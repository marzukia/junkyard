/**
 * Gate for OCR progress events from tesseract.js.
 *
 * Tesseract fires its logger callback on every internal progress tick —
 * far more frequently than a whole-percent boundary changes — causing a
 * re-render storm when each tick calls store.setProgress().  This helper
 * lets callers suppress no-op events while always passing through:
 *   - first event of a run (lastPct === -1)
 *   - 0% (initialisation sentinel)
 *   - 100% (completion)
 *   - any message/status change (so "Initialising…" → "Scanning…" transitions
 *     are never swallowed)
 *   - any whole-percent boundary change
 *
 * Mirror of kit/lib/workerTask.ts shouldEmitProgress, adapted for the
 * pct-and-message API used by the OCR logger (tesseract gives us a pre-rounded
 * fraction, not loaded/total bytes).
 *
 * Exported for unit testing. Not intended for direct use outside App.tsx.
 */
export function shouldEmitOcrProgress(
  pct: number,
  message: string,
  lastPct: number,
  lastMessage: string
): boolean {
  if (lastPct === -1) return true; // first event of this run
  if (pct === 0 || pct === 100) return true; // sentinel values always pass
  if (message !== lastMessage) return true; // status/label transition
  return pct !== lastPct; // whole-percent boundary
}
