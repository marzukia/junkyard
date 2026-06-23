/**
 * Pure image-manipulation helpers — no DOM side-effects, easily unit-tested.
 */

/** Supported input image MIME types. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/** True if the file's MIME type is a supported raster image. */
export function isSupportedImage(file: File): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

/** Format bytes as a human-readable string (KB / MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a download progress fraction (0–1) as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}

/** Produce a safe download filename for the processed image. */
export function outputFilename(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-bg-removed.png`;
}

/**
 * Validate a 3- or 6-digit hex color string (with or without leading #).
 * Returns the normalised "#rrggbb" form, or null if invalid.
 */
export function parseHexColor(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    const [r, g, b] = s.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return `#${s}`.toLowerCase();
  }
  return null;
}

/**
 * Clamp a number to [min, max].
 * Used for the compare-slider position (0-100).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
