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

export function defaultUnits(categoryId: CategoryId): { fromUnit: string; toUnit: string } {
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

export function computeResult(
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
  try {
    const result = convert({ value: n, from: fromUnit, to: toUnit, category: cat });
    return {
      resultValue: formatResultHuman(result, fullPrecision),
      resultNumeric: result,
      inputIsInvalid: false,
    };
  } catch {
    // Unknown unit ids (e.g. stale persisted ids that the migration didn't cover):
    // treat as empty result rather than crashing the render.
    return { resultValue: "—", resultNumeric: Number.NaN, inputIsInvalid: false };
  }
}

// ── Persist migration ─────────────────────────────────────────────────────────
//
// v0→v1: PR #56 renamed unit ids that were already persisted in localStorage:
//   mpg  → mpgUS    (fuel; "mpg" is still valid as miles-per-gallon US post-rename)
//   mpguk → mpgUK   (fuel)
//   l100  → l100km  (fuel)
//   ms    → mps     (speed only — "ms" is still valid as millisecond in time)
//
// Without migration, returning users rehydrate stale ids and convert() throws
// "Unknown unit" → blank screen.

interface V0PersistedState {
  categoryId?: string;
  fromUnit?: string;
  toUnit?: string;
  fullPrecision?: boolean;
}

function migrateUnitId(id: string | undefined, categoryId: string | undefined): string | undefined {
  if (!id) return id;
  if (id === "mpg") return "mpgUS";
  if (id === "mpguk") return "mpgUK";
  if (id === "l100") return "l100km";
  // ms → mps only in speed context; in time category "ms" = millisecond (still valid)
  if (id === "ms" && categoryId === "speed") return "mps";
  return id;
}

function migrate(persisted: unknown, fromVersion: number): unknown {
  if (fromVersion < 1) {
    const s = persisted as V0PersistedState;
    const categoryId = s.categoryId;
    s.fromUnit = migrateUnitId(s.fromUnit, categoryId);
    s.toUnit = migrateUnitId(s.toUnit, categoryId);
  }
  return persisted;
}

// ── Store ─────────────────────────────────────────────────────────────────────

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
      version: 1,
      migrate,
      partialize: (s) => ({
        categoryId: s.categoryId,
        fromUnit: s.fromUnit,
        toUnit: s.toUnit,
        fullPrecision: s.fullPrecision,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { fromUnit, toUnit, inputValue, fullPrecision } = state;
        // Validate categoryId: if unknown/non-string, fall back to "length".
        const knownCategoryIds = new Set(CATEGORIES.map((c) => c.id));
        const categoryId: CategoryId =
          typeof state.categoryId === "string" && knownCategoryIds.has(state.categoryId as CategoryId)
            ? (state.categoryId as CategoryId)
            : initialCat;
        if (categoryId !== state.categoryId) state.categoryId = categoryId;

        // Validate unit ids: if not a known id for the category, fall back to defaults.
        const cat = CATEGORIES.find((c) => c.id === categoryId);
        const knownUnitIds = new Set(cat?.units.map((u) => u.id) ?? []);
        const defaults = defaultUnits(categoryId);
        const safeFrom =
          typeof fromUnit === "string" && knownUnitIds.has(fromUnit)
            ? fromUnit
            : defaults.fromUnit;
        const safeTo =
          typeof toUnit === "string" && knownUnitIds.has(toUnit) ? toUnit : defaults.toUnit;
        if (safeFrom !== fromUnit) state.fromUnit = safeFrom;
        if (safeTo !== toUnit) state.toUnit = safeTo;
        Object.assign(
          state,
          computeResult(inputValue, safeFrom, safeTo, categoryId, fullPrecision)
        );
      },
    }
  )
);
