/**
 * Image helpers for bg removal — app-specific extensions on the shared core.
 * Shared core (ACCEPTED_TYPES, isSupportedImage, formatBytes, formatProgress,
 * outputFilename, parseHexColor, clamp) is imported from kit/lib/imageHelpers.
 */
export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatBytes,
  formatProgress,
  outputFilename,
  parseHexColor,
  clamp,
} from "../../../../kit/lib/imageHelpers";

/**
 * Compute cover-fit placement of a source image onto a destination canvas.
 *
 * Like CSS `object-fit: cover`: the source is scaled up (or down) uniformly
 * so that it fully covers the destination rectangle, then centred.  The
 * returned {x, y, w, h} are the draw coordinates to pass to drawImage().
 *
 * Pure function -- no DOM side-effects, easily unit-tested.
 */
export function computeCoverFit(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): { x: number; y: number; w: number; h: number } {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { x: 0, y: 0, w: dstW, h: dstH };
  }
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  const x = (dstW - w) / 2;
  const y = (dstH - h) / 2;
  return { x, y, w, h };
}
