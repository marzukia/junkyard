import { create } from "zustand";
import { execRegex, execReplace } from "../lib/regex";
import type { CommonPattern, RegexFlag, RegexOutcome } from "../lib/regex";

export type ActiveTab = "matches" | "replace" | "explain" | "export" | "library";

interface RegexState {
  pattern: string;
  flags: Set<RegexFlag>;
  testText: string;
  replacement: string;
  activeTab: ActiveTab;
  // derived (computed on every change)
  result: RegexOutcome;
  replaceOutput: string;
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

// ── Persist flags to/from localStorage ───────────────────────────────────────

function loadStoredFlags(): Set<RegexFlag> {
  try {
    const raw = localStorage.getItem(LS_FLAGS_KEY);
    if (!raw) return new Set(DEFAULT_FLAGS);
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set(DEFAULT_FLAGS);
    const valid = arr.filter((f): f is RegexFlag => ALL_FLAGS.includes(f as RegexFlag));
    const s = new Set<RegexFlag>(valid);
    // g must always be present
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

// ── Derive computed state ─────────────────────────────────────────────────────

function derive(
  pattern: string,
  flags: Set<RegexFlag>,
  testText: string,
  replacement: string
): { result: RegexOutcome; replaceOutput: string } {
  const result = execRegex(pattern, flags, testText);
  const replaceOutput = execReplace(pattern, flags, testText, replacement);
  return { result, replaceOutput };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useRegexStore = create<RegexState>((set, get) => {
  const storedFlags = loadStoredFlags();
  const initial = derive("", storedFlags, DEFAULT_TEXT, "");
  return {
    pattern: "",
    flags: storedFlags,
    testText: DEFAULT_TEXT,
    replacement: "",
    activeTab: "matches",
    ...initial,

    setPattern: (pattern) => {
      const { flags, testText, replacement } = get();
      set({ pattern, ...derive(pattern, flags, testText, replacement) });
    },

    toggleFlag: (flag) => {
      const { pattern, flags, testText, replacement } = get();
      const next = new Set(flags);
      if (next.has(flag)) {
        // Never remove g, it must stay on so matchAll works
        if (flag === "g") return;
        next.delete(flag);
      } else {
        next.add(flag);
      }
      saveFlags(next);
      set({ flags: next, ...derive(pattern, next, testText, replacement) });
    },

    setTestText: (testText) => {
      const { pattern, flags, replacement } = get();
      set({ testText, ...derive(pattern, flags, testText, replacement) });
    },

    setReplacement: (replacement) => {
      const { pattern, flags, testText } = get();
      set({ replacement, ...derive(pattern, flags, testText, replacement) });
    },

    setActiveTab: (activeTab) => set({ activeTab }),

    loadCommonPattern: (p) => {
      const flags = new Set<RegexFlag>(p.flags.length > 0 ? p.flags : ["g"]);
      if (!flags.has("g")) flags.add("g");
      saveFlags(flags);
      const derived = derive(p.pattern, flags, p.example, "");
      set({ pattern: p.pattern, flags, testText: p.example, replacement: "", ...derived });
    },

    clearAll: () => {
      const { flags } = get();
      const derived = derive("", flags, "", "");
      set({ pattern: "", testText: "", replacement: "", ...derived });
    },
  };
});
