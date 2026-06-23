import { create } from "zustand";
import type { EncodingMode } from "../lib/base64";

export type Direction = "encode" | "decode";

// Persisted keys — only mode + direction + gzip option survive page reload; input is ephemeral
const STORAGE_KEY = "b64-prefs";

const VALID_MODES: EncodingMode[] = ["base64", "base64url", "url", "hex"];

function loadPersistedPrefs(): { mode: EncodingMode; direction: Direction; gzip: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "base64", direction: "encode", gzip: false };
    const parsed = JSON.parse(raw) as Partial<{
      mode: EncodingMode;
      direction: Direction;
      gzip: boolean;
    }>;
    const mode: EncodingMode =
      parsed.mode && VALID_MODES.includes(parsed.mode) ? parsed.mode : "base64";
    const direction: Direction = parsed.direction === "decode" ? "decode" : "encode";
    const gzip = parsed.gzip === true;
    return { mode, direction, gzip };
  } catch {
    return { mode: "base64", direction: "encode", gzip: false };
  }
}

function persistPrefs(mode: EncodingMode, direction: Direction, gzip: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, direction, gzip }));
  } catch {
    // Storage may be unavailable (private browsing quota, etc.)
  }
}

interface Base64State {
  mode: EncodingMode;
  direction: Direction;
  /** Gzip-then-base64 option — only applies when mode is "base64" or "base64url" */
  gzip: boolean;
  inputText: string;
  outputText: string;
  error: string | null;
  // File tab state
  fileDataUrl: string | null;
  fileName: string | null;
  fileMime: string | null;
  fileBase64Output: string | null;

  setMode: (mode: EncodingMode) => void;
  setDirection: (direction: Direction) => void;
  setGzip: (gzip: boolean) => void;
  setInputText: (text: string) => void;
  setOutputText: (text: string) => void;
  setError: (error: string | null) => void;
  clearText: () => void;
  setFile: (dataUrl: string, name: string, mime: string) => void;
  setFileBase64Output: (b64: string | null) => void;
  clearFile: () => void;
}

const { mode: savedMode, direction: savedDirection, gzip: savedGzip } = loadPersistedPrefs();

export const useBase64Store = create<Base64State>()((set, get) => ({
  mode: savedMode,
  direction: savedDirection,
  gzip: savedGzip,
  inputText: "",
  outputText: "",
  error: null,
  fileDataUrl: null,
  fileName: null,
  fileMime: null,
  fileBase64Output: null,

  setMode: (mode) => {
    set({ mode });
    persistPrefs(mode, get().direction, get().gzip);
  },
  setDirection: (direction) => {
    set({ direction });
    persistPrefs(get().mode, direction, get().gzip);
  },
  setGzip: (gzip) => {
    set({ gzip });
    persistPrefs(get().mode, get().direction, gzip);
  },
  setInputText: (inputText) => set({ inputText }),
  setOutputText: (outputText) => set({ outputText }),
  setError: (error) => set({ error }),
  clearText: () => set({ inputText: "", outputText: "", error: null }),
  setFile: (fileDataUrl, fileName, fileMime) =>
    set({ fileDataUrl, fileName, fileMime, fileBase64Output: null }),
  setFileBase64Output: (fileBase64Output) => set({ fileBase64Output }),
  clearFile: () =>
    set({ fileDataUrl: null, fileName: null, fileMime: null, fileBase64Output: null }),
}));
