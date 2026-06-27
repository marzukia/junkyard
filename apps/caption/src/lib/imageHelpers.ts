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

export { formatBytes } from "@junkyardsh/ui";
export { formatProgress } from "@junkyardsh/ui/ai";

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
