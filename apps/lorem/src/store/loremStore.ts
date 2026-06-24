import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WordBank } from "../lib/lorem";

// ── Lorem tab ────────────────────────────────────────────────────────────────

export type LoremMode = "paragraphs" | "sentences" | "words" | "list";
export type ListStyle = "unordered" | "ordered";

export interface LoremState {
  mode: LoremMode;
  count: number;
  listStyle: ListStyle;
  output: string;
  seed: number;
  wordBank: WordBank;
  classicStart: boolean;
  setMode: (mode: LoremMode) => void;
  setCount: (count: number) => void;
  setListStyle: (style: ListStyle) => void;
  setOutput: (output: string) => void;
  regenerate: () => void;
  setWordBank: (bank: WordBank) => void;
  setClassicStart: (v: boolean) => void;
}

// ── Placeholder tab ──────────────────────────────────────────────────────────

export type PlaceholderFormat = "svg" | "png";

export interface PlaceholderState {
  width: number;
  height: number;
  bgColor: string;
  textColor: string;
  label: string;
  format: PlaceholderFormat;
  setWidth: (w: number) => void;
  setHeight: (h: number) => void;
  setBgColor: (c: string) => void;
  setTextColor: (c: string) => void;
  setLabel: (l: string) => void;
  setFormat: (f: PlaceholderFormat) => void;
}

// ── Active tab ───────────────────────────────────────────────────────────────

export type ActiveTab = "lorem" | "placeholder";

export interface TabState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

// ── Combined store ───────────────────────────────────────────────────────────

type LoremStore = LoremState & PlaceholderState & TabState;

export const useLoremStore = create<LoremStore>()(
  persist(
    (set) => ({
      // Lorem state
      mode: "paragraphs",
      count: 3,
      listStyle: "unordered",
      output: "",
      seed: Date.now(),
      wordBank: "classic" as WordBank,
      classicStart: false,
      setMode: (mode) => set((s) => {
        const maxCount = mode === "words" ? 200 : mode === "list" ? 30 : 20;
        const clampedCount = Math.min(s.count, maxCount);
        return { mode, count: clampedCount };
      }),
      setCount: (count) => set({ count }),
      setListStyle: (listStyle) => set({ listStyle }),
      setOutput: (output) => set({ output }),
      regenerate: () => set({ seed: Date.now() }),
      setWordBank: (wordBank) => set({ wordBank }),
      setClassicStart: (classicStart) => set({ classicStart }),

      // Placeholder state
      width: 800,
      height: 600,
      bgColor: "#cccccc",
      textColor: "#333333",
      label: "",
      format: "svg",
      setWidth: (width) => set({ width }),
      setHeight: (height) => set({ height }),
      setBgColor: (bgColor) => set({ bgColor }),
      setTextColor: (textColor) => set({ textColor }),
      setLabel: (label) => set({ label }),
      setFormat: (format) => set({ format }),

      // Tab state
      activeTab: "lorem",
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    {
      name: "lorem-tool-settings",
      // Version 0 is explicit so Zustand's version-mismatch guard never fires
      // against state written by this same schema. Bump version + add migrate()
      // if a field rename or removal ever changes the stored shape.
      version: 0,
      // Persist user choices; exclude ephemeral output/seed (regenerated on load)
      partialize: (state) => ({
        mode: state.mode,
        count: state.count,
        listStyle: state.listStyle,
        activeTab: state.activeTab,
        wordBank: state.wordBank,
        classicStart: state.classicStart,
        width: state.width,
        height: state.height,
        bgColor: state.bgColor,
        textColor: state.textColor,
        label: state.label,
        format: state.format,
      }),
    }
  )
);
