import { create } from "zustand";

export type Phase = "idle" | "model-loading" | "processing" | "done" | "error";

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface ResultDimensions {
  width: number;
  height: number;
}

interface BgState {
  phase: Phase;
  inputFile: File | null;
  inputUrl: string | null;
  resultUrl: string | null;
  errorMsg: string | null;
  modelProgress: ModelProgress;
  resultDimensions: ResultDimensions;
  // actions
  setInputFile: (file: File, url: string) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setResult: (url: string, width: number, height: number) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

const INITIAL: Pick<
  BgState,
  | "phase"
  | "inputFile"
  | "inputUrl"
  | "resultUrl"
  | "errorMsg"
  | "modelProgress"
  | "resultDimensions"
> = {
  phase: "idle",
  inputFile: null,
  inputUrl: null,
  resultUrl: null,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  resultDimensions: { width: 0, height: 0 },
};

export const useBgStore = create<BgState>((set) => ({
  ...INITIAL,

  setInputFile: (file, url) =>
    set({ inputFile: file, inputUrl: url, resultUrl: null, errorMsg: null }),

  setPhase: (phase) => set({ phase }),

  setModelProgress: (loaded, total, status) => set({ modelProgress: { loaded, total, status } }),

  setResult: (url, width, height) =>
    set({ resultUrl: url, phase: "done", resultDimensions: { width, height } }),

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  reset: () => set({ ...INITIAL }),
}));
