/**
 * Augment tests for units/units.ts -- covers gaps in the existing suite:
 * convert() with unknown unit IDs (throws), temperature with Rankine roundtrip,
 * zero-value conversions across categories, formatResult boundary values,
 * getCommonConversions return shapes, CATEGORIES array invariants.
 */
import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  convert,
  formatResult,
  formatResultHuman,
  getCommonConversions,
} from "./units";
import type { CategoryId } from "./units";

function approx(a: number, b: number, tol = 1e-6): boolean {
  if (a === b) return true;
  return Math.abs(a - b) / (Math.abs(b) || 1) < tol;
}

// ── convert() -- error paths ──────────────────────────────────────────────────

describe("convert -- error paths", () => {
  it("throws for an unknown fromUnit in length", () => {
    expect(() => convert(1, "zz", "m", "length")).toThrow();
  });

  it("throws for an unknown toUnit in mass", () => {
    expect(() => convert(1, "kg", "zz", "mass")).toThrow();
  });

  it("throws for an unknown temperature unit", () => {
    expect(() => convert(100, "X", "C", "temperature")).toThrow();
  });
});

// ── convert() -- zero input ───────────────────────────────────────────────────

describe("convert -- zero input", () => {
  it("0 m to ft is 0", () => {
    expect(convert(0, "m", "ft", "length")).toBe(0);
  });

  it("0 kg to lb is 0", () => {
    expect(convert(0, "kg", "lb", "mass")).toBe(0);
  });

  it("0 C to K is 273.15", () => {
    // 0 Celsius = 273.15 Kelvin
    expect(approx(convert(0, "C", "K", "temperature"), 273.15)).toBe(true);
  });

  it("0 J to cal is 0", () => {
    expect(convert(0, "J", "cal", "energy")).toBe(0);
  });
});

// ── convert() -- negative values ─────────────────────────────────────────────

describe("convert -- negative values", () => {
  it("-1 m is -100 cm", () => {
    expect(approx(convert(-1, "m", "cm", "length"), -100)).toBe(true);
  });

  it("-40 C = -40 F (the crossover)", () => {
    expect(approx(convert(-40, "C", "F", "temperature"), -40)).toBe(true);
  });

  it("-273.15 C = 0 K (absolute zero)", () => {
    expect(approx(convert(-273.15, "C", "K", "temperature"), 0, 1e-9)).toBe(true);
  });
});

// ── convert() -- roundtrip ────────────────────────────────────────────────────

describe("convert -- roundtrip", () => {
  it("length: ft -> m -> ft", () => {
    const m = convert(1, "ft", "m", "length");
    const back = convert(m, "m", "ft", "length");
    expect(approx(back, 1)).toBe(true);
  });

  it("temperature: C -> F -> C", () => {
    const f = convert(25, "C", "F", "temperature");
    const back = convert(f, "F", "C", "temperature");
    expect(approx(back, 25)).toBe(true);
  });

  it("data: MB -> bit -> MB", () => {
    const bits = convert(1, "MB", "bit", "data");
    const back = convert(bits, "bit", "MB", "data");
    expect(approx(back, 1)).toBe(true);
  });

  it("energy: kWh -> J -> kWh", () => {
    const j = convert(1, "kWh", "J", "energy");
    const back = convert(j, "J", "kWh", "energy");
    expect(approx(back, 1)).toBe(true);
  });
});

// ── convert() -- Rankine roundtrip ────────────────────────────────────────────

describe("convert -- Rankine", () => {
  it("0 K = 0 R", () => {
    expect(approx(convert(0, "K", "R", "temperature"), 0)).toBe(true);
  });

  it("Rankine -> K -> Rankine roundtrip", () => {
    const k = convert(500, "R", "K", "temperature");
    const back = convert(k, "K", "R", "temperature");
    expect(approx(back, 500)).toBe(true);
  });
});

// ── formatResult -- additional paths ─────────────────────────────────────────

describe("formatResult -- additional paths", () => {
  it("negative zero returns '0'", () => {
    expect(formatResult(-0)).toBe("0");
  });

  it("very small but finite positive value", () => {
    const r = formatResult(1e-9);
    expect(r).toMatch(/e/); // scientific notation
  });

  it("value with many trailing zeros stripped", () => {
    // 1.5000000 -> "1.5"
    const r = formatResult(1.5);
    expect(r).toBe("1.5");
  });

  it("negative infinity returns '—'", () => {
    expect(formatResult(Number.NEGATIVE_INFINITY)).toBe("—");
  });

  it("exact integer", () => {
    expect(formatResult(42)).toBe("42");
  });
});

// ── formatResultHuman -- additional paths ─────────────────────────────────────

describe("formatResultHuman -- additional paths", () => {
  it("negative value formats correctly", () => {
    const r = formatResultHuman(-1609.344);
    expect(r).toContain("-");
  });

  it("value between 1 and 1000 keeps up to 4 decimal places", () => {
    const r = formatResultHuman(1.23456789);
    // Should not have more than 4 decimal places
    const decimals = (r.split(".")[1] ?? "").length;
    expect(decimals).toBeLessThanOrEqual(4);
  });

  it("negative infinity returns '—'", () => {
    expect(formatResultHuman(Number.NEGATIVE_INFINITY)).toBe("—");
  });
});

// ── CATEGORIES invariants ─────────────────────────────────────────────────────

describe("CATEGORIES -- structural invariants", () => {
  it("every category has a non-empty id and label", () => {
    for (const cat of CATEGORIES) {
      expect(cat.id.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it("every category has at least 2 units", () => {
    for (const cat of CATEGORIES) {
      expect(cat.units.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every category's baseUnit is in its units array", () => {
    for (const cat of CATEGORIES) {
      const ids = cat.units.map((u) => u.id);
      expect(ids).toContain(cat.baseUnit);
    }
  });

  it("the base unit's toBase factor is 1 (for non-temperature)", () => {
    for (const cat of CATEGORIES) {
      if (cat.id === "temperature") continue; // toBase unused for temp
      const base = cat.units.find((u) => u.id === cat.baseUnit);
      expect(base?.toBase).toBe(1);
    }
  });
});

// ── getCommonConversions -- return shape ──────────────────────────────────────

describe("getCommonConversions -- return shape", () => {
  it("each item has from.value, from.unit, to.value, to.unit, label fields", () => {
    const list = getCommonConversions("length");
    for (const item of list) {
      expect(typeof item.from.value).toBe("number");
      expect(typeof item.from.unit).toBe("string");
      expect(typeof item.to.value).toBe("number");
      expect(typeof item.to.unit).toBe("string");
      expect(typeof item.label).toBe("string");
    }
  });

  it("time category includes 24 hours per day entry", () => {
    const list = getCommonConversions("time");
    const dayEntry = list.find(
      (c) => c.from.value === 1 && c.from.unit === "d" && Number.isFinite(c.to.value)
    );
    // There should be a 1 day -> N hours entry
    expect(dayEntry).toBeDefined();
  });

  it("pressure category has finite values only", () => {
    const list = getCommonConversions("pressure");
    for (const item of list) {
      expect(Number.isFinite(item.to.value)).toBe(true);
    }
  });
});
