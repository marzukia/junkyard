// ── Parser (vendored from kit/lib/csvParse.ts) ────────────────────────────────
// splitCsvRows and detectDelimiter are vendored via scripts/vendor-csvparse.mjs.
// Do NOT edit csvParse.ts here — edit kit/lib/csvParse.ts and re-run the script.
export { splitCsvRows, detectDelimiter } from "@junkyardsh/kit";
export type { Delimiter } from "@junkyardsh/kit";
import { detectDelimiter, splitCsvRows } from "@junkyardsh/kit";
import type { Delimiter } from "@junkyardsh/kit";

// ── Types ─────────────────────────────────────────────────────────────────────
export type ConvertMode = "csv-to-json" | "json-to-csv";
export type OutputFormat = "json" | "markdown" | "sql" | "xml" | "yaml";

export interface CsvParseOptions {
  delimiter: Delimiter;
  hasHeader: boolean;
}

/** A row index (1-based, header = 0) + the unexpected field count. */
export interface RaggedRowWarning {
  /** 1-based data-row index (i.e. row after header). */
  rowIndex: number;
  expected: number;
  actual: number;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** Total number of data rows (excluding header) */
  rowCount: number;
  colCount: number;
  /** Non-empty lines that were parsed (including header if present). */
  nonEmptyLineCount: number;
  /** Rows whose field count differs from the header width. */
  raggedWarnings: RaggedRowWarning[];
}

export interface ConvertError {
  message: string;
}

export interface ConvertSuccess<T> {
  ok: true;
  value: T;
}

export interface ConvertFailure {
  ok: false;
  error: ConvertError;
}

export type ConvertResult<T> = ConvertSuccess<T> | ConvertFailure;

// ── CSV parser ────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into headers + rows.
 *
 * Handles:
 * - Quoted fields (RFC 4180: double-quote escaping inside quotes)
 * - Fields with embedded newlines inside quotes
 * - Empty fields
 */
export function parseCsv(text: string, opts: CsvParseOptions): ConvertResult<ParsedCsv> {
  try {
    const rawRows = splitCsvRows(text, opts.delimiter);
    // Drop rows where every cell is empty/whitespace (trailing blank lines etc.)
    const allRows = rawRows.filter((r) => r.some((cell) => cell.trim().length > 0));

    if (allRows.length === 0) {
      return { ok: false, error: { message: "No data found in input." } };
    }

    let headers: string[];
    let dataRows: string[][];

    if (opts.hasHeader) {
      headers = allRows[0];
      dataRows = allRows.slice(1);
    } else {
      // Generate col headers: A, B, C, ...
      const colCount = Math.max(...allRows.map((r) => r.length));
      headers = Array.from({ length: colCount }, (_, i) => columnLabel(i));
      dataRows = allRows;
    }

    const colCount = headers.length;

    // Detect ragged rows: rows whose field count differs from colCount.
    const raggedWarnings: RaggedRowWarning[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const actual = dataRows[i].length;
      if (actual !== colCount) {
        raggedWarnings.push({ rowIndex: i + 1, expected: colCount, actual });
      }
    }

    return {
      ok: true,
      value: {
        headers,
        rows: dataRows,
        rowCount: dataRows.length,
        colCount,
        nonEmptyLineCount: allRows.length,
        raggedWarnings,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "Failed to parse CSV." },
    };
  }
}

/** Spreadsheet-style column label: 0=A, 25=Z, 26=AA, etc. */
function columnLabel(idx: number): string {
  let label = "";
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// ── CSV -> JSON ───────────────────────────────────────────────────────────────

/**
 * Convert parsed CSV into a JSON array of objects (one object per data row).
 * Values are coerced: numbers become numbers, "true"/"false" become booleans,
 * empty strings become null.
 */
export function csvToJson(parsed: ParsedCsv): ConvertResult<string> {
  try {
    const objects = parsed.rows.map((row) => {
      const obj = Object.create(null) as Record<string, unknown>;
      parsed.headers.forEach((header, i) => {
        const raw = row[i] ?? "";
        obj[header] = coerceValue(raw);
      });
      return obj;
    });

    return { ok: true, value: JSON.stringify(objects, null, 2) };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "CSV to JSON conversion failed." },
    };
  }
}

/** Coerce a raw CSV field string to its most likely JS type. */
export function coerceValue(raw: string): unknown {
  if (raw === "") return null;
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  // Avoid coercing strings that look like numeric codes (e.g. zip codes "01234")
  // Also reject Infinity/-Infinity: JSON.stringify silently converts them to null.
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return raw;
}

// ── JSON -> CSV ───────────────────────────────────────────────────────────────

/**
 * Convert a JSON string (array of objects OR array of arrays) into a CSV string.
 */
export function jsonToCsv(jsonText: string, delimiter: Delimiter): ConvertResult<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_err) {
    return { ok: false, error: { message: "Invalid JSON. Could not parse input." } };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: {
        message: "JSON must be an array. Expected an array of objects or an array of arrays.",
      },
    };
  }

  if (parsed.length === 0) {
    return { ok: true, value: "" };
  }

  const first = parsed[0];

  if (Array.isArray(first)) {
    // Array of arrays
    const lines = (parsed as unknown[][]).map((row) =>
      row.map((cell) => csvEscape(String(cell ?? ""), delimiter)).join(delimiter)
    );
    return { ok: true, value: lines.join("\n") };
  }

  if (typeof first === "object" && first !== null) {
    // Array of objects: collect all keys across all rows for headers
    const keySet = new Set<string>();
    for (const item of parsed) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        for (const k of Object.keys(item as Record<string, unknown>)) {
          keySet.add(k);
        }
      }
    }
    const headers = Array.from(keySet);
    const headerLine = headers.map((h) => csvEscape(h, delimiter)).join(delimiter);
    const dataLines = (parsed as Record<string, unknown>[]).map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          return csvEscape(String(val), delimiter);
        })
        .join(delimiter)
    );
    return { ok: true, value: [headerLine, ...dataLines].join("\n") };
  }

  return {
    ok: false,
    error: { message: "JSON array must contain objects or arrays, not primitives." },
  };
}

/**
 * Escape a single CSV field value. Wraps in double-quotes if the field contains
 * the delimiter, a double-quote, or a newline. Double-quotes inside are doubled.
 *
 * Formula injection (OWASP): cells whose first character is a formula trigger
 * (= + - @ or tab/CR) are prefixed with a single quote so spreadsheet apps
 * treat them as text rather than executing them as formulas on import.
 */
export function csvEscape(val: string, delimiter: Delimiter): string {
  // Prefix formula-trigger cells with a single quote to neutralise injection.
  const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
  const out = FORMULA_TRIGGERS.test(val) ? "'" + val : val;
  if (out.includes('"') || out.includes(delimiter) || out.includes("\n") || out.includes("\r")) {
    return `"${out.replace(/"/g, '""')}"`;
  }
  return out;
}

// ── Additional output formats ─────────────────────────────────────────────────

/**
 * Convert parsed CSV to a GitHub-flavoured Markdown table.
 */
export function csvToMarkdown(parsed: ParsedCsv): ConvertResult<string> {
  try {
    const md = (val: string) => val.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
    const header = `| ${parsed.headers.map(md).join(" | ")} |`;
    const sep = `| ${parsed.headers.map(() => "---").join(" | ")} |`;
    const rows = parsed.rows.map(
      (row) => `| ${parsed.headers.map((_, i) => md(row[i] ?? "")).join(" | ")} |`
    );
    return { ok: true, value: [header, sep, ...rows].join("\n") };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "Markdown conversion failed." },
    };
  }
}

/**
 * Convert parsed CSV to INSERT INTO SQL statements.
 * Table name defaults to "data".
 */
export function csvToSql(parsed: ParsedCsv, tableName = "data"): ConvertResult<string> {
  try {
    const sqlIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const sqlVal = (s: string) => {
      if (s === "") return "NULL";
      const n = Number(s);
      if (
        !Number.isNaN(n) &&
        Number.isFinite(n) &&
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)
      ) {
        return s;
      }
      return `'${s.replace(/'/g, "''")}'`;
    };
    const cols = parsed.headers.map(sqlIdent).join(", ");
    const lines = parsed.rows.map(
      (row) =>
        `INSERT INTO ${sqlIdent(tableName)} (${cols}) VALUES (${parsed.headers.map((_, i) => sqlVal(row[i] ?? "")).join(", ")});`
    );
    return { ok: true, value: lines.join("\n") };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "SQL conversion failed." },
    };
  }
}

/**
 * Escape a string for use as XML text content or attribute value.
 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert parsed CSV to XML. Each row becomes a <row> element with
 * child elements named after the headers.
 */
export function csvToXml(parsed: ParsedCsv): ConvertResult<string> {
  try {
    const tagName = (s: string) => {
      // Make a valid XML element name: replace non-word chars with underscore, ensure starts with letter.
      const clean = s.replace(/[^a-zA-Z0-9_.-]/g, "_");
      return /^[a-zA-Z_]/.test(clean) ? clean : `_${clean}`;
    };
    const tags = parsed.headers.map(tagName);
    const rowLines = parsed.rows.map((row) => {
      const fields = tags.map((tag, i) => `    <${tag}>${xmlEscape(row[i] ?? "")}</${tag}>`);
      return `  <row>\n${fields.join("\n")}\n  </row>`;
    });
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${rowLines.join("\n")}\n</data>`;
    return { ok: true, value: body };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "XML conversion failed." },
    };
  }
}

/**
 * Serialize a value for YAML output (block-style).
 * Handles strings that need quoting.
 */
function yamlVal(s: string): string {
  if (s === "") return '""';
  // Numbers and booleans are fine unquoted if they match exactly
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return s;
  if (s === "true" || s === "false" || s === "null") return `"${s}"`;
  // If it contains special chars, quote it
  if (/[:#\[\]{},&*?|<>=!%@`\n\r\\"]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Quote a YAML mapping key when it contains characters that would make the
 * bare key ambiguous or invalid (: # leading/trailing space, and anything
 * that yamlVal would also quote for values).
 */
function yamlKey(s: string): string {
  if (s === "") return '""';
  // Quote if the key contains YAML-special chars or leading/trailing whitespace
  if (/[:#\[\]{},&*?|<>=!%@`\n\r\\"]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Convert parsed CSV to YAML (array of mappings).
 */
export function csvToYaml(parsed: ParsedCsv): ConvertResult<string> {
  try {
    const blocks = parsed.rows.map((row) => {
      const fields = parsed.headers.map((h, i) => `  ${yamlKey(h)}: ${yamlVal(row[i] ?? "")}`);
      return `- ${fields[0]?.trimStart() ?? ""}\n${fields.slice(1).join("\n")}`;
    });
    return { ok: true, value: blocks.join("\n") };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "YAML conversion failed." },
    };
  }
}
