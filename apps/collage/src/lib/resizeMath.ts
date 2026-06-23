/**
 * Pure resize math for freeform card corner-drag resize.
 *
 * Cards are stored as normalised fractions of canvas size (x, y, w, h ∈ 0-1).
 * Corner handles drag in pixel space; the caller converts to normalised delta.
 *
 * Constraints:
 *   - Minimum size: MIN_FRAC of canvas per dimension (prevents cards collapsing)
 *   - Maximum size: 1.0 (cards can fill the whole canvas)
 *   - Aspect ratio is preserved by default (free-resize not required)
 */

export const MIN_FRAC = 0.05; // 5% of canvas per dimension minimum

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export interface CardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResizeResult {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute the new card rect after dragging a resize handle by (dx, dy)
 * in normalised canvas coords.
 *
 * Corner handles (nw/ne/sw/se) maintain aspect ratio:
 *   - The dominant axis is whichever has the larger absolute delta.
 *   - The other axis is computed from the original aspect ratio.
 *
 * Edge handles (n/s/e/w) resize a single axis only.
 *
 * Clamped to [MIN_FRAC, 1.0] for both dimensions,
 * with x/y adjusted so the card never overflows the canvas.
 */
export function applyResize(
  start: CardRect,
  handle: ResizeHandle,
  dx: number,
  dy: number
): ResizeResult {
  const origAspect = start.w / start.h;

  let { x, y, w, h } = start;

  // For corner handles, pick the dominant axis and lock aspect ratio
  if (handle === "se") {
    const domainDelta = Math.abs(dx) >= Math.abs(dy) ? dx : dy * origAspect;
    w = Math.max(MIN_FRAC, Math.min(1 - start.x, start.w + domainDelta));
    h = w / origAspect;
  } else if (handle === "sw") {
    const domainDelta = Math.abs(dx) >= Math.abs(dy) ? -dx : dy * origAspect;
    w = Math.max(MIN_FRAC, Math.min(start.x + start.w, start.w + domainDelta));
    h = w / origAspect;
    x = start.x + start.w - w;
  } else if (handle === "ne") {
    const domainDelta = Math.abs(dx) >= Math.abs(dy) ? dx : -dy * origAspect;
    w = Math.max(MIN_FRAC, Math.min(1 - start.x, start.w + domainDelta));
    h = w / origAspect;
    y = start.y + start.h - h;
  } else if (handle === "nw") {
    const domainDelta = Math.abs(dx) >= Math.abs(dy) ? -dx : -dy * origAspect;
    w = Math.max(MIN_FRAC, Math.min(start.x + start.w, start.w + domainDelta));
    h = w / origAspect;
    x = start.x + start.w - w;
    y = start.y + start.h - h;
  } else if (handle === "e") {
    w = Math.max(MIN_FRAC, Math.min(1 - start.x, start.w + dx));
  } else if (handle === "w") {
    w = Math.max(MIN_FRAC, Math.min(start.x + start.w, start.w - dx));
    x = start.x + start.w - w;
  } else if (handle === "s") {
    h = Math.max(MIN_FRAC, Math.min(1 - start.y, start.h + dy));
  } else if (handle === "n") {
    h = Math.max(MIN_FRAC, Math.min(start.y + start.h, start.h - dy));
    y = start.y + start.h - h;
  }

  // Final canvas-boundary clamp: card must stay fully inside [0, 1]
  x = Math.max(0, Math.min(1 - w, x));
  y = Math.max(0, Math.min(1 - h, y));

  return { x, y, w, h };
}
