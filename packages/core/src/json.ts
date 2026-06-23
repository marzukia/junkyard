import { z } from "zod";
import type { ToolDef } from "./types.js";

export type IndentOption = 2 | 4 | "tab";

export interface ParseError {
  message: string;
  line: number;
  col: number;
}

export interface JsonParseOutcome {
  ok: boolean;
  value?: unknown;
  error?: ParseError;
}

function cleanMessage(msg: string): string {
  return msg
    .replace(/\s+in JSON at position \d+.*$/, "")
    .replace(/\s+at line \d+ column \d+.*$/, "")
    .trim();
}

function positionToLineCol(raw: string, pos: number): { line: number; col: number } {
  const clamped = Math.min(pos, raw.length);
  let line = 1;
  let col = 1;
  for (let i = 0; i < clamped; i++) {
    if (raw[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function extractErrorLocation(raw: string, msg: string): { line: number; col: number } {
  const lcMatch = /at line (\d+) column (\d+)/.exec(msg);
  if (lcMatch) {
    return { line: Number.parseInt(lcMatch[1], 10), col: Number.parseInt(lcMatch[2], 10) };
  }
  const posMatch = /at position (\d+)/.exec(msg);
  if (posMatch) {
    return positionToLineCol(raw, Number.parseInt(posMatch[1], 10));
  }
  const spiderMatch = /line (\d+) column (\d+)/.exec(msg);
  if (spiderMatch) {
    return { line: Number.parseInt(spiderMatch[1], 10), col: Number.parseInt(spiderMatch[2], 10) };
  }
  return { line: 1, col: 1 };
}

export function parseJson(raw: string): JsonParseOutcome {
  try {
    const value = JSON.parse(raw) as unknown;
    return { ok: true, value };
  } catch (err) {
    const msg = err instanceof SyntaxError ? err.message : String(err);
    const loc = extractErrorLocation(raw, msg);
    return { ok: false, error: { message: cleanMessage(msg), line: loc.line, col: loc.col } };
  }
}

export function formatJson(raw: string, indent: IndentOption): string {
  const parsed = JSON.parse(raw) as unknown;
  const spaces: string | number = indent === "tab" ? "\t" : indent;
  return JSON.stringify(parsed, null, spaces);
}

export function minifyJson(raw: string): string {
  const parsed = JSON.parse(raw) as unknown;
  return JSON.stringify(parsed);
}

export function validateJson(raw: string): { valid: boolean; error?: string } {
  const result = parseJson(raw);
  if (result.ok) return { valid: true };
  return { valid: false, error: result.error?.message };
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const jsonTool: ToolDef = {
  slug: "json",
  name: "JSON Formatter",
  ops: [
    {
      name: "format",
      description: "Pretty-print JSON with configurable indentation",
      inputSchema: z.object({
        json: z.string(),
        indent: z.union([z.literal(2), z.literal(4), z.literal("tab")]).default(2),
      }),
      run({ json, indent }) {
        return formatJson(json, indent as IndentOption);
      },
    },
    {
      name: "minify",
      description: "Remove all whitespace from JSON",
      inputSchema: z.object({ json: z.string() }),
      run({ json }) {
        return minifyJson(json);
      },
    },
    {
      name: "validate",
      description: "Validate JSON and return parse errors with line/column",
      inputSchema: z.object({ json: z.string() }),
      run({ json }) {
        return validateJson(json);
      },
    },
  ],
};
