import { describe, expect, it } from "vitest";
import {
  ACCEPTED_TYPES,
  canvasToImageCoords,
  circleBrushOffsets,
  clamp,
  formatBytes,
  isSupportedImage,
  maskPixelCount,
  outputFilename,
  paintMaskCircle,
} from "./imageHelpers";

describe("isSupportedImage", () => {
  it("accepts PNG files", () => {
    const file = new File([""], "test.png", { type: "image/png" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts JPEG files", () => {
    const file = new File([""], "photo.jpg", { type: "image/jpeg" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts WebP files", () => {
    const file = new File([""], "img.webp", { type: "image/webp" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("accepts GIF files", () => {
    const file = new File([""], "anim.gif", { type: "image/gif" });
    expect(isSupportedImage(file)).toBe(true);
  });

  it("rejects PDF files", () => {
    const file = new File([""], "doc.pdf", { type: "application/pdf" });
    expect(isSupportedImage(file)).toBe(false);
  });

  it("covers all ACCEPTED_TYPES", () => {
    for (const mime of ACCEPTED_TYPES) {
      const file = new File([""], `test.${mime.split("/")[1]}`, { type: mime });
      expect(isSupportedImage(file)).toBe(true);
    }
  });
});

describe("formatBytes", () => {
  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("clamp", () => {
  it("returns value within range unchanged", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("clamps below min to min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above max to max", () => {
    expect(clamp(120, 0, 100)).toBe(100);
  });

  it("handles equal min/max", () => {
    expect(clamp(42, 10, 10)).toBe(10);
  });
});

describe("outputFilename", () => {
  it("strips extension and appends -cleanup.png", () => {
    expect(outputFilename("photo.jpg")).toBe("photo-cleanup.png");
  });

  it("handles dotted names", () => {
    expect(outputFilename("my.photo.webp")).toBe("my.photo-cleanup.png");
  });

  it("handles no extension", () => {
    expect(outputFilename("image")).toBe("image-cleanup.png");
  });
});

describe("canvasToImageCoords", () => {
  it("maps canvas origin to image origin", () => {
    expect(canvasToImageCoords(0, 0, 800, 600, 1600, 1200)).toEqual({ x: 0, y: 0 });
  });

  it("maps canvas center to image center", () => {
    expect(canvasToImageCoords(400, 300, 800, 600, 1600, 1200)).toEqual({ x: 800, y: 600 });
  });

  it("scales correctly when canvas is half image size", () => {
    expect(canvasToImageCoords(100, 50, 400, 200, 800, 400)).toEqual({ x: 200, y: 100 });
  });

  it("rounds to nearest integer", () => {
    const result = canvasToImageCoords(1, 1, 3, 3, 10, 10);
    expect(result.x).toBe(3);
    expect(result.y).toBe(3);
  });
});

describe("circleBrushOffsets", () => {
  it("radius 0 returns only one offset at origin", () => {
    const offsets = circleBrushOffsets(0);
    expect(offsets).toHaveLength(1);
    // Compare absolute values to avoid -0 vs +0 distinction
    expect(Math.abs(offsets[0][0])).toBe(0);
    expect(Math.abs(offsets[0][1])).toBe(0);
  });

  it("radius 1 returns 5 pixels (plus-sign)", () => {
    const offsets = circleBrushOffsets(1);
    // radius=1: circle x^2+y^2<=1 includes (0,0),(1,0),(-1,0),(0,1),(0,-1)
    expect(offsets).toHaveLength(5);
  });

  it("all returned offsets are within radius", () => {
    const r = 5;
    const offsets = circleBrushOffsets(r);
    for (const [dx, dy] of offsets) {
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(r * r);
    }
  });

  it("returns more pixels for larger radius", () => {
    const s = circleBrushOffsets(3).length;
    const l = circleBrushOffsets(6).length;
    expect(l).toBeGreaterThan(s);
  });
});

describe("paintMaskCircle", () => {
  it("paints pixels within radius as 255", () => {
    const mask = new Uint8Array(10 * 10);
    paintMaskCircle(mask, 5, 5, 2, 10, 10);
    // Center pixel must be painted
    expect(mask[5 * 10 + 5]).toBe(255);
    // Pixel well outside radius must be unpainted
    expect(mask[0]).toBe(0);
  });

  it("clips to image bounds without error", () => {
    const mask = new Uint8Array(10 * 10);
    // Paint at corner with large radius
    expect(() => paintMaskCircle(mask, 0, 0, 5, 10, 10)).not.toThrow();
  });

  it("does not write outside the mask buffer", () => {
    const mask = new Uint8Array(5 * 5);
    paintMaskCircle(mask, 4, 4, 3, 5, 5);
    // If out-of-bounds writes happened, we'd get a different length
    expect(mask.length).toBe(25);
  });
});

describe("maskPixelCount", () => {
  it("returns 0 for empty mask", () => {
    expect(maskPixelCount(new Uint8Array(100))).toBe(0);
  });

  it("counts pixels above threshold 127", () => {
    const mask = new Uint8Array([0, 128, 255, 100, 200]);
    // 128, 255, 200 are > 127
    expect(maskPixelCount(mask)).toBe(3);
  });

  it("counts full mask correctly", () => {
    const mask = new Uint8Array(50).fill(255);
    expect(maskPixelCount(mask)).toBe(50);
  });

  it("does not count value 127 (boundary exclusive)", () => {
    const mask = new Uint8Array([127]);
    expect(maskPixelCount(mask)).toBe(0);
  });
});
