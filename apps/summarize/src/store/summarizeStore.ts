import { create } from "zustand";

export type Phase = "idle" | "model-loading" | "processing" | "done" | "error";

/** Monotonic phase rank: higher = further along the pipeline. */
const PHASE_RANK: Record<Phase, number> = {
  idle: 0,
  "model-loading": 1,
  processing: 2,
  done: 3,
  error: 3,
};

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface SummarizeState {
  phase: Phase;
  inputText: string;
  summary: string | null;
  inputWords: number;
  outputWords: number;
  errorMsg: string | null;
  modelProgress: ModelProgress;
  /** Slider position 0-100 driving summary length. */
  lengthSlider: number;
  /** Chunk progress for long-document map-reduce (done out of total). */
  chunkProgress: { done: number; total: number };
  // actions
  setInputText: (text: string, wordCount: number) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setChunkProgress: (done: number, total: number) => void;
  setResult: (summary: string, inputWords: number, outputWords: number, chunks: number) => void;
  setError: (msg: string) => void;
  setLengthSlider: (pos: number) => void;
  reset: () => void;
  /** How many chunks the last summarization used (0 = unknown / single). */
  lastChunkCount: number;
}

const LS_KEY = "summarize:lengthSlider";

function readPersistedSlider(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
  } catch {
    // localStorage unavailable (e.g. private mode with storage blocked)
  }
  return 37;
}

function writePersistedSlider(pos: number): void {
  try {
    localStorage.setItem(LS_KEY, String(pos));
  } catch {
    // ignore
  }
}

const INITIAL: Pick<
  SummarizeState,
  | "phase"
  | "inputText"
  | "summary"
  | "inputWords"
  | "outputWords"
  | "errorMsg"
  | "modelProgress"
  | "lengthSlider"
  | "chunkProgress"
  | "lastChunkCount"
> = {
  phase: "idle",
  inputText: "",
  summary: null,
  inputWords: 0,
  outputWords: 0,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  lengthSlider: readPersistedSlider(),
  chunkProgress: { done: 0, total: 1 },
  lastChunkCount: 0,
};

export const useSummarizeStore = create<SummarizeState>((set) => ({
  ...INITIAL,

  setInputText: (text, wordCount) =>
    set({ inputText: text, inputWords: wordCount, summary: null, errorMsg: null, phase: "idle" }),

  setPhase: (phase) =>
    set((s) =>
      phase === "idle" || PHASE_RANK[phase] >= PHASE_RANK[s.phase] ? { phase } : {}
    ),

  setModelProgress: (loaded, total, status) => set({ modelProgress: { loaded, total, status } }),

  setChunkProgress: (done, total) => set({ chunkProgress: { done, total } }),

  setResult: (summary, inputWords, outputWords, chunks) =>
    set({ summary, inputWords, outputWords, lastChunkCount: chunks, phase: "done" }),

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  setLengthSlider: (pos) => {
    writePersistedSlider(pos);
    set({ lengthSlider: pos });
  },

  reset: () => set({ ...INITIAL, lengthSlider: readPersistedSlider() }),
}));
