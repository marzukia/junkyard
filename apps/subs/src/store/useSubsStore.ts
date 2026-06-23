import { create } from "zustand";
import {
  type Cue,
  type SubFormat,
  detectFormat,
  findReplace,
  fixOverlaps,
  linearSync,
  mightContainSubtitles,
  parseAss,
  parseSbv,
  parseSrt,
  parseVtt,
  serialise,
  shiftCues,
  shiftSelected,
} from "../lib/subtitle";

interface SubsState {
  cues: Cue[];
  selectedIds: Set<string>;
  format: SubFormat;
  fileName: string;
  /** Non-null when the last loadRaw produced 0 cues (parse error or wrong file). */
  loadError: string | null;
  /** Undo stack — each entry is the cues array before a destructive shift/fix */
  history: Cue[][];
  // actions
  loadRaw: (raw: string, fileName: string) => void;
  clearLoadError: () => void;
  updateCue: (id: string, patch: Partial<Omit<Cue, "id">>) => void;
  deleteCue: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  shiftAll: (deltaMs: number) => void;
  shiftSel: (deltaMs: number) => void;
  fixAll: () => void;
  applyLinearSync: (subA: number, actualA: number, subB: number, actualB: number) => void;
  applyFindReplace: (
    pattern: string,
    replacement: string,
    useRegex: boolean,
    caseSensitive: boolean
  ) => void;
  undo: () => void;
  setFormat: (f: SubFormat) => void;
  download: () => void;
  serialised: () => string;
  reset: () => void;
}

const MAX_HISTORY = 20;

function pushHistory(history: Cue[][], current: Cue[]): Cue[][] {
  const next = [...history, current];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

/**
 * Count non-printable characters in a string (excludes common whitespace).
 * Used as a heuristic to detect binary content (e.g. PNG read as text).
 * Avoids regex with control character literals to satisfy linter.
 */
function countNonPrintable(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Allow tab (9), LF (10), CR (13); reject other C0 controls and DEL (127)
    if (code < 9 || (code > 10 && code < 13) || (code > 13 && code < 32) || code === 127) {
      count++;
    }
  }
  return count;
}

/** Choose the right parser based on detected format. */
function parseRaw(raw: string, fmt: SubFormat): Cue[] {
  switch (fmt) {
    case "vtt":
      return parseVtt(raw);
    case "ass":
      return parseAss(raw);
    case "sbv":
      return parseSbv(raw);
    default:
      return parseSrt(raw);
  }
}

/** Derive initial format from file extension (fallback: detect from content). */
function formatFromFileName(name: string, contentFormat: SubFormat): SubFormat {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "ass" || ext === "ssa") return "ass";
  if (ext === "sbv") return "sbv";
  if (ext === "vtt") return "vtt";
  if (ext === "srt") return "srt";
  return contentFormat;
}

export const useSubsStore = create<SubsState>((set, get) => ({
  cues: [],
  selectedIds: new Set(),
  format: "srt",
  fileName: "subtitles.srt",
  loadError: null,
  history: [],

  loadRaw(raw, fileName) {
    // Reject binary / non-text content (e.g. PNG dropped as text)
    // heuristic: more than 1% non-printable chars (excluding common whitespace)
    const nonPrintable = countNonPrintable(raw);
    if (nonPrintable > raw.length * 0.01) {
      set({
        loadError: "This doesn't look like a subtitle file. Drop a .srt, .vtt, .ass, or .sbv file.",
      });
      return;
    }

    if (!mightContainSubtitles(raw)) {
      set({
        loadError:
          "Couldn't find any subtitles in this file. Expected .srt, .vtt, .ass, or .sbv format.",
      });
      return;
    }

    const contentFmt = detectFormat(raw);
    const fmt = formatFromFileName(fileName, contentFmt);
    const cues = parseRaw(raw, fmt);

    if (cues.length === 0) {
      set({
        loadError:
          "Couldn't find any subtitles in this file. Expected .srt, .vtt, .ass, or .sbv format.",
      });
      return;
    }

    set({ cues, format: fmt, fileName, selectedIds: new Set(), history: [], loadError: null });
  },

  clearLoadError() {
    set({ loadError: null });
  },

  updateCue(id, patch) {
    set((s) => ({
      cues: s.cues.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  deleteCue(id) {
    set((s) => {
      const next = new Set(s.selectedIds);
      next.delete(id);
      return { cues: s.cues.filter((c) => c.id !== id), selectedIds: next };
    });
  },

  toggleSelect(id) {
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  selectAll() {
    set((s) => ({ selectedIds: new Set(s.cues.map((c) => c.id)) }));
  },

  clearSelection() {
    set({ selectedIds: new Set() });
  },

  shiftAll(deltaMs) {
    set((s) => ({
      history: pushHistory(s.history, s.cues),
      cues: shiftCues(s.cues, deltaMs),
    }));
  },

  shiftSel(deltaMs) {
    set((s) => ({
      history: pushHistory(s.history, s.cues),
      cues: shiftSelected(s.cues, s.selectedIds, deltaMs),
    }));
  },

  fixAll() {
    set((s) => ({
      history: pushHistory(s.history, s.cues),
      cues: fixOverlaps(s.cues),
    }));
  },

  applyLinearSync(subA, actualA, subB, actualB) {
    set((s) => ({
      history: pushHistory(s.history, s.cues),
      cues: linearSync(s.cues, subA, actualA, subB, actualB),
    }));
  },

  applyFindReplace(pattern, replacement, useRegex, caseSensitive) {
    set((s) => {
      const next = findReplace(s.cues, pattern, replacement, useRegex, caseSensitive);
      // Only push history if something actually changed
      const changed = next.some((c, i) => c !== s.cues[i]);
      return changed ? { history: pushHistory(s.history, s.cues), cues: next } : {};
    });
  },

  undo() {
    set((s) => {
      if (s.history.length === 0) return {};
      const prev = s.history[s.history.length - 1];
      return { cues: prev, history: s.history.slice(0, -1) };
    });
  },

  setFormat(f) {
    set({ format: f });
  },

  serialised() {
    const { cues, format } = get();
    return serialise(cues, format);
  },

  download() {
    const { cues, format, fileName } = get();
    const text = serialise(cues, format);
    const base = fileName.replace(/\.(srt|vtt|ass|ssa|sbv)$/i, "");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  reset() {
    set({
      cues: [],
      selectedIds: new Set(),
      format: "srt",
      fileName: "subtitles.srt",
      loadError: null,
      history: [],
    });
  },
}));
