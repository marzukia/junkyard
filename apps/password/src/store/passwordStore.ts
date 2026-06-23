import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PassphraseOptions, PasswordOptions } from "../lib/password";

export type Mode = "random" | "passphrase";

interface PasswordState {
  mode: Mode;

  // Random password settings
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  minDigits: number;
  minSymbols: number;

  // Passphrase settings
  wordCount: number;
  separator: string;
  capitalize: boolean;
  appendNumber: boolean;

  // Output
  count: number; // how many to generate at once

  setMode: (m: Mode) => void;
  setLength: (n: number) => void;
  setUpper: (v: boolean) => void;
  setLower: (v: boolean) => void;
  setDigits: (v: boolean) => void;
  setSymbols: (v: boolean) => void;
  setExcludeAmbiguous: (v: boolean) => void;
  setMinDigits: (n: number) => void;
  setMinSymbols: (n: number) => void;
  setWordCount: (n: number) => void;
  setSeparator: (s: string) => void;
  setCapitalize: (v: boolean) => void;
  setAppendNumber: (v: boolean) => void;
  setCount: (n: number) => void;

  passwordOptions: () => PasswordOptions;
  passphraseOpts: () => Pick<
    PassphraseOptions,
    "wordCount" | "separator" | "capitalize" | "appendNumber"
  >;
}

export const usePasswordStore = create<PasswordState>()(
  persist(
    (set, get) => ({
      mode: "random",

      length: 20,
      upper: true,
      lower: true,
      digits: true,
      symbols: true,
      excludeAmbiguous: false,
      minDigits: 0,
      minSymbols: 0,

      wordCount: 5,
      separator: "-",
      capitalize: false,
      appendNumber: false,

      count: 5,

      setMode: (m) => set({ mode: m }),
      setLength: (n) => set({ length: n }),
      setUpper: (v) => set({ upper: v }),
      setLower: (v) => set({ lower: v }),
      setDigits: (v) => set({ digits: v }),
      setSymbols: (v) => set({ symbols: v }),
      setExcludeAmbiguous: (v) => set({ excludeAmbiguous: v }),
      setMinDigits: (n) => set({ minDigits: n }),
      setMinSymbols: (n) => set({ minSymbols: n }),
      setWordCount: (n) => set({ wordCount: n }),
      setSeparator: (s) => set({ separator: s }),
      setCapitalize: (v) => set({ capitalize: v }),
      setAppendNumber: (v) => set({ appendNumber: v }),
      setCount: (n) => set({ count: n }),

      passwordOptions: () => {
        const s = get();
        return {
          length: s.length,
          upper: s.upper,
          lower: s.lower,
          digits: s.digits,
          symbols: s.symbols,
          excludeAmbiguous: s.excludeAmbiguous,
          minDigits: s.minDigits,
          minSymbols: s.minSymbols,
        };
      },
      passphraseOpts: () => {
        const s = get();
        return {
          wordCount: s.wordCount,
          separator: s.separator,
          capitalize: s.capitalize,
          appendNumber: s.appendNumber,
        };
      },
    }),
    {
      name: "pw-generator-settings",
      // Only persist settings, not derived functions
      partialize: (s) => ({
        mode: s.mode,
        length: s.length,
        upper: s.upper,
        lower: s.lower,
        digits: s.digits,
        symbols: s.symbols,
        excludeAmbiguous: s.excludeAmbiguous,
        minDigits: s.minDigits,
        minSymbols: s.minSymbols,
        wordCount: s.wordCount,
        separator: s.separator,
        capitalize: s.capitalize,
        appendNumber: s.appendNumber,
        count: s.count,
      }),
    }
  )
);
