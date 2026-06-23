import { create } from "zustand";
import { type HmacAlgo, type OutputEncoding, hashAll, hmacHex, readFileBytes } from "../lib/hash";
import type { HashResult } from "../lib/hash";

export type InputMode = "text" | "file";
export type ToolMode = "hash" | "hmac";

const STORAGE_KEY = "hash-tool-prefs";

function loadPrefs(): { uppercase: boolean; encoding: OutputEncoding } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { uppercase: false, encoding: "hex" };
    const parsed = JSON.parse(raw) as { uppercase?: boolean; encoding?: OutputEncoding };
    return {
      uppercase: parsed.uppercase === true,
      encoding:
        parsed.encoding === "base64" || parsed.encoding === "base64url" ? parsed.encoding : "hex",
    };
  } catch {
    return { uppercase: false, encoding: "hex" };
  }
}

function savePrefs(prefs: { uppercase: boolean; encoding: OutputEncoding }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export interface HmacResult {
  algo: HmacAlgo;
  hex: string;
}

interface HashStore {
  // inputs
  inputMode: InputMode;
  toolMode: ToolMode;
  text: string;
  file: File | null;
  hmacKey: string;
  hmacAlgo: HmacAlgo;
  // outputs
  result: HashResult | null;
  hmacResult: HmacResult | null;
  loading: boolean;
  error: string | null;
  // display toggles
  uppercase: boolean;
  encoding: OutputEncoding;
  expectedChecksum: string;
  // actions
  setInputMode: (mode: InputMode) => void;
  setToolMode: (mode: ToolMode) => void;
  setText: (v: string) => void;
  clearText: () => void;
  setFile: (f: File) => void;
  clearFile: () => void;
  setUppercase: (v: boolean) => void;
  setEncoding: (v: OutputEncoding) => void;
  setExpectedChecksum: (v: string) => void;
  setHmacKey: (v: string) => void;
  setHmacAlgo: (v: HmacAlgo) => void;
  compute: () => Promise<void>;
}

const prefs = loadPrefs();

export const useHashStore = create<HashStore>((set, get) => ({
  inputMode: "text",
  toolMode: "hash",
  text: "",
  file: null,
  hmacKey: "",
  hmacAlgo: "SHA-256",
  result: null,
  hmacResult: null,
  loading: false,
  error: null,
  uppercase: prefs.uppercase,
  encoding: prefs.encoding,
  expectedChecksum: "",

  setInputMode: (mode) => set({ inputMode: mode, result: null, hmacResult: null, error: null }),
  setToolMode: (mode) =>
    set({ toolMode: mode, result: null, hmacResult: null, error: null, expectedChecksum: "" }),

  setText: (v) => {
    set({ text: v });
    // Auto-compute on each keystroke (debounce handled in component)
  },

  clearText: () => set({ text: "", result: null, hmacResult: null, error: null }),

  setFile: (f) => set({ file: f, result: null, hmacResult: null, error: null }),
  clearFile: () => set({ file: null, result: null, hmacResult: null, error: null }),

  setUppercase: (v) => {
    const { encoding } = get();
    set({ uppercase: v });
    savePrefs({ uppercase: v, encoding });
  },

  setEncoding: (v) => {
    const { uppercase } = get();
    set({ encoding: v });
    savePrefs({ uppercase, encoding: v });
  },

  setExpectedChecksum: (v) => set({ expectedChecksum: v }),
  setHmacKey: (v) => set({ hmacKey: v }),
  setHmacAlgo: (v) => set({ hmacAlgo: v }),

  compute: async () => {
    const { inputMode, toolMode, text, file, hmacKey, hmacAlgo } = get();
    set({ loading: true, error: null, result: null, hmacResult: null });
    try {
      let input: string | ArrayBuffer;
      if (inputMode === "text") {
        input = text;
      } else {
        if (!file) {
          set({ loading: false, error: "No file selected." });
          return;
        }
        input = await readFileBytes(file);
      }

      if (toolMode === "hmac") {
        if (!hmacKey.trim()) {
          set({ loading: false, error: "Enter a secret key to compute HMAC." });
          return;
        }
        const hex = await hmacHex(hmacAlgo, hmacKey, input);
        set({ hmacResult: { algo: hmacAlgo, hex }, loading: false });
      } else {
        const result = await hashAll(input);
        set({ result, loading: false });
      }
    } catch {
      set({ loading: false, error: "Hashing failed. Please try again." });
    }
  },
}));
