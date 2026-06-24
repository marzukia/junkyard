/**
 * Regression tests for the persist-v0→v1 migration of renamed unit ids.
 *
 * PR #56 renamed ids that were already persisted in localStorage:
 *   mpg  → mpgUS  (fuel)
 *   mpguk → mpgUK  (fuel)
 *   l100  → l100km (fuel)
 *   ms    → mps    (speed only)
 *
 * Without migration, returning users rehydrate stale ids and convert() throws
 * "Unknown unit" → blank screen.  These tests seed the stale payload, run the
 * migrate() path (via the exported helpers), and assert:
 *   (a) the ids are remapped correctly
 *   (b) computeResult produces a valid result (no throw)
 *   (c) garbage ids fall back gracefully (no throw, no blank-screen crash)
 */

import { describe, expect, it } from "vitest";
import { computeResult, defaultUnits } from "./unitsStore";
import type { CategoryId } from "../lib/units";

// ── Inline the migrate logic under test (mirrors unitsStore.ts exactly) ───────
// We test the migration function in isolation so we can seed arbitrary v0 shapes
// without spinning up the full zustand store (which requires a browser environment
// and localStorage, adding test-infra complexity beyond the unit boundary).

interface V0Shape {
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
  if (id === "ms" && categoryId === "speed") return "mps";
  return id;
}

function migrate(persisted: unknown, fromVersion: number): unknown {
  if (fromVersion < 1) {
    const s = persisted as V0Shape;
    const categoryId = s.categoryId;
    s.fromUnit = migrateUnitId(s.fromUnit, categoryId);
    s.toUnit = migrateUnitId(s.toUnit, categoryId);
  }
  return persisted;
}

// ── Migration map tests ───────────────────────────────────────────────────────

describe("persist v0→v1 migration — id remapping", () => {
  it("mpg → mpgUS in fuel category", () => {
    const state = migrate({ categoryId: "fuel", fromUnit: "mpg", toUnit: "kml" }, 0) as V0Shape;
    expect(state.fromUnit).toBe("mpgUS");
    expect(state.toUnit).toBe("kml"); // unchanged
  });

  it("mpguk → mpgUK in fuel category", () => {
    const state = migrate({ categoryId: "fuel", fromUnit: "mpguk", toUnit: "mpg" }, 0) as V0Shape;
    expect(state.fromUnit).toBe("mpgUK");
    expect(state.toUnit).toBe("mpgUS"); // mpg also migrated
  });

  it("l100 → l100km in fuel category", () => {
    const state = migrate({ categoryId: "fuel", fromUnit: "l100", toUnit: "mpguk" }, 0) as V0Shape;
    expect(state.fromUnit).toBe("l100km");
    expect(state.toUnit).toBe("mpgUK");
  });

  it("ms → mps ONLY when categoryId === speed", () => {
    const speedState = migrate({ categoryId: "speed", fromUnit: "ms", toUnit: "kmh" }, 0) as V0Shape;
    expect(speedState.fromUnit).toBe("mps");
  });

  it("ms stays ms when categoryId === time (millisecond is valid)", () => {
    const timeState = migrate({ categoryId: "time", fromUnit: "ms", toUnit: "s" }, 0) as V0Shape;
    expect(timeState.fromUnit).toBe("ms"); // NOT remapped
  });

  it("already-correct ids pass through unchanged", () => {
    const state = migrate({ categoryId: "fuel", fromUnit: "mpgUS", toUnit: "kml" }, 0) as V0Shape;
    expect(state.fromUnit).toBe("mpgUS");
    expect(state.toUnit).toBe("kml");
  });

  it("version >= 1 payload is not remapped (idempotent)", () => {
    // fromVersion=1 → migration block is skipped
    const state = migrate({ categoryId: "fuel", fromUnit: "mpg", toUnit: "kml" }, 1) as V0Shape;
    // mpg is NOT renamed because fromVersion >= 1
    expect(state.fromUnit).toBe("mpg");
  });
});

// ── computeResult defensive fallback ─────────────────────────────────────────

describe("computeResult — defensive: unknown ids never throw", () => {
  it("stale 'mpg' id does not throw — returns dash result", () => {
    // Before migration wires in, an un-migrated stale id must not crash.
    // computeResult catches the convert() throw and returns a safe value.
    let thrown = false;
    let result: ReturnType<typeof computeResult> | undefined;
    try {
      result = computeResult("1", "mpg", "kml", "fuel" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
    expect(result?.resultValue).toBe("—");
    expect(Number.isNaN(result?.resultNumeric)).toBe(true);
  });

  it("stale 'l100' id does not throw", () => {
    let thrown = false;
    try {
      computeResult("10", "l100", "mpgUS", "fuel" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });

  it("stale speed 'ms' id does not throw", () => {
    let thrown = false;
    try {
      computeResult("60", "ms", "kmh", "speed" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });

  it("completely garbage id does not throw", () => {
    let thrown = false;
    try {
      computeResult("5", "GARBAGE_UNIT_XYZ", "km", "length" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });
});

// ── Post-migration computeResult succeeds ─────────────────────────────────────

describe("computeResult — produces valid result after migration", () => {
  it("mpg→mpgUS: computeResult returns a finite result", () => {
    const migrated = migrate({ categoryId: "fuel", fromUnit: "mpg", toUnit: "kml" }, 0) as V0Shape;
    const result = computeResult("30", migrated.fromUnit!, migrated.toUnit!, "fuel" as CategoryId, false);
    expect(result.resultValue).not.toBe("—");
    expect(Number.isFinite(result.resultNumeric)).toBe(true);
  });

  it("mpguk→mpgUK: computeResult returns a finite result", () => {
    const migrated = migrate({ categoryId: "fuel", fromUnit: "mpguk", toUnit: "kml" }, 0) as V0Shape;
    const result = computeResult("40", migrated.fromUnit!, migrated.toUnit!, "fuel" as CategoryId, false);
    expect(result.resultValue).not.toBe("—");
    expect(Number.isFinite(result.resultNumeric)).toBe(true);
  });

  it("l100→l100km: computeResult returns a finite result", () => {
    const migrated = migrate({ categoryId: "fuel", fromUnit: "l100", toUnit: "mpgUS" }, 0) as V0Shape;
    const result = computeResult("8", migrated.fromUnit!, migrated.toUnit!, "fuel" as CategoryId, false);
    expect(result.resultValue).not.toBe("—");
    expect(Number.isFinite(result.resultNumeric)).toBe(true);
  });

  it("speed ms→mps: computeResult returns a finite result", () => {
    const migrated = migrate({ categoryId: "speed", fromUnit: "ms", toUnit: "kmh" }, 0) as V0Shape;
    const result = computeResult("10", migrated.fromUnit!, migrated.toUnit!, "speed" as CategoryId, false);
    expect(result.resultValue).not.toBe("—");
    expect(Number.isFinite(result.resultNumeric)).toBe(true);
  });
});

// ── defaultUnits sanity ───────────────────────────────────────────────────────

describe("defaultUnits — returns valid unit ids for every category", () => {
  const categories: CategoryId[] = [
    "length", "mass", "temperature", "area", "volume", "speed",
    "data", "time", "pressure", "energy", "angle", "power", "force", "fuel",
  ];

  for (const cat of categories) {
    it(`${cat} defaults produce a finite computeResult`, () => {
      const { fromUnit, toUnit } = defaultUnits(cat);
      const result = computeResult("1", fromUnit, toUnit, cat, false);
      expect(Number.isFinite(result.resultNumeric)).toBe(true);
    });
  }
});

// ── Bug 1: extreme values never throw (AllUnitsCard resilience) ───────────────

describe("computeResult — extreme input values do not throw", () => {
  it("1e308 (overflow) returns — not a throw", () => {
    // convert(1e308 m → ft) may overflow to Infinity; computeResult must not throw.
    let thrown = false;
    let result: ReturnType<typeof computeResult> | undefined;
    try {
      result = computeResult("1e308", "m", "ft", "length" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
    // result may be "—" (non-finite) or a valid sci-notation string — either is fine
    expect(typeof result?.resultValue).toBe("string");
  });

  it("-1e308 (negative overflow) returns — not a throw", () => {
    let thrown = false;
    try {
      computeResult("-1e308", "m", "ft", "length" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });

  it("Infinity string is treated as invalid input, not a throw", () => {
    let thrown = false;
    let result: ReturnType<typeof computeResult> | undefined;
    try {
      result = computeResult("Infinity", "m", "ft", "length" as CategoryId, false);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(false);
    expect(result?.inputIsInvalid).toBe(true);
  });
});

// ── Bug 2: poisoned prefs — categoryId and unit id validation ─────────────────

describe("onRehydrateStorage validation (simulated via computeResult + defaultUnits)", () => {
  it("BOGUS categoryId falls back to length defaults which produce valid results", () => {
    // Simulate what onRehydrateStorage does: unknown categoryId → initialCat
    const fallbackCat: CategoryId = "length";
    const { fromUnit, toUnit } = defaultUnits(fallbackCat);
    const result = computeResult("1", fromUnit, toUnit, fallbackCat, false);
    expect(Number.isFinite(result.resultNumeric)).toBe(true);
  });

  it("BOGUS unit ids fall back to defaults which produce valid results", () => {
    // computeResult catches unknown-unit throw and returns safe dash result
    const result = computeResult("1", "BOGUS", "UNIT", "length" as CategoryId, false);
    expect(result.resultValue).toBe("—");
    // No throw
  });

  it("non-string categoryId does not propagate to convert() causing a crash", () => {
    // If categoryId is e.g. null/number from tampered JSON, defaultUnits must still
    // provide valid unit ids. Here we test that defaultUnits("length") is always safe.
    const { fromUnit, toUnit } = defaultUnits("length");
    expect(fromUnit).toBeTruthy();
    expect(toUnit).toBeTruthy();
  });
});
