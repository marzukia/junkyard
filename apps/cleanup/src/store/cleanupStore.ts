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

export const useCleanupStore = create<CleanupState>((set, get) => ({
  ...INITIAL,

  setInputFile: (file, url) => {
    // Revoke prior blobs before replacing to prevent object-URL leaks.
    const { inputUrl, resultUrl } = get();
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    set({ inputFile: file, inputUrl: url, resultUrl: null, errorMsg: null });
  },

  setPhase: (phase) => set({ phase }),

  setResult: (url) => {
    // Revoke the prior result blob (a new one is being stored).
    const prior = get().resultUrl;
    if (prior) URL.revokeObjectURL(prior);
    set({ resultUrl: url, phase: "done" });
  },

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  reset: () => set({ ...INITIAL }),
}));
