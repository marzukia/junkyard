/**
 * Pure image-manipulation helpers, no DOM side-effects, easily unit-tested.
 */

/** Supported input image MIME types. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

// ── Batch export helpers ───────────────────────────────────────────────────────

export interface BatchCaptionRow {
  filename: string;
  caption: string;
}

/** Serialise batch results to CSV (with header row, RFC 4180 quoting). */
export function batchToCsv(rows: BatchCaptionRow[]): string {
  const csvQuote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    "filename,caption",
    ...rows.map((r) => `${csvQuote(r.filename)},${csvQuote(r.caption)}`),
  ];
  return lines.join("\r\n");
}

/** Serialise batch results to a JSON array. */
export function batchToJson(rows: BatchCaptionRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Trigger a browser download of text content as a file.
 * Pure in test environments (just returns the data URL).
 */
export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

/**
 * Capitalise the first letter of a caption and ensure it ends with a period.
 * Handles empty strings gracefully.
 */
export function formatCaption(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return capitalised.endsWith(".") ? capitalised : `${capitalised}.`;
}
