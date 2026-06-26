import { create } from "zustand";
import type { CommonPattern, RegexFlag, RegexOutcome } from "../lib/regex";
import type { WorkerRequest, WorkerResponse } from "../regex.worker";
// Vite worker import — statically analysable so Vite compiles this to a real chunk,
// not an inlined data URL. `new RegexWorker()` at the call site is required for
// Vite to detect the worker and emit it as a separate chunk.
import RegexWorker from "../regex.worker.ts?worker";

export type ActiveTab = "matches" | "replace" | "explain" | "export" | "library";

/** How long (ms) we wait for the worker before declaring catastrophic backtracking. */
const WORKER_TIMEOUT_MS = 2500;

interface RegexState {
  pattern: string;
  flags: Set<RegexFlag>;
  testText: string;
  replacement: string;
  activeTab: ActiveTab;
  // derived (populated asynchronously by the worker)
  result: RegexOutcome;
  replaceOutput: string;
  /** True while the worker is computing a result */
  isMatching: boolean;
  /** Set when the worker times out (catastrophic backtracking guard) */
  timeoutError: string | null;
  // actions
  setPattern: (p: string) => void;
  toggleFlag: (f: RegexFlag) => void;
  setTestText: (t: string) => void;
  setReplacement: (r: string) => void;
  setActiveTab: (t: ActiveTab) => void;
  loadCommonPattern: (p: CommonPattern) => void;
  clearAll: () => void;
}

const ALL_FLAGS: RegexFlag[] = ["g", "i", "m", "s", "u"];
const DEFAULT_FLAGS: Set<RegexFlag> = new Set(["g"]);
const DEFAULT_TEXT =
  "The quick brown fox jumps over the lazy dog.\nContact us at hello@example.com, version 2.4.1 released on 2024-06-15.";
const LS_FLAGS_KEY = "rx-flags";

const EMPTY_RESULT: RegexOutcome = { ok: true, matches: [], matchCount: 0, flags: "" };

// ── Persist flags to/from localStorage ───────────────────────────────────────

function loadStoredFlags(): Set<RegexFlag> {
  try {
    const raw = localStorage.getItem(LS_FLAGS_KEY);
    if (!raw) return new Set(DEFAULT_FLAGS);
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set(DEFAULT_FLAGS);
    const valid = arr.filter((f): f is RegexFlag => ALL_FLAGS.includes(f as RegexFlag));
    const s = new Set<RegexFlag>(valid);
    s.add("g");
    return s;
  } catch {
    return new Set(DEFAULT_FLAGS);
  }
}

function saveFlags(flags: Set<RegexFlag>): void {
  try {
    localStorage.setItem(LS_FLAGS_KEY, JSON.stringify([...flags]));
  } catch {
    // storage unavailable; ignore
  }
}

// ── Worker singleton + request sequencing ────────────────────────────────────
//
// One worker stays alive; only recreated after a timeout-terminate.
// A monotonically increasing request ID lets us discard stale responses
// when the user types faster than the worker responds.

let worker: Worker = new RegexWorker();
let pendingRequestId = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPending() {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  // Advance ID so any in-flight response is treated as stale
  pendingRequestId++;
}

function recreateWorker() {
  try {
    worker.terminate();
  } catch {
    // ignore if already dead
  }
  worker = new RegexWorker();
}

// ── Dispatch a match+replace job to the worker ────────────────────────────────

function dispatchToWorker(
  pattern: string,
  flags: Set<RegexFlag>,
  text: string,
  replacement: string,
  onResult: (result: RegexOutcome, replaceOutput: string) => void,
  onTimeout: () => void
) {
  cancelPending();
  const id = ++pendingRequestId;

  pendingTimer = setTimeout(() => {
    if (pendingRequestId !== id) return;
    recreateWorker();
    onTimeout();
  }, WORKER_TIMEOUT_MS);

  const request: WorkerRequest = {
    id,
    pattern,
    flags: [...flags] as RegexFlag[],
    text,
    replacement,
  };

  // Re-assign onmessage rather than addEventListener to avoid accumulating
  // stale listeners across recreate cycles.
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const resp = e.data;
    if (resp.id !== id) return; // stale response
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    onResult(resp.result, resp.replaceOutput);
  };

  worker.postMessage(request);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useRegexStore = create<RegexState>((set, get) => {
  const storedFlags = loadStoredFlags();

  function runMatch(pattern: string, flags: Set<RegexFlag>, testText: string, replacement: string) {
    if (!pattern) {
      cancelPending();
      set({
        result: EMPTY_RESULT,
        replaceOutput: testText,
        isMatching: false,
        timeoutError: null,
      });
      return;
    }

    set({ isMatching: true, timeoutError: null });

    dispatchToWorker(
      pattern,
      flags,
      testText,
      replacement,
      (result, replaceOutput) => {
        set({ result, replaceOutput, isMatching: false, timeoutError: null });
      },
      () => {
        set({
          result: EMPTY_RESULT,
          replaceOutput: "",
          isMatching: false,
          timeoutError:
            "This pattern is too slow on this input (possible catastrophic backtracking). Simplify the pattern.",
        });
      }
    );
  }

  return {
    pattern: "",
    flags: storedFlags,
    testText: DEFAULT_TEXT,
    replacement: "",
    activeTab: "matches",
    result: EMPTY_RESULT,
    replaceOutput: DEFAULT_TEXT,
    isMatching: false,
    timeoutError: null,

    setPattern: (pattern) => {
      const { flags, testText, replacement } = get();
      set({ pattern });
      runMatch(pattern, flags, testText, replacement);
    },

    toggleFlag: (flag) => {
      const { pattern, flags, testText, replacement } = get();
      const next = new Set(flags);
      if (next.has(flag)) {
        if (flag === "g") return;
        next.delete(flag);
      } else {
        next.add(flag);
      }
      saveFlags(next);
      set({ flags: next });
      runMatch(pattern, next, testText, replacement);
    },

    setTestText: (testText) => {
      const { pattern, flags, replacement } = get();
      set({ testText });
      runMatch(pattern, flags, testText, replacement);
    },

    setReplacement: (replacement) => {
      const { pattern, flags, testText } = get();
      set({ replacement });
      runMatch(pattern, flags, testText, replacement);
    },

    setActiveTab: (activeTab) => set({ activeTab }),

    loadCommonPattern: (p) => {
      const flags = new Set<RegexFlag>(p.flags.length > 0 ? p.flags : ["g"]);
      if (!flags.has("g")) flags.add("g");
      saveFlags(flags);
      set({ pattern: p.pattern, flags, testText: p.example, replacement: "" });
      runMatch(p.pattern, flags, p.example, "");
    },

    clearAll: () => {
      const { flags } = get();
      cancelPending();
      set({
        pattern: "",
        testText: "",
        replacement: "",
        result: EMPTY_RESULT,
        replaceOutput: "",
        isMatching: false,
        timeoutError: null,
      });
      void flags; // flags persist between clears
    },
  };
});
