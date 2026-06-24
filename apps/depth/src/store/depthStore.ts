import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ColourMap, RawDepthCache } from "../lib/depthEstimation";

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

interface DepthState {
  phase: Phase;
  inputFile: File | null;
  inputUrl: string | null;
  resultUrl: string | null;
  errorMsg: string | null;
  colourMap: ColourMap;
  invert: boolean;
  modelProgress: ModelProgress;
  /** Raw normalised depth cache; set after first inference, cleared on reset. */
  depthCache: RawDepthCache | null;
  // actions
  setInputFile: (file: File, url: string) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setResult: (url: string, cache: RawDepthCache) => void;
  setResultUrl: (url: string) => void;
  setError: (msg: string) => void;
  setColourMap: (map: ColourMap) => void;
  setInvert: (invert: boolean) => void;
  reset: () => void;
}

const INITIAL: Pick<
  DepthState,
  "phase" | "inputFile" | "inputUrl" | "resultUrl" | "errorMsg" | "modelProgress" | "depthCache"
> = {
  phase: "idle",
  inputFile: null,
  inputUrl: null,
  resultUrl: null,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  depthCache: null,
};

export const useDepthStore = create<DepthState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      colourMap: "viridis",
      invert: false,

      setInputFile: (file, url) => {
        // Revoke prior blobs before replacing to prevent object-URL leaks.
        // setResultUrl (colourmap re-render path at App.tsx:464) correctly
        // revokes the old resultUrl itself before calling this -- leave it alone.
        const { inputUrl, resultUrl } = get();
        if (inputUrl) URL.revokeObjectURL(inputUrl);
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        set({ inputFile: file, inputUrl: url, resultUrl: null, errorMsg: null, depthCache: null });
      },

      setPhase: (phase) =>
        set((s) =>
          phase === "idle" || PHASE_RANK[phase] >= PHASE_RANK[s.phase] ? { phase } : {}
        ),

      setModelProgress: (loaded, total, status) =>
        set({ modelProgress: { loaded, total, status } }),

      setResult: (url, cache) => set({ resultUrl: url, phase: "done", depthCache: cache }),

      setResultUrl: (url) => set({ resultUrl: url }),

      setError: (msg) => set({ errorMsg: msg, phase: "error" }),

      setColourMap: (colourMap) => set({ colourMap }),

      setInvert: (invert) => set({ invert }),

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "depth-prefs",
      // Only persist user preferences; session state is ephemeral
      partialize: (state) => ({ colourMap: state.colourMap, invert: state.invert }),
    }
  )
);
