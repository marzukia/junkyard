import { describe, expect, it } from "vitest";
import {
  buildUnifiedPatch,
  computeDiff,
  normaliseForCompare,
  wordDiff,
  wordDiffSingle,
  wordLevelStats,
} from "./diff";

describe("wordDiff", () => {
  it("returns equal tokens for identical strings", () => {
    const [left, right] = wordDiff("hello world", "hello world");
    expect(left.every((t) => t.kind === "equal")).toBe(true);
    expect(right.every((t) => t.kind === "equal")).toBe(true);
  });

  it("marks added token on right side", () => {
    const [_left, right] = wordDiff("foo", "foo bar");
    const added = right.filter((t) => t.kind === "added");
    expect(added.length).toBeGreaterThan(0);
    expect(added.map((t) => t.value.trim()).join("")).toBe("bar");
  });

  it("marks removed token on left side", () => {
    const [left, _right] = wordDiff("foo bar", "foo");
    const removed = left.filter((t) => t.kind === "removed");
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.map((t) => t.value.trim()).join("")).toBe("bar");
  });

  it("handles empty strings", () => {
    const [left, right] = wordDiff("", "");
    expect(left).toHaveLength(0);
    expect(right).toHaveLength(0);
  });
});

describe("wordDiffSingle", () => {
  it("marks new words as added on right side", () => {
    const tokens = wordDiffSingle("foo bar baz", "foo baz", "right");
    const added = tokens.filter((t) => t.kind === "added");
    expect(added.map((t) => t.value.trim()).join("")).toBe("bar");
  });

  it("marks deleted words as removed on left side", () => {
    const tokens = wordDiffSingle("foo baz", "foo bar baz", "left");
    const removed = tokens.filter((t) => t.kind === "removed");
    expect(removed.map((t) => t.value.trim()).join("")).toBe("bar");
  });
});

describe("computeDiff", () => {
  it("returns empty arrays for empty texts", () => {
    const result = computeDiff("", "");
    expect(result.sideBySide).toHaveLength(0);
    expect(result.inline).toHaveLength(0);
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });

  it("marks identical texts as all equal", () => {
    const text = "line one\nline two\nline three";
    const result = computeDiff(text, text);
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
    expect(result.stats.unchanged).toBe(3);
    expect(result.sideBySide.every((l) => l.kind === "equal")).toBe(true);
  });

  it("detects a single added line", () => {
    const result = computeDiff("line one\nline two", "line one\nline two\nline three");
    expect(result.stats.added).toBe(1);
    expect(result.stats.removed).toBe(0);
    expect(result.stats.unchanged).toBe(2);
  });

  it("detects a single removed line", () => {
    const result = computeDiff("line one\nline two\nline three", "line one\nline three");
    expect(result.stats.removed).toBe(1);
    expect(result.stats.added).toBe(0);
    expect(result.stats.unchanged).toBe(2);
  });

  it("detects changed lines and provides word diff", () => {
    const result = computeDiff("hello world", "hello earth");
    // One line changed — a removed + added pair
    const changed = result.sideBySide.filter((l) => l.kind === "changed");
    if (changed.length > 0) {
      // Paired as changed
      expect(changed[0].leftWords).not.toBeNull();
      expect(changed[0].rightWords).not.toBeNull();
    } else {
      // May appear as separate removed + added
      expect(result.stats.removed).toBe(1);
      expect(result.stats.added).toBe(1);
    }
  });

  it("sideBySide and inline line counts stay consistent", () => {
    const old = "a\nb\nc\nd";
    const next = "a\nb\ne\nd";
    const result = computeDiff(old, next);
    // inline includes one removed + one added for the changed line = +1 vs sideBySide
    expect(result.inline.length).toBeGreaterThanOrEqual(result.sideBySide.length);
  });

  it("assigns sequential leftNo for non-null left lines", () => {
    const result = computeDiff("a\nb\nc", "a\nb\nc\nd");
    const leftNums = result.sideBySide.map((l) => l.leftNo).filter((n): n is number => n !== null);
    for (let i = 0; i < leftNums.length - 1; i++) {
      expect(leftNums[i + 1]).toBe(leftNums[i] + 1);
    }
  });
});

describe("normaliseForCompare", () => {
  it("lowercases when ignoreCase is set", () => {
    expect(normaliseForCompare("Hello World", { ignoreCase: true })).toBe("hello world");
  });

  it("trims and collapses whitespace when ignoreWhitespace is set", () => {
    expect(normaliseForCompare("  foo   bar  ", { ignoreWhitespace: true })).toBe("foo bar");
  });

  it("applies both options together", () => {
    expect(
      normaliseForCompare("  HELLO   WORLD  ", { ignoreCase: true, ignoreWhitespace: true })
    ).toBe("hello world");
  });

  it("preserves text when no options are set", () => {
    expect(normaliseForCompare("  Hello  ", {})).toBe("  Hello  ");
  });
});

describe("computeDiff with options", () => {
  it("treats differently-cased identical texts as identical when ignoreCase is set", () => {
    const result = computeDiff("Hello World", "hello world", { ignoreCase: true });
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });

  it("treats whitespace-only-different texts as identical when ignoreWhitespace is set", () => {
    const result = computeDiff("foo  bar", "foo bar", { ignoreWhitespace: true });
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });

  it("still detects real differences even with ignore options active", () => {
    const result = computeDiff("hello world", "hello earth", {
      ignoreCase: true,
      ignoreWhitespace: true,
    });
    expect(result.stats.added + result.stats.removed).toBeGreaterThan(0);
  });
});

describe("buildUnifiedPatch", () => {
  it("returns empty string for identical texts", () => {
    expect(buildUnifiedPatch("same\n", "same\n")).toBe("");
  });

  it("includes --- and +++ headers", () => {
    const patch = buildUnifiedPatch("foo\n", "bar\n");
    expect(patch).toContain("---");
    expect(patch).toContain("+++");
  });

  it("includes @@ hunk header", () => {
    const patch = buildUnifiedPatch("foo\n", "bar\n");
    expect(patch).toContain("@@");
  });

  it("includes removed line with - prefix", () => {
    const patch = buildUnifiedPatch("foo\n", "bar\n");
    expect(patch).toMatch(/^-foo/m);
  });

  it("includes added line with + prefix", () => {
    const patch = buildUnifiedPatch("foo\n", "bar\n");
    expect(patch).toMatch(/^\+bar/m);
  });

  it("uses custom labels", () => {
    const patch = buildUnifiedPatch("a\n", "b\n", {}, "left.txt", "right.txt");
    expect(patch).toContain("--- left.txt");
    expect(patch).toContain("+++ right.txt");
  });

  it("respects ignoreWhitespace option", () => {
    // With ignoreWhitespace these are the same; patch should be empty
    expect(buildUnifiedPatch("foo  bar", "foo bar", { ignoreWhitespace: true })).toBe("");
  });
});

describe("wordLevelStats", () => {
  it("counts added words", () => {
    const { wordAdded, wordRemoved } = wordLevelStats("hello", "hello world");
    expect(wordAdded).toBe(1);
    expect(wordRemoved).toBe(0);
  });

  it("counts removed words", () => {
    const { wordAdded, wordRemoved } = wordLevelStats("hello world", "hello");
    expect(wordAdded).toBe(0);
    expect(wordRemoved).toBe(1);
  });

  it("returns zeros for identical texts", () => {
    const { wordAdded, wordRemoved } = wordLevelStats("same text", "same text");
    expect(wordAdded).toBe(0);
    expect(wordRemoved).toBe(0);
  });
});
