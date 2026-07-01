/**
 * Shared image helpers — pure, no DOM side-effects, easily unit-tested.
 * Source of truth: kit/lib/imageHelpers.ts
 * Re-exported via @junkyardsh/kit so apps can import directly.
 */

/** Supported input image MIME types. */
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/** True if the file's MIME type is a supported raster image. */
export function isSupportedImage(file: File): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

/** Format a byte count as a human-readable string (B / KB / MB). */
export { formatBytes } from "../components/format";

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Produce a safe download filename — strips extension, appends suffix. */
export function outputFilename(inputName: string, suffix: string, ext: string = "png"): string {
  const base = inputName.replace(/\.([^.]+)$/, "");
  return `${base}-${suffix}.${ext}`;
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

/** True if the string is a valid 3- or 6-digit hex color (with or without #). */
export function isValidHex(hex: string): boolean {
  return parseHexColor(hex) !== null;
}

/** Format seconds to "HH:MM:SS" or "M:SS". */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse "MM:SS", "HH:MM:SS", or plain seconds into a seconds number. */
export function parseTime(input: string): number {
  const trimmed = input.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/** Revoke a blob URL safely (no-op for null/empty). */
export function revokeResult(url: string | null | undefined): void {
  if (!url) return;
  URL.revokeObjectURL(url);
}

/** Format a download progress fraction (0–1) as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}
