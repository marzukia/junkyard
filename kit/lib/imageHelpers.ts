/**
 * Shared image helpers — pure, no DOM side-effects, easily unit-tested.
 * Source of truth: kit/lib/imageHelpers.ts
 * Re-exported via @junkyardsh/ui so apps can import directly.
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

/** Format a download progress fraction (0–1) as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}
