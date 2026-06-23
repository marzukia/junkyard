import { describe, expect, it } from "vitest";
import { MIN_FRAC, applyResize } from "./resizeMath";
import type { CardRect, ResizeHandle } from "./resizeMath";

const base: CardRect = { x: 0.1, y: 0.1, w: 0.3, h: 0.2 };
// aspect = 0.3 / 0.2 = 1.5

describe("applyResize — corner handles maintain aspect ratio", () => {
  it("se: dragging right increases w and h proportionally", () => {
    const result = applyResize(base, "se", 0.1, 0.0);
    expect(result.w).toBeCloseTo(0.4, 5);
    expect(result.h).toBeCloseTo(0.4 / 1.5, 5);
    expect(result.x).toBe(base.x);
    expect(result.y).toBe(base.y);
  });

  it("se: dragging left decreases w and h proportionally", () => {
    const result = applyResize(base, "se", -0.1, 0.0);
    expect(result.w).toBeCloseTo(0.2, 5);
    expect(result.h).toBeCloseTo(0.2 / 1.5, 5);
  });

  it("nw: dragging shrinks card from top-left, moves x+y", () => {
    const result = applyResize(base, "nw", 0.1, 0.0);
    // Shrinks w by 0.1, x moves right by 0.1
    expect(result.w).toBeCloseTo(0.2, 5);
    expect(result.x).toBeCloseTo(0.2, 5); // 0.1 + 0.1
  });

  it("ne: dragging right grows card, y adjusts", () => {
    const result = applyResize(base, "ne", 0.1, 0.0);
    expect(result.w).toBeCloseTo(0.4, 5);
    const expectedH = 0.4 / 1.5;
    // y = start.y + start.h - h (top edge moves up)
    expect(result.y).toBeCloseTo(base.y + base.h - expectedH, 5);
  });

  it("sw: dragging left grows card, x adjusts", () => {
    const result = applyResize(base, "sw", -0.05, 0.0);
    expect(result.w).toBeCloseTo(0.35, 5);
    expect(result.x).toBeCloseTo(base.x + base.w - 0.35, 5);
  });
});

describe("applyResize — edge handles resize one axis", () => {
  it("e: increases w only", () => {
    const result = applyResize(base, "e", 0.05, 0.99);
    expect(result.w).toBeCloseTo(0.35, 5);
    expect(result.h).toBe(base.h); // unchanged
    expect(result.y).toBe(base.y);
  });

  it("w: decreases w and moves x", () => {
    const result = applyResize(base, "w", 0.05, 0.0);
    expect(result.w).toBeCloseTo(0.25, 5);
    expect(result.x).toBeCloseTo(0.15, 5);
    expect(result.h).toBe(base.h);
  });

  it("s: increases h only", () => {
    const result = applyResize(base, "s", 0.0, 0.05);
    expect(result.h).toBeCloseTo(0.25, 5);
    expect(result.w).toBe(base.w);
    expect(result.x).toBe(base.x);
  });

  it("n: decreases h and moves y", () => {
    const result = applyResize(base, "n", 0.0, 0.05);
    expect(result.h).toBeCloseTo(0.15, 5);
    expect(result.y).toBeCloseTo(0.15, 5);
    expect(result.w).toBe(base.w);
  });
});

describe("applyResize — minimum size clamping", () => {
  it("se: cannot shrink below MIN_FRAC", () => {
    const result = applyResize(base, "se", -9.0, 0.0);
    expect(result.w).toBeGreaterThanOrEqual(MIN_FRAC);
    expect(result.h).toBeGreaterThan(0);
  });

  it("e: cannot shrink below MIN_FRAC", () => {
    const result = applyResize(base, "e", -9.0, 0.0);
    expect(result.w).toBeGreaterThanOrEqual(MIN_FRAC);
  });

  it("n: cannot shrink below MIN_FRAC", () => {
    const result = applyResize(base, "n", 0.0, 9.0);
    expect(result.h).toBeGreaterThanOrEqual(MIN_FRAC);
  });
});

describe("applyResize — canvas boundary clamping", () => {
  it("se: width clamped to 1 - x", () => {
    const result = applyResize(base, "se", 9.0, 0.0);
    expect(result.w).toBeLessThanOrEqual(1 - base.x);
  });

  it("nw: x never goes negative", () => {
    const result = applyResize(base, "nw", -9.0, 0.0);
    expect(result.x).toBeGreaterThanOrEqual(0);
  });

  it("s: h clamped so card stays inside canvas", () => {
    const result = applyResize(base, "s", 0.0, 9.0);
    expect(result.y + result.h).toBeLessThanOrEqual(1 + 1e-10);
  });
});

describe("applyResize — handles all 8 handle types", () => {
  const handles: ResizeHandle[] = ["nw", "ne", "sw", "se", "n", "s", "e", "w"];
  for (const handle of handles) {
    it(`${handle}: returns valid rect`, () => {
      const result = applyResize(base, handle, 0.05, 0.05);
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.w).toBeGreaterThanOrEqual(MIN_FRAC);
      expect(result.h).toBeGreaterThan(0);
    });
  }
});
