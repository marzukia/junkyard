import { z } from "zod";
import type { ToolDef } from "./types.js";

export interface MatchSpan {
  start: number;
  end: number;
  text: string;
  groups: { value: string | null; name?: string; index: number }[];
  matchIndex: number;
}

export interface RegexTestResult {
  matches: MatchSpan[];
  matchCount: number;
  flags: string;
}

// Feature-detect the 'd' flag (RegExp hasIndices, ES2022 / Node 16+).
// Node 22 and Bun 1.x both support it, so this guard never triggers in practice,
// but avoids a hard crash on older engines that would mis-handle the flag string.
const HAS_INDICES_SUPPORTED = (() => {
  try {
    void new RegExp("x", "dg");
    return true;
  } catch {
    return false;
  }
})();

export function testRegex(
  pattern: string,
  flags: string,
  text: string
): RegexTestResult {
  if (!pattern) return { matches: [], matchCount: 0, flags: "" };

  // Always include 'g' for matchAll; include 'd' (hasIndices) when supported so
  // match.indices is populated, giving correct positional index for named groups.
  const flagSet = new Set(flags.split("").filter(Boolean));
  flagSet.add("g");
  if (HAS_INDICES_SUPPORTED) flagSet.add("d");
  const flagStr = ["d", "g", "i", "m", "s", "u"].filter((f) => flagSet.has(f)).join("");

  const re = new RegExp(pattern, flagStr);
  const spans: MatchSpan[] = [];
  let matchIndex = 0;

  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    const fullMatch = m[0];
    const end = start + fullMatch.length;

    const groups: MatchSpan["groups"] = [];
    const namedGroups = m.groups ?? {};

    // Build a map from group name -> positional index using match.indices.groups.
    // This is correct even when two groups capture the same string value, because
    // indices are position-based not value-based.
    //
    // The 'd' flag populates `indices` (ES2022 RegExp hasIndices). TypeScript's
    // matchAll return type doesn't expose `.indices` directly, so we access it
    // via an explicit structural type assertion.
    type MatchWithIndices = {
      indices?: Array<[number, number] | undefined> & { groups?: Record<string, [number, number] | undefined> };
    };
    const mIdx = (m as unknown as MatchWithIndices).indices;
    const namedIndexMap = new Map<string, number>();
    const indicesGroups = mIdx?.groups ?? {};
    for (const name of Object.keys(indicesGroups)) {
      // Find the positional index (1-based) whose span matches the named group span.
      const namedSpan = indicesGroups[name];
      if (namedSpan === undefined) continue;
      for (let i = 1; i < m.length; i++) {
        const span = mIdx?.[i];
        if (span && span[0] === namedSpan[0] && span[1] === namedSpan[1]) {
          if (!namedIndexMap.has(name)) {
            namedIndexMap.set(name, i);
            break;
          }
        }
      }
    }

    for (let i = 1; i < m.length; i++) {
      const val = m[i];
      groups.push({ index: i, value: val !== undefined ? val : null });
    }

    for (const [name, idx] of namedIndexMap) {
      const g = groups.find((x) => x.index === idx);
      if (g) g.name = name;
    }

    spans.push({ start, end, text: fullMatch, groups, matchIndex });
    matchIndex++;
  }

  return { matches: spans, matchCount: spans.length, flags: flagStr };
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const regexTool: ToolDef = {
  slug: "regex",
  name: "Regex Tester",
  ops: [
    {
      name: "test",
      description: "Test a regex pattern against text and return all matches with capture groups",
      inputSchema: z.object({
        pattern: z.string(),
        flags: z.string().default("g"),
        text: z.string(),
      }),
      run({ pattern, flags, text }) {
        return testRegex(pattern, flags, text);
      },
    },
  ],
};
