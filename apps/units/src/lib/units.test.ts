import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  convert,
  formatResult,
  formatResultHuman,
  getCommonConversions,
} from "./units";
import type { CategoryId } from "./units";

// ── Helpers ───────────────────────────────────────────────────────────────────

function approx(a: number, b: number, tol = 1e-6): boolean {
  if (a === b) return true;
  return Math.abs(a - b) / (Math.abs(b) || 1) < tol;
}

// ── convert() ─────────────────────────────────────────────────────────────────

describe("convert — length", () => {
  it("1 mile = 1.609344 km", () => {
    expect(approx(convert({ value: 1, from: "mi", to: "km", category: "length" }), 1.609344)).toBe(true);
  });
  it("1 foot = 0.3048 m", () => {
    expect(approx(convert({ value: 1, from: "ft", to: "m", category: "length" }), 0.3048)).toBe(true);
  });
  it("1 inch = 2.54 cm", () => {
    expect(approx(convert({ value: 1, from: "in", to: "cm", category: "length" }), 2.54)).toBe(true);
  });
  it("same unit returns same value", () => {
    expect(convert({ value: 42, from: "m", to: "m", category: "length" })).toBe(42);
  });
  it("1 nmi = 1852 m", () => {
    expect(approx(convert({ value: 1, from: "nmi", to: "m", category: "length" }), 1852)).toBe(true);
  });
});

describe("convert — mass", () => {
  it("1 lb = 0.45359237 kg", () => {
    expect(approx(convert({ value: 1, from: "lb", to: "kg", category: "mass" }), 0.45359237)).toBe(true);
  });
  it("1 oz ≈ 28.3495 g", () => {
    expect(approx(convert({ value: 1, from: "oz", to: "g", category: "mass" }), 28.34952, 1e-5)).toBe(true);
  });
  it("1 stone = 14 lb", () => {
    expect(approx(convert({ value: 1, from: "st", to: "lb", category: "mass" }), 14, 1e-5)).toBe(true);
  });
});

describe("convert — temperature", () => {
  it("0°C = 32°F", () => {
    expect(approx(convert({ value: 0, from: "C", to: "F", category: "temperature" }), 32)).toBe(true);
  });
  it("100°C = 212°F", () => {
    expect(approx(convert({ value: 100, from: "C", to: "F", category: "temperature" }), 212)).toBe(true);
  });
  it("0°C = 273.15K", () => {
    expect(approx(convert({ value: 0, from: "C", to: "K", category: "temperature" }), 273.15)).toBe(true);
  });
  it("-40°C = -40°F", () => {
    expect(approx(convert({ value: -40, from: "C", to: "F", category: "temperature" }), -40)).toBe(true);
  });
  it("32°F = 0°C", () => {
    expect(approx(convert({ value: 32, from: "F", to: "C", category: "temperature" }), 0)).toBe(true);
  });
  it("0K = -273.15°C", () => {
    expect(approx(convert({ value: 0, from: "K", to: "C", category: "temperature" }), -273.15)).toBe(true);
  });
  it("491.67°R = 32°F", () => {
    expect(approx(convert({ value: 491.67, from: "R", to: "F", category: "temperature" }), 32, 1e-4)).toBe(true);
  });
});

describe("convert — area", () => {
  it("1 ha = 10000 m²", () => {
    expect(approx(convert({ value: 1, from: "ha", to: "m2", category: "area" }), 10000)).toBe(true);
  });
  it("1 ac ≈ 0.404686 ha", () => {
    expect(approx(convert({ value: 1, from: "ac", to: "ha", category: "area" }), 0.404686, 1e-5)).toBe(true);
  });
});

describe("convert — volume", () => {
  it("1 gal = 3.785412 l", () => {
    expect(approx(convert({ value: 1, from: "gal", to: "l", category: "volume" }), 3.785412)).toBe(true);
  });
  it("1 cup = 236.5882 ml", () => {
    expect(approx(convert({ value: 1, from: "cup", to: "ml", category: "volume" }), 236.5882, 1e-4)).toBe(true);
  });
});

describe("convert — speed", () => {
  it("1 mph ≈ 1.60934 km/h", () => {
    expect(approx(convert({ value: 1, from: "mph", to: "kmh", category: "speed" }), 1.60934, 1e-4)).toBe(true);
  });
  it("1 knot ≈ 1.852 km/h", () => {
    expect(approx(convert({ value: 1, from: "kn", to: "kmh", category: "speed" }), 1.852, 1e-4)).toBe(true);
  });
  it("1 mps = 3.6 kmh (canonical speed base unit)", () => {
    expect(approx(convert({ value: 1, from: "mps", to: "kmh", category: "speed" }), 3.6, 1e-5)).toBe(true);
  });
});

describe("convert — data", () => {
  it("1 GB = 1000 MB", () => {
    expect(approx(convert({ value: 1, from: "GB", to: "MB", category: "data" }), 1000)).toBe(true);
  });
  it("1 GiB ≈ 1.07374 GB", () => {
    expect(approx(convert({ value: 1, from: "GiB", to: "GB", category: "data" }), 1.073741824)).toBe(true);
  });
  it("1 B = 8 bits", () => {
    expect(approx(convert({ value: 1, from: "B", to: "bit", category: "data" }), 8)).toBe(true);
  });
});

describe("convert — time", () => {
  it("1 day = 24 hours", () => {
    expect(approx(convert({ value: 1, from: "d", to: "h", category: "time" }), 24)).toBe(true);
  });
  it("1 week = 7 days", () => {
    expect(approx(convert({ value: 1, from: "wk", to: "d", category: "time" }), 7)).toBe(true);
  });
  it("1 hour = 60 minutes", () => {
    expect(approx(convert({ value: 1, from: "h", to: "min", category: "time" }), 60)).toBe(true);
  });
  it("ms is millisecond (time category), not speed", () => {
    // ms = 0.001 seconds
    expect(approx(convert({ value: 1000, from: "ms", to: "s", category: "time" }), 1)).toBe(true);
  });
});

describe("convert — pressure", () => {
  it("1 atm = 101.325 kPa", () => {
    expect(approx(convert({ value: 1, from: "atm", to: "kPa", category: "pressure" }), 101.325)).toBe(true);
  });
  it("1 bar ≈ 14.5038 psi", () => {
    expect(approx(convert({ value: 1, from: "bar", to: "psi", category: "pressure" }), 14.5038, 1e-4)).toBe(true);
  });
});

describe("convert — energy", () => {
  it("1 kcal = 4.184 kJ", () => {
    expect(approx(convert({ value: 1, from: "kcal", to: "kJ", category: "energy" }), 4.184)).toBe(true);
  });
  it("1 kWh = 3.6 MJ", () => {
    expect(approx(convert({ value: 1, from: "kWh", to: "MJ", category: "energy" }), 3.6)).toBe(true);
  });
  it("1 BTU ≈ 1.05506 kJ", () => {
    expect(approx(convert({ value: 1, from: "BTU", to: "kJ", category: "energy" }), 1.05506, 1e-4)).toBe(true);
  });
});

describe("convert — edge cases", () => {
  it("NaN input throws a clear error", () => {
    expect(() => convert({ value: Number.NaN, from: "m", to: "ft", category: "length" })).toThrow(/non-finite/i);
  });
  it("Infinity input throws a clear error", () => {
    expect(() => convert({ value: Number.POSITIVE_INFINITY, from: "m", to: "ft", category: "length" })).toThrow(/non-finite/i);
  });
});

// ── formatResult() ────────────────────────────────────────────────────────────

describe("formatResult", () => {
  it("formats zero as '0'", () => {
    expect(formatResult(0)).toBe("0");
  });
  it("strips trailing zeros", () => {
    expect(formatResult(1.5)).toBe("1.5");
  });
  it("formats large numbers in scientific notation", () => {
    const result = formatResult(1e13);
    expect(result).toMatch(/e/);
  });
  it("formats very small numbers in scientific notation", () => {
    const result = formatResult(1e-8);
    expect(result).toMatch(/e/);
  });
  it("returns '—' for NaN", () => {
    expect(formatResult(Number.NaN)).toBe("—");
  });
  it("returns '—' for Infinity", () => {
    expect(formatResult(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("convert — angle", () => {
  it("180 degrees = pi radians", () => {
    expect(approx(convert({ value: 180, from: "deg", to: "rad", category: "angle" }), Math.PI, 1e-9)).toBe(true);
  });
  it("1 revolution = 360 degrees", () => {
    expect(approx(convert({ value: 1, from: "rev", to: "deg", category: "angle" }), 360)).toBe(true);
  });
  it("90 degrees = 100 gradians", () => {
    expect(approx(convert({ value: 90, from: "deg", to: "grad", category: "angle" }), 100)).toBe(true);
  });
  it("1 degree = 60 arcminutes", () => {
    expect(approx(convert({ value: 1, from: "deg", to: "arcmin", category: "angle" }), 60)).toBe(true);
  });
});

describe("convert — power", () => {
  it("1 hp ~= 0.74570 kW", () => {
    expect(approx(convert({ value: 1, from: "hp", to: "kW", category: "power" }), 0.74569987, 1e-5)).toBe(true);
  });
  it("1 kW = 1000 W", () => {
    expect(approx(convert({ value: 1, from: "kW", to: "W", category: "power" }), 1000)).toBe(true);
  });
});

describe("convert — force", () => {
  it("1 lbf ~= 4.44822 N", () => {
    expect(approx(convert({ value: 1, from: "lbf", to: "N", category: "force" }), 4.4482216, 1e-5)).toBe(true);
  });
  it("1 kgf ~= 9.80665 N", () => {
    expect(approx(convert({ value: 1, from: "kgf", to: "N", category: "force" }), 9.80665, 1e-5)).toBe(true);
  });
});

describe("convert — fuel economy", () => {
  it("1 mpgUS ~= 0.42514371 km/L (canonical factor)", () => {
    // canonical id: mpgUS (not mpg); canonical factor: 0.42514371
    expect(approx(convert({ value: 1, from: "mpgUS", to: "kml", category: "fuel" }), 0.42514371, 1e-6)).toBe(true);
  });
  it("10 L/100km = 10 km/L inverse", () => {
    // canonical id: l100km (not l100)
    expect(approx(convert({ value: 10, from: "l100km", to: "kml", category: "fuel" }), 10)).toBe(true);
  });
  it("30 mpgUS -> L/100km roundtrip", () => {
    const kml = convert({ value: 30, from: "mpgUS", to: "kml", category: "fuel" });
    const back = convert({ value: kml, from: "kml", to: "mpgUS", category: "fuel" });
    expect(approx(back, 30, 1e-5)).toBe(true);
  });
  it("L/100km with 0 throws (division by zero)", () => {
    expect(() => convert({ value: 0, from: "l100km", to: "kml", category: "fuel" })).toThrow(/non-finite/i);
  });
  it("same unit returns same value", () => {
    expect(convert({ value: 25, from: "mpgUS", to: "mpgUS", category: "fuel" })).toBe(25);
  });
  it("1 mpgUK ~= 0.35400620 km/L (canonical factor)", () => {
    expect(approx(convert({ value: 1, from: "mpgUK", to: "kml", category: "fuel" }), 0.35400620, 1e-6)).toBe(true);
  });
});

// ── formatResultHuman() ───────────────────────────────────────────────────────

describe("formatResultHuman", () => {
  it("returns '—' for NaN", () => {
    expect(formatResultHuman(Number.NaN)).toBe("—");
  });
  it("returns '—' for Infinity", () => {
    expect(formatResultHuman(Number.POSITIVE_INFINITY)).toBe("—");
  });
  it("returns '0' for zero", () => {
    expect(formatResultHuman(0)).toBe("0");
  });
  it("adds thousands separator for large numbers", () => {
    const r = formatResultHuman(1609.344);
    expect(r).toContain(",");
  });
  it("fullPrecision falls back to formatResult", () => {
    expect(formatResultHuman(1.5, true)).toBe(formatResult(1.5));
  });
  it("rounds to sensible sig figs", () => {
    // 1 mile = 1.609344 km; human format should not show all 7 decimals
    const r = formatResultHuman(1.609344);
    expect(r.length).toBeLessThan(8);
  });
  it("uses scientific notation for extreme values", () => {
    expect(formatResultHuman(1e16)).toMatch(/e/);
    expect(formatResultHuman(1e-10)).toMatch(/e/);
  });
});

// ── getCommonConversions() ────────────────────────────────────────────────────

describe("getCommonConversions", () => {
  it("returns non-empty array for every category", () => {
    const cats: CategoryId[] = CATEGORIES.map((c) => c.id as CategoryId);
    for (const cat of cats) {
      const list = getCommonConversions(cat);
      expect(list.length).toBeGreaterThan(0);
    }
  });
  it("length conversions are internally consistent", () => {
    const list = getCommonConversions("length");
    for (const item of list) {
      expect(Number.isFinite(item.to.value)).toBe(true);
    }
  });
  it("temperature common conversions include 0 deg C -> 32 deg F", () => {
    const list = getCommonConversions("temperature");
    const found = list.find((c) => c.from.value === 0 && c.from.unit === "°C");
    expect(found).toBeDefined();
    expect(approx(found?.to.value ?? Number.NaN, 32)).toBe(true);
  });
  it("angle common conversions are non-empty and finite", () => {
    const list = getCommonConversions("angle");
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(Number.isFinite(item.to.value)).toBe(true);
    }
  });
  it("fuel common conversions are non-empty and finite", () => {
    const list = getCommonConversions("fuel");
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(Number.isFinite(item.to.value)).toBe(true);
    }
  });
});
