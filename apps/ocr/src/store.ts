import { create } from "zustand";
import type { OcrWord } from "./ocrPdfUtils";
import { loadPersistedLanguage } from "./ocrUtils";

export type OcrStatus = "idle" | "loading" | "running" | "done" | "error";

/** One item in the batch queue. */
export interface QueueItem {
  id: string;
  file: File;
  /** Object URL for preview -- caller must revoke when removing. */
  previewUrl: string;
  /** null = not yet processed */
  status: OcrStatus;
  text: string;
  confidence: number;
  errorMsg: string;
  /** Word-level bounding boxes cached after OCR so multi-page PDF uses per-page data. */
  words: OcrWord[];
}

/** A rectangular region in natural image coordinates (pixels on the source image). */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrState {
  // Input -- single active image (first item in queue, or manually selected)
  imageFile: File | null;
  imageUrl: string | null;
  language: string;

  // Batch queue (includes the active image as item 0)
  queue: QueueItem[];
  activeIndex: number;

  // Region selection -- null means "whole image"
  cropRect: CropRect | null;

  // OCR result for the active item
  status: OcrStatus;
  progress: number; // 0-100
  progressMessage: string;
  rawText: string;
  editedText: string;
  confidence: number; // 0-100
  /** Low-confidence words for the current result. */
  lowConfWords: Array<{ text: string; confidence: number }>;
  /** Word-level bounding box data for searchable PDF export. Empty if not available. */
  ocrWords: OcrWord[];

  // UI
  copyDone: boolean;
  showWordHighlights: boolean;

  /**
   * Monotonic counter for generating unique queue-item IDs.
   * Stored in Zustand state (not module scope) so it resets correctly under
   * Vite HMR and does not desync across hot reloads.
   */
  _idCounter: number;

  // Actions
  setImage: (file: File) => void;
  addFiles: (files: File[]) => void;
  removeQueueItem: (id: string) => void;
  setActiveIndex: (index: number) => void;
  clearImage: () => void;
  setLanguage: (lang: string) => void;
  setStatus: (status: OcrStatus) => void;
  setProgress: (progress: number, message: string) => void;
  setResult: (
    text: string,
    confidence: number,
    lowConfWords?: Array<{ text: string; confidence: number }>,
    ocrWords?: OcrWord[]
  ) => void;
  setQueueItemResult: (
    id: string,
    text: string,
    confidence: number,
    errorMsg?: string,
    words?: OcrWord[]
  ) => void;
  setEditedText: (text: string) => void;
  setCopyDone: (v: boolean) => void;
  setCropRect: (rect: CropRect | null) => void;
  setShowWordHighlights: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  imageFile: null,
  imageUrl: null,
  language: loadPersistedLanguage(),
  queue: [] as QueueItem[],
  activeIndex: 0,
  cropRect: null as CropRect | null,
  status: "idle" as OcrStatus,
  progress: 0,
  progressMessage: "",
  rawText: "",
  editedText: "",
  confidence: 0,
  lowConfWords: [] as Array<{ text: string; confidence: number }>,
  ocrWords: [] as OcrWord[],
  copyDone: false,
  showWordHighlights: false,
  _idCounter: 0,
};

function makeQueueItem(file: File, id: number): QueueItem {
  return {
    id: `q${id}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "idle",
    text: "",
    confidence: 0,
    errorMsg: "",
    words: [],
  };
}

export const useOcrStore = create<OcrState>((set, get) => ({
  ...initialState,

  setImage: (file) => {
    const state = get();
    // Revoke existing object URLs
    for (const item of state.queue) URL.revokeObjectURL(item.previewUrl);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

    const nextId = state._idCounter + 1;
    const item = makeQueueItem(file, nextId);
    set({
      _idCounter: nextId,
      imageFile: file,
      imageUrl: item.previewUrl,
      queue: [item],
      activeIndex: 0,
      cropRect: null,
      status: "idle",
      rawText: "",
      editedText: "",
      confidence: 0,
      lowConfWords: [],
    });
  },

  addFiles: (files) => {
    const state = get();
    let counter = state._idCounter;
    const newItems = files.map((f) => makeQueueItem(f, ++counter));
    if (state.queue.length === 0) {
      // Nothing yet -- treat first file as the active image
      const first = newItems[0];
      set({
        _idCounter: counter,
        imageFile: first.file,
        imageUrl: first.previewUrl,
        queue: newItems,
        activeIndex: 0,
        cropRect: null,
        status: "idle",
        rawText: "",
        editedText: "",
        confidence: 0,
        lowConfWords: [],
      });
    } else {
      set({ _idCounter: counter, queue: [...state.queue, ...newItems] });
    }
  },

  removeQueueItem: (id) => {
    const state = get();
    const idx = state.queue.findIndex((q) => q.id === id);
    if (idx === -1) return;
    const item = state.queue[idx];
    URL.revokeObjectURL(item.previewUrl);
    const newQueue = state.queue.filter((q) => q.id !== id);
    if (newQueue.length === 0) {
      // All removed, full reset (preserve _idCounter so IDs stay monotonic)
      set({ ...initialState, _idCounter: state._idCounter, language: state.language });
      return;
    }
    const newActive = Math.min(state.activeIndex, newQueue.length - 1);
    const activeItem = newQueue[newActive];
    set({
      queue: newQueue,
      activeIndex: newActive,
      imageFile: activeItem.file,
      imageUrl: activeItem.previewUrl,
      status: activeItem.status,
      rawText: activeItem.text,
      editedText: activeItem.text,
      confidence: activeItem.confidence,
      cropRect: null,
      lowConfWords: [],
      ocrWords: [],
    });
  },

  setActiveIndex: (index) => {
    const state = get();
    const item = state.queue[index];
    if (!item) return;
    set({
      activeIndex: index,
      imageFile: item.file,
      imageUrl: item.previewUrl,
      status: item.status,
      rawText: item.text,
      editedText: item.text,
      confidence: item.confidence,
      cropRect: null,
      lowConfWords: [],
      ocrWords: [],
      progress: 0,
      progressMessage: "",
    });
  },

  clearImage: () => {
    const state = get();
    for (const item of state.queue) URL.revokeObjectURL(item.previewUrl);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    // Preserve _idCounter so IDs remain monotonic after clear.
    set({ ...initialState, _idCounter: state._idCounter, language: state.language });
  },

  setLanguage: (lang) => set({ language: lang }),

  setStatus: (status) => set({ status }),

  setProgress: (progress, progressMessage) => set({ progress, progressMessage }),

  setResult: (rawText, confidence, lowConfWords = [], ocrWords = []) => {
    const state = get();
    // Also update the active queue item
    const queue = state.queue.map((item, i) =>
      i === state.activeIndex
        ? { ...item, status: "done" as OcrStatus, text: rawText, confidence }
        : item
    );
    set({
      rawText,
      editedText: rawText,
      confidence,
      status: "done",
      progress: 100,
      lowConfWords,
      ocrWords,
      queue,
    });
  },

  setQueueItemResult: (id, text, confidence, errorMsg = "", words = []) => {
    const state = get();
    const status: OcrStatus = errorMsg ? "error" : "done";
    const queue = state.queue.map((item) =>
      item.id === id ? { ...item, status, text, confidence, errorMsg, words } : item
    );
    set({ queue });
  },

  setEditedText: (editedText) => set({ editedText }),

  setCopyDone: (copyDone) => set({ copyDone }),

  setCropRect: (cropRect) => set({ cropRect }),

  setShowWordHighlights: (showWordHighlights) => set({ showWordHighlights }),

  reset: () => {
    const state = get();
    for (const item of state.queue) URL.revokeObjectURL(item.previewUrl);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    // Preserve _idCounter so IDs remain monotonic after reset.
    set({ ...initialState, _idCounter: state._idCounter, language: state.language });
  },
}));
