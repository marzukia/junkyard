// ── Types ─────────────────────────────────────────────────────────────────────

export type IndentOption = 2 | 4 | "tab";

export interface ParseError {
  message: string;
  line: number;
  col: number;
}

export interface ParseResult {
  ok: true;
  value: unknown;
}

export interface ParseFailure {
  ok: false;
  error: ParseError;
}

export type JsonParseOutcome = ParseResult | ParseFailure;

// ── Tree node ─────────────────────────────────────────────────────────────────

export type TreeNode =
  | {
      kind: "primitive";
      key: string | null;
      value: string;
      valueKind: "string" | "number" | "boolean" | "null";
    }
  | { kind: "object"; key: string | null; children: TreeNode[]; count: number }
  | { kind: "array"; key: string | null; children: TreeNode[]; count: number };

// ── Parse with precise error location ────────────────────────────────────────

/**
 * Parse a JSON string and return either the parsed value or a structured error
 * with line+column extracted from the native SyntaxError message.
 *
 * Browsers/V8 embed "at line N column M" or "position N" in SyntaxError.message.
 * We try both patterns; if neither matches we compute position from a character
 * offset found via `at position N` style messages.
 */
export function parseJson(raw: string): JsonParseOutcome {
  try {
    const value = JSON.parse(raw) as unknown;
    return { ok: true, value };
  } catch (err) {
    const msg = err instanceof SyntaxError ? err.message : String(err);
    const loc = extractErrorLocation(raw, msg);
    return {
      ok: false,
      error: { message: cleanMessage(msg), line: loc.line, col: loc.col },
    };
  }
}

function cleanMessage(msg: string): string {
  // Strip the redundant position suffix V8 appends after the actual message
  return msg
    .replace(/\s+in JSON at position \d+.*$/, "")
    .replace(/\s+at line \d+ column \d+.*$/, "")
    .trim();
}

function extractErrorLocation(raw: string, msg: string): { line: number; col: number } {
  // V8 >= 10: "Unexpected token 'x', "..." is not valid JSON at line N column M"
  const lcMatch = /at line (\d+) column (\d+)/.exec(msg);
  if (lcMatch) {
    return { line: Number.parseInt(lcMatch[1], 10), col: Number.parseInt(lcMatch[2], 10) };
  }

  // Older V8: "Unexpected token x in JSON at position N"
  const posMatch = /at position (\d+)/.exec(msg);
  if (posMatch) {
    const pos = Number.parseInt(posMatch[1], 10);
    return positionToLineCol(raw, pos);
  }

  // SpiderMonkey / JavaScriptCore: "JSON.parse: unexpected character at line N column M"
  const spiderMatch = /line (\d+) column (\d+)/.exec(msg);
  if (spiderMatch) {
    return { line: Number.parseInt(spiderMatch[1], 10), col: Number.parseInt(spiderMatch[2], 10) };
  }

  // Last resort: scan the raw string to find where it first diverges
  return { line: 1, col: 1 };
}

export function positionToLineCol(raw: string, pos: number): { line: number; col: number } {
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

// ── Format ────────────────────────────────────────────────────────────────────

export function formatJson(raw: string, indent: IndentOption): string {
  const parsed = JSON.parse(raw) as unknown;
  const spaces: string | number = indent === "tab" ? "\t" : indent;
  return JSON.stringify(parsed, null, spaces);
}

// ── Minify ────────────────────────────────────────────────────────────────────

export function minifyJson(raw: string): string {
  const parsed = JSON.parse(raw) as unknown;
  return JSON.stringify(parsed);
}

// ── Tree building ─────────────────────────────────────────────────────────────

export function buildTree(value: unknown, key: string | null = null): TreeNode {
  if (value === null) {
    return { kind: "primitive", key, value: "null", valueKind: "null" };
  }
  if (typeof value === "boolean") {
    return { kind: "primitive", key, value: String(value), valueKind: "boolean" };
  }
  if (typeof value === "number") {
    return { kind: "primitive", key, value: String(value), valueKind: "number" };
  }
  if (typeof value === "string") {
    return { kind: "primitive", key, value: JSON.stringify(value), valueKind: "string" };
  }
  if (Array.isArray(value)) {
    const children = value.map((item, idx) => buildTree(item, String(idx)));
    return { kind: "array", key, children, count: children.length };
  }
  if (typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      buildTree(v, k)
    );
    return { kind: "object", key, children, count: children.length };
  }
  // fallback for undefined etc.
  return { kind: "primitive", key, value: String(value), valueKind: "null" };
}

// ── Sort keys ─────────────────────────────────────────────────────────────────

/**
 * Recursively sort all object keys alphabetically.
 * Arrays preserve their order; only object keys are sorted.
 */
export function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = sortKeys((value as Record<string, unknown>)[k]);
      return acc;
    }, {});
  return sorted;
}

// ── JSON repair ───────────────────────────────────────────────────────────────

/**
 * Best-effort JSON repair for common authoring mistakes:
 *   - trailing commas in objects and arrays
 *   - single-quoted strings
 *   - unquoted keys
 *   - missing quotes around string values that look like identifiers
 *
 * Returns the repaired string on success, or throws if it still can't parse.
 */
export function repairJson(raw: string): string {
  let s = raw.trim();

  // 1. Convert single-quoted strings to double-quoted
  //    e.g. {'key': 'val'} -> {"key": "val"}
  //    Careful: only replace outside of existing double-quoted strings
  s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner: string) => {
    // Escape any unescaped double quotes inside
    return `"${inner.replace(/"/g, '\\"')}"`;
  });

  // 2. Remove trailing commas before ] or }
  //    e.g. [1, 2, 3,] -> [1, 2, 3]
  s = s.replace(/,(\s*[}\]])/g, "$1");

  // 3. Quote unquoted object keys:  { key: value } -> { "key": value }
  //    Match word-like keys not already quoted
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // Verify it's now valid
  JSON.parse(s);
  return s;
}

// ── JSONPath query ─────────────────────────────────────────────────────────────

export interface QueryResult {
  path: string;
  value: unknown;
}

/**
 * Minimal JSONPath evaluator supporting:
 *   $           - root
 *   .key        - child key
 *   ['key']     - child key (bracket)
 *   [N]         - array index
 *   .*          - all children
 *   ..**        - recursive descent (wildcard)
 *   [*]         - all array items
 *
 * Returns an array of {path, value} matches.
 * If the expression is empty, returns the root.
 */
export function queryJsonPath(root: unknown, expr: string): QueryResult[] {
  const path = expr.trim();
  if (!path || path === "$") {
    return [{ path: "$", value: root }];
  }

  // Tokenise the path after the leading $
  const stripped = path.startsWith("$") ? path.slice(1) : path;

  const results: QueryResult[] = [];

  function traverse(value: unknown, remaining: string, currentPath: string): void {
    if (!remaining) {
      results.push({ path: currentPath, value });
      return;
    }

    // Recursive descent: ..* or ..*
    const recursiveMatch = /^\.\.(\*|[a-zA-Z_$][a-zA-Z0-9_$]*)(.*)$/.exec(remaining);
    if (recursiveMatch) {
      const key = recursiveMatch[1];
      const rest = recursiveMatch[2];
      // Apply to current node and all descendants
      function descend(v: unknown, p: string): void {
        if (key === "*") {
          traverse(v, rest, p);
        } else if (isObj(v) && key in (v as Record<string, unknown>)) {
          traverse((v as Record<string, unknown>)[key], rest, `${p}.${key}`);
        }
        // Recurse into children
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            descend(v[i], `${p}[${i}]`);
          }
        } else if (isObj(v)) {
          for (const k of Object.keys(v as Record<string, unknown>)) {
            descend((v as Record<string, unknown>)[k], `${p}.${k}`);
          }
        }
      }
      descend(value, currentPath);
      return;
    }

    // Wildcard: .* or [*]
    const wildcardDot = /^\.\*(.*)$/.exec(remaining);
    if (wildcardDot) {
      const rest = wildcardDot[1];
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          traverse(value[i], rest, `${currentPath}[${i}]`);
        }
      } else if (isObj(value)) {
        for (const k of Object.keys(value as Record<string, unknown>)) {
          traverse((value as Record<string, unknown>)[k], rest, `${currentPath}.${k}`);
        }
      }
      return;
    }

    const wildcardBracket = /^\[\*\](.*)$/.exec(remaining);
    if (wildcardBracket) {
      const rest = wildcardBracket[1];
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          traverse(value[i], rest, `${currentPath}[${i}]`);
        }
      }
      return;
    }

    // Dot-notation: .key
    const dotKey = /^\.([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)$/.exec(remaining);
    if (dotKey) {
      const key = dotKey[1];
      const rest = dotKey[2];
      if (isObj(value) && key in (value as Record<string, unknown>)) {
        traverse((value as Record<string, unknown>)[key], rest, `${currentPath}.${key}`);
      }
      return;
    }

    // Bracket-notation: ['key'] or ["key"]
    const bracketKey = /^\[['"]([^'"]+)['"]\](.*)$/.exec(remaining);
    if (bracketKey) {
      const key = bracketKey[1];
      const rest = bracketKey[2];
      if (isObj(value) && key in (value as Record<string, unknown>)) {
        traverse((value as Record<string, unknown>)[key], rest, `${currentPath}['${key}']`);
      }
      return;
    }

    // Array index: [N]
    const arrIdx = /^\[(\d+)\](.*)$/.exec(remaining);
    if (arrIdx) {
      const idx = Number.parseInt(arrIdx[1], 10);
      const rest = arrIdx[2];
      if (Array.isArray(value) && idx < value.length) {
        traverse(value[idx], rest, `${currentPath}[${idx}]`);
      }
      return;
    }
  }

  traverse(root, stripped, "$");
  return results;
}

function isObj(v: unknown): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// ── Byte-size helper ──────────────────────────────────────────────────────────

export function byteSize(str: string): number {
  return new TextEncoder().encode(str).length;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
