import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OutputFormat } from "../lib/imageHelpers";
import type { ScaleFactor } from "../lib/upscale";

export type Phase = "idle" | "model-loading" | "processing" | "done" | "error";

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface UpscaleState {
  phase: Phase;
  scale: ScaleFactor;
  outputFormat: OutputFormat;
  inputFile: File | null;
  inputUrl: string | null;
  inputWidth: number | null;
  inputHeight: number | null;
  resultUrl: string | null;
  resultWidth: number | null;
  resultHeight: number | null;
  resultSize: number | null;
  errorMsg: string | null;
  modelProgress: ModelProgress;
  // actions
  setInputFile: (file: File, url: string) => void;
  setInputDimensions: (width: number, height: number) => void;
  setScale: (scale: ScaleFactor) => void;
  setOutputFormat: (format: OutputFormat) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setResult: (url: string, width: number, height: number, size: number) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

const INITIAL: Pick<
  UpscaleState,
  | "phase"
  | "scale"
  | "outputFormat"
  | "inputFile"
  | "inputUrl"
  | "inputWidth"
  | "inputHeight"
  | "resultUrl"
  | "resultWidth"
  | "resultHeight"
  | "resultSize"
  | "errorMsg"
  | "modelProgress"
> = {
  phase: "idle",
  scale: 2,
  outputFormat: "png",
  inputFile: null,
  inputUrl: null,
  inputWidth: null,
  inputHeight: null,
  resultUrl: null,
  resultWidth: null,
  resultHeight: null,
  resultSize: null,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
};

export const useUpscaleStore = create<UpscaleState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setInputFile: (file, url) =>
        set({
          inputFile: file,
          inputUrl: url,
          inputWidth: null,
          inputHeight: null,
          resultUrl: null,
          resultSize: null,
          errorMsg: null,
        }),

      setInputDimensions: (width, height) => set({ inputWidth: width, inputHeight: height }),

      setScale: (scale) => set({ scale }),

      setOutputFormat: (format) => set({ outputFormat: format }),

      setPhase: (phase) => set({ phase }),

      setModelProgress: (loaded, total, status) =>
        set({ modelProgress: { loaded, total, status } }),

      setResult: (url, width, height, size) =>
        set({
          resultUrl: url,
          resultWidth: width,
          resultHeight: height,
          resultSize: size,
          phase: "done",
        }),

      setError: (msg) => set({ errorMsg: msg, phase: "error" }),

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "upscale-prefs",
      // Only persist the scale + format preferences -- not transient state
      partialize: (state) => ({ scale: state.scale, outputFormat: state.outputFormat }),
    }
  )
);
