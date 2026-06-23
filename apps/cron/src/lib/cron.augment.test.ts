/**
 * Augmentation tests for cron.ts — pathways not covered by cron.test.ts:
 *   - macroLabel
 *   - splitExpression (direct)
 *   - fieldLabel
 *   - describeRaw
 *   - PRESETS shape
 *   - validateField step/range edge cases
 *   - nextRuns with dom+dow both restricted (OR semantics)
 *   - describeCron weekday/weekend special-casing
 */
import { describe, expect, it } from "vitest";
import {
  FIELD_ORDER,
  PRESETS,
  describeRaw,
  describeCron,
  expressionToFields,
  fieldLabel,
  macroLabel,
  nextRuns,
  splitExpression,
  validateField,
} from "./cron";

// ── macroLabel ─────────────────────────────────────────────────────────────

describe("macroLabel", () => {
  it("returns label with expanded expression for @daily", () => {
    const label = macroLabel("@daily");
    expect(label).not.toBeNull();
    expect(label).toContain("@daily");
    expect(label).toContain("0 0 * * *");
  });

  it("is case-insensitive", () => {
    expect(macroLabel("@HOURLY")).not.toBeNull();
    expect(macroLabel("@HOURLY")).toContain("0 * * * *");
  });

  it("returns null for a plain expression", () => {
    expect(macroLabel("0 0 * * *")).toBeNull();
  });

  it("returns null for an unknown @-identifier", () => {
    expect(macroLabel("@every5min")).toBeNull();
  });

  it("returns correct expanded form for @weekly", () => {
    const label = macroLabel("@weekly");
    expect(label).not.toBeNull();
    expect(label).toContain("0 0 * * 0");
  });
});

// ── splitExpression ────────────────────────────────────────────────────────

describe("splitExpression", () => {
  it("splits a 5-field expression into an array of 5 strings", () => {
    const parts = splitExpression("*/5 9-17 * * 1-5");
    expect(parts).not.toBeNull();
    expect(parts).toHaveLength(5);
    expect(parts?.[0]).toBe("*/5");
    expect(parts?.[4]).toBe("1-5");
  });

  it("returns null for 4 fields", () => {
    expect(splitExpression("* * * *")).toBeNull();
  });

  it("returns null for 6 fields", () => {
    expect(splitExpression("0 0 12 * * ?")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(splitExpression("")).toBeNull();
  });

  it("trims leading/trailing whitespace before splitting", () => {
    const parts = splitExpression("  0 0 * * *  ");
    expect(parts).not.toBeNull();
    expect(parts).toHaveLength(5);
  });
});

// ── fieldLabel ─────────────────────────────────────────────────────────────

describe("fieldLabel", () => {
  it("returns Minute for minute", () => {
    expect(fieldLabel("minute")).toBe("Minute");
  });

  it("returns Hour for hour", () => {
    expect(fieldLabel("hour")).toBe("Hour");
  });

  it("returns Day of month for dom", () => {
    expect(fieldLabel("dom")).toBe("Day of month");
  });

  it("returns Month for month", () => {
    expect(fieldLabel("month")).toBe("Month");
  });

  it("returns Day of week for dow", () => {
    expect(fieldLabel("dow")).toBe("Day of week");
  });

  it("covers all FIELD_ORDER entries", () => {
    for (const f of FIELD_ORDER) {
      expect(typeof fieldLabel(f)).toBe("string");
      expect(fieldLabel(f).length).toBeGreaterThan(0);
    }
  });
});

// ── describeRaw ────────────────────────────────────────────────────────────

describe("describeRaw", () => {
  it("returns comma-separated values for a named month range", () => {
    const { fields } = expressionToFields("0 0 * 1-3 *");
    // month field is '1-3'; spec for month
    const result = describeRaw("1-3", { min: 1, max: 12 });
    // should expand 1,2,3
    expect(result).toBe("1, 2, 3");
  });

  it("returns a single value for a plain number", () => {
    expect(describeRaw("5", { min: 0, max: 59 })).toBe("5");
  });

  it("returns all 60 values for * in minute spec", () => {
    const result = describeRaw("*", { min: 0, max: 59 });
    const values = result.split(", ").map(Number);
    expect(values).toHaveLength(60);
    expect(values[0]).toBe(0);
    expect(values[59]).toBe(59);
  });

  it("expands a step like */15 to 0, 15, 30, 45 for minute", () => {
    const result = describeRaw("*/15", { min: 0, max: 59 });
    expect(result).toBe("0, 15, 30, 45");
  });
});

// ── PRESETS shape ──────────────────────────────────────────────────────────

describe("PRESETS", () => {
  it("each preset has a non-empty label, expression, and description", () => {
    for (const p of PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.expression.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("every preset expression either starts with @ or has 5 fields", () => {
    for (const p of PRESETS) {
      if (!p.expression.startsWith("@")) {
        expect(p.expression.trim().split(/\s+/)).toHaveLength(5);
      }
    }
  });

  it("every preset parses successfully via expressionToFields", () => {
    for (const p of PRESETS) {
      const r = expressionToFields(p.expression);
      expect(r.ok).toBe(true);
    }
  });
});

// ── validateField edge cases ───────────────────────────────────────────────

describe("validateField edge cases", () => {
  it("rejects */0 step (step < 1)", () => {
    expect(validateField("minute", "*/0")).not.toBeNull();
  });

  it("rejects a step that exceeds the range (*/61 for minute)", () => {
    expect(validateField("minute", "*/61")).not.toBeNull();
  });

  it("accepts a range with step: 0-30/5", () => {
    expect(validateField("minute", "0-30/5")).toBeNull();
  });

  it("rejects out-of-range low bound in range (0-60 for minute)", () => {
    // 60 is out of range for minute (max 59)
    expect(validateField("minute", "0-60")).not.toBeNull();
  });

  it("rejects plain number out of range for dom (32)", () => {
    expect(validateField("dom", "32")).not.toBeNull();
  });

  it("accepts dom=1 and dom=31", () => {
    expect(validateField("dom", "1")).toBeNull();
    expect(validateField("dom", "31")).toBeNull();
  });

  it("rejects dom=0 (out of range)", () => {
    expect(validateField("dom", "0")).not.toBeNull();
  });

  it("rejects completely invalid token", () => {
    expect(validateField("minute", "foo")).not.toBeNull();
  });
});

// ── nextRuns dom+dow both specified (OR semantics) ─────────────────────────

describe("nextRuns dom+dow OR semantics", () => {
  // Use a UTC anchor far from midnight to avoid timezone edge cases.
  // 2024-01-15T06:00:00Z = Monday, 15th at 06:00 UTC.
  const anchor = new Date("2024-01-15T06:00:00Z");

  it("fires when dom=1 occurs before the next Sunday", () => {
    // dom=1 (1st of month) OR dow=0 (Sunday).
    // Anchor is the 15th; next dom=1 is Feb 1 (also a Thursday, not Sunday).
    // Next Sunday from Jan 15 is Jan 21.
    // With OR semantics, the earlier of these is Jan 21 (Sunday).
    const runs = nextRuns(
      { minute: "0", hour: "12", dom: "1", month: "*", dow: "0" },
      1,
      anchor
    );
    expect(runs).toHaveLength(1);
    // Result should be strictly after anchor
    expect(runs[0].getTime()).toBeGreaterThan(anchor.getTime());
    // Day of week is either 0 (Sunday) or the result is on the 1st
    const dow = runs[0].getDay();
    const date = runs[0].getDate();
    expect(dow === 0 || date === 1).toBe(true);
  });

  it("fires when dow matches even if dom does not", () => {
    // dom=31 (not this month at all for Feb) or dow=1 (Monday).
    // From Jan 15 (Monday), next Mon is Jan 22.
    const runs = nextRuns(
      { minute: "0", hour: "12", dom: "31", month: "*", dow: "1" },
      1,
      anchor
    );
    expect(runs).toHaveLength(1);
    // Result is strictly after anchor
    expect(runs[0].getTime()).toBeGreaterThan(anchor.getTime());
    // Must match either dom=31 or dow=1
    const dow = runs[0].getDay();
    const date = runs[0].getDate();
    expect(dow === 1 || date === 31).toBe(true);
  });
});

// ── describeCron special cases ─────────────────────────────────────────────

describe("describeCron special cases", () => {
  it("describes weekday schedule Mon-Fri with 'Monday through Friday'", () => {
    const { fields } = expressionToFields("0 9 * * 1-5");
    expect(describeCron(fields)).toMatch(/Monday through Friday/i);
  });

  it("describes weekend (0,6) correctly", () => {
    const { fields } = expressionToFields("0 10 * * 0,6");
    const desc = describeCron(fields);
    expect(desc).toMatch(/Saturday and Sunday/i);
  });

  it("describes a single DOW", () => {
    const { fields } = expressionToFields("0 9 * * 3");
    expect(describeCron(fields)).toMatch(/Wednesday/i);
  });

  it("returns an error string for invalid fields", () => {
    const desc = describeCron({ minute: "99", hour: "*", dom: "*", month: "*", dow: "*" });
    expect(desc).toMatch(/Invalid/i);
  });
});
