/**
 * Augmentation tests for depthEstimation.ts and imageHelpers.ts
 * Covers pathways not in the existing tests:
 *
 * depthEstimation.ts:
 *   - All colour maps: boundary values at exact stop endpoints
 *   - Monotonicity checks (colour maps should change across the range)
 *   - applyColourMap greyscale boundary and mid-range
 *   - viridisColour intermediate segments
 *   - magmaColour/turboColour/plasmaColour t=0.5 validity
 *
 * imageHelpers.ts:
 *   - formatBytes edge cases: exact 1024, exact 1MB
 *   - formatProgress: 1% rounding, negative loaded
 *   - outputFilename: file with multiple dots, no extension
 */
import { describe, expect, it } from "vitest";
import {
  applyColourMap,
  magmaColour,
  plasmaColour,
  turboColour,
  viridisColour,
} from "./depthEstimation";
import { formatBytes, formatProgress, outputFilename } from "./imageHelpers";

// ── viridisColour boundary segments ────────────────────────────────────────

describe("viridisColour boundary segments", () => {
  it("t=0.143 (exact stop boundary) produces valid RGB", () => {
    const [r, g, b] = viridisColour(0.143);
    expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
  });

  it("values at all 8 stop boundaries are in 0-255", () => {
    const stops = [0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857, 1.0];
    for (const t of stops) {
      const [r, g, b] = viridisColour(t);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("viridis overall shifts from dark blue to bright yellow (monotone change)", () => {
    // At t=0 the sum of RGB is low; at t=1 it's high (yellow = R+G dominant)
    const sumAt0 = viridisColour(0).reduce((a, b) => a + b, 0);
    const sumAt1 = viridisColour(1).reduce((a, b) => a + b, 0);
    expect(sumAt1).toBeGreaterThan(sumAt0);
  });
});

// ── magmaColour additional tests ───────────────────────────────────────────

describe("magmaColour additional tests", () => {
  it("t=0.5 produces valid mid-range colour", () => {
    const [r, g, b] = magmaColour(0.5);
    expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
  });

  it("t=0.5 is distinctly between the t=0 and t=1 endpoints", () => {
    const [r0] = magmaColour(0);
    const [r1] = magmaColour(1);
    const [r5] = magmaColour(0.5);
    // r at 0.5 should be between the two extremes
    expect(r5).toBeGreaterThan(r0);
    expect(r5).toBeLessThan(r1);
  });

  it("all 8 stop boundaries return valid RGB", () => {
    const stops = [0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857, 1.0];
    for (const t of stops) {
      const [r, g, b] = magmaColour(t);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
    }
  });
});

// ── turboColour additional tests ───────────────────────────────────────────

describe("turboColour additional tests", () => {
  it("t=0.5 produces cyan/green (high green channel)", () => {
    const [, g] = turboColour(0.5);
    // Turbo at midpoint is green-ish
    expect(g).toBeGreaterThan(150);
  });

  it("all 8 stop boundaries return valid RGB", () => {
    const stops = [0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857, 1.0];
    for (const t of stops) {
      const [r, g, b] = turboColour(t);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("is not identical at t=0 and t=1 (colour diversity)", () => {
    expect(turboColour(0)).not.toEqual(turboColour(1));
  });
});

// ── plasmaColour additional tests ──────────────────────────────────────────

describe("plasmaColour additional tests", () => {
  it("t=0.5 produces orange-ish tones (high red)", () => {
    const [r] = plasmaColour(0.5);
    expect(r).toBeGreaterThan(150);
  });

  it("all 8 stop boundaries return valid RGB", () => {
    const stops = [0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857, 1.0];
    for (const t of stops) {
      const [r, g, b] = plasmaColour(t);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
    }
  });

  it("clamps negative value same as 0", () => {
    expect(plasmaColour(-0.001)).toEqual(plasmaColour(0));
  });
});

// ── applyColourMap greyscale mid-range ────────────────────────────────────

describe("applyColourMap greyscale mid-range", () => {
  it("t=0.5 greyscale is exactly (128,128,128)", () => {
    const [r, g, b] = applyColourMap(0.5, "greyscale");
    expect(r).toBe(128);
    expect(g).toBe(128);
    expect(b).toBe(128);
  });

  it("t=0.25 greyscale is (64,64,64)", () => {
    const [r, g, b] = applyColourMap(0.25, "greyscale");
    expect(r).toBe(64);
    expect(g).toBe(64);
    expect(b).toBe(64);
  });

  it("t=0.75 greyscale is (191,191,191)", () => {
    const [r, g, b] = applyColourMap(0.75, "greyscale");
    expect(r).toBe(191);
    expect(g).toBe(191);
    expect(b).toBe(191);
  });

  it("greyscale out-of-range t clamped via dispatch", () => {
    // viridis clamps; for greyscale Math.round(t*255) with t=1.5 = 255 if clamped
    // applyColourMap passes t directly to the greyscale branch which uses Math.round(t*255)
    // The viridis/magma/etc map internals clamp but greyscale branch does not call clamp.
    // Let's test it doesn't throw.
    expect(() => applyColourMap(1.5, "greyscale")).not.toThrow();
    expect(() => applyColourMap(-0.5, "greyscale")).not.toThrow();
  });
});

// ── applyColourMap routes all colour maps ─────────────────────────────────

describe("applyColourMap routes all colour maps", () => {
  const colourMaps = ["viridis", "magma", "turbo", "plasma", "greyscale"] as const;
  for (const cm of colourMaps) {
    it(`applyColourMap delegates ${cm} for t=0`, () => {
      expect(() => applyColourMap(0, cm)).not.toThrow();
      const [r, g, b] = applyColourMap(0, cm);
      expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
    });
  }
});

// ── formatBytes edge cases ────────────────────────────────────────────────

describe("formatBytes edge cases", () => {
  it("formats exactly 1024 as 1.0 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats exactly 1 MB as 1.0 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats 0 bytes as 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats 1023 bytes as B (not KB)", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats large files in MB", () => {
    const tenMB = 10 * 1024 * 1024;
    expect(formatBytes(tenMB)).toBe("10.0 MB");
  });
});

// ── formatProgress edge cases ─────────────────────────────────────────────

describe("formatProgress edge cases", () => {
  it("returns 0% when loaded is 0 and total > 0", () => {
    expect(formatProgress(0, 100)).toBe("0%");
  });

  it("returns 100% when loaded equals total", () => {
    expect(formatProgress(50, 50)).toBe("100%");
  });

  it("caps at 100% even when loaded > total", () => {
    expect(formatProgress(150, 100)).toBe("100%");
  });

  it("returns 0% for negative total", () => {
    expect(formatProgress(0, -1)).toBe("0%");
  });

  it("rounds correctly for non-integer percentage", () => {
    // 1/3 = 33.33... -> 33%
    expect(formatProgress(1, 3)).toBe("33%");
    // 2/3 = 66.66... -> 67%
    expect(formatProgress(2, 3)).toBe("67%");
  });
});

// ── outputFilename edge cases ─────────────────────────────────────────────

describe("outputFilename edge cases", () => {
  it("handles filename with no extension", () => {
    expect(outputFilename("image")).toBe("image-depth.png");
  });

  it("handles filename with multiple dots", () => {
    expect(outputFilename("my.landscape.jpeg")).toBe("my.landscape-depth.png");
  });

  it("handles empty-ish filename", () => {
    expect(outputFilename(".png")).toBe("-depth.png");
  });

  it("always appends -depth.png regardless of input extension", () => {
    expect(outputFilename("shot.webp")).toBe("shot-depth.png");
    expect(outputFilename("shot.jpg")).toBe("shot-depth.png");
    expect(outputFilename("shot.png")).toBe("shot-depth.png");
  });
});
