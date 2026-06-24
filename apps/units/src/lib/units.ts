// ── Unit conversion tables ───────────────────────────────────────────────────
//
// Each category uses a "base unit" strategy: every unit has a toBase factor
// (multiply value by this to get base) and a fromBase factor (multiply base to
// get unit). Temperature is special-cased because it requires affine transforms
// (offset + scale), not just scale.
//
// Design note: this file is the single source of truth for all conversion maths.
// The React layer (App.tsx, store) never touches raw numbers — it calls convert()
// and getCommonConversions() only.
//

export type CategoryId =
  | "length"
  | "mass"
  | "temperature"
  | "area"
  | "volume"
  | "speed"
  | "data"
  | "time"
  | "pressure"
  | "energy"
  | "angle"
  | "power"
  | "force"
  | "fuel";

export interface UnitDef {
  id: string;
  label: string;
  symbol: string;
  /** Factor to convert this unit → base unit. For temperature, ignored (handled separately). */
  toBase: number;
}

export interface Category {
  id: CategoryId;
  label: string;
  /** Base unit id (the one with toBase === 1) */
  baseUnit: string;
  units: UnitDef[];
}

// ── Length (base: metre) ─────────────────────────────────────────────────────
const length: Category = {
  id: "length",
  label: "Length",
  baseUnit: "m",
  units: [
    { id: "mm", label: "Millimetre", symbol: "mm", toBase: 0.001 },
    { id: "cm", label: "Centimetre", symbol: "cm", toBase: 0.01 },
    { id: "m", label: "Metre", symbol: "m", toBase: 1 },
    { id: "km", label: "Kilometre", symbol: "km", toBase: 1000 },
    { id: "in", label: "Inch", symbol: "in", toBase: 0.0254 },
    { id: "ft", label: "Foot", symbol: "ft", toBase: 0.3048 },
    { id: "yd", label: "Yard", symbol: "yd", toBase: 0.9144 },
    { id: "mi", label: "Mile", symbol: "mi", toBase: 1609.344 },
    { id: "nmi", label: "Nautical mile", symbol: "nmi", toBase: 1852 },
  ],
};

// ── Mass (base: kilogram) ────────────────────────────────────────────────────
const mass: Category = {
  id: "mass",
  label: "Mass",
  baseUnit: "kg",
  units: [
    { id: "mg", label: "Milligram", symbol: "mg", toBase: 0.000001 },
    { id: "g", label: "Gram", symbol: "g", toBase: 0.001 },
    { id: "kg", label: "Kilogram", symbol: "kg", toBase: 1 },
    { id: "t", label: "Metric ton", symbol: "t", toBase: 1000 },
    { id: "oz", label: "Ounce", symbol: "oz", toBase: 0.02834952 },
    { id: "lb", label: "Pound", symbol: "lb", toBase: 0.45359237 },
    { id: "st", label: "Stone", symbol: "st", toBase: 6.35029318 },
    { id: "ton", label: "US short ton", symbol: "ton", toBase: 907.18474 },
  ],
};

// ── Temperature (special-cased) ──────────────────────────────────────────────
// Conversion goes through Kelvin as the base.
export const TEMP_UNITS = [
  { id: "C", label: "Celsius", symbol: "°C" },
  { id: "F", label: "Fahrenheit", symbol: "°F" },
  { id: "K", label: "Kelvin", symbol: "K" },
  { id: "R", label: "Rankine", symbol: "°R" },
] as const;

function tempToKelvin(value: number, fromId: string): number {
  switch (fromId) {
    case "C":
      return value + 273.15;
    case "F":
      return (value + 459.67) * (5 / 9);
    case "K":
      return value;
    case "R":
      return value * (5 / 9);
    default:
      throw new Error(`Unknown temperature unit: ${fromId}`);
  }
}

function kelvinToUnit(kelvin: number, toId: string): number {
  switch (toId) {
    case "C":
      return kelvin - 273.15;
    case "F":
      return kelvin * (9 / 5) - 459.67;
    case "K":
      return kelvin;
    case "R":
      return kelvin * (9 / 5);
    default:
      throw new Error(`Unknown temperature unit: ${toId}`);
  }
}

const temperature: Category = {
  id: "temperature",
  label: "Temperature",
  baseUnit: "K",
  units: TEMP_UNITS.map((u) => ({ ...u, toBase: 1 })), // toBase unused for temp
};

// ── Area (base: square metre) ────────────────────────────────────────────────
const area: Category = {
  id: "area",
  label: "Area",
  baseUnit: "m2",
  units: [
    { id: "mm2", label: "Square millimetre", symbol: "mm²", toBase: 0.000001 },
    { id: "cm2", label: "Square centimetre", symbol: "cm²", toBase: 0.0001 },
    { id: "m2", label: "Square metre", symbol: "m²", toBase: 1 },
    { id: "km2", label: "Square kilometre", symbol: "km²", toBase: 1_000_000 },
    { id: "in2", label: "Square inch", symbol: "in²", toBase: 0.00064516 },
    { id: "ft2", label: "Square foot", symbol: "ft²", toBase: 0.09290304 },
    { id: "yd2", label: "Square yard", symbol: "yd²", toBase: 0.83612736 },
    { id: "ac", label: "Acre", symbol: "ac", toBase: 4046.8564224 },
    { id: "ha", label: "Hectare", symbol: "ha", toBase: 10000 },
  ],
};

// ── Volume (base: litre) ─────────────────────────────────────────────────────
const volume: Category = {
  id: "volume",
  label: "Volume",
  baseUnit: "l",
  units: [
    { id: "ml", label: "Millilitre", symbol: "ml", toBase: 0.001 },
    { id: "cl", label: "Centilitre", symbol: "cl", toBase: 0.01 },
    { id: "l", label: "Litre", symbol: "l", toBase: 1 },
    { id: "m3", label: "Cubic metre", symbol: "m³", toBase: 1000 },
    { id: "tsp", label: "Teaspoon (US)", symbol: "tsp", toBase: 0.00492892 },
    { id: "tbsp", label: "Tablespoon (US)", symbol: "tbsp", toBase: 0.01478676 },
    { id: "floz", label: "Fluid ounce (US)", symbol: "fl oz", toBase: 0.02957353 },
    { id: "cup", label: "Cup (US)", symbol: "cup", toBase: 0.2365882 },
    { id: "pt", label: "Pint (US)", symbol: "pt", toBase: 0.4731765 },
    { id: "qt", label: "Quart (US)", symbol: "qt", toBase: 0.946353 },
    { id: "gal", label: "Gallon (US)", symbol: "gal", toBase: 3.785412 },
  ],
};

// ── Speed (base: metre per second) ──────────────────────────────────────────
const speed: Category = {
  id: "speed",
  label: "Speed",
  baseUnit: "ms",
  units: [
    { id: "ms", label: "Metre/second", symbol: "m/s", toBase: 1 },
    { id: "kmh", label: "Kilometre/hour", symbol: "km/h", toBase: 1 / 3.6 },
    { id: "mph", label: "Mile/hour", symbol: "mph", toBase: 0.44704 },
    { id: "kn", label: "Knot", symbol: "kn", toBase: 0.514444 },
    { id: "fts", label: "Foot/second", symbol: "ft/s", toBase: 0.3048 },
  ],
};

// ── Data (base: bit) ──────────────────────────────────────────────────────────
const data: Category = {
  id: "data",
  label: "Data",
  baseUnit: "bit",
  units: [
    { id: "bit", label: "Bit", symbol: "bit", toBase: 1 },
    { id: "B", label: "Byte", symbol: "B", toBase: 8 },
    { id: "KB", label: "Kilobyte", symbol: "KB", toBase: 8_000 },
    { id: "MB", label: "Megabyte", symbol: "MB", toBase: 8_000_000 },
    { id: "GB", label: "Gigabyte", symbol: "GB", toBase: 8_000_000_000 },
    { id: "TB", label: "Terabyte", symbol: "TB", toBase: 8_000_000_000_000 },
    { id: "PB", label: "Petabyte", symbol: "PB", toBase: 8_000_000_000_000_000 },
    { id: "KiB", label: "Kibibyte", symbol: "KiB", toBase: 8_192 },
    { id: "MiB", label: "Mebibyte", symbol: "MiB", toBase: 8_388_608 },
    { id: "GiB", label: "Gibibyte", symbol: "GiB", toBase: 8_589_934_592 },
    { id: "TiB", label: "Tebibyte", symbol: "TiB", toBase: 8_796_093_022_208 },
  ],
};

// ── Time (base: second) ───────────────────────────────────────────────────────
const time: Category = {
  id: "time",
  label: "Time",
  baseUnit: "s",
  units: [
    { id: "ns", label: "Nanosecond", symbol: "ns", toBase: 1e-9 },
    { id: "us", label: "Microsecond", symbol: "μs", toBase: 1e-6 },
    { id: "ms", label: "Millisecond", symbol: "ms", toBase: 0.001 },
    { id: "s", label: "Second", symbol: "s", toBase: 1 },
    { id: "min", label: "Minute", symbol: "min", toBase: 60 },
    { id: "h", label: "Hour", symbol: "h", toBase: 3600 },
    { id: "d", label: "Day", symbol: "d", toBase: 86400 },
    { id: "wk", label: "Week", symbol: "wk", toBase: 604800 },
    { id: "mo", label: "Month (avg)", symbol: "mo", toBase: 2629800 },
    { id: "yr", label: "Year (365d)", symbol: "yr", toBase: 31536000 },
  ],
};

// ── Pressure (base: pascal) ───────────────────────────────────────────────────
const pressure: Category = {
  id: "pressure",
  label: "Pressure",
  baseUnit: "Pa",
  units: [
    { id: "Pa", label: "Pascal", symbol: "Pa", toBase: 1 },
    { id: "kPa", label: "Kilopascal", symbol: "kPa", toBase: 1000 },
    { id: "MPa", label: "Megapascal", symbol: "MPa", toBase: 1_000_000 },
    { id: "bar", label: "Bar", symbol: "bar", toBase: 100000 },
    { id: "psi", label: "Pounds/sq inch", symbol: "psi", toBase: 6894.757 },
    { id: "atm", label: "Atmosphere", symbol: "atm", toBase: 101325 },
    { id: "mmHg", label: "mmHg (Torr)", symbol: "mmHg", toBase: 133.322 },
    { id: "inHg", label: "Inch of mercury", symbol: "inHg", toBase: 3386.389 },
  ],
};

// ── Energy (base: joule) ──────────────────────────────────────────────────────
const energy: Category = {
  id: "energy",
  label: "Energy",
  baseUnit: "J",
  units: [
    { id: "J", label: "Joule", symbol: "J", toBase: 1 },
    { id: "kJ", label: "Kilojoule", symbol: "kJ", toBase: 1000 },
    { id: "MJ", label: "Megajoule", symbol: "MJ", toBase: 1_000_000 },
    { id: "cal", label: "Calorie (small)", symbol: "cal", toBase: 4.184 },
    { id: "kcal", label: "Kilocalorie (Cal)", symbol: "kcal", toBase: 4184 },
    { id: "Wh", label: "Watt-hour", symbol: "Wh", toBase: 3600 },
    { id: "kWh", label: "Kilowatt-hour", symbol: "kWh", toBase: 3_600_000 },
    { id: "BTU", label: "BTU (IT)", symbol: "BTU", toBase: 1055.06 },
    { id: "eV", label: "Electronvolt", symbol: "eV", toBase: 1.602176634e-19 },
  ],
};

// ── Angle (base: radian) ──────────────────────────────────────────────────────
const angle: Category = {
  id: "angle",
  label: "Angle",
  baseUnit: "rad",
  units: [
    { id: "rad", label: "Radian", symbol: "rad", toBase: 1 },
    { id: "deg", label: "Degree", symbol: "°", toBase: Math.PI / 180 },
    { id: "grad", label: "Gradian", symbol: "grad", toBase: Math.PI / 200 },
    { id: "arcmin", label: "Arcminute", symbol: "′", toBase: Math.PI / 10800 },
    { id: "arcsec", label: "Arcsecond", symbol: "″", toBase: Math.PI / 648000 },
    { id: "rev", label: "Revolution", symbol: "rev", toBase: 2 * Math.PI },
  ],
};

// ── Power (base: watt) ────────────────────────────────────────────────────────
const power: Category = {
  id: "power",
  label: "Power",
  baseUnit: "W",
  units: [
    { id: "mW", label: "Milliwatt", symbol: "mW", toBase: 0.001 },
    { id: "W", label: "Watt", symbol: "W", toBase: 1 },
    { id: "kW", label: "Kilowatt", symbol: "kW", toBase: 1000 },
    { id: "MW", label: "Megawatt", symbol: "MW", toBase: 1_000_000 },
    { id: "GW", label: "Gigawatt", symbol: "GW", toBase: 1_000_000_000 },
    { id: "hp", label: "Horsepower (mech)", symbol: "hp", toBase: 745.69987 },
    { id: "BTUh", label: "BTU/hour", symbol: "BTU/h", toBase: 0.29307107 },
    { id: "kcalh", label: "kcal/hour", symbol: "kcal/h", toBase: 1.163 },
  ],
};

// ── Force (base: newton) ──────────────────────────────────────────────────────
const force: Category = {
  id: "force",
  label: "Force",
  baseUnit: "N",
  units: [
    { id: "N", label: "Newton", symbol: "N", toBase: 1 },
    { id: "kN", label: "Kilonewton", symbol: "kN", toBase: 1000 },
    { id: "MN", label: "Meganewton", symbol: "MN", toBase: 1_000_000 },
    { id: "lbf", label: "Pound-force", symbol: "lbf", toBase: 4.4482216 },
    { id: "kgf", label: "Kilogram-force", symbol: "kgf", toBase: 9.80665 },
    { id: "dyn", label: "Dyne", symbol: "dyn", toBase: 0.00001 },
  ],
};

// ── Fuel economy (base: km/L) ─────────────────────────────────────────────────
// Fuel economy cannot use a simple linear factor because l/100km is an inverse unit.
// We special-case it in convert() below.
const fuel: Category = {
  id: "fuel",
  label: "Fuel Economy",
  baseUnit: "kml",
  units: [
    { id: "kml", label: "km/L", symbol: "km/L", toBase: 1 },
    { id: "l100", label: "L/100 km", symbol: "L/100km", toBase: 0 /* inverse */ },
    { id: "mpg", label: "MPG (US)", symbol: "mpg", toBase: 0.425144 },
    { id: "mpguk", label: "MPG (UK)", symbol: "mpg (UK)", toBase: 0.354006 },
  ],
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  length,
  mass,
  temperature,
  area,
  volume,
  speed,
  data,
  time,
  pressure,
  energy,
  angle,
  power,
  force,
  fuel,
];

export function getCategoryById(id: CategoryId): Category {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}

// ── Fuel economy conversion (inverse unit) ────────────────────────────────────

// toKml[id]: converts id → km/L (base). l/100km is (100 / value) km/L.
const FUEL_TO_KML: Record<string, (v: number) => number> = {
  kml: (v) => v,
  l100: (v) => (v === 0 ? Number.NaN : 100 / v),
  mpg: (v) => v * 0.425144,
  mpguk: (v) => v * 0.354006,
};

const FUEL_FROM_KML: Record<string, (v: number) => number> = {
  kml: (v) => v,
  l100: (v) => (v === 0 ? Number.NaN : 100 / v),
  mpg: (v) => v / 0.425144,
  mpguk: (v) => v / 0.354006,
};

function convertFuel(value: number, fromId: string, toId: string): number {
  if (fromId === toId) return value;
  const toKml = FUEL_TO_KML[fromId];
  const fromKml = FUEL_FROM_KML[toId];
  if (!toKml || !fromKml) throw new Error(`Unknown fuel unit: ${fromId} or ${toId}`);
  const kml = toKml(value);
  if (!Number.isFinite(kml)) return Number.NaN;
  return fromKml(kml);
}

// ── Core conversion ───────────────────────────────────────────────────────────

/**
 * Convert a value from one unit to another within the same category.
 * Returns NaN if the value is not a finite number.
 */
export function convert(
  value: number,
  fromId: string,
  toId: string,
  categoryId: CategoryId
): number {
  if (!Number.isFinite(value)) throw new Error(`Cannot convert non-finite value: ${value}`);

  if (categoryId === "temperature") {
    if (fromId === toId) return value;
    const kelvin = tempToKelvin(value, fromId);
    return kelvinToUnit(kelvin, toId);
  }

  // Fuel economy: l/100km is the inverse of km/L, so we cannot use a simple
  // scale factor. Convert everything through km/L as the intermediate.
  if (categoryId === "fuel") {
    if (fromId === toId) return value;
    const result = convertFuel(value, fromId, toId);
    if (!Number.isFinite(result)) throw new Error(`Conversion produced non-finite result: ${value} ${fromId} -> ${toId} (check for zero division)`);
    return result;
  }

  const cat = getCategoryById(categoryId);
  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from) throw new Error(`Unknown unit: ${fromId}`);
  if (!to) throw new Error(`Unknown unit: ${toId}`);
  if (fromId === toId) return value;

  const base = value * from.toBase;
  const result = base / to.toBase;
  if (!Number.isFinite(result)) throw new Error(`Conversion produced non-finite result for ${value} ${fromId} -> ${toId}`);
  return result;
}

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
        p(1, "ms", "kmh"),
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
        p(1, "mpg", "kml"),
        p(1, "kml", "mpg"),
        p(10, "l100", "mpg"),
        p(30, "mpg", "l100"),
        p(1, "mpguk", "kml"),
        p(1, "kml", "l100"),
      ].filter(notNull);
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
    const result = convert(value, fromId, toId, categoryId);
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
  const fromSym = TEMP_UNITS.find((u) => u.id === fromId)?.symbol ?? fromId;
  const toSym = TEMP_UNITS.find((u) => u.id === toId)?.symbol ?? toId;
  const result = convert(value, fromId, toId, "temperature");
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
