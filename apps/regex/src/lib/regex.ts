// ── Types ─────────────────────────────────────────────────────────────────────

export type RegexFlag = "g" | "i" | "m" | "s" | "u";

export interface MatchSpan {
  start: number;
  end: number;
  /** Full match text */
  text: string;
  /** Named and indexed capture groups */
  groups: CaptureGroup[];
  /** 0-based match index in the list of all matches */
  matchIndex: number;
}

export interface CaptureGroup {
  /** null for named groups that did not participate */
  value: string | null;
  /** undefined for positional groups */
  name?: string;
  /** 1-based capture index */
  index: number;
}

export interface RegexResult {
  ok: true;
  matches: MatchSpan[];
  matchCount: number;
  flags: string;
}

export interface RegexError {
  ok: false;
  message: string;
}

export type RegexOutcome = RegexResult | RegexError;

// ── Group-name parser ─────────────────────────────────────────────────────────

/**
 * Parse a regex pattern string and return a Map of named-group-name to its
 * 1-based positional capture index.
 *
 * Counting rules (per ECMA-262):
 *   - Every `(` that is NOT `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!` is a capturing group.
 *   - Named groups `(?<name>` are capturing (they count in the positional index too).
 *   - Escaped `\(` are not groups.
 *   - Character classes `[...]` may contain `(` that must be skipped.
 */
export function parseGroupNames(pattern: string): Map<string, number> {
  const result = new Map<string, number>();
  let i = 0;
  let groupIndex = 0; // counts capturing groups seen so far

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "\\") {
      // Escaped character - skip the next char
      i += 2;
      continue;
    }

    if (ch === "[") {
      // Character class - skip until the closing `]`, accounting for `\]`
      i++;
      while (i < pattern.length && !(pattern[i] === "]" && pattern[i - 1] !== "\\")) {
        i++;
      }
      i++; // skip `]`
      continue;
    }

    if (ch === "(") {
      // Determine if this is a capturing group
      if (pattern[i + 1] === "?") {
        const after = pattern[i + 2];
        if (after === ":" || after === "=" || after === "!") {
          // Non-capturing or lookahead
          i++;
          continue;
        }
        if (after === "<") {
          const afterLt = pattern[i + 3];
          if (afterLt === "=" || afterLt === "!") {
            // Lookbehind
            i++;
            continue;
          }
          // Named capturing group (?<name>...)
          groupIndex++;
          const nameStart = i + 3;
          const nameEnd = pattern.indexOf(">", nameStart);
          if (nameEnd !== -1) {
            const name = pattern.slice(nameStart, nameEnd);
            result.set(name, groupIndex);
            i = nameEnd + 1;
            continue;
          }
        }
      }
      // Plain capturing group
      groupIndex++;
    }

    i++;
  }

  return result;
}

// ── Execute ───────────────────────────────────────────────────────────────────

/**
 * Execute a regex pattern against test text and return structured match data.
 * Always uses the "g" flag internally so we can iterate all matches; other
 * flags are passed through as requested.
 */
export function execRegex(pattern: string, flags: Set<RegexFlag>, text: string): RegexOutcome {
  if (!pattern) {
    return { ok: true, matches: [], matchCount: 0, flags: "" };
  }

  // Build the flag string; always include "g" so matchAll works.
  const flagStr = buildFlagString(flags);

  let re: RegExp;
  try {
    re = new RegExp(pattern, flagStr);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Derive the name->1-based-positional-index map by scanning the pattern.
  // We count opening `(` characters that start capturing groups, skipping:
  //   - non-capturing groups  (?:
  //   - lookaheads/lookbehinds (?= (?! (?<= (?<!
  //   - escaped parens  \(
  // Named groups (?<name>...) ARE capturing, so they advance the counter too.
  const groupIndexByName = parseGroupNames(pattern);

  const spans: MatchSpan[] = [];
  let matchIndex = 0;

  try {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const fullMatch = m[0];
      const end = start + fullMatch.length;

      const groups: CaptureGroup[] = [];

      // Build positional groups (index 1+) with no names yet
      for (let i = 1; i < m.length; i++) {
        const val = m[i];
        groups.push({
          index: i,
          value: val !== undefined ? val : null,
        });
      }

      // Attach names using the pattern-derived index map (not value matching)
      for (const [name, idx] of groupIndexByName) {
        const g = groups[idx - 1]; // groups array is 0-based, idx is 1-based
        if (g) g.name = name;
      }

      spans.push({ start, end, text: fullMatch, groups, matchIndex });
      matchIndex++;
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  return { ok: true, matches: spans, matchCount: spans.length, flags: flagStr };
}

/**
 * Build a flag string that always includes "g" (needed for matchAll), plus
 * whatever the user has toggled on.
 */
export function buildFlagString(flags: Set<RegexFlag>): string {
  const order: RegexFlag[] = ["g", "i", "m", "s", "u"];
  const active = new Set(flags);
  active.add("g");
  return order.filter((f) => active.has(f)).join("");
}

// ── Replace preview ───────────────────────────────────────────────────────────

/**
 * Run a String.replace with the compiled regex and the replacement template.
 * Returns the replaced string or an error message.
 */
export function execReplace(
  pattern: string,
  flags: Set<RegexFlag>,
  text: string,
  replacement: string
): string {
  if (!pattern) return text;
  const flagStr = buildFlagString(flags);
  try {
    const re = new RegExp(pattern, flagStr);
    return text.replace(re, replacement);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// ── Plain-English explanation ─────────────────────────────────────────────────

export interface ExplanationToken {
  raw: string;
  explanation: string;
  kind: "anchor" | "quantifier" | "class" | "group" | "literal" | "alternation" | "escape";
}

/**
 * Produce a rough token-by-token plain-English explanation of a regex pattern.
 * This is a best-effort human-readable parse -- it handles the most common
 * constructs and falls back to "literal character" for anything unrecognised.
 *
 * We intentionally keep this simple: a full PCRE parser is out of scope and
 * the value here is "useful for beginners", not byte-perfect accuracy.
 */
export function explainPattern(pattern: string): ExplanationToken[] {
  if (!pattern) return [];
  const tokens: ExplanationToken[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    // Anchors
    if (ch === "^") {
      tokens.push({
        raw: "^",
        explanation: "Start of string (or line in multiline mode)",
        kind: "anchor",
      });
      i++;
      continue;
    }
    if (ch === "$") {
      tokens.push({
        raw: "$",
        explanation: "End of string (or line in multiline mode)",
        kind: "anchor",
      });
      i++;
      continue;
    }

    // Alternation
    if (ch === "|") {
      tokens.push({
        raw: "|",
        explanation: "OR, match the left side or the right side",
        kind: "alternation",
      });
      i++;
      continue;
    }

    // Escaped sequences
    if (ch === "\\") {
      const next = pattern[i + 1] ?? "";
      const raw = `\\${next}`;
      const esc = ESCAPE_MAP[next];
      if (esc) {
        tokens.push({ raw, explanation: esc, kind: "escape" });
      } else if (next === "b") {
        tokens.push({ raw, explanation: "Word boundary", kind: "anchor" });
      } else if (next === "B") {
        tokens.push({ raw, explanation: "Non-word boundary", kind: "anchor" });
      } else {
        tokens.push({ raw, explanation: `Literal "${next}"`, kind: "literal" });
      }
      i += 2;
      continue;
    }

    // Character classes [...]
    if (ch === "[") {
      const end = findCharClassEnd(pattern, i);
      const raw = pattern.slice(i, end + 1);
      tokens.push({ raw, explanation: explainCharClass(raw), kind: "class" });
      i = end + 1;
      // Consume trailing quantifier if present
      const q = peekQuantifier(pattern, i);
      if (q) {
        tokens.push({ raw: q.raw, explanation: q.explanation, kind: "quantifier" });
        i += q.raw.length;
      }
      continue;
    }

    // Groups (...)
    if (ch === "(") {
      const groupInfo = describeGroupOpen(pattern, i);
      tokens.push({ raw: groupInfo.raw, explanation: groupInfo.explanation, kind: "group" });
      i += groupInfo.raw.length;
      continue;
    }
    if (ch === ")") {
      tokens.push({ raw: ")", explanation: "End of group", kind: "group" });
      i++;
      const q = peekQuantifier(pattern, i);
      if (q) {
        tokens.push({ raw: q.raw, explanation: q.explanation, kind: "quantifier" });
        i += q.raw.length;
      }
      continue;
    }

    // Dot
    if (ch === ".") {
      tokens.push({
        raw: ".",
        explanation: "Any character except newline (any character with dotAll flag)",
        kind: "class",
      });
      i++;
      const q = peekQuantifier(pattern, i);
      if (q) {
        tokens.push({ raw: q.raw, explanation: q.explanation, kind: "quantifier" });
        i += q.raw.length;
      }
      continue;
    }

    // Standalone quantifiers (shouldn't appear here but guard anyway)
    if ("*+?{".includes(ch)) {
      const q = peekQuantifier(pattern, i);
      if (q) {
        tokens.push({ raw: q.raw, explanation: q.explanation, kind: "quantifier" });
        i += q.raw.length;
        continue;
      }
    }

    // Literal character
    tokens.push({ raw: ch, explanation: `Literal "${ch}"`, kind: "literal" });
    i++;
    const q = peekQuantifier(pattern, i);
    if (q) {
      tokens.push({ raw: q.raw, explanation: q.explanation, kind: "quantifier" });
      i += q.raw.length;
    }
  }

  return tokens;
}

// ── Internal explanation helpers ──────────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
  d: "Any digit [0-9]",
  D: "Any non-digit",
  w: "Any word character [a-zA-Z0-9_]",
  W: "Any non-word character",
  s: "Any whitespace character",
  S: "Any non-whitespace character",
  n: "Newline",
  r: "Carriage return",
  t: "Tab",
  f: "Form feed",
  v: "Vertical tab",
  "0": "Null character",
};

function findCharClassEnd(pattern: string, start: number): number {
  let i = start + 1;
  if (pattern[i] === "^") i++;
  if (pattern[i] === "]") i++; // ']' immediately after '[' or '[^' is literal
  while (i < pattern.length) {
    if (pattern[i] === "\\") {
      i += 2;
      continue;
    }
    if (pattern[i] === "]") return i;
    i++;
  }
  return pattern.length - 1;
}

function explainCharClass(raw: string): string {
  const negated = raw.startsWith("[^");
  const inner = negated ? raw.slice(2, -1) : raw.slice(1, -1);
  const prefix = negated ? "Any character NOT in: " : "Any character in: ";
  return prefix + describeCharClassContents(inner);
}

function describeCharClassContents(inner: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "\\") {
      const next = inner[i + 1] ?? "";
      parts.push(ESCAPE_MAP[next] ?? `\\${next}`);
      i += 2;
      continue;
    }
    if (inner[i + 1] === "-" && inner[i + 2] !== undefined) {
      parts.push(`"${inner[i]}" to "${inner[i + 2]}"`);
      i += 3;
      continue;
    }
    parts.push(`"${inner[i]}"`);
    i++;
  }
  return parts.join(", ");
}

function describeGroupOpen(pattern: string, i: number): { raw: string; explanation: string } {
  const rest = pattern.slice(i);
  if (rest.startsWith("(?:"))
    return {
      raw: "(?:",
      explanation: "Non-capturing group -- groups without creating a backreference",
    };
  if (rest.startsWith("(?="))
    return { raw: "(?=", explanation: "Positive lookahead -- matches if followed by..." };
  if (rest.startsWith("(?!"))
    return { raw: "(?!", explanation: "Negative lookahead -- matches if NOT followed by..." };
  if (rest.startsWith("(?<="))
    return { raw: "(?<=", explanation: "Positive lookbehind -- matches if preceded by..." };
  if (rest.startsWith("(?<!"))
    return { raw: "(?<!", explanation: "Negative lookbehind -- matches if NOT preceded by..." };
  // Named group (?<name>
  const namedMatch = /^\(\?<([^>]+)>/.exec(rest);
  if (namedMatch) {
    return { raw: namedMatch[0], explanation: `Named capture group "${namedMatch[1]}"` };
  }
  return { raw: "(", explanation: "Capture group -- captures the matched text for backreferences" };
}

interface QuantifierInfo {
  raw: string;
  explanation: string;
}

function peekQuantifier(pattern: string, i: number): QuantifierInfo | null {
  const ch = pattern[i];
  if (ch === undefined) return null;

  // {n}, {n,}, {n,m}
  if (ch === "{") {
    const end = pattern.indexOf("}", i);
    if (end !== -1) {
      const inner = pattern.slice(i + 1, end);
      const lazy = pattern[end + 1] === "?";
      const raw = pattern.slice(i, end + 1 + (lazy ? 1 : 0));
      const lazyNote = lazy ? " (lazy, fewest possible)" : " (greedy, as many as possible)";
      if (/^\d+$/.test(inner)) {
        return { raw, explanation: `Exactly ${inner} times${lazyNote}` };
      }
      const parts = inner.split(",");
      if (parts.length === 2) {
        const [min, max] = parts;
        if (max === "") return { raw, explanation: `${min} or more times${lazyNote}` };
        return { raw, explanation: `Between ${min} and ${max} times${lazyNote}` };
      }
    }
    return null;
  }

  if (ch === "*") {
    const lazy = pattern[i + 1] === "?";
    return {
      raw: lazy ? "*?" : "*",
      explanation: lazy ? "Zero or more times (lazy)" : "Zero or more times (greedy)",
    };
  }
  if (ch === "+") {
    const lazy = pattern[i + 1] === "?";
    return {
      raw: lazy ? "+?" : "+",
      explanation: lazy ? "One or more times (lazy)" : "One or more times (greedy)",
    };
  }
  if (ch === "?") {
    const lazy = pattern[i + 1] === "?";
    return {
      raw: lazy ? "??" : "?",
      explanation: lazy ? "Zero or one times (lazy)" : "Zero or one times (optional)",
    };
  }

  return null;
}

// ── Format match list as plain text for clipboard ────────────────────────────

/**
 * Serialise a match list to clipboard-friendly plain text.
 * One block per match: header line + optional group lines.
 */
export function formatMatchesForCopy(matches: MatchSpan[]): string {
  return matches
    .map((m) => {
      const header = `#${m.matchIndex + 1}  ${m.text || "(empty)"}  [${m.start}..${m.end}]`;
      if (m.groups.length === 0) return header;
      const groups = m.groups
        .map((g) => `  ${g.name ? `${g.name}: ` : `$${g.index}: `}${g.value ?? "(unmatched)"}`)
        .join("\n");
      return `${header}\n${groups}`;
    })
    .join("\n\n");
}

/**
 * Return just the matched text values, one per line. Useful for piping into
 * editors or scripts without the positional metadata.
 */
export function formatMatchTextsForCopy(matches: MatchSpan[]): string {
  return matches.map((m) => m.text).join("\n");
}

/**
 * Return all capture group values across all matches, one per line.
 * Named groups are prefixed with their name; positional groups with $N.
 * Unmatched optional groups are skipped.
 */
export function formatCaptureGroupsForCopy(matches: MatchSpan[]): string {
  const lines: string[] = [];
  for (const m of matches) {
    for (const g of m.groups) {
      if (g.value === null) continue;
      const label = g.name ? g.name : `$${g.index}`;
      lines.push(`${label}: ${g.value}`);
    }
  }
  return lines.join("\n");
}

// ── Common pattern library ────────────────────────────────────────────────────

export interface CommonPattern {
  label: string;
  pattern: string;
  flags: RegexFlag[];
  example: string;
  description: string;
}

export const COMMON_PATTERNS: CommonPattern[] = [
  {
    label: "Email address",
    pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    flags: ["g", "i"],
    example: "Contact us at hello@example.com or support@domain.co.nz",
    description: "Matches most standard email addresses.",
  },
  {
    label: "URL (http/https)",
    pattern: "https?:\\/\\/[^\\s/$.?#].[^\\s]*",
    flags: ["g", "i"],
    example: "Visit https://example.com or http://docs.example.org/guide?ref=1",
    description: "Matches http and https URLs.",
  },
  {
    label: "IPv4 address",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b",
    flags: ["g"],
    example: "Server IPs: 192.168.1.1, 10.0.0.255, 172.16.254.1",
    description: "Matches valid IPv4 addresses (0.0.0.0 to 255.255.255.255).",
  },
  {
    label: "Hex colour",
    pattern: "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: ["g"],
    example: "Colours: #fff, #2f9d8d, #e8b04b, #D9594C",
    description: "Matches 3 or 6-digit CSS hex colour codes.",
  },
  {
    label: "ISO date (YYYY-MM-DD)",
    pattern: "\\b(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])\\b",
    flags: ["g"],
    example: "Released 2024-01-15, updated 2024-06-22.",
    description: "Matches ISO 8601 date strings with capture groups for year, month, day.",
  },
  {
    label: "Phone number (intl)",
    pattern: "\\+?[1-9]\\d{0,2}[\\s.\\-]?\\(?\\d{1,4}\\)?[\\s.\\-]?\\d{1,4}[\\s.\\-]?\\d{1,9}",
    flags: ["g"],
    example: "Call +1 800 555-0199 or +64 9 123 4567",
    description: "Loosely matches international phone numbers.",
  },
  {
    label: "Slug (URL-safe)",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    flags: [],
    example: "my-blog-post-title",
    description: "Validates a URL slug: lowercase letters, digits and hyphens only.",
  },
  {
    label: "Semver",
    pattern:
      "\\bv?(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?\\b",
    flags: ["g"],
    example: "Changelog: v1.0.0, 2.3.1-beta.1, 10.0.0+build.42",
    description: "Matches semantic version strings.",
  },
  {
    label: "UUID v4",
    pattern: "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
    flags: ["g", "i"],
    example: "ID: 550e8400-e29b-41d4-a716-446655440000",
    description: "Matches UUID v4 strings.",
  },
  {
    label: "Credit card number",
    pattern:
      "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\\b",
    flags: ["g"],
    example: "Card: 4111111111111111 or 5500005555555559",
    description: "Matches major credit card number formats (Visa, Mastercard, Amex, Discover).",
  },
  {
    label: "HTML tag",
    pattern: "<([a-zA-Z][a-zA-Z0-9]*)(?:\\s[^>]*)?>",
    flags: ["g", "i"],
    example: '<div class="foo"><span id="bar">hello</span></div>',
    description: "Matches opening HTML tags and captures the tag name.",
  },
  {
    label: "Blank lines",
    pattern: "^\\s*$",
    flags: ["g", "m"],
    example: "line one\n\n   \nline four\n\nline six",
    description: "Matches empty or whitespace-only lines in multiline text.",
  },
];

// ── Code-gen export ───────────────────────────────────────────────────────────

export type CodeLang = "javascript" | "python" | "go" | "php";

/**
 * Generate a ready-to-paste code snippet for the given language.
 * Escapes the pattern for use inside a string literal of that language.
 */
export function generateCodeExport(
  pattern: string,
  flags: Set<RegexFlag>,
  testText: string,
  lang: CodeLang
): string {
  if (!pattern) return "// Enter a pattern to generate code";

  const flagStr = [...flags].join("");
  // Escape backslashes for string-literal languages (JS/Python/Go/PHP all use \)
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

  switch (lang) {
    case "javascript": {
      // Use RegExp constructor so flags are explicit and readable
      const jsFlags = flagStr || "g";
      return [
        `const pattern = new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(jsFlags)});`,
        `const text = ${JSON.stringify(testText)};`,
        "",
        "// Find all matches",
        "const matches = [...text.matchAll(pattern)];",
        "console.log(matches.map(m => m[0]));",
      ].join("\n");
    }

    case "python": {
      // Python re flags
      const pyFlagParts: string[] = [];
      if (flags.has("i")) pyFlagParts.push("re.IGNORECASE");
      if (flags.has("m")) pyFlagParts.push("re.MULTILINE");
      if (flags.has("s")) pyFlagParts.push("re.DOTALL");
      const pyFlags = pyFlagParts.length > 0 ? `, ${pyFlagParts.join(" | ")}` : "";
      const rawPat = pattern.replace(/\\/g, "\\\\");
      return [
        "import re",
        "",
        `pattern = re.compile(r${JSON.stringify(rawPat)}${pyFlags})`,
        `text = ${JSON.stringify(testText)}`,
        "",
        "# Find all matches",
        "matches = pattern.findall(text)",
        "print(matches)",
      ].join("\n");
    }

    case "go": {
      // Go regexp (no i/m/s as separate flags; use inline modifiers)
      const goMods: string[] = [];
      if (flags.has("i")) goMods.push("i");
      if (flags.has("m")) goMods.push("m");
      if (flags.has("s")) goMods.push("s");
      const modPrefix = goMods.length > 0 ? `(?${goMods.join("")})` : "";
      const goPat = esc(`${modPrefix}${pattern}`);
      return [
        "package main",
        "",
        "import (",
        `\t"fmt"`,
        `\t"regexp"`,
        ")",
        "",
        "func main() {",
        `\tpattern := regexp.MustCompile(\`${goPat}\`)`,
        `\ttext := ${JSON.stringify(testText)}`,
        "",
        "\t// Find all matches",
        "\tmatches := pattern.FindAllString(text, -1)",
        "\tfmt.Println(matches)",
        "}",
      ].join("\n");
    }

    case "php": {
      const phpFlags = flagStr.replace("g", ""); // PHP uses preg_match_all for global
      const phpPat = pattern.replace(/\//g, "\\/");
      return [
        "<?php",
        "",
        `$pattern = '/${phpPat}/${phpFlags}';`,
        `$text = ${JSON.stringify(testText)};`,
        "",
        "// Find all matches",
        "preg_match_all($pattern, $text, $matches);",
        "print_r($matches[0]);",
      ].join("\n");
    }
  }
}

// ── Substitution reference ────────────────────────────────────────────────────

export interface SubstitutionRef {
  token: string;
  meaning: string;
}

/**
 * Common substitution tokens for JavaScript's String.replace / String.replaceAll.
 * These are the same tokens usable in the Replace tab.
 */
export const SUBSTITUTION_REFS: SubstitutionRef[] = [
  { token: "$&", meaning: "The full matched substring" },
  { token: "$`", meaning: "Text before the match" },
  { token: "$'", meaning: "Text after the match" },
  { token: "$1, $2, ...", meaning: "Nth capture group (1-based)" },
  { token: "$<name>", meaning: "Named capture group value" },
  { token: "$$", meaning: "Literal dollar sign" },
];
