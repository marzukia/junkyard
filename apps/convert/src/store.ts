import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isHeic, validateImageFile } from "./convert";
import type { OutputFormat } from "./convert";

export type FileStatus = "pending" | "processing" | "done" | "error" | "invalid";

export interface ConvertFile {
  id: string;
  file: File;
  /** Object URL for thumbnail preview (non-HEIC only) */
  previewUrl: string | null;
  status: FileStatus;
  /** 0-100 during processing, null otherwise */
  progressPct: number | null;
  /** Output blob URL after conversion */
  outputUrl: string | null;
  outputName: string | null;
  outputSize: number | null;
  /** Output blob retained for zip packaging */
  outputBlob: Blob | null;
  errorMsg: string | null;
}

interface ConverterState {
  files: ConvertFile[];
  format: OutputFormat;
  quality: number;
  maxDimension: number;
  exactWidth: number;
  exactHeight: number;
  scalePct: number;
  /** Which resize mode is active: "max" | "exact" | "scale" */
  resizeMode: "max" | "exact" | "scale";

  addFiles: (incoming: File[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  setFormat: (f: OutputFormat) => void;
  setQuality: (q: number) => void;
  setMaxDimension: (d: number) => void;
  setExactWidth: (w: number) => void;
  setExactHeight: (h: number) => void;
  setScalePct: (s: number) => void;
  setResizeMode: (m: "max" | "exact" | "scale") => void;
  updateFile: (id: string, patch: Partial<ConvertFile>) => void;
}

export const useConverterStore = create<ConverterState>()(
  persist(
    (set) => ({
      files: [],
      format: "jpg",
      quality: 85,
      maxDimension: 0,
      exactWidth: 0,
      exactHeight: 0,
      scalePct: 0,
      resizeMode: "max",

      addFiles: (incoming) =>
        set((state) => {
          const existingNames = new Set(state.files.map((f) => f.file.name));
          const novel = incoming.filter((f) => !existingNames.has(f.name));
          const newEntries: ConvertFile[] = novel.map((f) => ({
            id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
            file: f,
            previewUrl: f.type.startsWith("image/") && !isHeic(f) ? URL.createObjectURL(f) : null,
            status: "pending",
            progressPct: null,
            outputUrl: null,
            outputName: null,
            outputSize: null,
            outputBlob: null,
            errorMsg: null,
          }));
          // Kick off background validation for each new entry (updates status async)
          for (const entry of newEntries) {
            const file = entry.file;
            const id = entry.id;
            validateImageFile(file)
              .then((reason) => {
                if (reason !== null) {
                  set((s) => ({
                    files: s.files.map((fe) =>
                      fe.id === id ? { ...fe, status: "invalid", errorMsg: reason } : fe
                    ),
                  }));
                }
              })
              .catch(() => {
                // validateImageFile itself doesn't throw, but guard anyway
              });
          }
          return { files: [...state.files, ...newEntries] };
        }),

      removeFile: (id) =>
        set((state) => {
          const target = state.files.find((f) => f.id === id);
          if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
          if (target?.outputUrl) URL.revokeObjectURL(target.outputUrl);
          return { files: state.files.filter((f) => f.id !== id) };
        }),

      clearAll: () =>
        set((state) => {
          for (const f of state.files) {
            if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
            if (f.outputUrl) URL.revokeObjectURL(f.outputUrl);
          }
          return { files: [] };
        }),

      setFormat: (format) => set({ format }),
      setQuality: (quality) => set({ quality }),
      setMaxDimension: (maxDimension) => set({ maxDimension }),
      setExactWidth: (exactWidth) => set({ exactWidth }),
      setExactHeight: (exactHeight) => set({ exactHeight }),
      setScalePct: (scalePct) => set({ scalePct }),
      setResizeMode: (resizeMode) => set({ resizeMode }),

      updateFile: (id, patch) =>
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
    }),
    {
      name: "convert-settings",
      // Only persist user preferences; the file queue is ephemeral (Blobs/ObjectURLs
      // cannot be serialised to JSON).
      partialize: (state) => ({
        format: state.format,
        quality: state.quality,
        maxDimension: state.maxDimension,
        exactWidth: state.exactWidth,
        exactHeight: state.exactHeight,
        scalePct: state.scalePct,
        resizeMode: state.resizeMode,
      }),
    }
  )
);
