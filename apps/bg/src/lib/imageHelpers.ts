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
