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
    expect(approx(convert(1, "mi", "km", "length"), 1.609344)).toBe(true);
  });
  it("1 foot = 0.3048 m", () => {
    expect(approx(convert(1, "ft", "m", "length"), 0.3048)).toBe(true);
  });
  it("1 inch = 2.54 cm", () => {
    expect(approx(convert(1, "in", "cm", "length"), 2.54)).toBe(true);
  });
  it("same unit returns same value", () => {
    expect(convert(42, "m", "m", "length")).toBe(42);
  });
  it("1 nmi = 1852 m", () => {
    expect(approx(convert(1, "nmi", "m", "length"), 1852)).toBe(true);
  });
});

describe("convert — mass", () => {
  it("1 lb = 0.45359237 kg", () => {
    expect(approx(convert(1, "lb", "kg", "mass"), 0.45359237)).toBe(true);
  });
  it("1 oz ≈ 28.3495 g", () => {
    expect(approx(convert(1, "oz", "g", "mass"), 28.34952, 1e-5)).toBe(true);
  });
  it("1 stone = 14 lb", () => {
    expect(approx(convert(1, "st", "lb", "mass"), 14, 1e-5)).toBe(true);
  });
});

describe("convert — temperature", () => {
  it("0°C = 32°F", () => {
    expect(approx(convert(0, "C", "F", "temperature"), 32)).toBe(true);
  });
  it("100°C = 212°F", () => {
    expect(approx(convert(100, "C", "F", "temperature"), 212)).toBe(true);
  });
  it("0°C = 273.15K", () => {
    expect(approx(convert(0, "C", "K", "temperature"), 273.15)).toBe(true);
  });
  it("-40°C = -40°F", () => {
    expect(approx(convert(-40, "C", "F", "temperature"), -40)).toBe(true);
  });
  it("32°F = 0°C", () => {
    expect(approx(convert(32, "F", "C", "temperature"), 0)).toBe(true);
  });
  it("0K = -273.15°C", () => {
    expect(approx(convert(0, "K", "C", "temperature"), -273.15)).toBe(true);
  });
  it("491.67°R = 32°F", () => {
    expect(approx(convert(491.67, "R", "F", "temperature"), 32, 1e-4)).toBe(true);
  });
});

describe("convert — area", () => {
  it("1 ha = 10000 m²", () => {
    expect(approx(convert(1, "ha", "m2", "area"), 10000)).toBe(true);
  });
  it("1 ac ≈ 0.404686 ha", () => {
    expect(approx(convert(1, "ac", "ha", "area"), 0.404686, 1e-5)).toBe(true);
  });
});

describe("convert — volume", () => {
  it("1 gal = 3.785412 l", () => {
    expect(approx(convert(1, "gal", "l", "volume"), 3.785412)).toBe(true);
  });
  it("1 cup = 236.5882 ml", () => {
    expect(approx(convert(1, "cup", "ml", "volume"), 236.5882, 1e-4)).toBe(true);
  });
});

describe("convert — speed", () => {
  it("1 mph ≈ 1.60934 km/h", () => {
    expect(approx(convert(1, "mph", "kmh", "speed"), 1.60934, 1e-4)).toBe(true);
  });
  it("1 knot ≈ 1.852 km/h", () => {
    expect(approx(convert(1, "kn", "kmh", "speed"), 1.852, 1e-4)).toBe(true);
  });
});

describe("convert — data", () => {
  it("1 GB = 1000 MB", () => {
    expect(approx(convert(1, "GB", "MB", "data"), 1000)).toBe(true);
  });
  it("1 GiB ≈ 1.07374 GB", () => {
    expect(approx(convert(1, "GiB", "GB", "data"), 1.073741824)).toBe(true);
  });
  it("1 B = 8 bits", () => {
    expect(approx(convert(1, "B", "bit", "data"), 8)).toBe(true);
  });
});

describe("convert — time", () => {
  it("1 day = 24 hours", () => {
    expect(approx(convert(1, "d", "h", "time"), 24)).toBe(true);
  });
  it("1 week = 7 days", () => {
    expect(approx(convert(1, "wk", "d", "time"), 7)).toBe(true);
  });
  it("1 hour = 60 minutes", () => {
    expect(approx(convert(1, "h", "min", "time"), 60)).toBe(true);
  });
});

describe("convert — pressure", () => {
  it("1 atm = 101.325 kPa", () => {
    expect(approx(convert(1, "atm", "kPa", "pressure"), 101.325)).toBe(true);
  });
  it("1 bar ≈ 14.5038 psi", () => {
    expect(approx(convert(1, "bar", "psi", "pressure"), 14.5038, 1e-4)).toBe(true);
  });
});

describe("convert — energy", () => {
  it("1 kcal = 4.184 kJ", () => {
    expect(approx(convert(1, "kcal", "kJ", "energy"), 4.184)).toBe(true);
  });
  it("1 kWh = 3.6 MJ", () => {
    expect(approx(convert(1, "kWh", "MJ", "energy"), 3.6)).toBe(true);
  });
  it("1 BTU ≈ 1.05506 kJ", () => {
    expect(approx(convert(1, "BTU", "kJ", "energy"), 1.05506, 1e-4)).toBe(true);
  });
});

describe("convert — edge cases", () => {
  it("NaN input throws a clear error", () => {
    expect(() => convert(Number.NaN, "m", "ft", "length")).toThrow(/non-finite/i);
  });
  it("Infinity input throws a clear error", () => {
    expect(() => convert(Number.POSITIVE_INFINITY, "m", "ft", "length")).toThrow(/non-finite/i);
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
    expect(approx(convert(180, "deg", "rad", "angle"), Math.PI, 1e-9)).toBe(true);
  });
  it("1 revolution = 360 degrees", () => {
    expect(approx(convert(1, "rev", "deg", "angle"), 360)).toBe(true);
  });
  it("90 degrees = 100 gradians", () => {
    expect(approx(convert(90, "deg", "grad", "angle"), 100)).toBe(true);
  });
  it("1 degree = 60 arcminutes", () => {
    expect(approx(convert(1, "deg", "arcmin", "angle"), 60)).toBe(true);
  });
});

describe("convert — power", () => {
  it("1 hp ~= 0.74570 kW", () => {
    expect(approx(convert(1, "hp", "kW", "power"), 0.74569987, 1e-5)).toBe(true);
  });
  it("1 kW = 1000 W", () => {
    expect(approx(convert(1, "kW", "W", "power"), 1000)).toBe(true);
  });
});

describe("convert — force", () => {
  it("1 lbf ~= 4.44822 N", () => {
    expect(approx(convert(1, "lbf", "N", "force"), 4.4482216, 1e-5)).toBe(true);
  });
  it("1 kgf ~= 9.80665 N", () => {
    expect(approx(convert(1, "kgf", "N", "force"), 9.80665, 1e-5)).toBe(true);
  });
});

describe("convert — fuel economy", () => {
  it("1 mpg (US) ~= 0.425144 km/L", () => {
    expect(approx(convert(1, "mpg", "kml", "fuel"), 0.425144, 1e-5)).toBe(true);
  });
  it("10 L/100km = 10 km/L inverse", () => {
    // 10 L/100km = 100/10 = 10 km/L
    expect(approx(convert(10, "l100", "kml", "fuel"), 10)).toBe(true);
  });
  it("30 mpg -> L/100km roundtrip", () => {
    const kml = convert(30, "mpg", "kml", "fuel");
    const back = convert(kml, "kml", "mpg", "fuel");
    expect(approx(back, 30, 1e-5)).toBe(true);
  });
  it("L/100km with 0 throws (division by zero)", () => {
    expect(() => convert(0, "l100", "kml", "fuel")).toThrow(/non-finite/i);
  });
  it("same unit returns same value", () => {
    expect(convert(25, "mpg", "mpg", "fuel")).toBe(25);
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
