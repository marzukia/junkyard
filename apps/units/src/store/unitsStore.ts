import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATEGORIES, convert, formatResultHuman } from "../lib/units";
import type { CategoryId } from "../lib/units";

interface UnitsState {
  categoryId: CategoryId;
  fromUnit: string;
  toUnit: string;
  inputValue: string;
  /** Formatted result string, or "—" if invalid */
  resultValue: string;
  /** Raw numeric result, or NaN */
  resultNumeric: number;
  /** Whether the input is non-numeric (so we can show a hint) */
  inputIsInvalid: boolean;
  /** Show full precision instead of human-rounded format */
  fullPrecision: boolean;

  setCategory: (id: CategoryId) => void;
  setFromUnit: (id: string) => void;
  setToUnit: (id: string) => void;
  setInputValue: (v: string) => void;
  swap: () => void;
  togglePrecision: () => void;
}

function defaultUnits(categoryId: CategoryId): { fromUnit: string; toUnit: string } {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return { fromUnit: "", toUnit: "" };
  switch (categoryId) {
    case "length":
      return { fromUnit: "m", toUnit: "ft" };
    case "mass":
      return { fromUnit: "kg", toUnit: "lb" };
    case "temperature":
      return { fromUnit: "C", toUnit: "F" };
    case "area":
      return { fromUnit: "m2", toUnit: "ft2" };
    case "volume":
      return { fromUnit: "l", toUnit: "gal" };
    case "speed":
      return { fromUnit: "kmh", toUnit: "mph" };
    case "data":
      return { fromUnit: "GB", toUnit: "GiB" };
    case "time":
      return { fromUnit: "h", toUnit: "min" };
    case "pressure":
      return { fromUnit: "atm", toUnit: "kPa" };
    case "energy":
      return { fromUnit: "kJ", toUnit: "kcal" };
    case "angle":
      return { fromUnit: "deg", toUnit: "rad" };
    case "power":
      return { fromUnit: "kW", toUnit: "hp" };
    case "force":
      return { fromUnit: "N", toUnit: "lbf" };
    case "fuel":
      return { fromUnit: "mpgUS", toUnit: "kml" };  // canonical: mpgUS (not mpg)
  }
}

interface ComputeResult {
  resultValue: string;
  resultNumeric: number;
  inputIsInvalid: boolean;
}

function computeResult(
  value: string,
  fromUnit: string,
  toUnit: string,
  cat: CategoryId,
  fullPrecision: boolean
): ComputeResult {
  const trimmed = value.trim();
  if (trimmed === "") {
    return { resultValue: "—", resultNumeric: Number.NaN, inputIsInvalid: false };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { resultValue: "—", resultNumeric: Number.NaN, inputIsInvalid: true };
  }
  const result = convert({ value: n, from: fromUnit, to: toUnit, category: cat });
  return {
    resultValue: formatResultHuman(result, fullPrecision),
    resultNumeric: result,
    inputIsInvalid: false,
  };
}

const initialCat: CategoryId = "length";
const { fromUnit: defaultFrom, toUnit: defaultTo } = defaultUnits(initialCat);

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set, get) => {
      const inputValue = "1";
      const fullPrecision = false;

      return {
        categoryId: initialCat,
        fromUnit: defaultFrom,
        toUnit: defaultTo,
        inputValue,
        fullPrecision,
        ...computeResult(inputValue, defaultFrom, defaultTo, initialCat, fullPrecision),

        setCategory(id) {
          // Reset input to "1" when category changes so we never show a stale
          // result for a value that made sense in the old category but is
          // confusing in the new one.
          const { fromUnit: f, toUnit: t } = defaultUnits(id);
          const { fullPrecision: fp } = get();
          const newInput = "1";
          set({
            categoryId: id,
            fromUnit: f,
            toUnit: t,
            inputValue: newInput,
            ...computeResult(newInput, f, t, id, fp),
          });
        },

        setFromUnit(id) {
          const { inputValue: v, toUnit, categoryId, fullPrecision: fp } = get();
          set({ fromUnit: id, ...computeResult(v, id, toUnit, categoryId, fp) });
        },

        setToUnit(id) {
          const { inputValue: v, fromUnit, categoryId, fullPrecision: fp } = get();
          set({ toUnit: id, ...computeResult(v, fromUnit, id, categoryId, fp) });
        },

        setInputValue(v) {
          const { fromUnit, toUnit, categoryId, fullPrecision: fp } = get();
          set({ inputValue: v, ...computeResult(v, fromUnit, toUnit, categoryId, fp) });
        },

        swap() {
          const {
            fromUnit,
            toUnit,
            resultNumeric,
            inputValue,
            categoryId,
            fullPrecision: fp,
          } = get();
          // After swap, the old result becomes the new input (use raw numeric to
          // avoid reformatting artefacts). Fall back to current input if no result.
          const newInput = Number.isFinite(resultNumeric) ? String(resultNumeric) : inputValue;
          set({
            fromUnit: toUnit,
            toUnit: fromUnit,
            inputValue: newInput,
            ...computeResult(newInput, toUnit, fromUnit, categoryId, fp),
          });
        },

        togglePrecision() {
          const { inputValue, fromUnit, toUnit, categoryId, fullPrecision: fp } = get();
          const next = !fp;
          set({
            fullPrecision: next,
            ...computeResult(inputValue, fromUnit, toUnit, categoryId, next),
          });
        },
      };
    },
    {
      name: "units-prefs",
      partialize: (s) => ({
        categoryId: s.categoryId,
        fromUnit: s.fromUnit,
        toUnit: s.toUnit,
        fullPrecision: s.fullPrecision,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { categoryId, fromUnit, toUnit, inputValue, fullPrecision } = state;
        Object.assign(
          state,
          computeResult(inputValue, fromUnit, toUnit, categoryId, fullPrecision)
        );
      },
    }
  )
);
