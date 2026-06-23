import { wcagLuminance } from "culori";
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance, wcagAssessment } from "./contrast";

describe("relativeLuminance", () => {
  it("black is 0", () => {
    expect(relativeLuminance("#000000")).toBe(0);
  });

  it("white is 1", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("mid grey is between 0 and 1", () => {
    const l = relativeLuminance("#808080");
    expect(l).toBeGreaterThan(0);
    expect(l).toBeLessThan(1);
  });

  it("returns 0 for invalid input", () => {
    expect(relativeLuminance("invalid")).toBe(0);
    expect(relativeLuminance("")).toBe(0);
  });
});

describe("contrastRatio", () => {
  it("black vs white ≈ 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("white vs white = 1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("black vs black = 1", () => {
    expect(contrastRatio("#000000", "#000000")).toBe(1);
  });

  it("is symmetric (fg/bg order doesn't matter)", () => {
    const r1 = contrastRatio("#336699", "#ffffff");
    const r2 = contrastRatio("#ffffff", "#336699");
    expect(r1).toBeCloseTo(r2, 10);
  });

  it("mid grey on white gives a value between 1 and 21", () => {
    const r = contrastRatio("#808080", "#ffffff");
    expect(r).toBeGreaterThan(1);
    expect(r).toBeLessThan(21);
    // WCAG published value for #767676 on white is ~4.54; #808080 is slightly lower
    expect(r).toBeCloseTo(3.95, 1);
  });
});

describe("wcagAssessment", () => {
  it("1:1 fails everything", () => {
    const a = wcagAssessment(1);
    expect(a.aaNormal).toBe(false);
    expect(a.aaLarge).toBe(false);
    expect(a.aaaNormal).toBe(false);
    expect(a.aaaLarge).toBe(false);
  });

  it("exactly 3:1 passes aaLarge only", () => {
    const a = wcagAssessment(3);
    expect(a.aaLarge).toBe(true);
    expect(a.aaNormal).toBe(false);
    expect(a.aaaNormal).toBe(false);
    expect(a.aaaLarge).toBe(false);
  });

  it("exactly 4.5:1 passes aaNormal + aaLarge + aaaLarge", () => {
    const a = wcagAssessment(4.5);
    expect(a.aaNormal).toBe(true);
    expect(a.aaLarge).toBe(true);
    expect(a.aaaLarge).toBe(true);
    expect(a.aaaNormal).toBe(false);
  });

  it("exactly 7:1 passes everything", () => {
    const a = wcagAssessment(7);
    expect(a.aaNormal).toBe(true);
    expect(a.aaLarge).toBe(true);
    expect(a.aaaNormal).toBe(true);
    expect(a.aaaLarge).toBe(true);
  });

  it("21:1 passes everything", () => {
    const a = wcagAssessment(21);
    expect(a.aaNormal).toBe(true);
    expect(a.aaLarge).toBe(true);
    expect(a.aaaNormal).toBe(true);
    expect(a.aaaLarge).toBe(true);
  });

  it("2.9:1 fails even aaLarge", () => {
    const a = wcagAssessment(2.9);
    expect(a.aaLarge).toBe(false);
  });
});

// ── luminance parity: relativeLuminance vs culori wcagLuminance ───────────────
//
// Both implementations must agree to within floating-point rounding (1e-6).
// This guards against silent divergence between the hand-rolled WCAG formula
// in contrast.ts and culori's implementation used in color.ts.

describe("relativeLuminance parity with culori wcagLuminance", () => {
  const SAMPLES: string[] = [
    "#000000",
    "#ffffff",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#808080",
    "#336699",
    "#f0e040",
  ];

  for (const hex of SAMPLES) {
    it(`${hex}: relativeLuminance ≈ culori wcagLuminance (tolerance 1e-6)`, () => {
      const ours = relativeLuminance(hex);
      const culoriVal = wcagLuminance(hex) ?? 0;
      expect(Math.abs(ours - culoriVal)).toBeLessThan(1e-6);
    });
  }
});
