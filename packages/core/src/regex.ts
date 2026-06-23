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

export function testRegex(
  pattern: string,
  flags: string,
  text: string
): RegexTestResult {
  if (!pattern) return { matches: [], matchCount: 0, flags: "" };

  // Always include 'g' for matchAll
  const flagSet = new Set(flags.split("").filter(Boolean));
  flagSet.add("g");
  const flagStr = ["g", "i", "m", "s", "u"].filter((f) => flagSet.has(f)).join("");

  const re = new RegExp(pattern, flagStr);
  const spans: MatchSpan[] = [];
  let matchIndex = 0;

  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    const fullMatch = m[0];
    const end = start + fullMatch.length;

    const groups: MatchSpan["groups"] = [];
    const namedGroups = m.groups ?? {};
    const namedKeys = Object.keys(namedGroups);

    for (let i = 1; i < m.length; i++) {
      const val = m[i];
      groups.push({ index: i, value: val !== undefined ? val : null });
    }

    for (const name of namedKeys) {
      const namedVal = namedGroups[name] !== undefined ? namedGroups[name] : null;
      const g = groups.find((x) => x.value === namedVal && x.name === undefined);
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
