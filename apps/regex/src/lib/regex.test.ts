import { describe, expect, it } from "vitest";
import {
  COMMON_PATTERNS,
  SUBSTITUTION_REFS,
  buildFlagString,
  execRegex,
  execReplace,
  explainPattern,
  formatCaptureGroupsForCopy,
  formatMatchTextsForCopy,
  formatMatchesForCopy,
  generateCodeExport,
  parseGroupNames,
} from "./regex";
import type { CodeLang, RegexFlag } from "./regex";

// ── execRegex ─────────────────────────────────────────────────────────────────

describe("execRegex", () => {
  it("returns empty matches for empty pattern", () => {
    const r = execRegex("", new Set<RegexFlag>(["g"]), "hello");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matches).toHaveLength(0);
  });

  it("finds a simple literal match", () => {
    const r = execRegex("lo", new Set<RegexFlag>(["g"]), "hello world");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matchCount).toBe(1);
      expect(r.matches[0].text).toBe("lo");
      expect(r.matches[0].start).toBe(3);
      expect(r.matches[0].end).toBe(5);
    }
  });

  it("finds multiple matches with global flag", () => {
    const r = execRegex("a", new Set<RegexFlag>(["g"]), "banana");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchCount).toBe(3);
  });

  it("is case-insensitive with i flag", () => {
    const r = execRegex("hello", new Set<RegexFlag>(["g", "i"]), "Hello HELLO hello");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchCount).toBe(3);
  });

  it("captures groups", () => {
    const r = execRegex("(\\d+)-(\\d+)", new Set<RegexFlag>(["g"]), "2024-06");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matchCount).toBe(1);
      const groups = r.matches[0].groups;
      expect(groups).toHaveLength(2);
      expect(groups[0].value).toBe("2024");
      expect(groups[1].value).toBe("06");
    }
  });

  it("returns an error for invalid pattern", () => {
    const r = execRegex("[invalid", new Set<RegexFlag>(["g"]), "text");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });

  it("handles multiline flag for ^ and $", () => {
    const r = execRegex("^line", new Set<RegexFlag>(["g", "m"]), "line one\nline two");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchCount).toBe(2);
  });

  it("handles dotAll flag for . matching newlines", () => {
    const r = execRegex("a.b", new Set<RegexFlag>(["g", "s"]), "a\nb");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchCount).toBe(1);
  });

  it("attaches matchIndex to each match", () => {
    const r = execRegex("x", new Set<RegexFlag>(["g"]), "x y x z x");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matches[0].matchIndex).toBe(0);
      expect(r.matches[1].matchIndex).toBe(1);
      expect(r.matches[2].matchIndex).toBe(2);
    }
  });

  it("email pattern from library matches test example", () => {
    const ep = COMMON_PATTERNS.find((p) => p.label === "Email address");
    if (!ep) throw new Error("Email pattern missing from COMMON_PATTERNS");
    const r = execRegex(ep.pattern, new Set<RegexFlag>(ep.flags), ep.example);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.matchCount).toBeGreaterThanOrEqual(1);
  });
});

// ── parseGroupNames ───────────────────────────────────────────────────────────

describe("parseGroupNames", () => {
  it("returns empty map for pattern with no named groups", () => {
    expect(parseGroupNames("(\\d+)-(\\d+)")).toEqual(new Map());
  });

  it("maps a single named group to positional index 1", () => {
    const map = parseGroupNames("(?<year>\\d{4})");
    expect(map.get("year")).toBe(1);
  });

  it("maps named group in correct positional slot when preceded by unnamed group", () => {
    // (\\w) is group 1 (unnamed), (?<b>\\w) is group 2 (named)
    const map = parseGroupNames("(\\w)(?<b>\\w)");
    expect(map.get("b")).toBe(2);
  });

  it("handles non-capturing groups without advancing index", () => {
    const map = parseGroupNames("(?:prefix)(?<name>\\w+)");
    expect(map.get("name")).toBe(1);
  });

  it("handles lookahead without advancing index", () => {
    const map = parseGroupNames("(?=x)(?<word>\\w+)");
    expect(map.get("word")).toBe(1);
  });
});

// Regression: named group must not steal slot from same-valued unnamed group
describe("execRegex named group slot", () => {
  it("correctly labels named group when preceding unnamed group has same value", () => {
    // Pattern: (\\w)(?<b>\\w) on "xx"
    // group 1 = 'x' (unnamed), group 2 = 'x' (named 'b')
    // Old bug: value-match found group 1 first and labelled it 'b'
    const r = execRegex("(\\w)(?<b>\\w)", new Set<RegexFlag>(["g"]), "xx");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const groups = r.matches[0].groups;
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBeUndefined(); // first group is unnamed
    expect(groups[1].name).toBe("b"); // second group is named 'b'
  });
});

// ── buildFlagString ───────────────────────────────────────────────────────────

describe("buildFlagString", () => {
  it("always includes g", () => {
    const f = buildFlagString(new Set<RegexFlag>());
    expect(f).toContain("g");
  });

  it("includes requested flags in canonical order", () => {
    const f = buildFlagString(new Set<RegexFlag>(["m", "i"]));
    // canonical order: g, i, m, s, u
    expect(f.indexOf("i")).toBeLessThan(f.indexOf("m"));
  });

  it("does not duplicate g when already in set", () => {
    const f = buildFlagString(new Set<RegexFlag>(["g", "i"]));
    expect(f.split("g")).toHaveLength(2); // exactly one 'g'
  });
});

// ── execReplace ───────────────────────────────────────────────────────────────

describe("execReplace", () => {
  it("replaces a literal match", () => {
    const result = execReplace("foo", new Set<RegexFlag>(["g"]), "foo bar foo", "baz");
    expect(result).toBe("baz bar baz");
  });

  it("uses backreference $1", () => {
    const result = execReplace("(\\w+)@(\\w+)", new Set<RegexFlag>(["g"]), "user@example", "$2/$1");
    expect(result).toBe("example/user");
  });

  it("returns original text for empty pattern", () => {
    const result = execReplace("", new Set<RegexFlag>(["g"]), "hello", "replaced");
    expect(result).toBe("hello");
  });

  it("returns error message string for invalid pattern", () => {
    const result = execReplace("[bad", new Set<RegexFlag>(["g"]), "text", "x");
    expect(result.length).toBeGreaterThan(0);
    // should not be the original text
    expect(result).not.toBe("text");
  });
});

// ── explainPattern ────────────────────────────────────────────────────────────

describe("explainPattern", () => {
  it("returns empty array for empty pattern", () => {
    expect(explainPattern("")).toHaveLength(0);
  });

  it("explains ^ as start anchor", () => {
    const tokens = explainPattern("^");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("anchor");
    expect(tokens[0].explanation.toLowerCase()).toContain("start");
  });

  it("explains $ as end anchor", () => {
    const tokens = explainPattern("$");
    expect(tokens[0].kind).toBe("anchor");
    expect(tokens[0].explanation.toLowerCase()).toContain("end");
  });

  it("explains \\d as digit class", () => {
    const tokens = explainPattern("\\d");
    expect(tokens[0].kind).toBe("escape");
    expect(tokens[0].explanation.toLowerCase()).toContain("digit");
  });

  it("explains \\w as word character", () => {
    const tokens = explainPattern("\\w");
    expect(tokens[0].kind).toBe("escape");
    expect(tokens[0].explanation.toLowerCase()).toContain("word");
  });

  it("explains + quantifier", () => {
    const tokens = explainPattern("a+");
    const q = tokens.find((t) => t.kind === "quantifier");
    expect(q).toBeDefined();
    expect(q?.explanation.toLowerCase()).toContain("one or more");
  });

  it("explains * quantifier", () => {
    const tokens = explainPattern("a*");
    const q = tokens.find((t) => t.kind === "quantifier");
    expect(q?.explanation.toLowerCase()).toContain("zero or more");
  });

  it("explains ? quantifier", () => {
    const tokens = explainPattern("a?");
    const q = tokens.find((t) => t.kind === "quantifier");
    expect(q?.explanation.toLowerCase()).toContain("zero or one");
  });

  it("explains {n,m} quantifier", () => {
    const tokens = explainPattern("a{2,5}");
    const q = tokens.find((t) => t.kind === "quantifier");
    expect(q?.explanation).toContain("2");
    expect(q?.explanation).toContain("5");
  });

  it("explains character class [a-z]", () => {
    const tokens = explainPattern("[a-z]");
    expect(tokens[0].kind).toBe("class");
    expect(tokens[0].explanation.toLowerCase()).toContain("any character");
  });

  it("explains negated character class [^0-9]", () => {
    const tokens = explainPattern("[^0-9]");
    expect(tokens[0].explanation.toLowerCase()).toContain("not");
  });

  it("explains capture group (", () => {
    const tokens = explainPattern("(abc)");
    const g = tokens.find((t) => t.kind === "group" && t.raw === "(");
    expect(g?.explanation.toLowerCase()).toContain("capture");
  });

  it("explains non-capturing group (?:", () => {
    const tokens = explainPattern("(?:abc)");
    const g = tokens.find((t) => t.kind === "group" && t.raw === "(?:");
    expect(g?.explanation.toLowerCase()).toContain("non-capturing");
  });

  it("explains | alternation", () => {
    const tokens = explainPattern("cat|dog");
    const alt = tokens.find((t) => t.kind === "alternation");
    expect(alt).toBeDefined();
  });

  it("explains . dot", () => {
    const tokens = explainPattern(".");
    expect(tokens[0].kind).toBe("class");
    expect(tokens[0].explanation.toLowerCase()).toContain("any character");
  });

  it("explains named group (?<year>\\d{4})", () => {
    const tokens = explainPattern("(?<year>\\d{4})");
    const g = tokens.find((t) => t.kind === "group");
    expect(g?.explanation.toLowerCase()).toContain("year");
  });
});

// ── formatMatchesForCopy ──────────────────────────────────────────────────────

describe("formatMatchesForCopy", () => {
  it("returns empty string for no matches", () => {
    expect(formatMatchesForCopy([])).toBe("");
  });

  it("formats a single match with header and position", () => {
    const r = execRegex("lo", new Set<RegexFlag>(["g"]), "hello");
    if (!r.ok) throw new Error("expected match");
    const out = formatMatchesForCopy(r.matches);
    expect(out).toContain("#1");
    expect(out).toContain("lo");
    expect(out).toContain("[3..5]");
  });

  it("separates multiple matches with a blank line", () => {
    const r = execRegex("a", new Set<RegexFlag>(["g"]), "banana");
    if (!r.ok) throw new Error("expected match");
    const out = formatMatchesForCopy(r.matches);
    expect(out).toContain("#1");
    expect(out).toContain("#2");
    expect(out).toContain("#3");
    // blocks are separated by double newline
    expect(out.split("\n\n").length).toBe(3);
  });

  it("includes capture group values", () => {
    const r = execRegex("(\\d+)-(\\d+)", new Set<RegexFlag>(["g"]), "2024-06");
    if (!r.ok) throw new Error("expected match");
    const out = formatMatchesForCopy(r.matches);
    expect(out).toContain("$1: 2024");
    expect(out).toContain("$2: 06");
  });
});

// ── COMMON_PATTERNS ───────────────────────────────────────────────────────────

describe("COMMON_PATTERNS", () => {
  it("has at least 10 patterns", () => {
    expect(COMMON_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it("every pattern compiles without error", () => {
    for (const p of COMMON_PATTERNS) {
      const r = execRegex(p.pattern, new Set<RegexFlag>(p.flags), p.example);
      expect(r.ok).toBe(true);
    }
  });

  it("every pattern matches at least one result in its example", () => {
    for (const p of COMMON_PATTERNS) {
      const r = execRegex(p.pattern, new Set<RegexFlag>(p.flags), p.example);
      if (r.ok) {
        expect(r.matchCount).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ── formatMatchTextsForCopy ───────────────────────────────────────────────────

describe("formatMatchTextsForCopy", () => {
  it("returns empty string for no matches", () => {
    expect(formatMatchTextsForCopy([])).toBe("");
  });

  it("returns one match text per line", () => {
    const r = execRegex("a", new Set<RegexFlag>(["g"]), "banana");
    if (!r.ok) throw new Error("expected match");
    const out = formatMatchTextsForCopy(r.matches);
    expect(out).toBe("a\na\na");
  });

  it("does not include positional metadata", () => {
    const r = execRegex("\\d+", new Set<RegexFlag>(["g"]), "1 22 333");
    if (!r.ok) throw new Error("expected match");
    const out = formatMatchTextsForCopy(r.matches);
    expect(out).toBe("1\n22\n333");
    // no brackets or offsets
    expect(out).not.toContain("[");
  });
});

// ── formatCaptureGroupsForCopy ────────────────────────────────────────────────

describe("formatCaptureGroupsForCopy", () => {
  it("returns empty string when no captures", () => {
    const r = execRegex("\\d+", new Set<RegexFlag>(["g"]), "42");
    if (!r.ok) throw new Error("expected match");
    expect(formatCaptureGroupsForCopy(r.matches)).toBe("");
  });

  it("returns group values labelled by position", () => {
    const r = execRegex("(\\d{4})-(\\d{2})", new Set<RegexFlag>(["g"]), "2024-06 and 2025-01");
    if (!r.ok) throw new Error("expected match");
    const out = formatCaptureGroupsForCopy(r.matches);
    expect(out).toContain("$1: 2024");
    expect(out).toContain("$2: 06");
    expect(out).toContain("$1: 2025");
    expect(out).toContain("$2: 01");
  });

  it("skips null (unmatched optional) groups", () => {
    const r = execRegex("(a)?(b)", new Set<RegexFlag>(["g"]), "b");
    if (!r.ok) throw new Error("expected match");
    const out = formatCaptureGroupsForCopy(r.matches);
    // group 1 is null, should not appear; group 2 = "b" should appear
    expect(out).toContain("$2: b");
    expect(out).not.toContain("$1:");
  });
});

// ── generateCodeExport ────────────────────────────────────────────────────────

describe("generateCodeExport", () => {
  const flags = new Set<RegexFlag>(["g", "i"]);
  const langs: CodeLang[] = ["javascript", "python", "go", "php"];

  it("returns a placeholder for empty pattern", () => {
    for (const lang of langs) {
      const out = generateCodeExport("", flags, "text", lang);
      expect(out.toLowerCase()).toContain("enter a pattern");
    }
  });

  it("includes the pattern in JS output", () => {
    const out = generateCodeExport("\\d+", flags, "hello 42", "javascript");
    expect(out).toContain("\\\\d+");
    expect(out).toContain("matchAll");
  });

  it("includes the pattern in Python output", () => {
    const out = generateCodeExport("\\d+", flags, "hello 42", "python");
    expect(out).toContain("import re");
    expect(out).toContain("IGNORECASE");
    expect(out).toContain("findall");
  });

  it("includes the pattern in Go output", () => {
    const out = generateCodeExport("\\d+", flags, "hello 42", "go");
    expect(out).toContain("regexp");
    expect(out).toContain("FindAllString");
  });

  it("includes the pattern in PHP output", () => {
    const out = generateCodeExport("\\d+", flags, "hello 42", "php");
    expect(out).toContain("preg_match_all");
  });

  it("embeds the test text in the snippet", () => {
    const text = "my test string";
    const out = generateCodeExport("foo", flags, text, "javascript");
    expect(out).toContain(text);
  });
});

// ── SUBSTITUTION_REFS ─────────────────────────────────────────────────────────

describe("SUBSTITUTION_REFS", () => {
  it("includes the full-match token $&", () => {
    expect(SUBSTITUTION_REFS.some((r) => r.token === "$&")).toBe(true);
  });

  it("includes at least 4 substitution tokens", () => {
    expect(SUBSTITUTION_REFS.length).toBeGreaterThanOrEqual(4);
  });
});
