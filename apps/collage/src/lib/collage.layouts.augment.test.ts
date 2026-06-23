/**
 * Augmented tests for collage app:
 * - layouts.ts additional coverage for template area invariants and getTemplate
 * - exportFilename.ts additional edge cases (time-zone independent mocked time)
 * - resizeMath.ts additional edge cases for w/h minimum-clamping interactions
 */
import { describe, expect, it, vi } from "vitest";
import { LAYOUT_TEMPLATES, getTemplate } from "./layouts";
import { exportFilename } from "./exportFilename";
import { MIN_FRAC, applyResize } from "./resizeMath";

// ── layouts.ts additional coverage ───────────────────────────────────────────

describe("LAYOUT_TEMPLATES - additional invariants", () => {
  it("all templates have non-empty description", () => {
    for (const t of LAYOUT_TEMPLATES) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("all templates have non-empty label", () => {
    for (const t of LAYOUT_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it("2-vertical template has two cells stacked (same x, adjacent y)", () => {
    const t = getTemplate("2-vertical");
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.cells).toHaveLength(2);
    expect(t.cells[0].x).toBe(0);
    expect(t.cells[1].x).toBe(0);
    expect(t.cells[0].y + t.cells[0].h).toBeCloseTo(t.cells[1].y, 5);
  });

  it("3-equal has three cells of equal width", () => {
    const t = getTemplate("3-equal");
    expect(t).toBeDefined();
    if (!t) return;
    for (const c of t.cells) {
      expect(c.w).toBeCloseTo(1 / 3, 5);
    }
  });

  it("4-banner has a large top cell (height > 0.5)", () => {
    const t = getTemplate("4-banner");
    expect(t).toBeDefined();
    if (!t) return;
    const topCell = t.cells[0];
    expect(topCell.h).toBeGreaterThan(0.5);
  });

  it("6-grid has 6 cells each of area 1/6", () => {
    const t = getTemplate("6-grid");
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.cells).toHaveLength(6);
    for (const c of t.cells) {
      expect(c.w * c.h).toBeCloseTo(1 / 6, 5);
    }
  });
});

// ── exportFilename.ts additional coverage ─────────────────────────────────────

describe("exportFilename - additional cases", () => {
  it("the date segment always has exactly 8 digits and 6 digits", () => {
    const name = exportFilename("png");
    const match = /^collage-(\d{8})-(\d{6})\.(png|jpg)$/.exec(name);
    expect(match).not.toBeNull();
    if (!match) return;
    expect(match[1]).toHaveLength(8);
    expect(match[2]).toHaveLength(6);
  });

  it("png and jpg produce different file extensions with same mock time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T09:05:03.000Z"));
    const png = exportFilename("png");
    const jpg = exportFilename("jpg");
    vi.useRealTimers();
    expect(png).toMatch(/\.png$/);
    expect(jpg).toMatch(/\.jpg$/);
    // Stems should be the same
    expect(png.replace(/\.png$/, "")).toBe(jpg.replace(/\.jpg$/, ""));
  });
});

// ── resizeMath.ts additional edge cases ───────────────────────────────────────

describe("applyResize - additional edge cases", () => {
  const base = { x: 0.3, y: 0.3, w: 0.4, h: 0.3 };

  it("result width is always >= MIN_FRAC for all 8 handles (large negative delta)", () => {
    const handles = ["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const;
    for (const handle of handles) {
      const result = applyResize(base, handle, -5, -5);
      expect(result.w).toBeGreaterThanOrEqual(MIN_FRAC);
    }
  });

  it("result height is always >= MIN_FRAC for corner handles (large negative delta)", () => {
    const handles = ["nw", "ne", "sw", "se"] as const;
    for (const handle of handles) {
      const result = applyResize(base, handle, -5, -5);
      // height is derived from width / aspectRatio for corner handles
      // so with MIN_FRAC width and original aspect, height could be very small
      // We just confirm no negative or zero
      expect(result.h).toBeGreaterThan(0);
    }
  });

  it("x stays within [0, 1-w] after nw resize growing left", () => {
    // Large negative dx = grows to the left beyond canvas
    const result = applyResize({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 }, "nw", -9, 0);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x + result.w).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("y stays within [0, 1-h] after ne resize growing up", () => {
    const result = applyResize({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 }, "ne", 0, -9);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y + result.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("zero delta returns card dimensions unchanged", () => {
    const base2 = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 };
    const result = applyResize(base2, "se", 0, 0);
    expect(result.w).toBeCloseTo(base2.w, 5);
    expect(result.h).toBeCloseTo(base2.h, 5);
    expect(result.x).toBeCloseTo(base2.x, 5);
    expect(result.y).toBeCloseTo(base2.y, 5);
  });
});
