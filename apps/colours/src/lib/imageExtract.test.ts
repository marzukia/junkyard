/**
 * Tests for the pure logic in imageExtract.ts.
 *
 * Canvas-dependent functions (samplePixels, extractPaletteFromFile,
 * extractPaletteFromImage) require a DOM with canvas support; we test only the
 * pure parts that can run in jsdom without a real canvas implementation.
 */

import { describe, expect, it } from "vitest";
import { extractPaletteFromPixels, isImageFile } from "./imageExtract";
import { mulberry32 } from "./palette";

// ── isImageFile ───────────────────────────────────────────────────────────────

describe("isImageFile", () => {
  function makeFile(name: string, type: string): File {
    return new File([""], name, { type });
  }

  it("accepts image/jpeg", () => {
    expect(isImageFile(makeFile("photo.jpg", "image/jpeg"))).toBe(true);
  });

  it("accepts image/png", () => {
    expect(isImageFile(makeFile("icon.png", "image/png"))).toBe(true);
  });

  it("accepts image/webp", () => {
    expect(isImageFile(makeFile("art.webp", "image/webp"))).toBe(true);
  });

  it("accepts image/gif", () => {
    expect(isImageFile(makeFile("anim.gif", "image/gif"))).toBe(true);
  });

  it("rejects text/plain", () => {
    expect(isImageFile(makeFile("readme.txt", "text/plain"))).toBe(false);
  });

  it("rejects application/pdf", () => {
    expect(isImageFile(makeFile("doc.pdf", "application/pdf"))).toBe(false);
  });

  it("rejects empty type string", () => {
    expect(isImageFile(makeFile("unknown", ""))).toBe(false);
  });
});

// ── mulberry32 PRNG determinism ───────────────────────────────────────────────

describe("mulberry32 PRNG", () => {
  it("same seed produces the same sequence", () => {
    const r1 = mulberry32(12345);
    const r2 = mulberry32(12345);
    const seq1 = Array.from({ length: 20 }, () => r1());
    const seq2 = Array.from({ length: 20 }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  it("different seeds produce different first values", () => {
    const r1 = mulberry32(1);
    const r2 = mulberry32(2);
    expect(r1()).not.toBe(r2());
  });

  it("outputs are in [0, 1)", () => {
    const r = mulberry32(999);
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ── k-means determinism via extractPaletteFromPixels ─────────────────────────

// Diffuse pixel set: many pixels spread across the full RGB cube.
// With large variance, initialization order (driven by the PRNG) matters --
// different seeds can land in different local optima, making same-seed identity
// a genuine constraint rather than a vacuous property.
function makeGradientPixels(n: number): Array<{ r: number; g: number; b: number }> {
  const pixels: Array<{ r: number; g: number; b: number }> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pixels.push({
      r: Math.round(t * 255),
      g: Math.round((1 - t) * 255),
      b: Math.round(Math.abs(Math.sin(t * Math.PI * 4)) * 255),
    });
  }
  return pixels;
}

const DIFFUSE = makeGradientPixels(200);

describe("extractPaletteFromPixels -- determinism", () => {
  it("same pixels + same seed always produces the same palette (pinned output)", () => {
    const run1 = extractPaletteFromPixels(DIFFUSE, 5, 42);
    const run2 = extractPaletteFromPixels(DIFFUSE, 5, 42);
    // Both runs must be byte-identical.
    expect(run1).toEqual(run2);
    // Pin the output: if the algorithm changes, this catches the regression.
    expect(run1).toMatchSnapshot();
  });

  it("returns count hex strings for any valid seed", () => {
    const result = extractPaletteFromPixels(DIFFUSE, 4, 1);
    expect(result).toHaveLength(4);
    for (const hex of result) {
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("returns fallback palette for empty pixel array", () => {
    const result = extractPaletteFromPixels([], 4, 1);
    expect(result).toHaveLength(4);
    for (const hex of result) expect(hex).toBe("#808080");
  });
});
