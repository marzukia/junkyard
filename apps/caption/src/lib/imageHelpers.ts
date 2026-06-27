/**
 * Image helpers for caption — app-specific extensions on the shared core.
 * Shared core (ACCEPTED_TYPES, isSupportedImage, formatBytes, formatProgress)
 * is imported from kit/lib/imageHelpers (source of truth).
 */
export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatBytes,
  formatProgress,
} from "../../../../kit/lib/imageHelpers";

// ── Batch export helpers ───────────────────────────────────────────────────────

export interface BatchCaptionRow {
  filename: string;
  caption: string;
}

/** Serialise batch results to CSV (with header row, RFC 4180 quoting). */
export function batchToCsv(rows: BatchCaptionRow[]): string {
  const csvQuote = (v: string) => `"${v.replace(/\"/g, '""')}"`;
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
