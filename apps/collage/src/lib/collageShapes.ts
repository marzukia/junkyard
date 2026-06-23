/**
 * Parametric collage shape masks.
 *
 * Each shape is defined as an SVG path string (viewBox 0 0 1 1, normalised).
 * The canvas export function scales these paths to pixel coords.
 *
 * Shapes apply to the whole collage canvas — transparent outside, content inside.
 */

export type CollageShapeId = "rectangle" | "rounded" | "circle" | "heart";

export interface CollageShape {
  id: CollageShapeId;
  label: string;
  /** Returns an SVG path `d` attribute string in a 0–w × 0–h bounding box. */
  path: (w: number, h: number) => string;
  /** CSS clip-path string for live preview (uses % coords). */
  cssClipPath: (w: number, h: number) => string;
}

/** Rectangle — default, no clipping needed but we still define it uniformly. */
function rectanglePath(w: number, h: number): string {
  return `M0,0 H${w} V${h} H0 Z`;
}

/** Rounded rectangle — ~15% corner radius. */
function roundedPath(w: number, h: number): string {
  const r = Math.min(w, h) * 0.15;
  return (
    `M${r},0 H${w - r} ` +
    `Q${w},0 ${w},${r} ` +
    `V${h - r} ` +
    `Q${w},${h} ${w - r},${h} ` +
    `H${r} ` +
    `Q0,${h} 0,${h - r} ` +
    `V${r} ` +
    `Q0,0 ${r},0 Z`
  );
}

/** Circle / ellipse — inscribed within the bounding box. */
function circlePath(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = w / 2;
  const cy = h / 2;
  // SVG arc approximation of an ellipse (two arcs)
  return `M${cx},${cy - ry} ` + `A${rx},${ry} 0 1,1 ${cx - 0.001},${cy - ry} Z`;
}

/**
 * Heart path — scales to any w×h bounding box.
 *
 * Uses a well-known cubic bezier heart construction:
 *   Start at the bottom tip, cubic to the left peak, curve over to the
 *   top-centre dip, cubic to the right peak, close back to the tip.
 * Control points are normalised from a unit-square heart then scaled to w×h.
 */
function heartPath(w: number, h: number): string {
  // Normalised coords (0-1 square) for a classic heart shape,
  // then scaled to w×h. The heart sits with tip at bottom.

  function p(nx: number, ny: number): string {
    return `${nx * w},${ny * h}`;
  }

  // Path starts at the bottom tip (0.5, 1.0)
  // Curves up-left to the left lobe peak near (0, 0.35)
  // then continues to top-left bump (0.25, 0) with dip at centre (0.5, 0.4)
  // Mirror for the right side.
  return (
    `M${p(0.5, 1.0)} ` +
    `C${p(0.1, 0.75)} ${p(0.0, 0.45)} ${p(0.0, 0.3)} ` +
    `C${p(0.0, 0.12)} ${p(0.15, 0.0)} ${p(0.3, 0.0)} ` +
    `C${p(0.4, 0.0)} ${p(0.5, 0.1)} ${p(0.5, 0.2)} ` +
    `C${p(0.5, 0.1)} ${p(0.6, 0.0)} ${p(0.7, 0.0)} ` +
    `C${p(0.85, 0.0)} ${p(1.0, 0.12)} ${p(1.0, 0.3)} ` +
    `C${p(1.0, 0.45)} ${p(0.9, 0.75)} ${p(0.5, 1.0)} Z`
  );
}

export const COLLAGE_SHAPES: CollageShape[] = [
  {
    id: "rectangle",
    label: "Rect",
    path: rectanglePath,
    cssClipPath: () => "none",
  },
  {
    id: "rounded",
    label: "Rounded",
    path: roundedPath,
    cssClipPath: (w, h) => {
      const r = Math.min(w, h) * 0.15;
      const rPct = `${(r / Math.min(w, h)) * 100}%`;
      return `inset(0 0 0 0 round ${rPct})`;
    },
  },
  {
    id: "circle",
    label: "Circle",
    path: circlePath,
    cssClipPath: () => "ellipse(50% 50% at 50% 50%)",
  },
  {
    id: "heart",
    label: "Heart",
    path: heartPath,
    cssClipPath: () => "none", // SVG mask used for heart in preview
  },
];

export function getShape(id: CollageShapeId): CollageShape {
  return COLLAGE_SHAPES.find((s) => s.id === id) ?? COLLAGE_SHAPES[0];
}

/**
 * Apply a shape mask to a canvas context using a clip path.
 * Call this BEFORE drawing content. The caller must save/restore ctx around it.
 *
 * Returns true if a clip was applied (content should be drawn).
 */
export function applyShapeClip(
  ctx: CanvasRenderingContext2D,
  shapeId: CollageShapeId,
  w: number,
  h: number
): boolean {
  if (shapeId === "rectangle") return false; // no clip needed

  const shape = getShape(shapeId);
  const d = shape.path(w, h);

  const path2d = new Path2D(d);
  ctx.clip(path2d);
  return true;
}
