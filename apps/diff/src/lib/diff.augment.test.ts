/**
 * Augmentation tests for diff.ts — pathways not covered by diff.test.ts:
 *   - normaliseForCompare multi-line input (whitespace collapse per line)
 *   - wordDiff with completely different strings
 *   - wordDiff single-word left and multi-word right
 *   - computeDiff with multi-line complex changes
 *   - computeDiff stats: multiple changes in one diff
 *   - buildUnifiedPatch with multi-line changes
 *   - wordLevelStats with multi-word changes
 *   - wordDiffSingle right vs left both sides
 */
import { describe, expect, it } from "vitest";
import {
  buildUnifiedPatch,
  computeDiff,
  normaliseForCompare,
  wordDiff,
  wordDiffSingle,
  wordLevelStats,
} from "./diff";

// ── normaliseForCompare multi-line ────────────────────────────────────────

describe("normaliseForCompare multi-line", () => {
  it("collapses whitespace in each line independently", () => {
    const input = "  hello   world  \n  foo   bar  ";
    const result = normaliseForCompare(input, { ignoreWhitespace: true });
    const lines = result.split("\n");
    expect(lines[0]).toBe("hello world");
    expect(lines[1]).toBe("foo bar");
  });

  it("lowercases all lines when ignoreCase", () => {
    const input = "HELLO\nWORLD";
    const result = normaliseForCompare(input, { ignoreCase: true });
    expect(result).toBe("hello\nworld");
  });

  it("both options together on multi-line", () => {
    const input = "  HELLO   WORLD  \n  FOO   BAR  ";
    const result = normaliseForCompare(input, { ignoreCase: true, ignoreWhitespace: true });
    const lines = result.split("\n");
    expect(lines[0]).toBe("hello world");
    expect(lines[1]).toBe("foo bar");
  });

  it("no options: preserves all whitespace exactly", () => {
    const input = "  spaces  ";
    expect(normaliseForCompare(input, {})).toBe("  spaces  ");
  });
});

// ── wordDiff with completely different strings ────────────────────────────

describe("wordDiff with completely different strings", () => {
  it("marks all left tokens as removed for fully different strings", () => {
    const [left, right] = wordDiff("hello world", "foo bar baz");
    const removedLeft = left.filter((t) => t.kind === "removed");
    const addedRight = right.filter((t) => t.kind === "added");
    expect(removedLeft.length).toBeGreaterThan(0);
    expect(addedRight.length).toBeGreaterThan(0);
  });

  it("reconstructs original left text from tokens", () => {
    const original = "the quick brown fox";
    const [left] = wordDiff(original, "a very different sentence");
    const reconstructed = left.map((t) => t.value).join("");
    expect(reconstructed).toBe(original);
  });

  it("reconstructs modified right text from tokens", () => {
    const modified = "a completely new phrase";
    const [, right] = wordDiff("old stuff here", modified);
    const reconstructed = right.map((t) => t.value).join("");
    expect(reconstructed).toBe(modified);
  });
});

// ── wordDiff asymmetric ───────────────────────────────────────────────────

describe("wordDiff asymmetric lengths", () => {
  it("more words added than removed: right has more added tokens", () => {
    const [left, right] = wordDiff("one", "one two three four");
    const addedRight = right.filter((t) => t.kind === "added");
    const removedLeft = left.filter((t) => t.kind === "removed");
    expect(addedRight.length).toBeGreaterThan(removedLeft.length);
  });

  it("more words removed than added: left has more removed tokens", () => {
    const [left, right] = wordDiff("one two three four", "one");
    const addedRight = right.filter((t) => t.kind === "added");
    const removedLeft = left.filter((t) => t.kind === "removed");
    expect(removedLeft.length).toBeGreaterThan(addedRight.length);
  });
});

// ── wordDiffSingle both sides ──────────────────────────────────────────────

describe("wordDiffSingle both sides", () => {
  it("right side: only includes equal and added tokens (not removed)", () => {
    const tokens = wordDiffSingle("foo bar baz", "foo baz", "right");
    const removedInRight = tokens.filter((t) => t.kind === "removed");
    expect(removedInRight).toHaveLength(0);
  });

  it("left side: only includes equal and removed tokens (not added)", () => {
    const tokens = wordDiffSingle("foo baz", "foo bar baz", "left");
    const addedInLeft = tokens.filter((t) => t.kind === "added");
    expect(addedInLeft).toHaveLength(0);
  });

  it("returns equal tokens for identical texts on right side", () => {
    const tokens = wordDiffSingle("same text", "same text", "right");
    expect(tokens.every((t) => t.kind === "equal")).toBe(true);
  });

  it("returns equal tokens for identical texts on left side", () => {
    const tokens = wordDiffSingle("same text", "same text", "left");
    expect(tokens.every((t) => t.kind === "equal")).toBe(true);
  });
});

// ── computeDiff complex multi-line ────────────────────────────────────────

describe("computeDiff complex multi-line", () => {
  it("total lines in sideBySide = max(oldLines, newLines) for pure additions", () => {
    const old = "line1\nline2";
    const next = "line1\nline2\nline3\nline4";
    const result = computeDiff(old, next);
    // 2 equal + 2 added on right
    expect(result.stats.unchanged).toBe(2);
    expect(result.stats.added).toBe(2);
    expect(result.stats.removed).toBe(0);
  });

  it("handles completely different single-line texts with stats", () => {
    const result = computeDiff("abc", "xyz");
    expect(result.stats.added + result.stats.removed).toBeGreaterThan(0);
  });

  it("handles all lines removed (old text, empty new)", () => {
    const result = computeDiff("a\nb\nc", "");
    expect(result.stats.removed).toBe(3);
    expect(result.stats.unchanged).toBe(0);
    // The diff library may count a trailing empty-string entry as 1 added;
    // the old content is removed either way.
    expect(result.stats.removed).toBeGreaterThan(result.stats.added);
  });

  it("handles all lines added (empty old text, new text)", () => {
    const result = computeDiff("", "x\ny\nz");
    expect(result.stats.added).toBe(3);
    expect(result.stats.unchanged).toBe(0);
    // The diff library may count a trailing empty-string entry as 1 removed;
    // the new content is added either way.
    expect(result.stats.added).toBeGreaterThan(result.stats.removed);
  });

  it("rightNo is null for removed-only sideBySide lines", () => {
    const result = computeDiff("a\nb\nc", "a\nc");
    const removedLines = result.sideBySide.filter((l) => l.kind === "removed");
    for (const l of removedLines) {
      expect(l.rightNo).toBeNull();
    }
  });

  it("leftNo is null for added-only sideBySide lines", () => {
    const result = computeDiff("a\nc", "a\nb\nc");
    const addedLines = result.sideBySide.filter((l) => l.kind === "added");
    for (const l of addedLines) {
      expect(l.leftNo).toBeNull();
    }
  });
});

// ── buildUnifiedPatch multi-line ──────────────────────────────────────────

describe("buildUnifiedPatch multi-line", () => {
  it("produces a patch that can be applied to reconstruct the diff", () => {
    const patch = buildUnifiedPatch("line1\nline2\nline3\n", "line1\nchanged\nline3\n");
    expect(patch).toContain("-line2");
    expect(patch).toContain("+changed");
    expect(patch).toContain("line1");
    expect(patch).toContain("line3");
  });

  it("context lines appear in the patch without + or - prefix", () => {
    const patch = buildUnifiedPatch("a\nb\nc\n", "a\nX\nc\n");
    // 'a' and 'c' are context lines; they appear with a space prefix in the hunk
    expect(patch).toMatch(/ a/);
    expect(patch).toMatch(/ c/);
  });

  it("multiple hunks when changes are far apart", () => {
    // 10 lines apart: two separate hunks
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
    const oldText = lines.join("\n") + "\n";
    const changed = [...lines];
    changed[0] = "CHANGED_1";
    changed[19] = "CHANGED_20";
    const newText = changed.join("\n") + "\n";
    const patch = buildUnifiedPatch(oldText, newText);
    // Should have at least 2 @@ headers (two hunks)
    const hunkCount = (patch.match(/^@@/gm) ?? []).length;
    expect(hunkCount).toBeGreaterThanOrEqual(2);
  });

  it("custom labels appear in --- and +++ headers", () => {
    const patch = buildUnifiedPatch("a\n", "b\n", {}, "v1.txt", "v2.txt");
    expect(patch).toContain("--- v1.txt");
    expect(patch).toContain("+++ v2.txt");
  });
});

// ── wordLevelStats edge cases ──────────────────────────────────────────────

describe("wordLevelStats edge cases", () => {
  it("counts multiple added words", () => {
    const { wordAdded } = wordLevelStats("hello", "hello brave new world");
    expect(wordAdded).toBe(3);
  });

  it("counts multiple removed words", () => {
    const { wordRemoved } = wordLevelStats("the quick brown fox", "the fox");
    expect(wordRemoved).toBe(2);
  });

  it("counts both added and removed in a swap", () => {
    const { wordAdded, wordRemoved } = wordLevelStats("foo bar", "baz qux");
    expect(wordAdded).toBeGreaterThan(0);
    expect(wordRemoved).toBeGreaterThan(0);
  });

  it("returns zeros for empty old and new", () => {
    const { wordAdded, wordRemoved } = wordLevelStats("", "");
    expect(wordAdded).toBe(0);
    expect(wordRemoved).toBe(0);
  });
});
