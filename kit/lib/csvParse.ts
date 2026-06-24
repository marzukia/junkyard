/**
 * Canonical CSV parser (RFC 4180 quote-state-machine) and delimiter-detection
 * heuristic for junkyard.
 *
 * This is the single source of truth for the parse logic and delimiter-detection
 * algorithm. It is vendored into apps/csv/src/lib/csv.ts via
 * scripts/vendor-csvparse.mjs.
 *
 * packages/core/src/csv.ts keeps its own standalone copy (no kit import — core
 * must remain Buffer/Node-independent and is distributed as a package). When
 * updating parser logic or the heuristic here, reconcile packages/core/src/csv.ts
 * manually and note the sync in that file's header comment.
 *
 * What is canonical here:
 *   - splitCsvRows: RFC 4180 quote-state-machine parser
 *   - detectDelimiter: mean - variance*0.1 heuristic over 5-line sample
 *
 * What is NOT here (app-specific / already-fixed, do not include):
 *   - formula-injection csvEscape (apps/csv + packages/core each own their copy)
 *   - csvToJson, jsonToCsv, markdown/sql/xml/yaml converters (app-only)
 */

export type Delimiter = "," | "\t" | ";" | "|";

/**
 * Split a CSV string into an array of rows, each row being an array of field strings.
 * Handles RFC 4180 quoting and embedded newlines.
 */
export function splitCsvRows(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  let i = 0;

  // Normalise line endings
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < src.length) {
    const ch = src[i];

    if (inQuote) {
      if (ch === '"') {
        // Peek next char: double-quote inside quotes = escaped quote
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuote = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        // Skip empty trailing rows
        if (row.length > 1 || row[0] !== "") {
          rows.push(row);
        }
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush last field/row
  row.push(field);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}

/** Count how many times a delimiter appears in a line, respecting quoted fields. */
function countDelimiter(line: string, delim: string): number {
  let count = 0;
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && ch === delim) {
      count++;
    }
  }
  return count;
}

/**
 * Heuristically detect the delimiter in a CSV string by counting occurrences
 * in the first few lines. Scores each candidate by: mean count minus 0.1 * variance.
 * High mean + low variance = consistent column structure = good delimiter.
 */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.split("\n").slice(0, 5).join("\n");
  const candidates: Delimiter[] = [",", "\t", ";", "|"];

  let bestDelim: Delimiter = ",";
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sample
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((line) => countDelimiter(line, delim));

    if (counts.length === 0) continue;

    const max = Math.max(...counts);
    if (max === 0) continue;

    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const score = mean - variance * 0.1;

    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }

  return bestDelim;
}
