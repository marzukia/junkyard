import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "split" | "inline";
export type DiffLevel = "line" | "word";

interface DiffState {
  leftText: string;
  rightText: string;
  viewMode: ViewMode;
  diffLevel: DiffLevel;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  setLeftText: (text: string) => void;
  setRightText: (text: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setDiffLevel: (level: DiffLevel) => void;
  setIgnoreWhitespace: (v: boolean) => void;
  setIgnoreCase: (v: boolean) => void;
  swap: () => void;
  clear: () => void;
}

export const useDiffStore = create<DiffState>()(
  persist(
    (set, get) => ({
      leftText: "",
      rightText: "",
      viewMode: "split",
      diffLevel: "word",
      ignoreWhitespace: false,
      ignoreCase: false,
      setLeftText: (text) => set({ leftText: text }),
      setRightText: (text) => set({ rightText: text }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setDiffLevel: (level) => set({ diffLevel: level }),
      setIgnoreWhitespace: (v) => set({ ignoreWhitespace: v }),
      setIgnoreCase: (v) => set({ ignoreCase: v }),
      swap: () => {
        const { leftText, rightText } = get();
        set({ leftText: rightText, rightText: leftText });
      },
      clear: () => set({ leftText: "", rightText: "" }),
    }),
    {
      name: "diff-prefs",
      // Only persist user preferences, not the text content
      partialize: (state) => ({
        viewMode: state.viewMode,
        diffLevel: state.diffLevel,
        ignoreWhitespace: state.ignoreWhitespace,
        ignoreCase: state.ignoreCase,
      }),
    }
  )
);
