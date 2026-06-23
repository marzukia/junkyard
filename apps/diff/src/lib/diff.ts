/**
 * Core diff logic for text-diff tool.
 *
 * Wraps the `diff` npm library to produce typed, annotated change objects.
 * All functions here are pure (no side effects) so they are easy to unit-test.
 */
import { diffWords, diffWordsWithSpace, structuredPatch } from "diff";

// ─── Normalisation helpers ────────────────────────────────────────────────────

export interface DiffOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
}

/** Normalise a text before diffing according to user options.
 *  Returns the normalised string; used only for comparison, the display text
 *  is always the original so highlights remain accurate at the line level. */
export function normaliseForCompare(text: string, opts: DiffOptions): string {
  let t = text;
  if (opts.ignoreCase) t = t.toLowerCase();
  if (opts.ignoreWhitespace) {
    // Collapse all runs of whitespace (including leading/trailing) within each line.
    t = t
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .join("\n");
  }
  return t;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChangeKind = "equal" | "added" | "removed";

/** A single token (word or char) within a line. */
export interface WordChange {
  kind: ChangeKind;
  value: string;
}

/** A single line in a side-by-side diff. */
export interface SideBySideLine {
  /** Line number in the original text (1-based), or null for inserted lines. */
  leftNo: number | null;
  /** Line number in the modified text (1-based), or null for deleted lines. */
  rightNo: number | null;
  leftText: string | null;
  rightText: string | null;
  kind: "equal" | "changed" | "added" | "removed";
  /** Word-level diff for the left side (only set when kind !== equal). */
  leftWords: WordChange[] | null;
  /** Word-level diff for the right side (only set when kind !== equal). */
  rightWords: WordChange[] | null;
}

/** A single line in an inline diff. */
export interface InlineLine {
  no: number | null;
  kind: ChangeKind;
  text: string;
  /** Word-level diff tokens — only set for added/removed lines when there is a counterpart. */
  words: WordChange[] | null;
}

export interface DiffResult {
  sideBySide: SideBySideLine[];
  inline: InlineLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

// ─── Word diff ───────────────────────────────────────────────────────────────

/**
 * Produce word-level WordChange arrays for a pair of lines.
 * Uses `diffWordsWithSpace` to preserve whitespace tokens.
 */
export function wordDiff(left: string, right: string): [WordChange[], WordChange[]] {
  const changes = diffWordsWithSpace(left, right);
  const leftWords: WordChange[] = [];
  const rightWords: WordChange[] = [];

  for (const c of changes) {
    if (c.added) {
      rightWords.push({ kind: "added", value: c.value });
    } else if (c.removed) {
      leftWords.push({ kind: "removed", value: c.value });
    } else {
      leftWords.push({ kind: "equal", value: c.value });
      rightWords.push({ kind: "equal", value: c.value });
    }
  }

  return [leftWords, rightWords];
}

/**
 * Produce word-level WordChange[] for a single line vs its counterpart.
 * Used in inline diff to highlight which words changed within a line.
 */
export function wordDiffSingle(
  text: string,
  counterpart: string,
  side: "left" | "right"
): WordChange[] {
  const changes = diffWordsWithSpace(counterpart, text);
  const result: WordChange[] = [];

  if (side === "right") {
    // We want to annotate the "text" (right/added) side
    for (const c of changes) {
      if (c.added) {
        result.push({ kind: "added", value: c.value });
      } else if (!c.removed) {
        result.push({ kind: "equal", value: c.value });
      }
    }
  } else {
    // Annotate the left/removed side
    for (const c of changes) {
      if (c.removed) {
        result.push({ kind: "removed", value: c.value });
      } else if (!c.added) {
        result.push({ kind: "equal", value: c.value });
      }
    }
  }

  return result;
}

// ─── Line diff ───────────────────────────────────────────────────────────────

/**
 * Core: compute a unified patch using `diff` then produce SideBySideLine[] and InlineLine[].
 *
 * Strategy:
 *   1. Run structuredPatch to get hunk-based line diffs.
 *   2. Walk the patch building (leftLines, rightLines) aligned arrays.
 *   3. For changed pairs run wordDiff to get token-level highlights.
 */
export function computeDiff(oldText: string, newText: string, opts: DiffOptions = {}): DiffResult {
  // Normalise: ensure trailing newline so structuredPatch works correctly.
  const ensureNewline = (s: string) => (s.endsWith("\n") ? s : `${s}\n`);

  // When ignoring whitespace/case, diff against normalised text but display original lines.
  const compareOld = ensureNewline(normaliseForCompare(oldText, opts));
  const compareNew = ensureNewline(normaliseForCompare(newText, opts));

  const patch = structuredPatch("old", "new", compareOld, compareNew, "", "", {
    context: Number.MAX_SAFE_INTEGER,
  });

  // Build flat line arrays from the patch.
  // structuredPatch with context=MAX_SAFE_INTEGER gives us the full file diff in one hunk.
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Remove trailing empty string from split if text ends with \n
  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();

  // Use the diff library's line-diff to pair up changed lines.
  // We'll rebuild from the hunk lines directly.
  const sideBySide: SideBySideLine[] = [];
  const inline: InlineLine[] = [];

  let leftNo = 1;
  let rightNo = 1;

  const stats = { added: 0, removed: 0, unchanged: 0 };

  if (patch.hunks.length === 0) {
    // Identical texts — emit equal lines.
    for (let i = 0; i < oldLines.length; i++) {
      sideBySide.push({
        leftNo: i + 1,
        rightNo: i + 1,
        leftText: oldLines[i],
        rightText: oldLines[i],
        kind: "equal",
        leftWords: null,
        rightWords: null,
      });
      inline.push({ no: i + 1, kind: "equal", text: oldLines[i], words: null });
      stats.unchanged++;
    }
    return { sideBySide, inline, stats };
  }

  // Collect all hunk lines (context=MAX so we get one big hunk with everything).
  // Lines are prefixed with ' ', '+', '-'.
  const hunkLines = patch.hunks.flatMap((h) => h.lines);

  // We pair removed/added lines that appear consecutively for word diff.
  // Buffer removed lines; when we hit a non-added line flush them as pure removed.
  const removedBuf: string[] = [];

  const flushRemoved = (addedBuf: string[]) => {
    // Pair each removed with an added for word-level diff.
    const pairCount = Math.min(removedBuf.length, addedBuf.length);

    for (let i = 0; i < pairCount; i++) {
      const [lw, rw] = wordDiff(removedBuf[i], addedBuf[i]);
      sideBySide.push({
        leftNo: leftNo++,
        rightNo: rightNo++,
        leftText: removedBuf[i],
        rightText: addedBuf[i],
        kind: "changed",
        leftWords: lw,
        rightWords: rw,
      });
      inline.push({
        no: leftNo - 1,
        kind: "removed",
        text: removedBuf[i],
        words: wordDiffSingle(removedBuf[i], addedBuf[i], "left"),
      });
      inline.push({
        no: rightNo - 1,
        kind: "added",
        text: addedBuf[i],
        words: wordDiffSingle(addedBuf[i], removedBuf[i], "right"),
      });
      stats.removed++;
      stats.added++;
    }

    // Unpaired removed (more removals than additions)
    for (let i = pairCount; i < removedBuf.length; i++) {
      sideBySide.push({
        leftNo: leftNo++,
        rightNo: null,
        leftText: removedBuf[i],
        rightText: null,
        kind: "removed",
        leftWords: null,
        rightWords: null,
      });
      inline.push({ no: leftNo - 1, kind: "removed", text: removedBuf[i], words: null });
      stats.removed++;
    }

    // Unpaired added (more additions than removals)
    for (let i = pairCount; i < addedBuf.length; i++) {
      sideBySide.push({
        leftNo: null,
        rightNo: rightNo++,
        leftText: null,
        rightText: addedBuf[i],
        kind: "added",
        leftWords: null,
        rightWords: null,
      });
      inline.push({ no: rightNo - 1, kind: "added", text: addedBuf[i], words: null });
      stats.added++;
    }

    removedBuf.length = 0;
    addedBuf.length = 0;
  };

  // Two-phase scan: collect a run of -/+ lines then emit them paired.
  const addedBuf: string[] = [];

  for (const raw of hunkLines) {
    const prefix = raw[0];
    const content = raw.slice(1);

    if (prefix === " ") {
      // Context line — flush pending buffers first.
      flushRemoved(addedBuf);
      sideBySide.push({
        leftNo: leftNo++,
        rightNo: rightNo++,
        leftText: content,
        rightText: content,
        kind: "equal",
        leftWords: null,
        rightWords: null,
      });
      inline.push({ no: leftNo - 1, kind: "equal", text: content, words: null });
      stats.unchanged++;
    } else if (prefix === "-") {
      // Flush any pending added that came before removed (shouldn't happen in normal diff order)
      if (addedBuf.length > 0) {
        flushRemoved(addedBuf);
      }
      removedBuf.push(content);
    } else if (prefix === "+") {
      addedBuf.push(content);
    }
  }

  // Flush any trailing buffers.
  flushRemoved(addedBuf);

  return { sideBySide, inline, stats };
}

// ─── Unified patch export ─────────────────────────────────────────────────────

/**
 * Produce a proper unified diff (.patch) string.
 * Uses context=3 (standard) and real hunk headers (@@ -a,b +c,d @@).
 */
export function buildUnifiedPatch(
  oldText: string,
  newText: string,
  opts: DiffOptions = {},
  oldLabel = "original",
  newLabel = "modified"
): string {
  const ensureNewline = (s: string) => (s.endsWith("\n") ? s : `${s}\n`);
  const compareOld = ensureNewline(normaliseForCompare(oldText, opts));
  const compareNew = ensureNewline(normaliseForCompare(newText, opts));

  const patch = structuredPatch(oldLabel, newLabel, compareOld, compareNew, "", "", {
    context: 3,
  });

  if (patch.hunks.length === 0) return "";

  const lines: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];

  for (const hunk of patch.hunks) {
    const oldCount = hunk.oldLines;
    const newCount = hunk.newLines;
    const hunkHeader = `@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`;
    lines.push(hunkHeader);
    for (const line of hunk.lines) {
      lines.push(line);
    }
  }

  return `${lines.join("\n")}\n`;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Quick word-count diff for summary badge. */
export function wordLevelStats(
  oldText: string,
  newText: string
): { wordAdded: number; wordRemoved: number } {
  const changes = diffWords(oldText, newText);
  let wordAdded = 0;
  let wordRemoved = 0;
  for (const c of changes) {
    const words = c.value.trim().split(/\s+/).filter(Boolean).length;
    if (c.added) wordAdded += words;
    else if (c.removed) wordRemoved += words;
  }
  return { wordAdded, wordRemoved };
}
