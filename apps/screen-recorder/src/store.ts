import { create } from "zustand";

export type RecorderPhase = "idle" | "recording" | "done" | "error";

interface RecorderState {
  phase: RecorderPhase;
  /** Accumulated recording chunks. */
  chunks: Blob[];
  /** Assembled result blob. */
  resultBlob: Blob | null;
  /** Object URL for the result video — revoke before replacing. */
  resultUrl: string | null;
  /** MIME type used for the current recording. */
  mimeType: string;
  /** Elapsed seconds during recording. */
  elapsed: number;
  /** User-visible error message. */
  errorMsg: string | null;
  /** Recording index for filename generation (increments each session). */
  recordingIndex: number;

  // --- Setters ---
  setPhase: (phase: RecorderPhase) => void;
  addChunk: (chunk: Blob) => void;
  setMimeType: (mime: string) => void;
  setElapsed: (sec: number) => void;
  setError: (msg: string) => void;
  /**
   * Commit the assembled blob+url as the result.
   * Revokes any previous resultUrl before setting the new one.
   */
  setResult: (blob: Blob, url: string) => void;
  /** Reset to idle for a new recording. Revokes previous object URL. */
  reset: () => void;
}

export const useRecorderStore = create<RecorderState>((set, get) => ({
  phase: "idle",
  chunks: [],
  resultBlob: null,
  resultUrl: null,
  mimeType: "video/webm",
  elapsed: 0,
  errorMsg: null,
  recordingIndex: 0,

  setPhase: (phase) => set({ phase }),
  addChunk: (chunk) => set((s) => ({ chunks: [...s.chunks, chunk] })),
  setMimeType: (mimeType) => set({ mimeType }),
  setElapsed: (elapsed) => set({ elapsed }),
  setError: (errorMsg) => set({ phase: "error", errorMsg }),

  setResult: (blob, url) => {
    const prev = get().resultUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ resultBlob: blob, resultUrl: url });
  },

  reset: () => {
    const prev = get().resultUrl;
    if (prev) URL.revokeObjectURL(prev);
    set((s) => ({
      phase: "idle",
      chunks: [],
      resultBlob: null,
      resultUrl: null,
      elapsed: 0,
      errorMsg: null,
      recordingIndex: s.recordingIndex + 1,
    }));
  },
}));
