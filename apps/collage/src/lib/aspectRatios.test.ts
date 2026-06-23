import { describe, expect, it } from "vitest";
import { ASPECT_PRESETS, canvasPreviewSize, getAspectPreset } from "./aspectRatios";

describe("ASPECT_PRESETS", () => {
  it("all presets have a positive ratio", () => {
    for (const p of ASPECT_PRESETS) {
      expect(p.ratio).toBeGreaterThan(0);
    }
  });

  it("export dimensions match the declared ratio", () => {
    for (const p of ASPECT_PRESETS) {
      const computed = p.exportWidth / p.exportHeight;
      expect(computed).toBeCloseTo(p.ratio, 2);
    }
  });

  it("1:1 is square", () => {
    const p = getAspectPreset("1:1");
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.exportWidth).toBe(p.exportHeight);
  });

  it("9:16 is portrait (width < height)", () => {
    const p = getAspectPreset("9:16");
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.exportWidth).toBeLessThan(p.exportHeight);
  });

  it("16:9 is landscape (width > height)", () => {
    const p = getAspectPreset("16:9");
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.exportWidth).toBeGreaterThan(p.exportHeight);
  });

  it("getAspectPreset returns undefined for unknown id", () => {
    expect(getAspectPreset("unknown")).toBeUndefined();
  });

  it("social presets all have valid positive ratios and export dimensions", () => {
    const socialIds = ["ig-square", "ig-portrait", "ig-story", "pinterest"];
    for (const id of socialIds) {
      const p = getAspectPreset(id);
      expect(p).toBeDefined();
      if (!p) return;
      expect(p.ratio).toBeGreaterThan(0);
      expect(p.exportWidth).toBeGreaterThan(0);
      expect(p.exportHeight).toBeGreaterThan(0);
      expect(p.exportWidth / p.exportHeight).toBeCloseTo(p.ratio, 2);
    }
  });

  it("ig-story is portrait (9:16)", () => {
    const p = getAspectPreset("ig-story");
    expect(p?.exportWidth).toBeLessThan(p?.exportHeight ?? 0);
  });

  it("ig-square is square", () => {
    const p = getAspectPreset("ig-square");
    expect(p?.exportWidth).toBe(p?.exportHeight);
  });
});

describe("canvasPreviewSize", () => {
  it("fits a 1:1 ratio inside a 600x600 container", () => {
    const size = canvasPreviewSize(1, 600, 600);
    expect(size.width).toBe(600);
    expect(size.height).toBe(600);
  });

  it("fits a 16:9 landscape inside a 800x600 container width-first", () => {
    const size = canvasPreviewSize(16 / 9, 800, 600);
    expect(size.width).toBe(800);
    expect(size.height).toBeCloseTo(800 / (16 / 9), 0);
    expect(size.height).toBeLessThanOrEqual(600);
  });

  it("fits a 9:16 portrait inside a 400x800 container", () => {
    const size = canvasPreviewSize(9 / 16, 400, 800);
    expect(size.width).toBeLessThanOrEqual(400);
    expect(size.height).toBeLessThanOrEqual(800);
  });

  it("output ratio matches the input ratio", () => {
    const ratio = 4 / 5;
    const size = canvasPreviewSize(ratio, 720, 580);
    expect(size.width / size.height).toBeCloseTo(ratio, 3);
  });
});

/**
 * Mobile viewport scaling: the canvas renders at full logical pixels
 * (canvasPreviewSize with PREVIEW_MAX_W=720) but is CSS-scaled down so
 * it never exceeds the actual container width on narrow screens.
 *
 * This replicates the scale computation from App.tsx.
 */
describe("mobile canvas scale factor", () => {
  const PREVIEW_MAX_W = 720;
  const PREVIEW_MAX_H = 580;

  function computeScale(ratio: number, containerWidth: number) {
    const previewSize = canvasPreviewSize(ratio, PREVIEW_MAX_W, PREVIEW_MAX_H);
    return Math.min(1, containerWidth / previewSize.width);
  }

  it("scale is 1 when container is wider than preview", () => {
    expect(computeScale(1, 800)).toBe(1);
  });

  it("scale is 1 at exactly the preview width", () => {
    const size = canvasPreviewSize(1, PREVIEW_MAX_W, PREVIEW_MAX_H);
    expect(computeScale(1, size.width)).toBe(1);
  });

  it("scale < 1 on a 390px mobile viewport (1:1 aspect)", () => {
    const scale = computeScale(1, 390);
    expect(scale).toBeLessThan(1);
    // Scaled canvas width must not exceed container
    const previewSize = canvasPreviewSize(1, PREVIEW_MAX_W, PREVIEW_MAX_H);
    expect(Math.round(previewSize.width * scale)).toBeLessThanOrEqual(390);
  });

  it("scaled canvas width never exceeds container on 360px screen for all aspects", () => {
    const containerWidth = 360;
    for (const preset of ASPECT_PRESETS) {
      const scale = computeScale(preset.ratio, containerWidth);
      const previewSize = canvasPreviewSize(preset.ratio, PREVIEW_MAX_W, PREVIEW_MAX_H);
      const scaledW = Math.round(previewSize.width * scale);
      expect(scaledW).toBeLessThanOrEqual(containerWidth);
    }
  });

  it("aspect ratio is preserved after scaling", () => {
    const ratio = 16 / 9;
    // computeScale keeps the logical size unchanged — only the CSS scale factor changes.
    // So the logical width/height ratio is always identical to the input ratio.
    const previewSize = canvasPreviewSize(ratio, PREVIEW_MAX_W, PREVIEW_MAX_H);
    expect(previewSize.width / previewSize.height).toBeCloseTo(ratio, 3);
  });
});
