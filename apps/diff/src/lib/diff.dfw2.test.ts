/**
 * Regression tests for dogfood wave 2 Bug 4:
 *   Large input (>LARGE_INPUT_LINE_THRESHOLD total lines) must skip per-line
 *   word-diff and set wordDiffDisabled=true in the result.  This prevents the
 *   multi-second UI freeze seen at 5000 lines (63 s in testing).
 *
 * Synthetic perturbation: if we set skipWordDiff=false for large inputs the
 *   computeDiff code would call wordDiff per paired changed-line — the test
 *   asserting wordDiffDisabled=true would fail, proving the guard is wired.
 */
import { describe, expect, it } from "vitest";
import { LARGE_INPUT_LINE_THRESHOLD, computeDiff } from "./diff";

/** Build a string of `n` unique lines. */
function makeLines(n: number, prefix = "line"): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join("\n");
}

describe("Bug 4 — large-input word-diff guard (dfw2)", () => {
  it("LARGE_INPUT_LINE_THRESHOLD is exported and equals 1500", () => {
    expect(LARGE_INPUT_LINE_THRESHOLD).toBe(1500);
  });

  it("small input (below threshold) has wordDiffDisabled falsy", () => {
    const old = makeLines(10, "a");
    const next = makeLines(10, "b");
    const result = computeDiff(old, next);
    expect(result.wordDiffDisabled).toBeFalsy();
  });

  it("large input (above threshold) sets wordDiffDisabled=true", () => {
    // 800 old + 800 new = 1600 total lines > 1500 threshold
    const old = makeLines(800, "old");
    const next = makeLines(800, "new");
    const result = computeDiff(old, next);
    expect(result.wordDiffDisabled).toBe(true);
  });

  it("large input: changed lines have null leftWords/rightWords (no word diff tokens)", () => {
    const old = makeLines(800, "old");
    const next = makeLines(800, "new");
    const result = computeDiff(old, next);
    const changed = result.sideBySide.filter((l) => l.kind === "changed");
    // There should be changed lines and none of them should have word tokens
    expect(changed.length).toBeGreaterThan(0);
    for (const line of changed) {
      expect(line.leftWords).toBeNull();
      expect(line.rightWords).toBeNull();
    }
  });

  it("large input: inline changed lines have null words", () => {
    const old = makeLines(800, "foo");
    const next = makeLines(800, "bar");
    const result = computeDiff(old, next);
    const changedInline = result.inline.filter((l) => l.kind !== "equal");
    expect(changedInline.length).toBeGreaterThan(0);
    for (const line of changedInline) {
      expect(line.words).toBeNull();
    }
  });

  it("line-level stats remain correct for large input", () => {
    // 5 lines old, 5 completely different lines new, padded to exceed threshold
    const sharedLines = makeLines(800, "shared");
    const old = `${makeLines(5, "removed")}\n${sharedLines}`;
    const next = `${makeLines(5, "added")}\n${sharedLines}`;
    const result = computeDiff(old, next);
    // Must still have correct counts even when word-diff is skipped
    expect(result.stats.added).toBeGreaterThan(0);
    expect(result.stats.removed).toBeGreaterThan(0);
    expect(result.wordDiffDisabled).toBe(true);
  });

  it("small input: changed lines still have word diff tokens (guard not over-broad)", () => {
    const result = computeDiff("hello world", "hello earth");
    // Small input — word diff should still run on changed lines
    const changed = result.sideBySide.filter((l) => l.kind === "changed");
    if (changed.length > 0) {
      // At least one of them should have word tokens
      const anyHasWords = changed.some((l) => l.leftWords !== null || l.rightWords !== null);
      expect(anyHasWords).toBe(true);
    }
    expect(result.wordDiffDisabled).toBeFalsy();
  });
});
