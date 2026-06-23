import { describe, expect, it } from "vitest";
import { LAYOUT_TEMPLATES, getTemplate } from "./layouts";

describe("LAYOUT_TEMPLATES", () => {
  it("all templates have at least one cell", () => {
    for (const t of LAYOUT_TEMPLATES) {
      expect(t.cells.length).toBeGreaterThan(0);
    }
  });

  it("all cell rects are in normalised [0,1] space", () => {
    for (const t of LAYOUT_TEMPLATES) {
      for (const c of t.cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("all template ids are unique", () => {
    const ids = LAYOUT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("single template has exactly one cell covering full canvas", () => {
    const t = getTemplate("single");
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.cells.length).toBe(1);
    expect(t.cells[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("4-grid template has exactly 4 cells forming a 2x2 grid", () => {
    const t = getTemplate("4-grid");
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.cells.length).toBe(4);
  });

  it("9-grid template has exactly 9 cells", () => {
    const t = getTemplate("9-grid");
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.cells.length).toBe(9);
  });

  it("getTemplate returns undefined for unknown id", () => {
    expect(getTemplate("unknown-xyz")).toBeUndefined();
  });

  it("cell areas in 2-horizontal sum to approximately 1.0", () => {
    const t = getTemplate("2-horizontal");
    expect(t).toBeDefined();
    if (!t) return;
    const totalArea = t.cells.reduce((sum, c) => sum + c.w * c.h, 0);
    expect(totalArea).toBeCloseTo(1.0, 5);
  });

  it("cell areas in 9-grid each equal 1/9", () => {
    const t = getTemplate("9-grid");
    expect(t).toBeDefined();
    if (!t) return;
    for (const c of t.cells) {
      expect(c.w * c.h).toBeCloseTo(1 / 9, 5);
    }
  });
});
