import { z } from "zod";
import type { ToolDef } from "./types.js";

export type Delimiter = "," | "\t" | ";" | "|";

export interface CsvParseOptions {
  delimiter: Delimiter;
  hasHeader: boolean;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  rowCount: number;
  colCount: number;
}

function columnLabel(idx: number): string {
  let label = "";
  let n = idx;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function splitCsvRows(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuote) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; }
        else { inQuote = false; i++; }
      } else { field += ch; i++; }
    } else {
      if (ch === '"') { inQuote = true; i++; }
      else if (ch === delimiter) { row.push(field); field = ""; i++; }
      else if (ch === "\n") {
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = []; i++;
      } else { field += ch; i++; }
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

export function detectDelimiter(text: string): Delimiter {
  const sample = text.split("\n").slice(0, 5).join("\n");
  const candidates: Delimiter[] = [",", "\t", ";", "|"];
  let bestDelim: Delimiter = ",";
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sample.split("\n").filter((l) => l.trim().length > 0).map((line) => {
      let count = 0;
      let inq = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inq = !inq;
        else if (!inq && line[i] === delim) count++;
      }
      return count;
    });
    if (counts.length === 0) continue;
    const max = Math.max(...counts);
    if (max === 0) continue;
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const score = mean - variance * 0.1;
    if (score > bestScore) { bestScore = score; bestDelim = delim; }
  }
  return bestDelim;
}

export function parseCsv(text: string, opts: CsvParseOptions): { ok: true; value: ParsedCsv } | { ok: false; error: string } {
  try {
    const rawRows = splitCsvRows(text, opts.delimiter);
    const allRows = rawRows.filter((r) => r.some((cell) => cell.trim().length > 0));
    if (allRows.length === 0) return { ok: false, error: "No data found in input." };

    let headers: string[];
    let dataRows: string[][];

    if (opts.hasHeader) {
      headers = allRows[0];
      dataRows = allRows.slice(1);
    } else {
      const colCount = Math.max(...allRows.map((r) => r.length));
      headers = Array.from({ length: colCount }, (_, i) => columnLabel(i));
      dataRows = allRows;
    }

    return { ok: true, value: { headers, rows: dataRows, rowCount: dataRows.length, colCount: headers.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to parse CSV." };
  }
}

function coerceValue(raw: string): unknown {
  if (raw === "") return null;
  if (raw.toLowerCase() === "true") return true;
  if (raw.toLowerCase() === "false") return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return raw;
}

export function csvToJsonString(csvText: string, delimiter?: Delimiter): string {
  const delim = delimiter ?? detectDelimiter(csvText);
  const parsed = parseCsv(csvText, { delimiter: delim, hasHeader: true });
  if (!parsed.ok) throw new Error(parsed.error);
  const objects = parsed.value.rows.map((row) => {
    const obj = Object.create(null) as Record<string, unknown>;
    parsed.value.headers.forEach((header, i) => { obj[header] = coerceValue(row[i] ?? ""); });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

function csvEscape(val: string, delimiter: Delimiter): string {
  // OWASP formula injection: prefix cells starting with a formula trigger char
  // so spreadsheet apps do not execute them as formulas on import.
  const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
  let out = val;
  if (FORMULA_TRIGGERS.test(val)) {
    out = "'" + val;
  }
  if (out.includes('"') || out.includes(delimiter) || out.includes("\n") || out.includes("\r")) {
    return `"${out.replace(/"/g, '""')}"`;
  }
  return out;
}

export function jsonToCsvString(jsonText: string, delimiter: Delimiter = ","): string {
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error("Invalid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
  if (parsed.length === 0) return "";

  const first = parsed[0];
  if (Array.isArray(first)) {
    return (parsed as unknown[][]).map((row) => row.map((cell) => csvEscape(String(cell ?? ""), delimiter)).join(delimiter)).join("\n");
  }
  if (typeof first === "object" && first !== null) {
    const keySet = new Set<string>();
    for (const item of parsed) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        for (const k of Object.keys(item as Record<string, unknown>)) keySet.add(k);
      }
    }
    const headers = Array.from(keySet);
    const headerLine = headers.map((h) => csvEscape(h, delimiter)).join(delimiter);
    const dataLines = (parsed as Record<string, unknown>[]).map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        return csvEscape(String(val), delimiter);
      }).join(delimiter)
    );
    return [headerLine, ...dataLines].join("\n");
  }
  throw new Error("JSON array must contain objects or arrays.");
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const csvTool: ToolDef = {
  slug: "csv",
  name: "CSV / JSON",
  ops: [
    {
      name: "csvToJson",
      description: "Convert CSV text to a JSON array of objects",
      inputSchema: z.object({
        csv: z.string(),
        delimiter: z.enum([",", "\t", ";", "|"]).optional(),
      }),
      run({ csv, delimiter }) {
        return csvToJsonString(csv, delimiter as Delimiter | undefined);
      },
    },
    {
      name: "jsonToCsv",
      description: "Convert a JSON array of objects or arrays to CSV text",
      inputSchema: z.object({
        json: z.string(),
        delimiter: z.enum([",", "\t", ";", "|"]).default(","),
      }),
      run({ json, delimiter }) {
        return jsonToCsvString(json, delimiter as Delimiter);
      },
    },
  ],
};
