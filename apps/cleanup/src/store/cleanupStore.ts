import { create } from "zustand";

export type Phase = "idle" | "loaded" | "brushing" | "erasing" | "done" | "error";

interface CleanupState {
  phase: Phase;
  inputFile: File | null;
  inputUrl: string | null;
  resultUrl: string | null;
  errorMsg: string | null;
  // actions
  setInputFile: (file: File, url: string) => void;
  setPhase: (phase: Phase) => void;
  setResult: (url: string) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

const INITIAL: Pick<CleanupState, "phase" | "inputFile" | "inputUrl" | "resultUrl" | "errorMsg"> = {
  phase: "idle",
  inputFile: null,
  inputUrl: null,
  resultUrl: null,
  errorMsg: null,
};

export const useCleanupStore = create<CleanupState>((set) => ({
  ...INITIAL,

  setInputFile: (file, url) =>
    set({ inputFile: file, inputUrl: url, resultUrl: null, errorMsg: null }),

  setPhase: (phase) => set({ phase }),

  setResult: (url) => set({ resultUrl: url, phase: "done" }),

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  reset: () => set({ ...INITIAL }),
}));
