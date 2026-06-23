/**
 * Lifted from apps/units/src/lib/units.ts. Pure math, no browser globals.
 */
import { z } from "zod";
import type { ToolDef } from "./types.js";

export type CategoryId =
  | "length" | "mass" | "temperature" | "area" | "volume"
  | "speed" | "data" | "time" | "pressure" | "energy"
  | "angle" | "power" | "force" | "fuel";

export interface UnitDef { id: string; label: string; symbol: string; toBase: number; }
export interface Category { id: CategoryId; label: string; baseUnit: string; units: UnitDef[]; }

const length: Category = { id: "length", label: "Length", baseUnit: "m", units: [
  { id: "mm", label: "Millimetre", symbol: "mm", toBase: 0.001 },
  { id: "cm", label: "Centimetre", symbol: "cm", toBase: 0.01 },
  { id: "m", label: "Metre", symbol: "m", toBase: 1 },
  { id: "km", label: "Kilometre", symbol: "km", toBase: 1000 },
  { id: "in", label: "Inch", symbol: "in", toBase: 0.0254 },
  { id: "ft", label: "Foot", symbol: "ft", toBase: 0.3048 },
  { id: "yd", label: "Yard", symbol: "yd", toBase: 0.9144 },
  { id: "mi", label: "Mile", symbol: "mi", toBase: 1609.344 },
  { id: "nmi", label: "Nautical mile", symbol: "nmi", toBase: 1852 },
]};

const mass: Category = { id: "mass", label: "Mass", baseUnit: "kg", units: [
  { id: "mg", label: "Milligram", symbol: "mg", toBase: 0.000001 },
  { id: "g", label: "Gram", symbol: "g", toBase: 0.001 },
  { id: "kg", label: "Kilogram", symbol: "kg", toBase: 1 },
  { id: "t", label: "Metric ton", symbol: "t", toBase: 1000 },
  { id: "oz", label: "Ounce", symbol: "oz", toBase: 0.02834952 },
  { id: "lb", label: "Pound", symbol: "lb", toBase: 0.45359237 },
  { id: "st", label: "Stone", symbol: "st", toBase: 6.35029318 },
  { id: "ton", label: "US short ton", symbol: "ton", toBase: 907.18474 },
]};

const TEMP_UNITS = [
  { id: "C", label: "Celsius", symbol: "C", toBase: 1 },
  { id: "F", label: "Fahrenheit", symbol: "F", toBase: 1 },
  { id: "K", label: "Kelvin", symbol: "K", toBase: 1 },
  { id: "R", label: "Rankine", symbol: "R", toBase: 1 },
];
const temperature: Category = { id: "temperature", label: "Temperature", baseUnit: "K", units: TEMP_UNITS };

function tempToKelvin(value: number, fromId: string): number {
  switch (fromId) {
    case "C": return value + 273.15;
    case "F": return (value + 459.67) * (5 / 9);
    case "K": return value;
    case "R": return value * (5 / 9);
    default: throw new Error(`Unknown temperature unit: ${fromId}`);
  }
}

function kelvinToUnit(kelvin: number, toId: string): number {
  switch (toId) {
    case "C": return kelvin - 273.15;
    case "F": return kelvin * (9 / 5) - 459.67;
    case "K": return kelvin;
    case "R": return kelvin * (9 / 5);
    default: throw new Error(`Unknown temperature unit: ${toId}`);
  }
}

const area: Category = { id: "area", label: "Area", baseUnit: "m2", units: [
  { id: "mm2", label: "Square millimetre", symbol: "mm2", toBase: 0.000001 },
  { id: "cm2", label: "Square centimetre", symbol: "cm2", toBase: 0.0001 },
  { id: "m2", label: "Square metre", symbol: "m2", toBase: 1 },
  { id: "km2", label: "Square kilometre", symbol: "km2", toBase: 1_000_000 },
  { id: "in2", label: "Square inch", symbol: "in2", toBase: 0.00064516 },
  { id: "ft2", label: "Square foot", symbol: "ft2", toBase: 0.09290304 },
  { id: "ac", label: "Acre", symbol: "ac", toBase: 4046.8564224 },
  { id: "ha", label: "Hectare", symbol: "ha", toBase: 10000 },
]};

const volume: Category = { id: "volume", label: "Volume", baseUnit: "l", units: [
  { id: "ml", label: "Millilitre", symbol: "ml", toBase: 0.001 },
  { id: "l", label: "Litre", symbol: "l", toBase: 1 },
  { id: "m3", label: "Cubic metre", symbol: "m3", toBase: 1000 },
  { id: "tsp", label: "Teaspoon (US)", symbol: "tsp", toBase: 0.00492892 },
  { id: "tbsp", label: "Tablespoon (US)", symbol: "tbsp", toBase: 0.01478676 },
  { id: "floz", label: "Fluid ounce (US)", symbol: "floz", toBase: 0.02957353 },
  { id: "cup", label: "Cup (US)", symbol: "cup", toBase: 0.2365882 },
  { id: "pt", label: "Pint (US)", symbol: "pt", toBase: 0.4731765 },
  { id: "qt", label: "Quart (US)", symbol: "qt", toBase: 0.946353 },
  { id: "gal", label: "Gallon (US)", symbol: "gal", toBase: 3.785412 },
]};

const speed: Category = { id: "speed", label: "Speed", baseUnit: "ms", units: [
  { id: "ms", label: "Metre/second", symbol: "m/s", toBase: 1 },
  { id: "kmh", label: "Kilometre/hour", symbol: "km/h", toBase: 1 / 3.6 },
  { id: "mph", label: "Mile/hour", symbol: "mph", toBase: 0.44704 },
  { id: "kn", label: "Knot", symbol: "kn", toBase: 0.514444 },
]};

const data: Category = { id: "data", label: "Data", baseUnit: "bit", units: [
  { id: "bit", label: "Bit", symbol: "bit", toBase: 1 },
  { id: "B", label: "Byte", symbol: "B", toBase: 8 },
  { id: "KB", label: "Kilobyte", symbol: "KB", toBase: 8_000 },
  { id: "MB", label: "Megabyte", symbol: "MB", toBase: 8_000_000 },
  { id: "GB", label: "Gigabyte", symbol: "GB", toBase: 8_000_000_000 },
  { id: "TB", label: "Terabyte", symbol: "TB", toBase: 8_000_000_000_000 },
  { id: "GiB", label: "Gibibyte", symbol: "GiB", toBase: 8_589_934_592 },
]};

const time: Category = { id: "time", label: "Time", baseUnit: "s", units: [
  { id: "ns", label: "Nanosecond", symbol: "ns", toBase: 1e-9 },
  { id: "us", label: "Microsecond", symbol: "us", toBase: 1e-6 },
  { id: "ms", label: "Millisecond", symbol: "ms", toBase: 0.001 },
  { id: "s", label: "Second", symbol: "s", toBase: 1 },
  { id: "min", label: "Minute", symbol: "min", toBase: 60 },
  { id: "h", label: "Hour", symbol: "h", toBase: 3600 },
  { id: "d", label: "Day", symbol: "d", toBase: 86400 },
  { id: "wk", label: "Week", symbol: "wk", toBase: 604800 },
  { id: "yr", label: "Year (365d)", symbol: "yr", toBase: 31536000 },
]};

const pressure: Category = { id: "pressure", label: "Pressure", baseUnit: "Pa", units: [
  { id: "Pa", label: "Pascal", symbol: "Pa", toBase: 1 },
  { id: "kPa", label: "Kilopascal", symbol: "kPa", toBase: 1000 },
  { id: "bar", label: "Bar", symbol: "bar", toBase: 100000 },
  { id: "psi", label: "Pounds/sq inch", symbol: "psi", toBase: 6894.757 },
  { id: "atm", label: "Atmosphere", symbol: "atm", toBase: 101325 },
]};

const energy: Category = { id: "energy", label: "Energy", baseUnit: "J", units: [
  { id: "J", label: "Joule", symbol: "J", toBase: 1 },
  { id: "kJ", label: "Kilojoule", symbol: "kJ", toBase: 1000 },
  { id: "cal", label: "Calorie", symbol: "cal", toBase: 4.184 },
  { id: "kcal", label: "Kilocalorie", symbol: "kcal", toBase: 4184 },
  { id: "Wh", label: "Watt-hour", symbol: "Wh", toBase: 3600 },
  { id: "kWh", label: "Kilowatt-hour", symbol: "kWh", toBase: 3_600_000 },
]};

const angle: Category = { id: "angle", label: "Angle", baseUnit: "rad", units: [
  { id: "rad", label: "Radian", symbol: "rad", toBase: 1 },
  { id: "deg", label: "Degree", symbol: "deg", toBase: Math.PI / 180 },
  { id: "grad", label: "Gradian", symbol: "grad", toBase: Math.PI / 200 },
]};

export const CATEGORIES: Category[] = [
  length, mass, temperature, area, volume, speed, data, time, pressure, energy, angle,
];

export function findUnit(unitId: string): { category: Category; unit: UnitDef } | null {
  for (const cat of CATEGORIES) {
    const unit = cat.units.find((u) => u.id === unitId);
    if (unit) return { category: cat, unit };
  }
  return null;
}

export function convert(value: number, fromId: string, toId: string, categoryId?: CategoryId): number {
  if (!Number.isFinite(value)) return Number.NaN;
  if (fromId === toId) return value;

  // Resolve category from unit IDs if not provided
  let cat: Category | undefined;
  if (categoryId) {
    cat = CATEGORIES.find((c) => c.id === categoryId);
  } else {
    const found = findUnit(fromId);
    if (!found) throw new Error(`Unknown unit: ${fromId}`);
    cat = found.category;
  }
  if (!cat) throw new Error(`Unknown category: ${String(categoryId)}`);

  if (cat.id === "temperature") {
    return kelvinToUnit(tempToKelvin(value, fromId), toId);
  }

  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from || !to) throw new Error(`Unknown unit ${fromId} or ${toId} in ${cat.id}`);
  return (value * from.toBase) / to.toBase;
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const unitsTool: ToolDef = {
  slug: "units",
  name: "Unit Converter",
  ops: [
    {
      name: "convert",
      description: "Convert a value between units (length, mass, temperature, area, volume, speed, data, time, pressure, energy, angle)",
      inputSchema: z.object({
        value: z.number(),
        from: z.string(),
        to: z.string(),
        category: z.string().optional(),
      }),
      run({ value, from, to, category }) {
        const result = convert(value, from, to, category as CategoryId | undefined);
        return { result, from, to, value };
      },
    },
  ],
};
