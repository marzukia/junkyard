import { create } from "zustand";
import type { AspectPreset, CropRect, CropShape, ExportFormat } from "./crop";

/** A single undo snapshot of the reversible transform state. */
export interface HistoryEntry {
  crop: CropRect;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

export interface CropState {
  /** The original File the user loaded */
  file: File | null;
  /** Object URL for the original image (revoked on new load) */
  imageUrl: string | null;
  /** Natural width/height of the loaded image */
  imageW: number;
  imageH: number;

  /** Current crop rect in image-pixel coordinates */
  crop: CropRect;

  /** Cumulative rotation in degrees (multiple of 90) */
  rotation: number;
  /** Flip state */
  flipH: boolean;
  flipV: boolean;

  /** Active aspect preset */
  aspect: AspectPreset;

  /** Resize output to exact pixels (0 = use crop size) */
  resizeW: number;
  resizeH: number;
  /** Lock resize aspect ratio to crop ratio */
  resizeLocked: boolean;

  /** Straighten: arbitrary rotation offset in degrees, -45..+45 */
  straighten: number;

  /** Crop shape mode */
  cropShape: CropShape;

  /** Export settings */
  format: ExportFormat;
  quality: number;

  /** Result data URL after export */
  resultUrl: string | null;
  resultName: string | null;

  /** Undo/redo history stacks */
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Actions
  loadImage: (file: File, url: string, w: number, h: number) => void;
  setCrop: (rect: CropRect) => void;
  setCropWithHistory: (rect: CropRect) => void;
  setAspect: (preset: AspectPreset) => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  toggleFlipH: () => void;
  toggleFlipV: () => void;
  setResizeW: (w: number) => void;
  setResizeH: (h: number) => void;
  setResizeLocked: (locked: boolean) => void;
  setStraighten: (deg: number) => void;
  setCropShape: (shape: CropShape) => void;
  setFormat: (fmt: ExportFormat) => void;
  setQuality: (q: number) => void;
  setResult: (url: string, name: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const DEFAULT_CROP: CropRect = { x: 0, y: 0, w: 0, h: 0 };

/** Read persisted format from localStorage (safe - returns "png" on failure). */
function readPersistedFormat(): ExportFormat {
  try {
    const v = localStorage.getItem("crop:format");
    if (v === "png" || v === "jpg" || v === "webp") return v;
  } catch {
    /* localStorage unavailable */
  }
  return "png";
}

function persistFormat(fmt: ExportFormat): void {
  try {
    localStorage.setItem("crop:format", fmt);
  } catch {
    /* ignore */
  }
}

/** Push current transform onto the undo stack, clear redo stack. */
function pushHistory(
  s: Pick<CropState, "crop" | "rotation" | "flipH" | "flipV" | "undoStack">
): Pick<CropState, "undoStack" | "redoStack"> {
  const entry: HistoryEntry = {
    crop: { ...s.crop },
    rotation: s.rotation,
    flipH: s.flipH,
    flipV: s.flipV,
  };
  return {
    undoStack: [...s.undoStack, entry].slice(-50),
    redoStack: [],
  };
}

export const useCropStore = create<CropState>((set) => ({
  file: null,
  imageUrl: null,
  imageW: 0,
  imageH: 0,
  crop: DEFAULT_CROP,
  rotation: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
  cropShape: "rect",
  aspect: "free",
  resizeW: 0,
  resizeH: 0,
  resizeLocked: true,
  format: readPersistedFormat(),
  quality: 92,
  resultUrl: null,
  resultName: null,
  undoStack: [],
  redoStack: [],

  loadImage: (file, url, w, h) =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return {
        file,
        imageUrl: url,
        imageW: w,
        imageH: h,
        crop: { x: 0, y: 0, w, h },
        rotation: 0,
        flipH: false,
        flipV: false,
        straighten: 0,
        cropShape: "rect" as CropShape,
        aspect: "free",
        resizeW: 0,
        resizeH: 0,
        resultUrl: null,
        resultName: null,
        undoStack: [],
        redoStack: [],
      };
    }),

  setCrop: (rect) => set({ crop: rect }),

  setCropWithHistory: (rect) =>
    set((s) => ({
      crop: rect,
      ...pushHistory(s),
    })),

  setAspect: (preset) => set({ aspect: preset }),

  rotateLeft: () =>
    set((s) => ({
      rotation: (s.rotation - 90 + 360) % 360,
      ...pushHistory(s),
    })),

  rotateRight: () =>
    set((s) => ({
      rotation: (s.rotation + 90) % 360,
      ...pushHistory(s),
    })),

  toggleFlipH: () =>
    set((s) => ({
      flipH: !s.flipH,
      ...pushHistory(s),
    })),

  toggleFlipV: () =>
    set((s) => ({
      flipV: !s.flipV,
      ...pushHistory(s),
    })),

  setResizeW: (w) => set({ resizeW: w }),
  setResizeH: (h) => set({ resizeH: h }),
  setResizeLocked: (locked) => set({ resizeLocked: locked }),
  setStraighten: (deg) => set({ straighten: deg }),
  setCropShape: (shape) => set({ cropShape: shape }),

  setFormat: (fmt) => {
    persistFormat(fmt);
    set({ format: fmt });
  },

  setQuality: (q) => set({ quality: q }),
  setResult: (url, name) => set({ resultUrl: url, resultName: name }),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return {};
      const prev = s.undoStack[s.undoStack.length - 1];
      const currentEntry: HistoryEntry = {
        crop: { ...s.crop },
        rotation: s.rotation,
        flipH: s.flipH,
        flipV: s.flipV,
      };
      return {
        crop: prev.crop,
        rotation: prev.rotation,
        flipH: prev.flipH,
        flipV: prev.flipV,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, currentEntry].slice(-50),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return {};
      const next = s.redoStack[s.redoStack.length - 1];
      const currentEntry: HistoryEntry = {
        crop: { ...s.crop },
        rotation: s.rotation,
        flipH: s.flipH,
        flipV: s.flipV,
      };
      return {
        crop: next.crop,
        rotation: next.rotation,
        flipH: next.flipH,
        flipV: next.flipV,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, currentEntry].slice(-50),
      };
    }),

  reset: () =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return {
        file: null,
        imageUrl: null,
        imageW: 0,
        imageH: 0,
        crop: DEFAULT_CROP,
        rotation: 0,
        flipH: false,
        flipV: false,
        straighten: 0,
        cropShape: "rect" as CropShape,
        aspect: "free",
        resizeW: 0,
        resizeH: 0,
        resultUrl: null,
        resultName: null,
        undoStack: [],
        redoStack: [],
      };
    }),
}));
