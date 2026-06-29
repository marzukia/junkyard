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

  // Last resort: scan the raw string to find the first offset that causes a
  // parse failure via binary search, then convert to line/col.
  const pos = findErrorOffset(raw);
  return positionToLineCol(raw, pos);
}

/**
 * Find the approximate character offset of a JSON parse error using a
 * recursive-descent parser that mirrors the JSON grammar. Returns the offset
 * of the first character that violates the grammar, or the length of the raw
 * string if the input is truncated/unclosed.
 *
 * This is the last-resort path (fires only when the JS engine doesn't embed
 * position info in the SyntaxError message), so correctness matters more than
 * speed; the inputs are small editor strings, not streaming data.
 */
function findErrorOffset(raw: string): number {
  const n = raw.length;
  // `cursor` is a mutable box so recursive helpers can advance it.
  const c = { i: 0 };

  function skipWs(): void {
    while (c.i < n && " \t\r\n".includes(raw[c.i])) c.i++;
  }

  /** Consume a complete string token.  Returns false if malformed. */
  function consumeString(): boolean {
    if (raw[c.i] !== '"') return false;
    c.i++;
    while (c.i < n) {
      if (raw[c.i] === "\\") {
        c.i += 2;
      } else if (raw[c.i] === '"') {
        c.i++;
        return true;
      } else {
        c.i++;
      }
    }
    return false; // unterminated
  }

  /** Consume a number. Returns false if the current char isn't a digit/minus. */
  function consumeNumber(): boolean {
    const start = c.i;
    if (c.i < n && raw[c.i] === "-") c.i++;
    if (c.i >= n || raw[c.i] < "0" || raw[c.i] > "9") {
      c.i = start;
      return false;
    }
    while (c.i < n && raw[c.i] >= "0" && raw[c.i] <= "9") c.i++;
    if (c.i < n && raw[c.i] === ".") {
      c.i++;
      while (c.i < n && raw[c.i] >= "0" && raw[c.i] <= "9") c.i++;
    }
    if (c.i < n && (raw[c.i] === "e" || raw[c.i] === "E")) {
      c.i++;
      if (c.i < n && (raw[c.i] === "+" || raw[c.i] === "-")) c.i++;
      while (c.i < n && raw[c.i] >= "0" && raw[c.i] <= "9") c.i++;
    }
    return true;
  }

  /** Parse a JSON value.  Returns true on success, false on failure.
   *  On failure, c.i points at (or just past) the offending character. */
  function parseValue(): boolean {
    skipWs();
    if (c.i >= n) return false; // truncated

    const ch = raw[c.i];

    if (ch === '"') return consumeString();
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (raw.startsWith("true", c.i)) {
      c.i += 4;
      return true;
    }
    if (raw.startsWith("false", c.i)) {
      c.i += 5;
      return true;
    }
    if (raw.startsWith("null", c.i)) {
      c.i += 4;
      return true;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) return consumeNumber();

    return false; // unexpected character
  }

  function parseObject(): boolean {
    c.i++; // consume '{'
    skipWs();
    if (c.i < n && raw[c.i] === "}") {
      c.i++;
      return true;
    } // empty object

    while (c.i < n) {
      skipWs();
      if (!consumeString()) return false; // expected key
      skipWs();
      if (c.i >= n || raw[c.i] !== ":") return false; // expected colon
      c.i++;
      if (!parseValue()) return false;
      skipWs();
      if (c.i >= n) return false;
      if (raw[c.i] === "}") {
        c.i++;
        return true;
      }
      if (raw[c.i] !== ",") return false; // expected comma or }
      c.i++;
    }
    return false; // unterminated
  }

  function parseArray(): boolean {
    c.i++; // consume '['
    skipWs();
    if (c.i < n && raw[c.i] === "]") {
      c.i++;
      return true;
    } // empty array

    while (c.i < n) {
      if (!parseValue()) return false;
      skipWs();
      if (c.i >= n) return false;
      if (raw[c.i] === "]") {
        c.i++;
        return true;
      }
      if (raw[c.i] !== ",") return false; // expected comma or ]
      c.i++;
    }
    return false; // unterminated
  }

  parseValue();
  // c.i now points at the position where parsing stopped (the offending char,
  // or just past it if we consumed a bad char).  Return it clamped to valid range.
  return Math.min(c.i, Math.max(0, n - 1));
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
 * Tokenise a JSON string into segments: double-quoted string literals and
 * everything else. This lets repair passes skip over string content so they
 * never corrupt a value like {"a":"x ,] y"} by treating its interior as
 * structural JSON.
 */
function tokeniseJson(s: string): Array<{ str: true; raw: string } | { str: false; raw: string }> {
  const tokens: Array<{ str: true; raw: string } | { str: false; raw: string }> = [];
  let i = 0;
  let nonStr = "";
  while (i < s.length) {
    if (s[i] === '"') {
      if (nonStr) {
        tokens.push({ str: false, raw: nonStr });
        nonStr = "";
      }
      // Consume the full double-quoted string (handle backslash escapes)
      let literal = '"';
      i++;
      while (i < s.length) {
        if (s[i] === "\\") {
          literal += s[i] + (s[i + 1] ?? "");
          i += 2;
        } else if (s[i] === '"') {
          literal += '"';
          i++;
          break;
        } else {
          literal += s[i];
          i++;
        }
      }
      tokens.push({ str: true, raw: literal });
    } else {
      nonStr += s[i];
      i++;
    }
  }
  if (nonStr) tokens.push({ str: false, raw: nonStr });
  return tokens;
}

/**
 * Best-effort JSON repair for common authoring mistakes:
 *   - trailing commas in objects and arrays
 *   - single-quoted strings
 *   - unquoted keys
 *   - missing quotes around string values that look like identifiers
 *
 * Returns the repaired string on success, or throws if it still can't parse.
 * If the input is already valid JSON it is returned untouched (fast path).
 */
export function repairJson(raw: string): string {
  const s = raw.trim();

  // Fast path: already valid - return immediately without any mutation.
  try {
    JSON.parse(s);
    return s;
  } catch {
    // fall through to repair passes
  }

  // Tokenise so repair passes operate only on non-string segments.
  const tokens = tokeniseJson(s);

  // Pass 1: convert single-quoted string literals to double-quoted.
  // Only applies to non-string tokens (single quotes cannot be inside a valid
  // double-quoted JSON string without escaping, so this is safe).
  const afterSingleQuote = tokens
    .map((t) => {
      if (t.str) return t.raw;
      return t.raw.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_: string, inner: string) => {
        return `"${inner.replace(/"/g, '\\"')}"`;
      });
    })
    .join("");

  // Re-tokenise after single-quote conversion (new double-quoted strings may have appeared)
  const tokens2 = tokeniseJson(afterSingleQuote);

  // Pass 2: remove trailing commas before ] or } - structural tokens only.
  // Pass 3: quote unquoted object keys - structural tokens only.
  const repaired = tokens2
    .map((t) => {
      if (t.str) return t.raw;
      return t.raw
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
    })
    .join("");

  // Verify repaired string parses (throws if still broken)
  JSON.parse(repaired);
  return repaired;
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
      // `$..*` means all descendants of the root, not including the root itself.
      // We track whether we are still at the node where the `..` was applied so
      // we can skip emitting it for wildcard descent.
      function descend(v: unknown, p: string, isOrigin: boolean): void {
        if (key === "*") {
          // Emit this node only if it is not the origin of the `..` operator
          if (!isOrigin) {
            traverse(v, rest, p);
          }
        } else if (isObj(v) && key in (v as Record<string, unknown>)) {
          traverse((v as Record<string, unknown>)[key], rest, `${p}.${key}`);
        }
        // Recurse into children regardless
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            descend(v[i], `${p}[${i}]`, false);
          }
        } else if (isObj(v)) {
          for (const k of Object.keys(v as Record<string, unknown>)) {
            descend((v as Record<string, unknown>)[k], `${p}.${k}`, false);
          }
        }
      }
      descend(value, currentPath, true);
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

export { formatBytes } from "@junkyardsh/ui";
