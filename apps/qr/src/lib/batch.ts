/**
 * Batch QR generation utilities.
 * Pure functions for parsing CSV/line input into a list of {label, content} items.
 */

export interface BatchItem {
  label: string;
  content: string;
}

export interface ParseResult {
  items: BatchItem[];
  /** Non-empty when the input was capped. Contains how many rows were dropped. */
  cappedAt: number | null;
  /** Row indices (0-based) that were skipped due to empty content. */
  skippedRows: number[];
}

export const BATCH_MAX_ROWS = 200;

/**
 * Sanitises a string for use as a filename: replaces characters that are
 * unsafe on common filesystems with underscores, collapses runs, trims.
 */
export function sanitiseFilename(raw: string): string {
  return (
    raw
      .trim()
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 100) || // guard against extremely long labels
    "qr"
  );
}

/**
 * Parses a raw string (pasted CSV or newline-separated list) into BatchItems.
 *
 * Supports two shapes per row:
 *   - single column:  `content`            => label inferred as row index
 *   - two columns:    `label,content`       => explicit label
 *
 * Rows where the resolved content is empty after trimming are skipped.
 * Input is capped at BATCH_MAX_ROWS valid rows.
 */
export function parseBatchInput(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/);
  const items: BatchItem[] = [];
  const skippedRows: number[] = [];
  let cappedAt: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blank lines are silently skipped (not counted as errors)
    if (!line.trim()) continue;

    if (items.length >= BATCH_MAX_ROWS) {
      cappedAt = BATCH_MAX_ROWS;
      break;
    }

    // Simple CSV split: treat first comma as delimiter.
    // Supports quoted fields: if line starts with `"`, parse as quoted CSV column.
    const parsed = splitCsvRow(line);
    let label: string;
    let content: string;

    if (parsed.length >= 2) {
      label = parsed[0].trim();
      content = parsed.slice(1).join(",").trim();
    } else {
      label = String(items.length + 1);
      content = parsed[0].trim();
    }

    if (!content) {
      skippedRows.push(i);
      continue;
    }

    // If label is empty after the comma, fall back to index
    if (!label) {
      label = String(items.length + 1);
    }

    items.push({ label: sanitiseFilename(label), content });
  }

  return { items, cappedAt, skippedRows };
}

/**
 * Splits a CSV row on the first unquoted comma.
 * Handles basic RFC 4180 quoting: `"value with, comma"`.
 * Returns an array of raw (unquoted) field strings.
 */
function splitCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  fields.push(current);
  return fields;
}
