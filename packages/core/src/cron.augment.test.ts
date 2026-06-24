/**
 * Direct unit tests for the N/step cron form in packages/core/src/cron.ts.
 * The core cron functions are not individually exported so we exercise them
 * through cronTool (the only public surface). We call the ToolDef's "describe"
 * op which runs parseExpression + expandField internally.
 *
 * Added for gauntlet wave-4 finding 1.
 */
import { describe, expect, it } from "vitest";
import { cronTool } from "./cron.js";

const describeOp = cronTool.ops.find((o) => o.name === "describe")!;

function parse(expr: string): { human: string; nextRuns: string[] } {
  return describeOp.run({ expr, nextCount: 8 }) as { human: string; nextRuns: string[] };
}

function parseThrows(expr: string): string {
  try {
    parse(expr);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}

describe("cronTool N/step form — valid cases", () => {
  it("accepts '0/15 * * * *' and fires at minutes 0,15,30,45", () => {
    const result = parse("0/15 * * * *");
    expect(result.nextRuns).toHaveLength(8);
    const mins = result.nextRuns.map((iso) => new Date(iso).getUTCMinutes());
    // We should see 0,15,30,45 cycling
    const validMins = new Set([0, 15, 30, 45]);
    for (const m of mins) expect(validMins.has(m)).toBe(true);
  });

  it("accepts '5/10 * * * *' and fires at minutes 5,15,25,35,45,55", () => {
    const result = parse("5/10 * * * *");
    expect(result.nextRuns).toHaveLength(8);
    const mins = result.nextRuns.map((iso) => new Date(iso).getUTCMinutes());
    const validMins = new Set([5, 15, 25, 35, 45, 55]);
    for (const m of mins) expect(validMins.has(m)).toBe(true);
  });

  it("accepts '0 0 1/2 * *' (dom step, odd days)", () => {
    const result = parse("0 0 1/2 * *");
    expect(result.nextRuns.length).toBeGreaterThan(0);
    const dates = result.nextRuns.map((iso) => new Date(iso).getUTCDate());
    const validDates = new Set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
    for (const d of dates) expect(validDates.has(d)).toBe(true);
  });
});

describe("cronTool N/step form — invalid cases", () => {
  it("rejects '0/0 * * * *' (step 0)", () => {
    const err = parseThrows("0/0 * * * *");
    expect(err).not.toBe("");
    expect(err).toMatch(/Step must be >= 1/);
  });

  it("rejects '99/5 * * * *' (start 99 out of range for minute 0-59)", () => {
    const err = parseThrows("99/5 * * * *");
    expect(err).not.toBe("");
    expect(err).toMatch(/out of range/);
  });
});

describe("cronTool existing behaviour unchanged", () => {
  it("still accepts */15 * * * *", () => {
    expect(() => parse("*/15 * * * *")).not.toThrow();
  });

  it("still accepts 0-30/5 * * * *", () => {
    expect(() => parse("0-30/5 * * * *")).not.toThrow();
  });

  it("still rejects dow=7", () => {
    const err = parseThrows("0 0 * * 7");
    expect(err).not.toBe("");
    expect(err).toMatch(/out of range/);
  });
});

// ── describeDows exact-set guard (gauntlet w5 finding 1) ──────────────────
describe("cronTool describeDows exact Mon-Fri set", () => {
  it("describes 0 9 * * 1-5 as Monday through Friday (genuine case)", () => {
    const result = parse("0 9 * * 1-5");
    expect(result.human).toContain("Monday through Friday");
  });

  it("describes 0 9 * * 1,2,3,4,5 as Monday through Friday (explicit list)", () => {
    const result = parse("0 9 * * 1,2,3,4,5");
    expect(result.human).toContain("Monday through Friday");
  });

  it("does NOT describe 0 9 * * 1,2,3,5,6 (Mon,Tue,Wed,Fri,Sat) as Monday through Friday", () => {
    const result = parse("0 9 * * 1,2,3,5,6");
    expect(result.human).not.toContain("Monday through Friday");
    // Should name the actual days (Mon, Tue, Wed, Fri, Sat)
    expect(result.human).toMatch(/Monday|Mon/i);
    expect(result.human).toMatch(/Saturday|Sat/i);
  });
});
