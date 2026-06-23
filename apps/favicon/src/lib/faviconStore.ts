import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type CanvasOptions, DEFAULT_CANVAS_OPTIONS, type SourceMode } from "./faviconCore";

export interface PreviewEntry {
  size: number;
  label: string;
  filename: string;
  dataUrl: string;
}

export type GenerationStatus = "idle" | "generating" | "done" | "error";

interface FaviconState {
  /** Active source mode */
  sourceMode: SourceMode;
  /** Original uploaded file (image mode) */
  sourceFile: File | null;
  /** Object URL for the source image element (image mode) */
  sourceUrl: string | null;
  /** Text or emoji string (text/emoji mode) */
  sourceText: string;
  /** App name used in manifest + snippet */
  appName: string;
  /** Background + shape options */
  canvasOptions: CanvasOptions;
  /** Generated PNG previews */
  previews: PreviewEntry[];
  /** ZIP blob URL once generated */
  zipUrl: string | null;
  status: GenerationStatus;
  errorMsg: string | null;
  progress: number;

  setSourceMode: (mode: SourceMode) => void;
  setSource: (file: File, url: string) => void;
  setSourceText: (text: string) => void;
  setAppName: (name: string) => void;
  setCanvasOptions: (opts: Partial<CanvasOptions>) => void;
  setPreviews: (previews: PreviewEntry[]) => void;
  setZipUrl: (url: string | null) => void;
  setStatus: (status: GenerationStatus, msg?: string) => void;
  setProgress: (n: number) => void;
  reset: () => void;
}

export const useFaviconStore = create<FaviconState>()(
  persist(
    (set, get) => ({
      sourceMode: "image",
      sourceFile: null,
      sourceUrl: null,
      sourceText: "",
      appName: "My App",
      canvasOptions: DEFAULT_CANVAS_OPTIONS,
      previews: [],
      zipUrl: null,
      status: "idle",
      errorMsg: null,
      progress: 0,

      setSourceMode: (mode) =>
        set({ sourceMode: mode, previews: [], zipUrl: null, status: "idle" }),
      setSource: (file, url) =>
        set({ sourceFile: file, sourceUrl: url, previews: [], zipUrl: null, status: "idle" }),
      setSourceText: (text) =>
        set({ sourceText: text, previews: [], zipUrl: null, status: "idle" }),
      setAppName: (name) => set({ appName: name }),
      setCanvasOptions: (opts) => set({ canvasOptions: { ...get().canvasOptions, ...opts } }),
      setPreviews: (previews) => set({ previews }),
      setZipUrl: (url) => set({ zipUrl: url }),
      setStatus: (status, msg) => set({ status, errorMsg: msg ?? null }),
      setProgress: (n) => set({ progress: n }),
      reset: () =>
        set({
          sourceFile: null,
          sourceUrl: null,
          sourceText: "",
          previews: [],
          zipUrl: null,
          status: "idle",
          errorMsg: null,
          progress: 0,
        }),
    }),
    {
      name: "favicon-tool-state",
      // Only persist non-binary state
      partialize: (state) => ({
        appName: state.appName,
        sourceMode: state.sourceMode,
        sourceText: state.sourceText,
        canvasOptions: state.canvasOptions,
      }),
    }
  )
);
