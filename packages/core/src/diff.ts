import { type ParsedDiff, diffWordsWithSpace, structuredPatch } from "diff";
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type ChangeKind = "equal" | "added" | "removed";

export interface WordChange {
  kind: ChangeKind;
  value: string;
}

export interface SideBySideLine {
  leftNo: number | null;
  rightNo: number | null;
  leftText: string | null;
  rightText: string | null;
  kind: "equal" | "changed" | "added" | "removed";
  leftWords: WordChange[] | null;
  rightWords: WordChange[] | null;
}

export interface DiffResult {
  sideBySide: SideBySideLine[];
  unified: string;
  stats: { added: number; removed: number; unchanged: number };
}

function wordDiff(left: string, right: string): [WordChange[], WordChange[]] {
  const changes = diffWordsWithSpace(left, right);
  const lw: WordChange[] = [];
  const rw: WordChange[] = [];
  for (const c of changes) {
    if (c.added) rw.push({ kind: "added", value: c.value });
    else if (c.removed) lw.push({ kind: "removed", value: c.value });
    else { lw.push({ kind: "equal", value: c.value }); rw.push({ kind: "equal", value: c.value }); }
  }
  return [lw, rw];
}

export function computeDiff(oldText: string, newText: string): DiffResult {
  const ensureNl = (s: string) => (s && !s.endsWith("\n") ? `${s}\n` : s);
  const patch = structuredPatch("old", "new", ensureNl(oldText), ensureNl(newText), "", "", { context: Number.MAX_SAFE_INTEGER });

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();
  if (oldLines.length === 1 && oldLines[0] === "") oldLines.pop();
  if (newLines.length === 1 && newLines[0] === "") newLines.pop();

  const sideBySide: SideBySideLine[] = [];
  const stats = { added: 0, removed: 0, unchanged: 0 };
  let leftNo = 1;
  let rightNo = 1;

  if (patch.hunks.length === 0) {
    for (let i = 0; i < oldLines.length; i++) {
      sideBySide.push({ leftNo: i + 1, rightNo: i + 1, leftText: oldLines[i], rightText: oldLines[i], kind: "equal", leftWords: null, rightWords: null });
      stats.unchanged++;
    }
  } else {
    const hunkLines = patch.hunks.flatMap((h) => h.lines);
    const removedBuf: string[] = [];
    const addedBuf: string[] = [];

    const flush = () => {
      const pairCount = Math.min(removedBuf.length, addedBuf.length);
      for (let i = 0; i < pairCount; i++) {
        const [lw, rw] = wordDiff(removedBuf[i], addedBuf[i]);
        sideBySide.push({ leftNo: leftNo++, rightNo: rightNo++, leftText: removedBuf[i], rightText: addedBuf[i], kind: "changed", leftWords: lw, rightWords: rw });
        stats.removed++; stats.added++;
      }
      for (let i = pairCount; i < removedBuf.length; i++) {
        sideBySide.push({ leftNo: leftNo++, rightNo: null, leftText: removedBuf[i], rightText: null, kind: "removed", leftWords: null, rightWords: null });
        stats.removed++;
      }
      for (let i = pairCount; i < addedBuf.length; i++) {
        sideBySide.push({ leftNo: null, rightNo: rightNo++, leftText: null, rightText: addedBuf[i], kind: "added", leftWords: null, rightWords: null });
        stats.added++;
      }
      removedBuf.length = 0; addedBuf.length = 0;
    };

    for (const raw of hunkLines) {
      const prefix = raw[0];
      const content = raw.slice(1);
      if (prefix === " ") {
        flush();
        sideBySide.push({ leftNo: leftNo++, rightNo: rightNo++, leftText: content, rightText: content, kind: "equal", leftWords: null, rightWords: null });
        stats.unchanged++;
      } else if (prefix === "-") {
        if (addedBuf.length > 0) flush();
        removedBuf.push(content);
      } else if (prefix === "+") {
        addedBuf.push(content);
      }
    }
    flush();
  }

  // Build unified patch string from the already-computed full-context hunkLines
  // using a 3-line context window -- avoids a second structuredPatch call.
  const unified = buildUnifiedFromFullHunk(patch.hunks, "original", "modified");

  return { sideBySide, unified, stats };
}


/**
 * Build a standard unified-diff string (context=3) from a full-context patch
 * (produced with context=MAX_SAFE_INTEGER). Avoids a second structuredPatch call.
 */
function buildUnifiedFromFullHunk(
  hunks: ParsedDiff["hunks"],
  oldLabel: string,
  newLabel: string,
  context = 3
): string {
  if (hunks.length === 0) return "";

  // With context=MAX the patch has a single hunk covering the full file.
  // We re-emit it trimmed to `context` lines around each changed block.
  const allLines = hunks.flatMap((h) => h.lines);
  if (allLines.length === 0) return "";

  // Find indices of non-context (changed) lines.
  const changedIdx = new Set<number>();
  for (let i = 0; i < allLines.length; i++) {
    const p = allLines[i]?.[0];
    if (p === "+" || p === "-") changedIdx.add(i);
  }
  if (changedIdx.size === 0) return "";

  // Build keep-set: indices within `context` lines of any changed line.
  const keep = new Set<number>();
  for (const ci of changedIdx) {
    for (let d = -context; d <= context; d++) {
      const idx = ci + d;
      if (idx >= 0 && idx < allLines.length) keep.add(idx);
    }
  }

  // Walk keep indices, grouping into hunks separated by gaps.
  const sorted = [...keep].sort((a, b) => a - b);
  const outputLines: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];

  // The full-context hunk starts at line 1 in both old and new.
  // Track old/new line numbers as we walk.
  let oldLine = hunks[0]?.oldStart ?? 1;
  let newLine = hunks[0]?.newStart ?? 1;

  let groupStart = 0;
  while (groupStart < sorted.length) {
    // Find contiguous run.
    let groupEnd = groupStart;
    while (
      groupEnd + 1 < sorted.length &&
      (sorted[groupEnd + 1] ?? 0) === (sorted[groupEnd] ?? 0) + 1
    ) {
      groupEnd++;
    }

    const indices = sorted.slice(groupStart, groupEnd + 1);

    // Compute old/new start positions for this group by counting lines before it.
    let oldStart = hunks[0]?.oldStart ?? 1;
    let newStart = hunks[0]?.newStart ?? 1;
    for (let i = 0; i < (indices[0] ?? 0); i++) {
      const p = allLines[i]?.[0];
      if (p === " " || p === "-") oldStart++;
      if (p === " " || p === "+") newStart++;
    }

    let oldCount = 0;
    let newCount = 0;
    const hunkBody: string[] = [];
    for (const i of indices) {
      const line = allLines[i] ?? " ";
      const p = line[0];
      hunkBody.push(line);
      if (p === " " || p === "-") oldCount++;
      if (p === " " || p === "+") newCount++;
    }

    outputLines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const l of hunkBody) outputLines.push(l);

    groupStart = groupEnd + 1;
  }

  return outputLines.join("\n") + "\n";
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const diffTool: ToolDef = {
  slug: "diff",
  name: "Text Diff",
  ops: [
    {
      name: "diff",
      description: "Diff two text strings and return structured changes plus a unified patch string",
      inputSchema: z.object({
        a: z.string(),
        b: z.string(),
      }),
      run({ a, b }) {
        return computeDiff(a, b);
      },
    },
  ],
};
