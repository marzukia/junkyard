import { create } from "zustand";

export type Phase = "idle" | "model-loading" | "processing" | "done" | "error";

/** Monotonic phase rank: higher = further along the pipeline. */
const PHASE_RANK: Record<Phase, number> = {
  idle: 0,
  "model-loading": 1,
  processing: 2,
  done: 3,
  error: 3,
};
export type InputMode = "file" | "url";

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface CaptionState {
  phase: Phase;
  inputMode: InputMode;
  inputFile: File | null;
  inputUrl: string | null;
  urlInput: string;
  caption: string | null;
  /** Editable copy of the caption in the alt-text textarea */
  editedCaption: string | null;
  /** Additional candidate captions (when numCaptions > 1) */
  candidates: string[];
  /** Which candidate is selected (0 = primary) */
  selectedIndex: number;
  errorMsg: string | null;
  modelProgress: ModelProgress;
  copied: boolean;
  copiedAlt: boolean;
  /** How many variations to generate (1-3) */
  numCaptions: number;
  // actions
  setInputFile: (file: File, url: string) => void;
  setInputMode: (mode: InputMode) => void;
  setUrlInput: (url: string) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setCaption: (caption: string, candidates: string[]) => void;
  setEditedCaption: (caption: string) => void;
  selectCandidate: (index: number) => void;
  setError: (msg: string) => void;
  setCopied: (copied: boolean) => void;
  setCopiedAlt: (copied: boolean) => void;
  setNumCaptions: (n: number) => void;
  reset: () => void;
}

const INITIAL: Pick<
  CaptionState,
  | "phase"
  | "inputMode"
  | "inputFile"
  | "inputUrl"
  | "urlInput"
  | "caption"
  | "editedCaption"
  | "candidates"
  | "selectedIndex"
  | "errorMsg"
  | "modelProgress"
  | "copied"
  | "copiedAlt"
  | "numCaptions"
> = {
  phase: "idle",
  inputMode: "file",
  inputFile: null,
  inputUrl: null,
  urlInput: "",
  caption: null,
  editedCaption: null,
  candidates: [],
  selectedIndex: 0,
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  copied: false,
  copiedAlt: false,
  numCaptions: 1,
};

export const useCaptionStore = create<CaptionState>((set, get) => ({
  ...INITIAL,

  setInputFile: (file, url) => {
    // Revoke the prior input blob before replacing to prevent object-URL leaks.
    const prior = get().inputUrl;
    if (prior) URL.revokeObjectURL(prior);
    set({
      inputFile: file,
      inputUrl: url,
      caption: null,
      editedCaption: null,
      candidates: [],
      selectedIndex: 0,
      errorMsg: null,
      copied: false,
      copiedAlt: false,
    });
  },

  setInputMode: (mode) => set({ inputMode: mode }),

  setUrlInput: (urlInput) => set({ urlInput }),

  setPhase: (phase) =>
    set((s) =>
      phase === "idle" || PHASE_RANK[phase] >= PHASE_RANK[s.phase] ? { phase } : {}
    ),

  setModelProgress: (loaded, total, status) => set({ modelProgress: { loaded, total, status } }),

  setCaption: (caption, candidates) =>
    set({ caption, editedCaption: caption, candidates, selectedIndex: 0, phase: "done" }),

  setEditedCaption: (editedCaption) => set({ editedCaption }),

  selectCandidate: (index) =>
    set((s) => {
      const allCaptions = [s.caption, ...s.candidates].filter(Boolean) as string[];
      const chosen = allCaptions[index] ?? s.caption ?? "";
      return { selectedIndex: index, editedCaption: chosen };
    }),

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  setCopied: (copied) => set({ copied }),

  setCopiedAlt: (copiedAlt) => set({ copiedAlt }),

  setNumCaptions: (numCaptions) => set({ numCaptions }),

  reset: () => set({ ...INITIAL }),
}));
