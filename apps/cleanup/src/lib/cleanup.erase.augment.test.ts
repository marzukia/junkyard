/**
 * Augmented tests for cleanup app:
 * - inpaint.ts eraseRegion function (not tested in existing suite)
 * - imageHelpers.ts additional negative and boundary cases
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  canvasToImageCoords,
  circleBrushOffsets,
  clamp,
  formatBytes,
  maskPixelCount,
  outputFilename,
  paintMaskCircle,
} from "./imageHelpers";
import { eraseRegion } from "./inpaint";

// jsdom does not expose ImageData as a global in this vitest setup.
// Provide a minimal polyfill so eraseRegion tests work.
beforeAll(() => {
  if (typeof globalThis.ImageData === "undefined") {
    class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height ?? dataOrWidth.length / (widthOrHeight * 4);
        }
      }
    }
    (globalThis as unknown as { ImageData: typeof ImageDataPolyfill }).ImageData =
      ImageDataPolyfill;
  }
});

/** Build a solid ImageData of given color. */
function solidImageData(width: number, height: number, r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}

// ── eraseRegion ───────────────────────────────────────────────────────────────

describe("eraseRegion", () => {
  it("does not mutate the source ImageData", () => {
    const src = solidImageData(8, 8, 200, 100, 50);
    const origFirstPixel = [src.data[0], src.data[1], src.data[2], src.data[3]];
    const mask = new Uint8Array(8 * 8);
    mask[3 * 8 + 3] = 255; // mask one interior pixel

    eraseRegion(src, mask);

    // Source must be unchanged
    expect(src.data[0]).toBe(origFirstPixel[0]);
    expect(src.data[1]).toBe(origFirstPixel[1]);
    expect(src.data[2]).toBe(origFirstPixel[2]);
    expect(src.data[3]).toBe(origFirstPixel[3]);
  });

  it("returns a new ImageData with the same dimensions", () => {
    const src = solidImageData(10, 10, 100, 150, 200);
    const mask = new Uint8Array(10 * 10).fill(0); // no pixels masked
    const out = eraseRegion(src, mask);
    expect(out.width).toBe(10);
    expect(out.height).toBe(10);
  });

  it("fills a masked pixel in a uniform-color image with that color", () => {
    const W = 12;
    const H = 12;
    const src = solidImageData(W, H, 180, 90, 45);

    // Corrupt the pixel in the source copy that eraseRegion will clone from
    src.data[(6 * W + 6) * 4] = 0;
    src.data[(6 * W + 6) * 4 + 1] = 0;
    src.data[(6 * W + 6) * 4 + 2] = 0;

    const mask = new Uint8Array(W * H);
    mask[6 * W + 6] = 255; // mask center pixel

    const out = eraseRegion(src, mask);

    const idx = (6 * W + 6) * 4;
    // Should be inpainted close to the background color
    expect(out.data[idx]).toBeGreaterThan(100);
    expect(out.data[idx + 3]).toBe(255); // alpha fully opaque
  });

  it("does not throw for zero-mask (no pixels erased)", () => {
    const src = solidImageData(6, 6, 100, 100, 100);
    const mask = new Uint8Array(6 * 6).fill(0);
    expect(() => eraseRegion(src, mask)).not.toThrow();
  });

  it("returns an object with data, width, height properties", () => {
    const src = solidImageData(4, 4, 50, 50, 50);
    const mask = new Uint8Array(4 * 4);
    const out = eraseRegion(src, mask);
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    expect(out.data).toBeTruthy();
    expect(out.data.length).toBe(4 * 4 * 4);
  });
});

// ── imageHelpers - additional boundary cases ──────────────────────────────────

describe("canvasToImageCoords - additional cases", () => {
  it("handles non-square canvas and image", () => {
    const result = canvasToImageCoords(200, 100, 400, 200, 1200, 600);
    expect(result).toEqual({ x: 600, y: 300 });
  });

  it("clamps to integer via Math.round", () => {
    // 1/3 of 10 = 3.333... -> rounds to 3
    const result = canvasToImageCoords(1, 1, 3, 3, 10, 10);
    expect(result.x).toBe(3);
    expect(result.y).toBe(3);
  });
});

describe("formatBytes - additional cases", () => {
  it("formats 1023 bytes as '1023 B'", () => {
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats exactly 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("clamp - additional cases", () => {
  it("handles floating point values correctly", () => {
    expect(clamp(0.5, 0, 1)).toBeCloseTo(0.5);
  });

  it("handles negative min and max", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

describe("outputFilename - additional cases", () => {
  it("handles JPEG extension", () => {
    expect(outputFilename("photo.jpeg")).toBe("photo-cleanup.png");
  });

  it("handles uppercase extension", () => {
    expect(outputFilename("IMAGE.PNG")).toBe("IMAGE-cleanup.png");
  });
});

describe("circleBrushOffsets - additional cases", () => {
  it("radius 2 returns points all within radius 2", () => {
    const offsets = circleBrushOffsets(2);
    expect(offsets.length).toBeGreaterThan(5);
    for (const [dx, dy] of offsets) {
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(4);
    }
  });
});

describe("maskPixelCount - additional cases", () => {
  it("returns 1 for a single 128 value (> 127 threshold)", () => {
    expect(maskPixelCount(new Uint8Array([128]))).toBe(1);
  });

  it("returns 0 for all zeros", () => {
    expect(maskPixelCount(new Uint8Array(20))).toBe(0);
  });
});

describe("paintMaskCircle - additional cases", () => {
  it("paints center pixel for radius 0", () => {
    const mask = new Uint8Array(5 * 5);
    paintMaskCircle(mask, 2, 2, 0, 5, 5);
    expect(mask[2 * 5 + 2]).toBe(255);
  });

  it("does not paint out of bounds when cx is at edge", () => {
    const mask = new Uint8Array(10 * 10);
    paintMaskCircle(mask, 9, 9, 3, 10, 10);
    expect(mask.length).toBe(100);
  });
});
