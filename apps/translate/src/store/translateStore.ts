import { create } from "zustand";
import { DEFAULT_TARGET, DETECT_CODE, findLanguage } from "../lib/languages";

/** Read the last-used language pair from localStorage, falling back to defaults. */
function readPersistedLangs(): { sourceLang: string; targetLang: string } {
  try {
    const raw = localStorage.getItem("translate:langs");
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "s" in parsed &&
        "t" in parsed &&
        typeof (parsed as { s: unknown }).s === "string" &&
        typeof (parsed as { t: unknown }).t === "string"
      ) {
        const { s, t } = parsed as { s: string; t: string };
        // Source may be DETECT_CODE (auto) or a real NLLB code
        const sourceOk = s === DETECT_CODE || findLanguage(s) !== undefined;
        if (sourceOk && findLanguage(t) && s !== t) {
          return { sourceLang: s, targetLang: t };
        }
      }
    }
  } catch {
    // localStorage unavailable or JSON malformed -- use defaults
  }
  return { sourceLang: DETECT_CODE, targetLang: DEFAULT_TARGET };
}

function persistLangs(sourceLang: string, targetLang: string): void {
  try {
    localStorage.setItem("translate:langs", JSON.stringify({ s: sourceLang, t: targetLang }));
  } catch {
    // Storage write failed (private mode quota, etc.) -- silently ignore
  }
}

export type Phase = "idle" | "model-loading" | "translating" | "done" | "error";

/** Monotonic phase rank: higher = further along the pipeline. */
const PHASE_RANK: Record<Phase, number> = {
  idle: 0,
  "model-loading": 1,
  translating: 2,
  done: 3,
  error: 3,
};

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface ChunkProgress {
  done: number;
  total: number;
}

interface TranslateState {
  phase: Phase;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  /** Resolved source language after detection (only set when sourceLang === DETECT_CODE) */
  detectedLang: string | null;
  errorMsg: string | null;
  modelProgress: ModelProgress;
  chunkProgress: ChunkProgress | null;
  // actions
  setSourceText: (text: string) => void;
  setTargetText: (text: string) => void;
  setSourceLang: (code: string) => void;
  setTargetLang: (code: string) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setChunkProgress: (done: number, total: number) => void;
  setResult: (text: string, detectedLang?: string) => void;
  setError: (msg: string) => void;
  swapLanguages: () => void;
  reset: () => void;
}

const persistedLangs = readPersistedLangs();

const INITIAL: Pick<
  TranslateState,
  | "phase"
  | "sourceText"
  | "targetText"
  | "sourceLang"
  | "targetLang"
  | "detectedLang"
  | "errorMsg"
  | "modelProgress"
  | "chunkProgress"
> = {
  phase: "idle",
  sourceText: "",
  targetText: "",
  sourceLang: persistedLangs.sourceLang,
  targetLang: persistedLangs.targetLang,
  detectedLang: null,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  chunkProgress: null,
};

export const useTranslateStore = create<TranslateState>((set, get) => ({
  ...INITIAL,

  setSourceText: (text) => set({ sourceText: text }),
  setTargetText: (text) => set({ targetText: text }),
  setSourceLang: (code) => {
    set({ sourceLang: code });
    persistLangs(code, get().targetLang);
  },
  setTargetLang: (code) => {
    set({ targetLang: code });
    persistLangs(get().sourceLang, code);
  },
  setPhase: (phase) =>
    set((s) =>
      phase === "idle" || PHASE_RANK[phase] >= PHASE_RANK[s.phase] ? { phase } : {}
    ),
  setModelProgress: (loaded, total, status) => set({ modelProgress: { loaded, total, status } }),
  setChunkProgress: (done, total) => set({ chunkProgress: { done, total } }),
  setResult: (text, detectedLang) =>
    set({
      targetText: text,
      phase: "done",
      detectedLang: detectedLang ?? null,
      chunkProgress: null,
    }),
  setError: (msg) => set({ errorMsg: msg, phase: "error", chunkProgress: null }),

  swapLanguages: () => {
    const { sourceLang, targetLang, sourceText, targetText } = get();
    // When source is DETECT_CODE, swapping would put DETECT_CODE on the target
    // side which makes no sense. Instead swap text only and keep target as-is.
    if (sourceLang === DETECT_CODE) {
      set({ sourceText: targetText, targetText: sourceText });
      return;
    }
    set({
      sourceLang: targetLang,
      targetLang: sourceLang,
      sourceText: targetText,
      targetText: sourceText,
      detectedLang: null,
    });
    persistLangs(targetLang, sourceLang);
  },

  reset: () => set({ ...INITIAL }),
}));
