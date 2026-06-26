import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OptimizeOptions } from "./svgOptimize";

export interface SvgStore {
  input: string;
  result: string | null;
  originalBytes: number;
  optimizedBytes: number;
  saving: number;
  error: string | null;
  options: OptimizeOptions;
  activePreview: "original" | "optimized";

  setInput: (v: string) => void;
  setResult: (
    result: string,
    originalBytes: number,
    optimizedBytes: number,
    saving: number
  ) => void;
  setError: (msg: string) => void;
  clearResult: () => void;
  setOption: <K extends keyof OptimizeOptions>(key: K, value: OptimizeOptions[K]) => void;
  setActivePreview: (v: "original" | "optimized") => void;
}

export const useSvgStore = create<SvgStore>()(
  persist(
    (set) => ({
      input: "",
      result: null,
      originalBytes: 0,
      optimizedBytes: 0,
      saving: 0,
      error: null,
      options: {
        precision: 2,
        stripMetadata: true,
        collapseGroups: true,
        removeViewBox: false,
        removeComments: true,
        convertShapes: true,
        cleanupIds: true,
      },
      activePreview: "optimized",

      setInput: (v) => set({ input: v, result: null, error: null }),
      setResult: (result, originalBytes, optimizedBytes, saving) =>
        set({ result, originalBytes, optimizedBytes, saving, error: null }),
      setError: (msg) => set({ error: msg, result: null }),
      clearResult: () => set({ result: null, error: null }),
      setOption: (key, value) =>
        set((s) => ({ options: { ...s.options, [key]: value }, result: null })),
      setActivePreview: (v) => set({ activePreview: v }),
    }),
    {
      name: "svg-optimizer-prefs",
      // Only persist user preferences, not transient result/error state
      partialize: (s) => ({ options: s.options }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SvgStore>;
        // Guard options: each boolean/number field must be its expected type; fall back to current.
        const raw = typeof p.options === "object" && p.options !== null ? p.options : {};
        const opts = raw as Partial<OptimizeOptions>;
        return {
          ...current,
          // Guard input: not in partialize but could be injected by a poisoned store.
          input: typeof p.input === "string" ? p.input : current.input,
          options: {
            precision:
              typeof opts.precision === "number" ? opts.precision : current.options.precision,
            stripMetadata:
              typeof opts.stripMetadata === "boolean"
                ? opts.stripMetadata
                : current.options.stripMetadata,
            collapseGroups:
              typeof opts.collapseGroups === "boolean"
                ? opts.collapseGroups
                : current.options.collapseGroups,
            removeViewBox:
              typeof opts.removeViewBox === "boolean"
                ? opts.removeViewBox
                : current.options.removeViewBox,
            removeComments:
              typeof opts.removeComments === "boolean"
                ? opts.removeComments
                : current.options.removeComments,
            convertShapes:
              typeof opts.convertShapes === "boolean"
                ? opts.convertShapes
                : current.options.convertShapes,
            cleanupIds:
              typeof opts.cleanupIds === "boolean" ? opts.cleanupIds : current.options.cleanupIds,
          },
        };
      },
    }
  )
);
