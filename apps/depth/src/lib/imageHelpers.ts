/**
 * Pure image-manipulation helpers, no DOM side-effects, easily unit-tested.
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

/** Format a download progress fraction as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}

/** Produce a safe download filename for the depth map output. */
export function outputFilename(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-depth.png`;
}
