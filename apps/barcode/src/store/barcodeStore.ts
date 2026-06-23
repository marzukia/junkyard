import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BarcodeFormat } from "../lib/barcode";
import { FORMAT_META, clampSize } from "../lib/barcode";

export interface BarcodeState {
  format: BarcodeFormat;
  input: string;
  width: number;
  height: number;
  margin: number;
  displayValue: boolean;
  validationError: string | null;

  setFormat: (format: BarcodeFormat) => void;
  setInput: (input: string) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setMargin: (margin: number) => void;
  setDisplayValue: (v: boolean) => void;
}

function validate(format: BarcodeFormat, input: string): string | null {
  if (input.trim().length === 0) return null;
  return FORMAT_META[format].validate(input);
}

// Seed the input with the format placeholder so the tool renders a barcode on first load.
const DEFAULT_FORMAT: BarcodeFormat = "CODE128";
const DEFAULT_INPUT = FORMAT_META[DEFAULT_FORMAT].placeholder;

export const useBarcodeStore = create<BarcodeState>()(
  persist(
    (set, get) => ({
      format: DEFAULT_FORMAT,
      input: DEFAULT_INPUT,
      width: 320,
      height: 100,
      margin: 10,
      displayValue: true,
      validationError: validate(DEFAULT_FORMAT, DEFAULT_INPUT),

      setFormat: (format) => {
        const { input } = get();
        const clamped = clampSize(get(), format);
        set({
          format,
          width: clamped.width,
          height: clamped.height,
          margin: clamped.margin,
          validationError: validate(format, input),
        });
      },

      setInput: (input) => {
        const { format } = get();
        set({ input, validationError: validate(format, input) });
      },

      setWidth: (width) => {
        const { format } = get();
        const clamped = clampSize({ ...get(), width }, format);
        set({ width: clamped.width });
      },

      setHeight: (height) => {
        const { format } = get();
        const clamped = clampSize({ ...get(), height }, format);
        set({ height: clamped.height });
      },

      setMargin: (margin) => {
        const { format } = get();
        const clamped = clampSize({ ...get(), margin }, format);
        set({ margin: clamped.margin });
      },

      setDisplayValue: (displayValue) => set({ displayValue }),
    }),
    {
      name: "barcode-settings",
      // Persist settings and last input but recompute validationError on rehydrate
      partialize: (state) => ({
        format: state.format,
        input: state.input,
        width: state.width,
        height: state.height,
        margin: state.margin,
        displayValue: state.displayValue,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.validationError = validate(state.format, state.input);
        }
      },
    }
  )
);
