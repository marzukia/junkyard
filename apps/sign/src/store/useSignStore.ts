import { create } from "zustand";

export type SigMode = "draw" | "type" | "upload";

export const SCRIPT_FONTS = [
  {
    label: "Cursive",
    value: "italic 72px Georgia, 'Times New Roman', serif",
    family: "Georgia, 'Times New Roman', serif",
  },
  {
    label: "Dancing Script",
    value: "italic 72px 'Dancing Script', cursive",
    family: "'Dancing Script', cursive",
  },
  {
    label: "Pacifico",
    value: "72px 'Pacifico', cursive",
    family: "'Pacifico', cursive",
  },
  {
    label: "Great Vibes",
    value: "72px 'Great Vibes', cursive",
    family: "'Great Vibes', cursive",
  },
  {
    label: "Sacramento",
    value: "72px 'Sacramento', cursive",
    family: "'Sacramento', cursive",
  },
] as const;

export type ScriptFontValue = (typeof SCRIPT_FONTS)[number]["value"];

interface SignStore {
  /** Raw PDF bytes loaded from file */
  pdfBytes: ArrayBuffer | null;
  pdfFileName: string;
  /** Total pages in the loaded PDF */
  pageCount: number;
  /** Currently viewed page (0-based) */
  currentPage: number;

  /** Signature PNG data URL (from draw, type, or upload) */
  sigDataUrl: string | null;
  sigMode: SigMode;

  /** Typed text for "type" mode */
  typedText: string;
  /** Font for "type" mode */
  typedFont: ScriptFontValue;
  /** Ink colour for both modes */
  inkColor: string;

  /** Whether signature has been placed on the page */
  placed: boolean;

  /**
   * When true, apply the signature to ALL pages (same position on each).
   * When false, only the currentPage receives it.
   */
  applyToAllPages: boolean;

  /** Date stamp text to embed below the signature (empty = no stamp) */
  dateStampText: string;
  /** Whether the date stamp is enabled */
  dateStampEnabled: boolean;

  /**
   * Saved signature for reuse across sessions.
   * Stored separately so it persists even when the user draws a new one.
   */
  savedSigDataUrl: string | null;
  savedSigMode: SigMode | null;

  setPdfBytes: (bytes: ArrayBuffer, fileName: string, pageCount: number) => void;
  setCurrentPage: (page: number) => void;
  setSigDataUrl: (url: string | null) => void;
  setSigMode: (mode: SigMode) => void;
  setTypedText: (text: string) => void;
  setTypedFont: (font: ScriptFontValue) => void;
  setInkColor: (color: string) => void;
  setPlaced: (placed: boolean) => void;
  setApplyToAllPages: (v: boolean) => void;
  setDateStampEnabled: (v: boolean) => void;
  setDateStampText: (text: string) => void;
  saveSignature: () => void;
  clearSavedSignature: () => void;
  reset: () => void;
}

// Persisted fields (signature + preferences, NOT PDF bytes which can't JSON-serialize cleanly)
const PERSIST_KEY = "sign-tool-prefs-v2";

function loadPersistedPrefs(): {
  sigMode: SigMode;
  inkColor: string;
  typedText: string;
  typedFont: ScriptFontValue;
  savedSigDataUrl: string | null;
  savedSigMode: SigMode | null;
  applyToAllPages: boolean;
  dateStampEnabled: boolean;
  dateStampText: string;
} {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<{
      sigMode: SigMode;
      inkColor: string;
      typedText: string;
      typedFont: ScriptFontValue;
      savedSigDataUrl: string | null;
      savedSigMode: SigMode | null;
      applyToAllPages: boolean;
      dateStampEnabled: boolean;
      dateStampText: string;
    }>;
    return {
      sigMode: parsed.sigMode ?? "draw",
      inkColor: parsed.inkColor ?? "#1a2530",
      typedText: parsed.typedText ?? "",
      typedFont: parsed.typedFont ?? SCRIPT_FONTS[0].value,
      savedSigDataUrl: parsed.savedSigDataUrl ?? null,
      savedSigMode: parsed.savedSigMode ?? null,
      applyToAllPages: parsed.applyToAllPages ?? false,
      dateStampEnabled: parsed.dateStampEnabled ?? false,
      dateStampText: parsed.dateStampText ?? todayISO(),
    };
  } catch {
    return defaults();
  }
}

function defaults() {
  return {
    sigMode: "draw" as SigMode,
    inkColor: "#1a2530",
    typedText: "",
    typedFont: SCRIPT_FONTS[0].value,
    savedSigDataUrl: null as string | null,
    savedSigMode: null as SigMode | null,
    applyToAllPages: false,
    dateStampEnabled: false,
    dateStampText: todayISO(),
  };
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

type PersistShape = {
  sigMode: SigMode;
  inkColor: string;
  typedText: string;
  typedFont: ScriptFontValue;
  savedSigDataUrl: string | null;
  savedSigMode: SigMode | null;
  applyToAllPages: boolean;
  dateStampEnabled: boolean;
  dateStampText: string;
};

function persistPrefs(state: PersistShape) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable -- fail silently
  }
}

const prefs = loadPersistedPrefs();

const INITIAL: Omit<
  SignStore,
  | "setPdfBytes"
  | "setCurrentPage"
  | "setSigDataUrl"
  | "setSigMode"
  | "setTypedText"
  | "setTypedFont"
  | "setInkColor"
  | "setPlaced"
  | "setApplyToAllPages"
  | "setDateStampEnabled"
  | "setDateStampText"
  | "saveSignature"
  | "clearSavedSignature"
  | "reset"
> = {
  pdfBytes: null,
  pdfFileName: "",
  pageCount: 0,
  currentPage: 0,
  sigDataUrl: null,
  sigMode: prefs.sigMode,
  typedText: prefs.typedText,
  typedFont: prefs.typedFont,
  inkColor: prefs.inkColor,
  placed: false,
  applyToAllPages: prefs.applyToAllPages,
  dateStampEnabled: prefs.dateStampEnabled,
  dateStampText: prefs.dateStampText,
  savedSigDataUrl: prefs.savedSigDataUrl,
  savedSigMode: prefs.savedSigMode,
};

function getPersistedShape(s: SignStore): PersistShape {
  return {
    sigMode: s.sigMode,
    inkColor: s.inkColor,
    typedText: s.typedText,
    typedFont: s.typedFont,
    savedSigDataUrl: s.savedSigDataUrl,
    savedSigMode: s.savedSigMode,
    applyToAllPages: s.applyToAllPages,
    dateStampEnabled: s.dateStampEnabled,
    dateStampText: s.dateStampText,
  };
}

export const useSignStore = create<SignStore>((set, get) => ({
  ...INITIAL,
  setPdfBytes: (bytes, fileName, pageCount) =>
    set({ pdfBytes: bytes, pdfFileName: fileName, pageCount, currentPage: 0, placed: false }),
  setCurrentPage: (page) => set({ currentPage: page, placed: false }),
  setSigDataUrl: (url) => set({ sigDataUrl: url, placed: false }),
  setSigMode: (mode) => {
    set({ sigMode: mode, sigDataUrl: null, placed: false });
    persistPrefs(getPersistedShape({ ...get(), sigMode: mode }));
  },
  setTypedText: (text) => {
    set({ typedText: text });
    persistPrefs(getPersistedShape({ ...get(), typedText: text }));
  },
  setTypedFont: (font) => {
    set({ typedFont: font });
    persistPrefs(getPersistedShape({ ...get(), typedFont: font }));
  },
  setInkColor: (color) => {
    set({ inkColor: color });
    persistPrefs(getPersistedShape({ ...get(), inkColor: color }));
  },
  setPlaced: (placed) => set({ placed }),
  setApplyToAllPages: (v) => {
    set({ applyToAllPages: v });
    persistPrefs(getPersistedShape({ ...get(), applyToAllPages: v }));
  },
  setDateStampEnabled: (v) => {
    set({ dateStampEnabled: v });
    persistPrefs(getPersistedShape({ ...get(), dateStampEnabled: v }));
  },
  setDateStampText: (text) => {
    set({ dateStampText: text });
    persistPrefs(getPersistedShape({ ...get(), dateStampText: text }));
  },
  saveSignature: () => {
    const s = get();
    if (!s.sigDataUrl) return;
    const update = { savedSigDataUrl: s.sigDataUrl, savedSigMode: s.sigMode };
    set(update);
    persistPrefs(getPersistedShape({ ...s, ...update }));
  },
  clearSavedSignature: () => {
    const s = get();
    const update = { savedSigDataUrl: null as string | null, savedSigMode: null as SigMode | null };
    set(update);
    persistPrefs(getPersistedShape({ ...s, ...update }));
  },
  reset: () => set({ ...INITIAL }),
}));
