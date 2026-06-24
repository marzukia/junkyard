// ── Unit conversion tables ───────────────────────────────────────────────────
//
// The conversion tables, unit ids, and convert() function are vendored from
// kit/lib/unitsData.ts via scripts/vendor-units.mjs. Do NOT edit unitsData.ts
// here — edit kit/lib/unitsData.ts and re-run the vendor script.
//
// This file provides app-specific helpers on top of the canonical data:
//   getCommonConversions, formatResult, formatResultHuman.
//
// Design note: the React layer (App.tsx, store) never touches raw numbers —
// it calls convert() and getCommonConversions() only.
//

export type { CategoryId, UnitDef, Category, ConvertOptions } from "./unitsData";
export { CATEGORIES, getCategoryById, findUnit, TEMP_UNITS, convert } from "./unitsData";

import { CATEGORIES, getCategoryById, convert } from "./unitsData";
import type { CategoryId } from "./unitsData";

// ── Common conversions (quick reference) ─────────────────────────────────────

export interface CommonConversion {
  label: string;
  from: { value: number; unit: string };
  to: { value: number; unit: string };
}

/**
 * Returns a list of well-known conversions for a given category,
 * useful for a "common conversions" quick-reference panel.
 */
export function getCommonConversions(categoryId: CategoryId): CommonConversion[] {
  function p(v: number, f: string, t: string): CommonConversion | null {
    return pair(v, f, t, categoryId);
  }
  function notNull(c: CommonConversion | null): c is CommonConversion {
    return c !== null;
  }

  switch (categoryId) {
    case "length":
      return [
        p(1, "mi", "km"),
        p(1, "km", "mi"),
        p(1, "ft", "m"),
        p(1, "m", "ft"),
        p(1, "in", "cm"),
        p(1, "yd", "m"),
      ].filter(notNull);
    case "mass":
      return [
        p(1, "lb", "kg"),
        p(1, "kg", "lb"),
        p(1, "oz", "g"),
        p(1, "st", "kg"),
        p(1, "t", "lb"),
        p(1, "ton", "kg"),
      ].filter(notNull);
    case "temperature":
      return [
        tempPair(0, "C", "F"),
        tempPair(100, "C", "F"),
        tempPair(32, "F", "C"),
        tempPair(212, "F", "C"),
        tempPair(0, "C", "K"),
        tempPair(-40, "C", "F"),
      ];
    case "area":
      return [
        p(1, "ac", "ha"),
        p(1, "ha", "ac"),
        p(1, "km2", "m2"),
        p(1, "ft2", "m2"),
        p(1, "m2", "ft2"),
        p(1, "yd2", "m2"),
      ].filter(notNull);
    case "volume":
      return [
        p(1, "gal", "l"),
        p(1, "l", "gal"),
        p(1, "cup", "ml"),
        p(1, "floz", "ml"),
        p(1, "pt", "l"),
        p(1, "qt", "l"),
      ].filter(notNull);
    case "speed":
      return [
        p(1, "mph", "kmh"),
        p(1, "kmh", "mph"),
        p(1, "kn", "kmh"),
        p(1, "mps", "kmh"),  // canonical: mps (not ms)
        p(100, "kmh", "mph"),
        p(60, "mph", "kmh"),
      ].filter(notNull);
    case "data":
      return [
        p(1, "GB", "GiB"),
        p(1, "GiB", "GB"),
        p(1, "TB", "TiB"),
        p(1, "MB", "MiB"),
        p(1, "GB", "MB"),
        p(1, "TB", "GB"),
      ].filter(notNull);
    case "time":
      return [
        p(1, "h", "min"),
        p(1, "d", "h"),
        p(1, "wk", "d"),
        p(1, "yr", "d"),
        p(1, "mo", "d"),
        p(60, "min", "h"),
      ].filter(notNull);
    case "pressure":
      return [
        p(1, "atm", "kPa"),
        p(1, "bar", "psi"),
        p(1, "psi", "kPa"),
        p(1, "atm", "psi"),
        p(1, "mmHg", "Pa"),
        p(1, "MPa", "bar"),
      ].filter(notNull);
    case "energy":
      return [
        p(1, "kcal", "kJ"),
        p(1, "kJ", "kcal"),
        p(1, "kWh", "MJ"),
        p(1, "BTU", "kJ"),
        p(1, "Wh", "kJ"),
        p(1, "J", "cal"),
      ].filter(notNull);
    case "angle":
      return [
        p(180, "deg", "rad"),
        p(1, "rad", "deg"),
        p(360, "deg", "rev"),
        p(1, "rev", "deg"),
        p(90, "deg", "grad"),
        p(1, "deg", "arcmin"),
      ].filter(notNull);
    case "power":
      return [
        p(1, "hp", "kW"),
        p(1, "kW", "hp"),
        p(1, "W", "BTUh"),
        p(1, "kW", "W"),
        p(1, "MW", "kW"),
        p(1, "kW", "kcalh"),
      ].filter(notNull);
    case "force":
      return [
        p(1, "lbf", "N"),
        p(1, "N", "lbf"),
        p(1, "kgf", "N"),
        p(1, "kN", "lbf"),
        p(1, "MN", "kN"),
        p(1, "N", "kgf"),
      ].filter(notNull);
    case "fuel":
      return [
        p(1, "mpgUS", "kml"),   // canonical: mpgUS (not mpg)
        p(1, "kml", "mpgUS"),
        p(10, "l100km", "mpgUS"),  // canonical: l100km (not l100)
        p(30, "mpgUS", "l100km"),
        p(1, "mpgUK", "kml"),   // canonical: mpgUK (not mpguk)
        p(1, "kml", "l100km"),
      ].filter(notNull);
    default:
      return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSymbol(categoryId: CategoryId, unitId: string): string {
  const cat = getCategoryById(categoryId);
  return cat.units.find((u) => u.id === unitId)?.symbol ?? unitId;
}

function pair(
  value: number,
  fromId: string,
  toId: string,
  categoryId: CategoryId
): CommonConversion | null {
  try {
    const result = convert({ value, from: fromId, to: toId, category: categoryId });
    return {
      label: `${value} ${getSymbol(categoryId, fromId)} → ${getSymbol(categoryId, toId)}`,
      from: { value, unit: getSymbol(categoryId, fromId) },
      to: { value: result, unit: getSymbol(categoryId, toId) },
    };
  } catch {
    return null;
  }
}

function tempPair(value: number, fromId: string, toId: string): CommonConversion {
  const cat = getCategoryById("temperature");
  const fromSym = cat.units.find((u) => u.id === fromId)?.symbol ?? fromId;
  const toSym = cat.units.find((u) => u.id === toId)?.symbol ?? toId;
  const result = convert({ value, from: fromId, to: toId, category: "temperature" });
  return {
    label: `${value}${fromSym} → ${toSym}`,
    from: { value, unit: fromSym },
    to: { value: result, unit: toSym },
  };
}

// ── Number formatting ─────────────────────────────────────────────────────────

/**
 * Format a conversion result for display.
 * - Very large / very small -> scientific notation
 * - Otherwise -> up to 8 significant figures, no trailing zeros
 *
 * This is the raw/full-precision variant used internally and by legacy callers.
 */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
    return n.toExponential(6).replace(/\.?0+e/, "e");
  }
  // toPrecision(8) then strip trailing zeros
  const s = n.toPrecision(8);
  // Remove trailing zeros after decimal point
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * Format a result for human-readable display: thousands separators, sensible
 * rounding (6 significant figures), with scientific notation only for extreme
 * values. Pass fullPrecision=true to fall back to formatResult.
 */
export function formatResultHuman(n: number, fullPrecision = false): string {
  if (!Number.isFinite(n)) return "—";
  if (fullPrecision) return formatResult(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);

  // Extreme values: use scientific notation
  if (abs >= 1e15 || abs < 1e-9) {
    return n.toExponential(4).replace(/\.?0+e/, "e");
  }

  // For values that benefit from sig-fig rounding (not near-integers)
  // Use 6 significant figures, then apply locale thousands separator
  const rounded = Number.parseFloat(n.toPrecision(6));

  // Use Intl for thousands separators; cap decimal places sensibly
  const decimals = (() => {
    if (abs >= 1000) return 2;
    if (abs >= 1) return 4;
    if (abs >= 0.01) return 6;
    return 8;
  })();

  return rounded.toLocaleString("en", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}
