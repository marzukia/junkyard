/**
 * Tests for the N/step cron form (Vixie-cron "start/step" syntax).
 * e.g. 0/15 in the minute field = 0,15,30,45
 * Added for gauntlet wave-4 finding 1.
 */
import { describe, expect, it } from "vitest";
import { validateField, expressionToFields, nextRuns } from "./cron";

describe("validateField N/step form", () => {
  it("accepts 0/15 in minute field", () => {
    expect(validateField("minute", "0/15")).toBeNull();
  });

  it("accepts 5/10 in minute field", () => {
    expect(validateField("minute", "5/10")).toBeNull();
  });

  it("accepts 1/2 in dom field (start 1, step 2)", () => {
    expect(validateField("dom", "1/2")).toBeNull();
  });

  it("rejects 0/0 (step 0 is invalid)", () => {
    expect(validateField("minute", "0/0")).not.toBeNull();
    expect(validateField("minute", "0/0")).toMatch(/Step must be >= 1/);
  });

  it("rejects 99/5 (start out of range 0-59 for minute)", () => {
    expect(validateField("minute", "99/5")).not.toBeNull();
    expect(validateField("minute", "99/5")).toMatch(/out of range/);
  });

  it("does NOT regress dow=7 rejection", () => {
    expect(validateField("dow", "7")).not.toBeNull();
  });
});

describe("expressionToFields N/step form", () => {
  it("accepts '0/15 * * * *'", () => {
    const r = expressionToFields("0/15 * * * *");
    expect(r.ok).toBe(true);
  });

  it("accepts '5/10 * * * *'", () => {
    const r = expressionToFields("5/10 * * * *");
    expect(r.ok).toBe(true);
  });

  it("accepts '0 0 1/2 * *'", () => {
    const r = expressionToFields("0 0 1/2 * *");
    expect(r.ok).toBe(true);
  });

  it("rejects '0/0 * * * *' (step 0)", () => {
    const r = expressionToFields("0/0 * * * *");
    expect(r.ok).toBe(false);
  });

  it("rejects '99/5 * * * *' (start out of range)", () => {
    const r = expressionToFields("99/5 * * * *");
    expect(r.ok).toBe(false);
  });
});

describe("nextRuns N/step expansion", () => {
  const anchor = new Date("2024-01-15T00:00:00Z");

  it("0/15 * * * * produces runs at minutes 0,15,30,45", () => {
    const r = expressionToFields("0/15 * * * *");
    expect(r.ok).toBe(true);
    const runs = nextRuns(r.fields, 8, anchor);
    const mins = runs.map((d) => d.getUTCMinutes());
    expect(mins).toEqual([15, 30, 45, 0, 15, 30, 45, 0]);
  });

  it("5/10 * * * * expands to 5,15,25,35,45,55", () => {
    const r = expressionToFields("5/10 * * * *");
    expect(r.ok).toBe(true);
    // Anchor is 2024-01-15 00:00:00Z; first run is at :05
    const runs = nextRuns(r.fields, 6, anchor);
    const mins = runs.map((d) => d.getUTCMinutes());
    expect(mins).toEqual([5, 15, 25, 35, 45, 55]);
  });

  it("0 0 1/2 * * dom expands to 1,3,5,...,31", () => {
    const r = expressionToFields("0 0 1/2 * *");
    expect(r.ok).toBe(true);
    // Pass timezone="UTC" so nextRuns evaluates midnight in UTC and
    // getUTCDate() reads the correct frame on any host timezone.
    const runs = nextRuns(r.fields, 16, new Date("2023-12-31T00:00:00Z"), "UTC");
    const dates = runs.map((d) => d.getUTCDate());
    expect(dates).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
  });
});
