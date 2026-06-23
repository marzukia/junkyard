import { diffWordsWithSpace, structuredPatch } from "diff";
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
  const ensureNl = (s: string) => s.endsWith("\n") ? s : `${s}\n`;
  const patch = structuredPatch("old", "new", ensureNl(oldText), ensureNl(newText), "", "", { context: Number.MAX_SAFE_INTEGER });

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  if (oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines[newLines.length - 1] === "") newLines.pop();

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

  // Build unified patch string with context=3
  const unifiedPatch = structuredPatch("original", "modified", ensureNl(oldText), ensureNl(newText), "", "", { context: 3 });
  let unified = "";
  if (unifiedPatch.hunks.length > 0) {
    const lines = ["--- original", "+++ modified"];
    for (const hunk of unifiedPatch.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      for (const line of hunk.lines) lines.push(line);
    }
    unified = `${lines.join("\n")}\n`;
  }

  return { sideBySide, unified, stats };
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
